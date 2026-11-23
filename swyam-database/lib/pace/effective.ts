/**
 * The pace settings that are in force right now, and nothing else.
 *
 * This file imports nothing on purpose. The motion kit (`fade()`, springs) reads the duration scale from here, so
 * it must stay light and free of cycles. `apply.ts` is the only writer. Everything defaults to "no change", which
 * is also what the server and the first client render see.
 */
export type Pace = "calm" | "balanced" | "snappy";

export interface Effective {
  /** "off" when pace learning is disabled, adaptation is off, or reduced motion is on. */
  pace: Pace | "off";
  /** Multiplier for animation durations. 1 means unchanged. Always within 0.8 to 1.25. */
  scale: number;
  /** Smooth-scroll softness (Lenis lerp). */
  lerp: number;
  /** Wheel distance multiplier for smooth scroll. */
  wheel: number;
  /** Larger touch targets and spacing are on. */
  steady: boolean;
  /** The double-tap guard and irreversible-action confirm are on. */
  guard: boolean;
}

export const DEFAULT_LERP = 0.12;

export const NEUTRAL: Effective = Object.freeze({
  pace: "off",
  scale: 1,
  lerp: DEFAULT_LERP,
  wheel: 1,
  steady: false,
  guard: false,
});

let current: Effective = NEUTRAL;
const listeners = new Set<() => void>();

/** How much to stretch or shrink an animation duration. 1 unless Swayam has learned a pace. */
export function getDurationScale(): number {
  return current.scale;
}

export function getEffective(): Effective {
  return current;
}

export function subscribeEffective(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setEffective(next: Effective): void {
  if (
    next.pace === current.pace &&
    next.scale === current.scale &&
    next.lerp === current.lerp &&
    next.wheel === current.wheel &&
    next.steady === current.steady &&
    next.guard === current.guard
  )
    return;
  current = next;
  listeners.forEach((fn) => fn());
}
