/**
 * The plan chooser: who gets which plan, the validator for an AI answer, and the deterministic fallback.
 *
 *  - The PLAN is a lookup on the declared profile type (`planForType`). Nothing here, and nothing the AI
 *    returns, can change it or the price.
 *  - The AI (or the rules) only orders the plan's own benefits and picks a headline, an accent and a reason
 *    from fixed lists. `validateChoice` runs on the server and again on the client; any failure means the
 *    caller uses `fallbackChoice`, never a partial result.
 *
 * Pure: no react, no DOM, no clock, no randomness. Same input, same output, every run.
 */
import type { BehaviourScores, DomainId } from "../../evolution/types";
import { DOMAIN_IDS } from "../../evolution/config/ids";
import type { ProfileType } from "../../lib/profile-type";
import {
  ACCENT_IDS,
  BENEFIT_BY_ID,
  HEADLINES,
  HEADLINE_IDS,
  LIVE_TOP,
  MAX_BENEFITS,
  MIN_BENEFITS,
  PLANS,
  PLAN_BY_TYPE,
  REASONS,
  REASON_KEYS,
  type AccentId,
  type Benefit,
  type BenefitId,
  type HeadlineId,
  type Plan,
  type ReasonKey,
} from "../config/plans";
import {
  CHOICE_KEYS,
  type ChoiceCheck,
  type ChoiceField,
  type ChooserInput,
  type PlanChoice,
} from "./types";

/* ── who gets which plan ─────────────────────────────────────────── */

const TYPES: ReadonlySet<string> = new Set(PLANS.map((p) => p.profileType));

export const isPlanProfileType = (v: unknown): v is ProfileType =>
  typeof v === "string" && TYPES.has(v);

/** The one plan for a declared profile type. A guest or unknown type gets none: no plan, no price. */
export function planForType(type: ProfileType | null | undefined): Plan | null {
  return type && isPlanProfileType(type) ? PLAN_BY_TYPE[type] : null;
}

/**
 * The kill switch (`VITE_MEMBERSHIP_AI`, read by the server and the client alike). Unset or an explicit
 * "on" means the AI may be asked; anything else (off, 0, false, a typo) fails closed to the rules.
 */
export function isAiEnabled(raw: string | null | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return !v || v === "on" || v === "live" || v === "true" || v === "1";
}

/* ── input ───────────────────────────────────────────────────────── */

/** One decimal, clamped to 0..1; a non-number is 0. Coarse on purpose: it is all the AI is told. */
export const roundDomain = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.round(Math.min(1, Math.max(0, n)) * 10) / 10
    : 0;

export function buildChooserInput(
  profileType: ProfileType,
  engine: {
    state: ChooserInput["state"];
    mode: ChooserInput["mode"];
    tier: ChooserInput["tier"];
    scores: Pick<
      BehaviourScores,
      "learningAffinity" | "careerAffinity" | "skillExchangeAffinity" | "communityAffinity"
    >;
  },
): ChooserInput {
  return {
    profileType,
    state: engine.state,
    mode: engine.mode,
    tier: engine.tier,
    domains: {
      LEARNING: roundDomain(engine.scores.learningAffinity),
      CAREER: roundDomain(engine.scores.careerAffinity),
      SKILL_EXCHANGE: roundDomain(engine.scores.skillExchangeAffinity),
      COMMUNITY: roundDomain(engine.scores.communityAffinity),
    },
  };
}

/** The local cache key (docs §2): one cached choice per (profileType, state, mode). */
export const cacheKeyOf = (i: Pick<ChooserInput, "profileType" | "state" | "mode">): string =>
  `${i.profileType}|${i.state}|${i.mode}`;

/** The server LRU key: the whole request, so two identical requests cost one model call. */
export const inputKeyOf = (i: ChooserInput): string =>
  `${cacheKeyOf(i)}|${i.tier}|${DOMAIN_IDS.map((d) => i.domains[d].toFixed(1)).join(",")}`;

