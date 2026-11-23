import { useSyncExternalStore } from "react";

/**
 * Ticking off a study block, and the week that builds from it.
 *
 * The coach produced a weekly plan and then never heard from the student
 * again: no way to say "did that", no record of a week kept, nothing on the
 * dashboard that could change because of the work. A plan you cannot mark is
 * a printout.
 *
 * So each block can be ticked, and the ticks are what the dashboard counts.
 * They live on the device beside the plan itself — the plan is not on the
 * server either, and a study record is the student's own business.
 *
 * Nothing here is a streak with a punishment attached. A missed week resets
 * nothing; the count is simply the count.
 */

const KEY = "swayam-coach-done";

/** `day` and the block's index within it, which is what a plan gives us. */
export type BlockId = `${string}#${number}`;

export const blockId = (day: string, index: number): BlockId => `${day}#${index}`;

interface Store {
  /** ISO week key → the blocks ticked in it. */
  [weekKey: string]: string[];
}

const listeners = new Set<() => void>();
const bump = () => listeners.forEach((l) => l());

/**
 * The Monday of a date, as `2026-09-21`.
 *
 * Weeks, not days, because the plan is weekly: a student who does Monday's
 * work on Tuesday evening has done Monday's work.
 */
export function weekKeyOf(d = new Date()): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay: 0 = Sunday. Monday is the start of the plan's week.
  const back = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - back);
  const mm = String(copy.getMonth() + 1).padStart(2, "0");
  const dd = String(copy.getDate()).padStart(2, "0");
  return `${copy.getFullYear()}-${mm}-${dd}`;
}

function read(): Store {
  if (typeof localStorage === "undefined") return {};
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function write(s: Store): void {
  if (typeof localStorage === "undefined") return;
  try {
    // Eight weeks is plenty of history for a count and a "last week" line.
    const weeks = Object.keys(s).sort().slice(-8);
    const trimmed: Store = {};
    for (const w of weeks) trimmed[w] = s[w] ?? [];
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* private window: the ticks just will not survive the session */
  }
  bump();
}

export function doneThisWeek(week = weekKeyOf()): string[] {
  return read()[week] ?? [];
}

export function isDone(id: BlockId, week = weekKeyOf()): boolean {
  return doneThisWeek(week).includes(id);
}

/** Returns the state the block is now in. */
export function toggleBlock(id: BlockId, week = weekKeyOf()): boolean {
  const store = read();
  const list = store[week] ?? [];
  const has = list.includes(id);
  store[week] = has ? list.filter((x) => x !== id) : [...list, id];
  write(store);
  return !has;
}

/** Wipe the record — called when the member deletes their academic data. */
export function clearProgress(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* already gone */
  }
  bump();
}

export interface WeekSummary {
  week: string;
  done: number;
  total: number;
  percent: number;
  /** Weeks, ending with this one, in which at least one block was ticked. */
  weeksKept: number;
}

export function weekSummary(total: number, week = weekKeyOf()): WeekSummary {
  const store = read();
  const done = (store[week] ?? []).length;
  const weeksKept = Object.values(store).filter((v) => v.length > 0).length;
  return {
    week,
    done: Math.min(done, total),
    total,
    percent: total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100)),
    weeksKept,
  };
}

/* A stable snapshot, so useSyncExternalStore does not loop. */
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (typeof window !== "undefined") window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", l);
  };
};

let cache: string[] = [];
let cacheKey = "";
function snapshot(): string[] {
  const list = doneThisWeek();
  const k = list.join("|");
  if (k !== cacheKey) {
    cache = list;
    cacheKey = k;
  }
  return cache;
}
const EMPTY: string[] = [];

/** The blocks ticked this week, re-rendering the moment one changes. */
export function useWeekProgress(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
