/**
 * EVOLUTION_PARAMS (plan §3.3): frozen. Golden tests fail if a tuning change breaks a persona.
 * The two decay constants are literal numbers, never computed at runtime (no Math.pow).
 */
import type { BehaviourMode, DomainId } from "../../types";

export const EVOLUTION_PARAMS = Object.freeze({
  /** Domain evidence decay per meaningful event: half-life 12 (2^(-1/12)). */
  LAMBDA_S: 0.9438743126816935,
  /** Behaviour-trait decay per meaningful event: half-life 10 (2^(-1/10)). */
  LAMBDA_B: 0.9330329915368074,
  /** Evidence half-saturation: ev = T / (T + K_EV). */
  K_EV: 4,
  /** Share lead that counts as complete dominance. */
  LEAD_SCALE: 0.6,
  /** Tier entry and stay-while confidence, index = tier (0 unused). */
  ENTER: Object.freeze([0, 0.4, 0.6, 0.8] as const),
  EXIT: Object.freeze([0, 0.25, 0.4, 0.6] as const),
  /** Domain events within WINDOW, index = tier (0 unused). */
  GATE_N: Object.freeze([0, 4, 6, 9] as const),
  /**
   * Distinct event types in the domain within WINDOW. One is enough: a person who opens six job
   * pages has told us as much as one who also searched, and a job page emits a single event type.
   * Dominance (LEAD_SCALE) and the confirmations below are what stop a fluke, not the type count.
   */
  GATE_TYPES: 1,
  /**
   * Nothing is evaluated before this many meaningful actions. With CONFIRM_UP the first visible
   * change lands on action MIN_TOTAL + 1: a focused guest sees the homepage lead with their domain
   * after 5 actions, the navigation after 8 (DWELL), and a single click or mixed browsing never.
   */
  MIN_TOTAL: 4,
  /** Sessions (including the current one) that used the domain, for tier 3. */
  VH_SESSIONS: 2,
  /** Last N meaningful events for gates, eligibility and facts. */
  WINDOW: 20,
  CONFIRM_UP: 2,
  CONFIRM_DOWN: 3,
  /** Meaningful events between visible changes. */
  DWELL: 3,
  /** Events before returning to the arrangement shown before the last change. */
  REVERSAL_LOCK: 20,
  /** Visible organic changes per session. */
  SESSION_BUDGET: 6,
  /** A ready tier-up may wait this many events for a pending mode so both land as one change. */
  MODE_WAIT: 2,
  MODE_ENTER: 0.45,
  MODE_EXIT: 0.25,
  MODE_SWITCH: 0.12,
  MODE_TIE: 0.08,
  MODE_MIN_TOTAL: 6,
  MODE_CONFIRM_ENTER: 2,
  MODE_CONFIRM_CHANGE: 3,
  K_RES: 3,
  K_REP: 3,
  K_QUICK: 2,
  K_EXPL: 4,
  /** *_FOCUSED: commit evidence half-saturation and weight per commit-type event. */
  K_FOC: 3,
  FOC_UNIT: 2,
  FOCUSED_MIN_COMMITS: 2,
  REPEAT_MIN_SIGNALS: 2,
  TRAIT_MIN_EVENTS: 2,
  /** Affinity multiplier for gestures on evolution-created surfaces (`via: adaptive`). */
  ADAPTIVE_DISCOUNT: 0.75,
  QUICK_MAX_GAP_MS: 90_000,
  /** Undo vetoes the undone arrangement for 20 events AND the rest of the session. */
  UNDO_VETO_EVENTS: 20,
  /** Advice older than this many meaningful events is dropped. */
  AI_MAX_AGE_EVENTS: 15,
  /** Stale decay: 6 extra decay steps per 14 idle days (a loop, capped). */
  STALE_AFTER_MS: 1_209_600_000,
  STALE_STEPS: 6,
  STALE_MAX_STEPS: 60,
  // caps
  VETO_CAP: 5,
  SESSIONS_CAP: 20,
  SEEN_CAP: 100,
  RECENT_CAP: 12,
  MINIMAL_SESSIONS: 5,
  MINIMAL_DECAY: 0.7,
  MINIMAL_LEAN_M: 0.75,
  MINIMAL_LEAN_SESSIONS: 2,
  /** EXPLORER eligibility: this many distinct domains in the window. */
  EXPLORER_MIN_DOMAINS: 3,
  /** Entities viewed in a domain within a session before the breadth bonus applies. */
  BREADTH_AFTER: 3,
});

export type EvolutionParams = typeof EVOLUTION_PARAMS;

export type Trait = Exclude<BehaviourMode, "BALANCED">;

/** Among mode candidates within MODE_TIE of the max, the first in this order wins. */
export const MODE_PRECEDENCE: readonly Trait[] = Object.freeze([
  "REPEAT",
  "CAREER_FOCUSED",
  "LEARNING_FOCUSED",
  "SKILL_FOCUSED",
  "RESEARCH",
  "QUICK",
  "MINIMAL",
  "EXPLORER",
] as const);

/** The focused mode a domain can earn (COMMUNITY has none). */
export const FOCUSED_MODE: Readonly<Partial<Record<DomainId, Trait>>> = Object.freeze({
  LEARNING: "LEARNING_FOCUSED",
  CAREER: "CAREER_FOCUSED",
  SKILL_EXCHANGE: "SKILL_FOCUSED",
});

/** Modes a primary can carry, mirroring validator R4 (UNIVERSAL: QUICK/MINIMAL, EXPLORER state: EXPLORER). */
export function allowedModes(P: DomainId | null): readonly Trait[] {
  if (P === null) return ["QUICK", "MINIMAL", "EXPLORER"];
  const f = FOCUSED_MODE[P];
  return f
    ? ["REPEAT", f, "RESEARCH", "QUICK", "MINIMAL"]
    : ["REPEAT", "RESEARCH", "QUICK", "MINIMAL"];
}