/* ── validation ──────────────────────────────────────────────────── */

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const bad = (field: ChoiceField, error: string): ChoiceCheck => ({ ok: false, field, error });

/**
 * Strict check of a candidate against the plan for `profileType`. Exactly five keys; planId must equal the
 * deterministic plan; 3 to 6 unique benefit ids from that plan; the first three live; the rest from fixed lists.
 */
export function validateChoice(
  raw: unknown,
  profileType: ProfileType | null | undefined,
): ChoiceCheck {
  const plan = planForType(profileType);
  if (!plan) return bad("planId", "no plan for this profile type");
  if (!isPlain(raw)) return bad("shape", "not an object");
  const keys = Object.keys(raw);
  if (keys.length !== CHOICE_KEYS.length || !CHOICE_KEYS.every((k) => k in raw))
    return bad("shape", "wrong keys");

  if (raw["planId"] !== plan.id) return bad("planId", "not the plan for this role");

  const order = raw["benefitOrder"];
  if (!Array.isArray(order)) return bad("benefitOrder", "not a list");
  if (order.length < MIN_BENEFITS || order.length > MAX_BENEFITS)
    return bad("benefitOrder", "wrong length");
  const allowed: ReadonlySet<string> = new Set(plan.benefitIds);
  const seen = new Set<string>();
  for (const id of order) {
    if (typeof id !== "string" || !allowed.has(id)) return bad("benefitOrder", "unknown benefit");
    if (seen.has(id)) return bad("benefitOrder", "duplicate benefit");
    seen.add(id);
  }
  for (const id of order.slice(0, LIVE_TOP)) {
    if (BENEFIT_BY_ID[id as BenefitId].availability !== "live")
      return bad("benefitOrder", "a preview benefit in the top three");
  }

  const headlineId = raw["headlineId"];
  if (typeof headlineId !== "string" || !(HEADLINE_IDS as readonly string[]).includes(headlineId))
    return bad("headlineId", "unknown headline");
  const accentId = raw["accentId"];
  if (typeof accentId !== "string" || !(ACCENT_IDS as readonly string[]).includes(accentId))
    return bad("accentId", "unknown accent");
  const reasonKey = raw["reasonKey"];
  if (typeof reasonKey !== "string" || !(REASON_KEYS as readonly string[]).includes(reasonKey))
    return bad("reasonKey", "unknown reason");

  return {
    ok: true,
    value: {
      planId: plan.id,
      benefitOrder: [...(order as BenefitId[])],
      headlineId: headlineId as HeadlineId,
      accentId: accentId as AccentId,
      reasonKey: reasonKey as ReasonKey,
    },
  };
}

/* ── the deterministic fallback ──────────────────────────────────── */

const DOMAIN_OF_STATE: Partial<Record<ChooserInput["state"], DomainId>> = {
  LEARNING_FIRST: "LEARNING",
  CAREER_FIRST: "CAREER",
  SKILL_EXCHANGE_FIRST: "SKILL_EXCHANGE",
  COMMUNITY_FIRST: "COMMUNITY",
};

const HEADLINE_OF_DOMAIN: Record<DomainId, readonly [HeadlineId, HeadlineId]> = {
  LEARNING: ["H_LEARNING_1", "H_LEARNING_2"],
  CAREER: ["H_CAREER_1", "H_CAREER_2"],
  SKILL_EXCHANGE: ["H_SKILL_1", "H_SKILL_2"],
  COMMUNITY: ["H_COMMUNITY_1", "H_COMMUNITY_2"],
};
const ACCENT_OF_DOMAIN: Record<DomainId, AccentId> = {
  LEARNING: "INDIGO",
  CAREER: "PEACOCK",
  SKILL_EXCHANGE: "RANI",
  COMMUNITY: "MARIGOLD",
};
const REASON_OF_DOMAIN: Record<DomainId, ReasonKey> = {
  LEARNING: "R_LEARNING_ACTIVITY",
  CAREER: "R_CAREER_ACTIVITY",
  SKILL_EXCHANGE: "R_SKILL_EXCHANGE_ACTIVITY",
  COMMUNITY: "R_COMMUNITY_ACTIVITY",
};

