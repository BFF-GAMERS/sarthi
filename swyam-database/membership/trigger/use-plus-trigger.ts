/**
 * The runtime half of the Plus trigger: gathers what trigger.ts needs, taps the evolution events for
 * meaningful moments, and opens the sheet when every rule agrees.
 *
 * Read-only toward the engine. It subscribes to the runtime's public store and diffs `getEvents()` by
 * sequence number; it never calls track(), never writes into the engine and never touches the frozen
 * tracker files. Mounted once, by PlusHost in the deferred overlays chunk.
 *
 * It only ever runs checks. If this hook says no (or never mounts), Plus is still one tap away in
 * Settings. The schedule (snooze, lifetime cap, "don't show again") lives in Plus's own local state.
 */
import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { getRuntime, onRuntimeSwap } from "@/evolution/state/commands";
import { useProfileType } from "@/lib/profile-type";
import { getSupabase } from "@/lib/supabase";
import { recordPlusEvent, usePlusState } from "@/membership";
import { noteRole } from "@/membership/state/storage";
import { getPlusOpen, openPlus, PLUS_MOMENT_EVENT, subscribePlusOpen } from "./plus-open-store";
import { useIsMinor } from "./use-is-minor";
import {
  evaluateTrigger,
  memoryFromPlusState,
  momentFromEvent,
  PLUS_MOMENTS,
  type PlusMoment,
  type TriggerInput,
} from "./trigger";

/** How often a pending moment is re-checked while it waits for a quiet screen. */
const POLL_MS = 2_000;
/** Typing means a key in the last few seconds, or focus sitting in a text field. */
const TYPING_MS = 4_000;
/** An event older than this is history, never a fresh moment. */
const FRESH_MS = 15_000;

/** One automatic appearance per page session, even if the host remounts. */
let shownThisSession = false;

function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "range", "file", "color"].includes(el.type);
  }
  return false;
}

/** Another dialog, the tour or the adaptation notice is up: queue behind it. */
function overlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.querySelector(
      '[role="dialog"][aria-modal="true"]:not([data-plus-sheet]), .evo-notice, [data-plus-block]',
    ) !== null
  );
}

