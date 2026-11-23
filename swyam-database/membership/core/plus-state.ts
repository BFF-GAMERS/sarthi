/**
 * Pure transitions for `PlusState` (the sheet's local memory) so the rules are plain tests.
 * The snooze ladder follows docs/evolution/subscriptions.md §3: "Not now" (or Esc, backdrop) snoozes 14 days,
 * a second dismissal 60 days, "Don't show again" is permanent. Nothing here reads a clock or storage.
 */
import type { PlusDismissKind } from "../config/events";
import { DEFAULT_PLUS_STATE, type PlusState } from "./types";

const DAY = 24 * 60 * 60_000;
export const SNOOZE_FIRST_MS = 14 * DAY;
export const SNOOZE_REPEAT_MS = 60 * DAY;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const count = (v: unknown): number => Math.max(0, Math.floor(num(v) ?? 0));

/** Defensive parse of whatever storage returned. Unknown keys are dropped, bad values reset to the default. */
export function parsePlusState(raw: unknown): PlusState {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PLUS_STATE };
  const r = raw as Record<string, unknown>;
  const signupAt = num(r["signupAt"]);
  return {
    shownCount: count(r["shownCount"]),
    lastShownAt: num(r["lastShownAt"]),
    snoozeUntil: num(r["snoozeUntil"]),
    dismissCount: count(r["dismissCount"]),
    never: r["never"] === true,
    interest: r["interest"] === "trial_demo" || r["interest"] === "notify" ? r["interest"] : null,
    ...(signupAt === null ? {} : { signupAt }),
  };
}

export const applyShown = (s: PlusState, now: number): PlusState => ({
  ...s,
  shownCount: s.shownCount + 1,
  lastShownAt: now,
});

export function applyDismiss(s: PlusState, kind: PlusDismissKind, now: number): PlusState {
  const dismissCount = s.dismissCount + 1;
  if (kind === "never") return { ...s, dismissCount, never: true };
  const ms = dismissCount >= 2 ? SNOOZE_REPEAT_MS : SNOOZE_FIRST_MS;
  return { ...s, dismissCount, snoozeUntil: Math.max(s.snoozeUntil ?? 0, now + ms) };
}

export const applyInterest = (s: PlusState, interest: "trial_demo" | "notify"): PlusState => ({
  ...s,
  interest,
});

/** A role change resets the snooze and the dismissal count; "never" and the lifetime counts stay. */
export const resetForRoleChange = (s: PlusState): PlusState => ({
  ...s,
  snoozeUntil: null,
  dismissCount: 0,
});

/** True while a snooze or "never" is in force. */
export const isSnoozed = (s: PlusState, now: number): boolean =>
  s.never || (s.snoozeUntil !== null && now < s.snoozeUntil);
