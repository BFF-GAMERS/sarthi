/**
 * Types shared by the membership core, server and state. Pure: no react, no DOM, no clock.
 */
import type {
  AiFallback,
  BehaviourMode,
  DomainId,
  EvolutionState,
  Tier,
} from "../../evolution/types";
import type { ProfileType } from "../../lib/profile-type";
import type { AccentId, BenefitId, HeadlineId, PlanId, ReasonKey } from "../config/plans";

/**
 * Everything the chooser (rules or AI) may know. No age, no free text, no price, no id.
 * The profile type is the only declared attribute; the rest are engine aggregates.
 */
export interface ChooserInput {
  profileType: ProfileType;
  state: EvolutionState;
  mode: BehaviourMode;
  tier: Tier;
  /** Affinity per domain, 0 to 1, rounded to one decimal. */
  domains: Readonly<Record<DomainId, number>>;
}

/** The only thing the AI (or the rules) may decide: order and presentation, never plan or price. */
export interface PlanChoice {
  planId: PlanId;
  /** 3 to 6 ids from the plan's own list, no duplicates, first three live. */
  benefitOrder: readonly BenefitId[];
  headlineId: HeadlineId;
  accentId: AccentId;
  reasonKey: ReasonKey;
}

export const CHOICE_KEYS = [
  "planId",
  "benefitOrder",
  "headlineId",
  "accentId",
  "reasonKey",
] as const;

export type ChoiceField = "shape" | (typeof CHOICE_KEYS)[number];

export type ChoiceCheck =
  { ok: true; value: PlanChoice } | { ok: false; field: ChoiceField; error: string };

export type ChoiceSource = "ai" | "rules";

/** What the sheet remembers between visits (docs/evolution/subscriptions.md §3, §5). All local. */
export interface PlusState {
  shownCount: number;
  lastShownAt: number | null;
  snoozeUntil: number | null;
  dismissCount: number;
  /** "Don't show again": permanent. */
  never: boolean;
  /** What they chose on the honest CTA screen; null until they chose. */
  interest: "trial_demo" | "notify" | null;
  /** First seen on this device, a conservative stand-in for signup. */
  signupAt?: number;
}

export const DEFAULT_PLUS_STATE: Readonly<PlusState> = Object.freeze({
  shownCount: 0,
  lastShownAt: null,
  snoozeUntil: null,
  dismissCount: 0,
  never: false,
  interest: null,
});

/** What POST /api/membership answers after a well-formed request: always 200, never a model or quota string. */
export type MembershipResponse =
  | { ok: true; source: "ai"; choice: PlanChoice; cached?: true }
  | { ok: false; fallback: AiFallback };