export function usePlusTrigger(): void {
  const { user, profileId, ready } = useAuth();
  const profileType = useProfileType(user?.email, user?.role, profileId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMinor = useIsMinor(profileId);
  const plus = usePlusState();
  const [signupAt, setSignupAt] = useState<number | null>(null);

  // Everything the check needs, in a ref so the effects below never re-subscribe on a render.
  const latest = useRef({ signedIn: false, profileType, pathname, isMinor, signupAt, plus });
  latest.current = {
    signedIn: Boolean(user && ready),
    profileType,
    pathname,
    isMinor,
    signupAt,
    plus,
  };

  const moment = useRef<{ id: PlusMoment; at: number } | null>(null);
  const typingAt = useRef(0);
  const eligibleSent = useRef(false);
  const checkRef = useRef<() => void>(() => {});

  // The account's own creation date, from the stored session (no network). Else first-seen stands in.
  useEffect(() => {
    setSignupAt(null);
    if (!profileId) return;
    let live = true;
    try {
      void getSupabase()
        ?.auth.getSession()
        .then(({ data }) => {
          const t = Date.parse(data.session?.user?.created_at ?? "");
          if (live && Number.isFinite(t)) setSignupAt(t);
        })
        .catch(() => {});
    } catch {
      /* the date stays unknown; first-seen covers it */
    }
    return () => {
      live = false;
    };
  }, [profileId]);

  // Stamps first-seen and applies a role change to the snooze, even when no Plus screen is mounted.
  const scope = plus.scope;
  useEffect(() => {
    if (profileType && !scope.startsWith("lab_") && !scope.startsWith("preview_")) {
      noteRole(scope, profileType, Date.now());
    }
    eligibleSent.current = false;
    moment.current = null;
  }, [scope, profileType]);

  // The check itself.
  useEffect(() => {
    const check = () => {
      if (typeof document === "undefined" || document.visibilityState === "hidden") return;
      if (getPlusOpen().open) return;
      const l = latest.current;
      if (!l.signedIn) return;
      const rt = getRuntime();
      const snap = rt.getSnapshot();
      if (!snap.hydrated) return;
      const now = Date.now();
      if (moment.current && now - moment.current.at > 120_000) moment.current = null;
      const lastChange = snap.history[snap.history.length - 1];
      const input: TriggerInput = {
        now,
        signedIn: l.signedIn,
        profileType: l.profileType,
        isMinor: l.isMinor,
        signupAt: l.signupAt,
        sandbox: snap.scope.startsWith("lab_") || snap.scope.startsWith("preview_"),
        tier: snap.tier,
        state: snap.ui.state,
        sessionCount: snap.profile.sessionCount,
        moment: moment.current,
        pathname: l.pathname,
        lastTransitionAt: lastChange ? lastChange.at : null,
        typing: now - typingAt.current < TYPING_MS || isTextField(document.activeElement),
        overlayOpen: overlayOpen(),
        shownThisSession,
        memory: memoryFromPlusState(l.plus.state, now),
      };
      const d = evaluateTrigger(input);
      if (!d.show || !d.moment) return;
      if (!eligibleSent.current) {
        eligibleSent.current = true;
        recordPlusEvent("plus_eligible", { moment: d.moment });
      }
      moment.current = null;
      shownThisSession = true;
      l.plus.markShown();
      openPlus({ source: "trigger", moment: d.moment });
    };
    checkRef.current = check;

    // Meaningful moments: a read-only diff of the engine's own event log.
    let lastSeq = -1;
    let unsubRt = () => {};
    const attach = () => {
      unsubRt();
      const rt = getRuntime();
      lastSeq = rt.getEvents().reduce((m, e) => Math.max(m, e.seq), -1);
      unsubRt = rt.subscribe(() => {
        const events = rt.getEvents();
        const snap = rt.getSnapshot();
        const top = events[events.length - 1];
        // Until the stored log has loaded, everything in it is history, not a moment.
        if (!snap.hydrated) {
          if (top && top.seq > lastSeq) lastSeq = top.seq;
          return;
        }
        const counts = snap.profile.countsByType as Record<string, number>;
        const now = Date.now();
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i]!;
          if (e.seq <= lastSeq) break;
          // Only what happened a moment ago can be "just happened".
          if (now - e.timestamp > FRESH_MS) continue;
          const m = momentFromEvent(e, counts);
          if (m) {
            moment.current = { id: m, at: now };
            break; // newest first: the latest moment wins
          }
        }
        if (top && top.seq > lastSeq) lastSeq = top.seq;
        check();
      });
    };
    attach();
    const unsubSwap = onRuntimeSwap(() => {
      moment.current = null;
      attach();
    });

    // Moments the event log does not carry (the Coach's real daily cap).
    const onSignal = (e: Event) => {
      const m = (e as CustomEvent<{ moment?: string }>).detail?.moment ?? "";
      if ((PLUS_MOMENTS as readonly string[]).includes(m)) {
        moment.current = { id: m as PlusMoment, at: Date.now() };
        check();
      }
    };
    const onKey = () => {
      typingAt.current = Date.now();
    };
    window.addEventListener(PLUS_MOMENT_EVENT, onSignal);
    document.addEventListener("keydown", onKey, { passive: true, capture: true });
    const unsubOpen = subscribePlusOpen(() => {
      if (!getPlusOpen().open) check();
    });
    const timer = window.setInterval(() => {
      if (moment.current) check();
    }, POLL_MS);

    return () => {
      checkRef.current = () => {};
      unsubRt();
      unsubSwap();
      unsubOpen();
      window.removeEventListener(PLUS_MOMENT_EVENT, onSignal);
      document.removeEventListener("keydown", onKey, true);
      window.clearInterval(timer);
    };
  }, []);

  // A new page, a resolved age or a fresh signup date can end a quiet window.
  useEffect(() => {
    checkRef.current();
  }, [pathname, isMinor, signupAt, profileType, plus.state]);
}
