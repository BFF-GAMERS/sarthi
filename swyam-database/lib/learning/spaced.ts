/**
 * A small Leitner-style scheduler for the mistake notebook.
 *
 * Pure: it never touches storage or the clock on its own, so every rule here
 * can be tested with plain numbers. Four boxes, revisited after 1, 3, 7 and 21
 * days. Getting an item right moves it up a box; getting it wrong sends it
 * back to box 1, which is the whole algorithm. Right in box 4 means mastered.
 */

export const DAY_MS = 86_400_000;
export const BOX_DAYS = [1, 3, 7, 21] as const;
export const MAX_PER_SESSION = 5;
/** A mastered item stays visible (faded) this long, then is dropped. */
export const MASTERED_KEEP_DAYS = 30;

export type Box = 1 | 2 | 3 | 4;

export interface SpacedState {
  box: Box;
  /** Epoch ms when the item is next worth another look. */
  dueAt: number;
  mastered: boolean;
  /** Epoch ms it was mastered; set only when `mastered` is true. */
  masteredAt?: number;
}

/** State for an item that was just answered wrongly: box 1, due in a day. */
export function freshState(now: number): SpacedState {
  return { box: 1, dueAt: now + BOX_DAYS[0] * DAY_MS, mastered: false };
}

/** One review. Correct climbs a box (box 4 becomes mastered); wrong goes back to box 1. */
export function review(state: SpacedState, correct: boolean, now: number): SpacedState {
  if (!correct) return freshState(now);
  if (state.box === 4) {
    return { box: 4, dueAt: now + BOX_DAYS[3] * DAY_MS, mastered: true, masteredAt: now };
  }
  const box = (state.box + 1) as Box;
  return { box, dueAt: now + BOX_DAYS[box - 1] * DAY_MS, mastered: false };
}

/** Local end of the calendar day containing `now`. */
export function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Ready to look at again right now. */
export function isDue(item: SpacedState, now: number): boolean {
  return !item.mastered && item.dueAt <= now;
}

const byDue = (a: SpacedState, b: SpacedState) => a.dueAt - b.dueAt || a.box - b.box;

/** Everything due by the end of today, soonest first. Mastered items never appear. */
export function dueToday<T extends SpacedState>(items: T[], now: number): T[] {
  const end = endOfDay(now);
  return items.filter((i) => !i.mastered && i.dueAt <= end).sort(byDue);
}

/**
 * One practice round: due items first, never more than `max` (default 5).
 * With `includeNotDue` the round is topped up with the next-soonest items, for
 * a learner who wants to look again before the schedule says so.
 */
export function pickSession<T extends SpacedState>(
  items: T[],
  now: number,
  opts: { max?: number; includeNotDue?: boolean } = {},
): T[] {
  const max = Math.max(0, Math.min(opts.max ?? MAX_PER_SESSION, MAX_PER_SESSION));
  const open = items.filter((i) => !i.mastered);
  const due = open.filter((i) => i.dueAt <= now).sort(byDue);
  if (due.length >= max || !opts.includeNotDue) return due.slice(0, max);
  const rest = open.filter((i) => i.dueAt > now).sort(byDue);
  return [...due, ...rest].slice(0, max);
}

/** Drop items that were mastered long enough ago to have faded out. */
export function pruneMastered<T extends SpacedState>(items: T[], now: number): T[] {
  const cutoff = now - MASTERED_KEEP_DAYS * DAY_MS;
  return items.filter((i) => !(i.mastered && (i.masteredAt ?? 0) < cutoff));
}
