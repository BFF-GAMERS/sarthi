/**
 * When the Swayam Plus sheet may open by itself (docs/evolution/subscriptions.md section 3).
 *
 * Pure: no React, no DOM, no clock of its own. Everything it needs is passed in, so every rule below is
 * a plain test. The rule of thumb behind all of it: the sheet is an invitation, never an interruption.
 * It waits for a good moment, stays away from anything the member is doing, and goes quiet for weeks
 * the moment it is dismissed.
 *
 * Nothing here reads age, gender or any other sensitive trait to decide who to target. Age appears
 * once, as a reason to stay silent: a minor, or a member whose age is not known, is never auto-prompted.
 */
import type { ProfileType } from "@/lib/profile-type";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export const TRIGGER = {
  /** No popup within a day of signing up. */
  SIGNUP_GATE_MS: DAY,
  /** At least this long between two automatic appearances. */
  SPACING_MS: 14 * DAY,
  /** Three automatic appearances in a lifetime, then never again. */
  LIFETIME_MAX: 3,
  /** "Not now" the first time. */
  SNOOZE_FIRST_MS: 14 * DAY,
  /** Any later dismissal. */
  SNOOZE_REPEAT_MS: 60 * DAY,
  /** Quiet after the layout has just changed on its own. */
  TRANSITION_QUIET_MS: MIN,
  /** A meaningful moment counts for this long, then it is stale. */
  MOMENT_WINDOW_MS: 2 * MIN,
  /** Wait this long after a moment so the sheet never lands mid-gesture. */
  MOMENT_SETTLE_MS: 2_500,
  MIN_SESSION: 2,
  MIN_TIER: 1,
} as const;

/* ── moments ───────────────────────────────────────────────────────── */

export const PLUS_MOMENTS = [
  "course_completed",
  "assessment_completed",
  "cv_review_finished",
  "job_applied",
  "job_saved_3",
  "swap_completed",
  "passport_opened",
  "coach_cap_reached",
] as const;
export type PlusMoment = (typeof PLUS_MOMENTS)[number];

export interface MomentInput {
  type: string;
  metadata?: object | null;
}

/**
 * Maps one evolution event to a moment worth pausing on, or null. `counts` is the running total per
 * event type (the engine's own `countsByType`), used only for "the third saved job".
 */
export function momentFromEvent(
  ev: MomentInput,
  counts: Readonly<Partial<Record<string, number>>> = {},
): PlusMoment | null {
  const m = (ev.metadata ?? {}) as Record<string, unknown>;
  switch (ev.type) {
    case "course_completed":
      return "course_completed";
    case "practice_completed":
      return m["surface"] === "assessment" ? "assessment_completed" : null;
    case "career_launcher_opened":
      return m["surface"] === "cv" && m["action"] === "plan_built" ? "cv_review_finished" : null;
    case "job_applied":
      return "job_applied";
    case "job_saved": {
      const n = counts["job_saved"] ?? 0;
      return n >= 3 && n % 3 === 0 ? "job_saved_3" : null;
    }
    case "skill_swap_requested":
      return "swap_completed";
    case "skill_passport_opened":
      return m["self"] === false ? null : "passport_opened";
    default:
      return null;
  }
}

/* ── routes ────────────────────────────────────────────────────────── */

/** Pages where the sheet never opens by itself: sign-in, settings, the lab, legal, the lesson player, checkout. */
const BLOCKED_PREFIXES = [
  "/auth",
  "/login",
  "/register",
  "/signup",
  "/settings",
  "/lab",
  "/privacy",
  "/terms",
  "/trust",
  "/learn",
  "/assessment",
  "/cart",
  "/messages",
  "/admin",
  "/embed",
  "/verify",
] as const;

