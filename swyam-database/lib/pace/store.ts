/**
 * What is kept about pace, on this device only: two switches, coarse counts, and the derived profile.
 *
 * `localStorage["swayam.pace.v1"]`. Never the raw signals, never anything about content. Learned data (counts
 * and profile) is dropped after 30 days without an update, so the profile follows how the person uses Swayam now.
 * The two switches are the person's choices and are kept.
 *
 * Every storage touch is in try/catch: a private window or blocked storage just means nothing is remembered.
 */
import { INITIAL_STATE, clampScale, type PaceState } from "./profile";
import type { Pace } from "./effective";
import type { Totals } from "./signals";

export const PACE_KEY = "swayam.pace.v1";
export const DECAY_MS = 30 * 24 * 60 * 60 * 1000;

export type SteadyMode = "auto" | "on" | "off";

export interface PaceCounts {
  taps: number;
  scrolls: number;
  navs: number;
  nearMisses: number;
  repeatTaps: number;
  backOuts: number;
}

export interface PaceData {
  v: 1;
  /** Learn from how I tap and scroll. */
  enabled: boolean;
  steadyMode: SteadyMode;
  counts: PaceCounts;
  state: PaceState;
  updatedAt: number;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const ZERO_COUNTS: PaceCounts = Object.freeze({
  taps: 0,
  scrolls: 0,
  navs: 0,
  nearMisses: 0,
  repeatTaps: 0,
  backOuts: 0,
});

export function defaultData(now = 0): PaceData {
  return {
    v: 1,
    enabled: true,
    steadyMode: "auto",
    counts: { ...ZERO_COUNTS },
    state: INITIAL_STATE,
    updatedAt: now,
  };
}

const PACES: readonly Pace[] = ["calm", "balanced", "snappy"];
const num = (v: unknown, fallback = 0, max = 1e9): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback;

/** What may be in storage: anything. Every field is checked before use. */
interface RawState {
  pace?: unknown;
  durationScale?: unknown;
  scrollLerp?: unknown;
  wheelMultiplier?: unknown;
  steady?: unknown;
}
interface RawData {
  v?: unknown;
  enabled?: unknown;
  steadyMode?: unknown;
  updatedAt?: unknown;
  counts?: Partial<Record<keyof PaceCounts, unknown>> | null;
  state?: RawState | null;
}

function parseState(o: RawState | null | undefined): PaceState {
  const r: RawState = o ?? {};
  const pace = PACES.includes(r.pace as Pace) ? (r.pace as Pace) : "balanced";
  return {
    ...INITIAL_STATE,
    pace,
    durationScale: clampScale(typeof r.durationScale === "number" ? r.durationScale : 1),
    scrollLerp: Math.min(0.3, Math.max(0.04, num(r.scrollLerp, 0.12))),
    wheelMultiplier: Math.min(1.5, Math.max(0.5, num(r.wheelMultiplier, 1))),
    steady: r.steady === true,
    // Pending streaks are transient evidence; start fresh after a reload.
    pending: null,
    pendingStreak: 0,
    steadyPending: null,
    steadyStreak: 0,
  };
}

/** Parse and validate stored data. Anything unexpected becomes the default; stale learning is dropped. */
export function parseData(raw: string | null, now: number): PaceData {
  if (!raw) return defaultData(now);
  let o: RawData;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultData(now);
    o = parsed as RawData;
  } catch {
    return defaultData(now);
  }
  if (o.v !== 1) return defaultData(now);
  const enabled = o.enabled !== false;
  const steadyMode: SteadyMode =
    o.steadyMode === "on" || o.steadyMode === "off" ? o.steadyMode : "auto";
  const updatedAt = num(o.updatedAt, 0, 1e15);
  if (now - updatedAt > DECAY_MS) return { ...defaultData(now), enabled, steadyMode };
  const c = o.counts ?? {};
  return {
    v: 1,
    enabled,
    steadyMode,
    counts: {
      taps: num(c.taps),
      scrolls: num(c.scrolls),
      navs: num(c.navs),
      nearMisses: num(c.nearMisses),
      repeatTaps: num(c.repeatTaps),
      backOuts: num(c.backOuts),
    },
    state: parseState(o.state),
    updatedAt,
  };
}

