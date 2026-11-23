/**
 * Swayam Plus events (docs/evolution/subscriptions.md §7). Local-first: they are written to this device
 * (see state/events.ts) and never carry a person's id, age, price or free text. Enum-ish props only.
 *
 * Pure: no react, no DOM, no clock.
 */
import type { PlanId } from "./plans";

export const PLUS_EVENTS = [
  "plus_eligible",
  "plus_shown",
  "plus_dismissed",
  "plus_cta_demo",
  "plus_cta_notify",
  "plus_settings_opened",
  "plus_ai_fallback",
  "plus_validation_rejected",
] as const;
export type PlusEventName = (typeof PLUS_EVENTS)[number];

/** The meaningful moment that opened the sheet (docs §3), or the manual entry points. */
export const PLUS_EVENT_MOMENTS = [
  "course_completed",
  "assessment_completed",
  "cv_review_finished",
  "job_applied",
  "job_saved_3",
  "swap_completed",
  "passport_opened",
  "coach_cap_reached",
  "settings",
  "lab",
] as const;
export type PlusEventMoment = (typeof PLUS_EVENT_MOMENTS)[number];

export const PLUS_DISMISS_KINDS = ["not_now", "never", "backdrop", "esc"] as const;
export type PlusDismissKind = (typeof PLUS_DISMISS_KINDS)[number];

export type PlusSource = "ai" | "rules";

export interface PlusEventProps {
  plus_eligible: { moment?: PlusEventMoment };
  plus_shown: { moment: PlusEventMoment; planId: PlanId; source: PlusSource };
  plus_dismissed: { kind: PlusDismissKind };
  plus_cta_demo: { planId?: PlanId };
  plus_cta_notify: { planId?: PlanId };
  plus_settings_opened: { planId?: PlanId };
  plus_ai_fallback: { reason: string };
  plus_validation_rejected: { field: string };
}

export interface PlusEvent<N extends PlusEventName = PlusEventName> {
  name: N;
  props: PlusEventProps[N];
  /** Epoch ms, stamped by state/events.ts. */
  at: number;
}