const FOCUSED_MODES: ReadonlySet<string> = new Set([
  "CAREER_FOCUSED",
  "LEARNING_FOCUSED",
  "SKILL_FOCUSED",
]);

/** First three live ids (in the given order), then everything else in the given order. */
function liveFirst(ids: readonly BenefitId[]): BenefitId[] {
  const head: BenefitId[] = [];
  for (const id of ids) {
    if (head.length < LIVE_TOP && BENEFIT_BY_ID[id].availability === "live") head.push(id);
  }
  return [...head, ...ids.filter((id) => !head.includes(id))];
}

/**
 * Same shape as an AI answer, no network. score = benefit.weight x the benefit's domain affinity; ties keep
 * the plan's canonical order. Nothing learned yet (tier 0, UNIVERSAL, EXPLORER) keeps the canonical order.
 * QUICK and MINIMAL modes get the short list of three. Also what runs when VITE_MEMBERSHIP_AI=off.
 */
export function fallbackChoice(input: ChooserInput): PlanChoice {
  const plan = planForType(input.profileType);
  if (!plan) throw new Error("fallbackChoice needs a profile type that has a plan");

  const stateDomain = DOMAIN_OF_STATE[input.state];
  const blind = input.tier === 0 || input.state === "UNIVERSAL" || input.state === "EXPLORER";
  const short = input.mode === "QUICK" || input.mode === "MINIMAL";

  const scored = plan.benefitIds.map((id, i) => {
    const b = BENEFIT_BY_ID[id];
    return { id, i, score: blind ? 0 : b.weight * (input.domains[b.domain] ?? 0) };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const ordered = liveFirst(scored.map((s) => s.id));
  const benefitOrder = ordered.slice(0, short ? MIN_BENEFITS : MAX_BENEFITS);

  // The dominant domain: the state's own, else the strongest affinity (canonical order breaks ties).
  let dominant: DomainId | null = blind ? null : (stateDomain ?? null);
  if (!blind && !dominant) {
    let best = 0;
    for (const d of DOMAIN_IDS) {
      if ((input.domains[d] ?? 0) > best) {
        best = input.domains[d];
        dominant = d;
      }
    }
  }

  let headlineId: HeadlineId;
  if (short) headlineId = "H_QUICK_1";
  else if (dominant)
    headlineId = HEADLINE_OF_DOMAIN[dominant][FOCUSED_MODES.has(input.mode) ? 1 : 0];
  else if (FOCUSED_MODES.has(input.mode)) headlineId = "H_FOCUS_1";
  else headlineId = input.state === "EXPLORER" ? "H_BALANCED_2" : "H_BALANCED_1";

  let reasonKey: ReasonKey;
  if (short) reasonKey = "R_QUICK";
  else if (dominant) reasonKey = REASON_OF_DOMAIN[dominant];
  else reasonKey = input.state === "EXPLORER" ? "R_BALANCED" : "R_ROLE_DEFAULT";

  return {
    planId: plan.id,
    benefitOrder,
    headlineId,
    accentId: dominant ? ACCENT_OF_DOMAIN[dominant] : "MARIGOLD",
    reasonKey,
  };
}

/* ── resolving a choice for display ──────────────────────────────── */

export interface ResolvedChoice {
  benefits: Benefit[];
  headline: string;
  reason: string;
}

/** Ids to records and text. English source strings: the UI renders them through tx(). */
export function resolveChoice(choice: PlanChoice): ResolvedChoice {
  return {
    benefits: choice.benefitOrder.map((id) => BENEFIT_BY_ID[id]),
    headline: HEADLINES[choice.headlineId],
    reason: REASONS[choice.reasonKey],
  };
}