export function serializeData(d: PaceData): string {
  // Only the profile fields are written, not the transient hysteresis streaks.
  const { pace, durationScale, scrollLerp, wheelMultiplier, steady } = d.state;
  return JSON.stringify({
    v: 1,
    enabled: d.enabled,
    steadyMode: d.steadyMode,
    counts: d.counts,
    state: { pace, durationScale, scrollLerp, wheelMultiplier, steady },
    updatedAt: d.updatedAt,
  });
}

export function loadFrom(storage: StorageLike | null, now: number): PaceData {
  if (!storage) return defaultData(now);
  try {
    return parseData(storage.getItem(PACE_KEY), now);
  } catch {
    return defaultData(now);
  }
}

export function saveTo(storage: StorageLike | null, d: PaceData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PACE_KEY, serializeData(d));
    return true;
  } catch {
    return false;
  }
}

export function addCounts(a: PaceCounts, b: Partial<PaceCounts>): PaceCounts {
  return {
    taps: a.taps + (b.taps ?? 0),
    scrolls: a.scrolls + (b.scrolls ?? 0),
    navs: a.navs + (b.navs ?? 0),
    nearMisses: a.nearMisses + (b.nearMisses ?? 0),
    repeatTaps: a.repeatTaps + (b.repeatTaps ?? 0),
    backOuts: a.backOuts + (b.backOuts ?? 0),
  };
}

export function diffTotals(now: Totals, before: Totals): PaceCounts {
  return {
    taps: Math.max(0, now.taps - before.taps),
    scrolls: Math.max(0, now.scrolls - before.scrolls),
    navs: Math.max(0, now.navs - before.navs),
    nearMisses: Math.max(0, now.nearMisses - before.nearMisses),
    repeatTaps: Math.max(0, now.repeatTaps - before.repeatTaps),
    backOuts: Math.max(0, now.backOuts - before.backOuts),
  };
}

// ── module store (client) ────────────────────────────────────────────────────────────────────────────

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let data: PaceData = defaultData();
let hydrated = false;
let epoch = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function commit(next: PaceData, persist = true): void {
  data = next;
  if (persist) saveTo(browserStorage(), data);
  emit();
}

export function getPaceData(): PaceData {
  return data;
}

export function isPaceHydrated(): boolean {
  return hydrated;
}

/** Bumped by `resetPace()` so the runtime knows to clear its in-memory window too. */
export function getPaceEpoch(): number {
  return epoch;
}

export function subscribePace(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function hydratePace(now = Date.now()): void {
  if (hydrated) return;
  hydrated = true;
  data = loadFrom(browserStorage(), now);
  emit();
}

export function setPaceEnabled(enabled: boolean, now = Date.now()): void {
  commit({ ...data, enabled, updatedAt: now });
}

export function setSteadyMode(steadyMode: SteadyMode, now = Date.now()): void {
  commit({ ...data, steadyMode, updatedAt: now });
}

/** Store a freshly derived profile and the counts gained since the last commit. */
export function commitLearning(
  state: PaceState,
  delta: Partial<PaceCounts>,
  now = Date.now(),
): void {
  commit({ ...data, state, counts: addCounts(data.counts, delta), updatedAt: now });
}

/** Forget what was learned. The two switches stay as the person set them. */
export function resetPace(now = Date.now()): void {
  epoch++;
  commit({ ...defaultData(now), enabled: data.enabled, steadyMode: data.steadyMode });
}

/** For tests: put the module back to its first state. */
export function __resetPaceStoreForTests(): void {
  data = defaultData();
  hydrated = false;
  epoch = 0;
  listeners.clear();
}