export function isBlockedRoute(pathname: string): boolean {
  const p = (pathname.split(/[?#]/)[0] ?? "").toLowerCase().replace(/\/+$/, "") || "/";
  return BLOCKED_PREFIXES.some((b) => p === b || p.startsWith(`${b}/`) || p.startsWith(`${b}.`));
}

/* ── memory ────────────────────────────────────────────────────────── */

/** What the trigger needs to remember. The truth lives in Plus's own local state (membership/state). */
export interface TriggerMemory {
  /** First time this account was seen on this device. Stands in for signup when the account's own date is unknown. */
  firstSeenAt: number;
  shownCount: number;
  lastShownAt: number | null;
  snoozeUntil: number;
  /** "Don't show again": permanent. */
  never: boolean;
  /** They took the trial or asked to be told: no more automatic popups. */
  engaged: boolean;
}

/** The slice of the stored Plus state the trigger reads (structural, so this file stays dependency-free). */
export interface PlusStateLike {
  shownCount: number;
  lastShownAt: number | null;
  snoozeUntil: number | null;
  never: boolean;
  interest: "trial_demo" | "notify" | null;
  signupAt?: number;
}

export function memoryFromPlusState(s: PlusStateLike, now: number): TriggerMemory {
  return {
    firstSeenAt: s.signupAt ?? now,
    shownCount: s.shownCount,
    lastShownAt: s.lastShownAt,
    snoozeUntil: s.snoozeUntil ?? 0,
    never: s.never,
    engaged: s.interest !== null,
  };
}

/* ── the decision ──────────────────────────────────────────────────── */

export type BlockReason =
  | "guest"
  | "no_type"
  | "no_auto_role"
  | "minor"
  | "unknown_age"
  | "sandbox"
  | "too_new"
  | "tier"
  | "universal"
  | "session"
  | "no_moment"
  | "stale_moment"
  | "settling"
  | "route"
  | "transition"
  | "typing"
  | "overlay"
  | "session_cap"
  | "spacing"
  | "lifetime"
  | "snoozed"
  | "never"
  | "engaged";

export interface TriggerInput {
  now: number;
  signedIn: boolean;
  profileType: ProfileType | null;
  /** `profiles.is_minor`; null when it has not been read. Unknown is treated as a minor. */
  isMinor: boolean | null;
  /** The account's own creation time, when known. */
  signupAt: number | null;
  /** True in the Evolution Lab sandbox or a preview iframe. */
  sandbox: boolean;
  tier: number;
  /** Engine state id; "UNIVERSAL" means nothing has been learned yet. */
  state: string;
  sessionCount: number;
  moment: { id: PlusMoment; at: number } | null;
  pathname: string;
  /** When the evolution engine last changed the layout. */
  lastTransitionAt: number | null;
  typing: boolean;
  /** Another dialog, the tour or the adaptation notice is on screen. */
  overlayOpen: boolean;
  shownThisSession: boolean;
  memory: TriggerMemory;
}

export interface TriggerDecision {
  show: boolean;
  /** The first rule that said no; null when the sheet may open. */
  reason: BlockReason | null;
  moment: PlusMoment | null;
}

const AUTO_ROLES: readonly ProfileType[] = ["college", "jobseeker", "professional"];

export function evaluateTrigger(i: TriggerInput): TriggerDecision {
  const no = (reason: BlockReason): TriggerDecision => ({ show: false, reason, moment: null });
  const m = i.memory;

  // Who.
  if (!i.signedIn) return no("guest");
  if (!i.profileType) return no("no_type");
  if (i.sandbox) return no("sandbox");
  if (i.profileType === "recruiter" || i.profileType === "institute") return no("no_auto_role");
  if (i.profileType !== "school" && !AUTO_ROLES.includes(i.profileType)) return no("no_auto_role");
  // School students only count once they are known to be adults; unknown age is treated as a minor.
  if (i.isMinor === null) return no("unknown_age");
  if (i.isMinor) return no("minor");

  // Their own choices come first: a no stays a no.
  if (m.never) return no("never");
  if (m.engaged) return no("engaged");
  if (i.now < m.snoozeUntil) return no("snoozed");
  if (m.shownCount >= TRIGGER.LIFETIME_MAX) return no("lifetime");
  if (m.lastShownAt !== null && i.now - m.lastShownAt < TRIGGER.SPACING_MS) return no("spacing");
  if (i.shownThisSession) return no("session_cap");

  // New enough to be left alone.
  const since = i.signupAt ?? m.firstSeenAt;
  if (i.now - since < TRIGGER.SIGNUP_GATE_MS) return no("too_new");
  if (i.sessionCount < TRIGGER.MIN_SESSION) return no("session");

  // The engine has learned something about how they use Swayam.
  if (i.tier < TRIGGER.MIN_TIER) return no("tier");
  if (i.state === "UNIVERSAL") return no("universal");

  // A good moment, and not a bad place or time.
  if (!i.moment) return no("no_moment");
  const age = i.now - i.moment.at;
  if (age > TRIGGER.MOMENT_WINDOW_MS) return no("stale_moment");
  if (age < TRIGGER.MOMENT_SETTLE_MS) return no("settling");
  if (isBlockedRoute(i.pathname)) return no("route");
  if (i.lastTransitionAt !== null && i.now - i.lastTransitionAt < TRIGGER.TRANSITION_QUIET_MS)
    return no("transition");
  if (i.typing) return no("typing");
  if (i.overlayOpen) return no("overlay");

  return { show: true, reason: null, moment: i.moment.id };
}
