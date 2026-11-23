/**
 * React hooks for Swayam Plus. `useMembership` renders the rules fallback on the very first paint and swaps
 * the order only if a cached or fresh AI choice arrives later; it never blocks on the network, and with no
 * profile type (a guest) it returns no plan at all. The engine is only read, never written.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "../../context/AuthContext";
import { useEvolutionSnapshot } from "../../evolution/react/hooks";
import { useProfileType } from "../../lib/profile-type";
import type { PlusDismissKind } from "../config/events";
import type { AccentId, Benefit, HeadlineId, Plan, ReasonKey } from "../config/plans";
import {
  buildChooserInput,
  cacheKeyOf,
  fallbackChoice,
  inputKeyOf,
  planForType,
  resolveChoice,
} from "../core/chooser";
import {
  DEFAULT_PLUS_STATE,
  type ChoiceSource,
  type ChooserInput,
  type PlanChoice,
  type PlusState,
} from "../core/types";
import { clientAiEnabled, requestChoice, type ChoiceRequestResult } from "./client";
import { recordPlusEvent } from "./events";
import {
  aiCallAllowed,
  getCachedChoice,
  markAiCall,
  noteRole,
  plusSnapshot,
  putCachedChoice,
  recordDismiss,
  recordInterest,
  recordShown,
  subscribe,
  updatePlus,
} from "./storage";

/* ── usePlusState ────────────────────────────────────────────────── */

export interface PlusStateApi {
  state: PlusState;
  scope: string;
  update: (fn: (s: PlusState) => PlusState) => void;
  /** The sheet opened: counts toward the lifetime cap. */
  markShown: () => void;
  /** The sheet closed without taking the offer: runs the snooze ladder. */
  dismiss: (kind: PlusDismissKind) => void;
  /** The honest CTA choice; stored locally only. */
  setInterest: (interest: "trial_demo" | "notify") => void;
}

export function usePlusState(): PlusStateApi {
  const { scope } = useEvolutionSnapshot();
  const state = useSyncExternalStore(
    subscribe,
    () => plusSnapshot(scope),
    () => DEFAULT_PLUS_STATE as PlusState,
  );
  const update = useCallback(
    (fn: (s: PlusState) => PlusState) => void updatePlus(scope, fn),
    [scope],
  );
  const markShown = useCallback(() => void recordShown(scope, Date.now()), [scope]);
  const dismiss = useCallback(
    (kind: PlusDismissKind) => void recordDismiss(scope, kind, Date.now()),
    [scope],
  );
  const setInterest = useCallback(
    (i: "trial_demo" | "notify") => void recordInterest(scope, i),
    [scope],
  );
  return { state, scope, update, markShown, dismiss, setInterest };
}

/* ── useMembership ───────────────────────────────────────────────── */

export interface Membership {
  /** The one plan for the declared profile type; null for a guest or an unknown type (no price shown). */
  plan: Plan | null;
  /** Ordered, resolved benefit records (3 to 6, first three live). Empty with no plan. */
  benefits: Benefit[];
  /** English source strings for tx(); null with no plan. */
  headline: string | null;
  headlineId: HeadlineId | null;
  accent: AccentId | null;
  reason: string | null;
  reasonKey: ReasonKey | null;
  source: ChoiceSource;
  /** The same ids, for the validator and the Lab. */
  choice: PlanChoice | null;
  /** The evolution scope the memory is stored under. */
  scope: string;
  /** True once the store has hydrated and the cache lookup is done; never waits for the network. */
  ready: boolean;
}

/** One request per (scope, input) at a time, even across StrictMode's double effect or two mounted cards. */
const inflight = new Map<string, Promise<ChoiceRequestResult>>();

function shouldAskAi(input: ChooserInput, scope: string, now: number): boolean {
  return (
    clientAiEnabled() &&
    input.tier >= 1 &&
    input.state !== "UNIVERSAL" &&
    input.state !== "EXPLORER" &&
    !scope.startsWith("preview_") &&
    !(typeof navigator !== "undefined" && navigator.onLine === false) &&
    aiCallAllowed(scope, now)
  );
}

const EMPTY: Omit<Membership, "scope" | "ready"> = {
  plan: null,
  benefits: [],
  headline: null,
  headlineId: null,
  accent: null,
  reason: null,
  reasonKey: null,
  source: "rules",
  choice: null,
};

export function useMembership(): Membership {
  const { user, profileId } = useAuth();
  const type = useProfileType(user?.email ?? "", user?.role ?? "student", profileId);
  const snap = useEvolutionSnapshot();
  const { scope } = snap;

  const plan = planForType(type);
  const fresh =
    plan && type
      ? buildChooserInput(type, {
          state: snap.ui.state,
          mode: snap.ui.mode,
          tier: snap.ui.tier,
          scores: snap.profile.scores,
        })
      : null;
  // The scores move on every event; the rounded input does not, so everything below keys on it.
  const key = fresh ? inputKeyOf(fresh) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo(() => fresh, [key]);
  const rules = useMemo(() => (input ? fallbackChoice(input) : null), [input]);

  const [ai, setAi] = useState<{ key: string; choice: PlanChoice } | null>(null);
  const [checked, setChecked] = useState<string | null>(null);

  useEffect(() => {
    if (!input) {
      setAi(null);
      setChecked(null);
      return;
    }
    const cacheKey = cacheKeyOf(input);
    const now = Date.now();
    noteRole(scope, input.profileType, now);

    const cached = getCachedChoice(scope, input, now);
    setAi(cached ? { key: cacheKey, choice: cached } : null);
    setChecked(`${scope}|${cacheKey}`);
    if (cached || !shouldAskAi(input, scope, now)) return;

    let alive = true;
    const flightKey = `${scope}|${key}`;
    let flight = inflight.get(flightKey);
    if (!flight) {
      markAiCall(scope, now);
      flight = requestChoice(input).finally(() => inflight.delete(flightKey));
      inflight.set(flightKey, flight);
    }
    void flight.then((res) => {
      if (res.ok) {
        putCachedChoice(scope, input, res.choice, Date.now());
        if (alive) setAi({ key: cacheKey, choice: res.choice });
      } else {
        recordPlusEvent("plus_ai_fallback", { reason: res.reason });
        if (res.field) recordPlusEvent("plus_validation_rejected", { field: res.field });
      }
    });
    return () => {
      alive = false;
    };
    // `key` carries the whole input; `scope` separates accounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scope]);

  const aiChoice = input && ai && ai.key === cacheKeyOf(input) ? ai.choice : null;
  const choice = aiChoice ?? rules;
  const resolved = useMemo(() => (choice ? resolveChoice(choice) : null), [choice]);

  if (!plan || !choice || !resolved) {
    return { ...EMPTY, scope, ready: snap.hydrated };
  }
  return {
    plan,
    benefits: resolved.benefits,
    headline: resolved.headline,
    headlineId: choice.headlineId,
    accent: choice.accentId,
    reason: resolved.reason,
    reasonKey: choice.reasonKey,
    source: aiChoice ? "ai" : "rules",
    choice,
    scope,
    ready: snap.hydrated && checked === `${scope}|${cacheKeyOf(input!)}`,
  };
}
