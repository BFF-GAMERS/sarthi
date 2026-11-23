/**
 * Turn behaviour signals into a pace profile. Pure: numbers in, numbers out.
 *
 * Only how someone moves is read (tempo of taps, speed of scrolling, how often taps miss). Nothing about who they
 * are goes in, so nothing about who they are can come out.
 *
 * Hysteresis keeps the interface from flickering between tempos: nothing changes until there are at least
 * MIN_SAMPLES of evidence, and a different reading must hold for CONSISTENT_WINDOWS evaluations in a row.
 */
import type { Pace } from "./effective";
import type { PaceSignals } from "./signals";

export type { Pace };

export const MIN_SAMPLES = 30;
export const CONSISTENT_WINDOWS = 2;
export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.25;

/** Median gap below this is quick, above this unhurried. */
const SNAPPY_GAP_MS = 1200;
const CALM_GAP_MS = 4000;
/** Median scroll speed (px/s) above this is quick, below this unhurried. */
const SNAPPY_SCROLL = 2000;
const CALM_SCROLL = 500;
/** Missed plus doubled taps (plus a little for quick back-outs) as a share of taps: one in five. */
const STEADY_EVIDENCE = 0.2;

const TABLE: Record<Pace, { scale: number; lerp: number; wheel: number }> = {
  calm: { scale: 1.2, lerp: 0.08, wheel: 0.85 },
  balanced: { scale: 1, lerp: 0.12, wheel: 1 },
  snappy: { scale: 0.85, lerp: 0.16, wheel: 1.15 },
};

export interface PaceProfile {
  pace: Pace;
  /** 0.8 to 1.25. Multiplies animation durations. */
  durationScale: number;
  /** Lenis lerp. Lower is softer. */
  scrollLerp: number;
  wheelMultiplier: number;
  /** Taps often miss or repeat, so larger targets and a double-tap guard would help. */
  steady: boolean;
}

export interface PaceState extends PaceProfile {
  pending: Pace | null;
  pendingStreak: number;
  steadyPending: boolean | null;
  steadyStreak: number;
}

export function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, n));
}

function profileFor(pace: Pace, steady: boolean): PaceProfile {
  const r = TABLE[pace];
  return {
    pace,
    durationScale: clampScale(r.scale),
    scrollLerp: r.lerp,
    wheelMultiplier: r.wheel,
    steady,
  };
}

export const INITIAL_STATE: PaceState = Object.freeze({
  ...profileFor("balanced", false),
  pending: null,
  pendingStreak: 0,
  steadyPending: null,
  steadyStreak: 0,
});

export function hasEnoughSamples(s: PaceSignals): boolean {
  return s.samples >= MIN_SAMPLES;
}

/** One window's reading, before hysteresis. With too little evidence it is balanced and not steady. */
export function classify(s: PaceSignals): { pace: Pace; steady: boolean } {
  if (!hasEnoughSamples(s)) return { pace: "balanced", steady: false };

  let score = 0;
  if (s.medianGapMs !== null) {
    if (s.medianGapMs < SNAPPY_GAP_MS) score += 1;
    else if (s.medianGapMs > CALM_GAP_MS) score -= 1;
  }
  if (s.scrollVelocity !== null) {
    if (s.scrollVelocity > SNAPPY_SCROLL) score += 1;
    else if (s.scrollVelocity < CALM_SCROLL) score -= 1;
  }

  const evidence = s.nearMissRate + s.repeatTapRate + (s.navs >= 4 ? 0.3 * s.backOutRate : 0);
  const steady = s.taps >= 10 && evidence >= STEADY_EVIDENCE;

  let pace: Pace = score >= 1 ? "snappy" : score <= -1 ? "calm" : "balanced";
  // Someone whose taps keep missing is not helped by motion getting quicker.
  if (steady && pace === "snappy") pace = "balanced";
  return { pace, steady };
}

/**
 * Fold one window of signals into the running state.
 *
 * Call it once per evaluation window. With fewer than MIN_SAMPLES it returns `prev` untouched; a change of pace
 * (or of steady) only lands after CONSISTENT_WINDOWS identical readings in a row.
 */
export function derivePace(signals: PaceSignals, prev: PaceState = INITIAL_STATE): PaceState {
  if (!hasEnoughSamples(signals)) return prev;
  const reading = classify(signals);

  let { pace, steady, pending, pendingStreak, steadyPending, steadyStreak } = prev;

  if (reading.pace === pace) {
    pending = null;
    pendingStreak = 0;
  } else if (pending === reading.pace) {
    pendingStreak += 1;
    if (pendingStreak >= CONSISTENT_WINDOWS) {
      pace = reading.pace;
      pending = null;
      pendingStreak = 0;
    }
  } else {
    pending = reading.pace;
    pendingStreak = 1;
  }

  if (reading.steady === steady) {
    steadyPending = null;
    steadyStreak = 0;
  } else if (steadyPending === reading.steady) {
    steadyStreak += 1;
    if (steadyStreak >= CONSISTENT_WINDOWS) {
      steady = reading.steady;
      steadyPending = null;
      steadyStreak = 0;
    }
  } else {
    steadyPending = reading.steady;
    steadyStreak = 1;
  }

  return { ...profileFor(pace, steady), pending, pendingStreak, steadyPending, steadyStreak };
}
