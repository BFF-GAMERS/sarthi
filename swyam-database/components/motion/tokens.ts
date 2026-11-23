import type { Transition } from "framer-motion";
import { getDurationScale } from "../../lib/pace/effective";

/**
 * Motion tokens for the Evolution Engine's visual layer.
 *
 * Three springs, picked by how much of the screen is moving, not by taste:
 *
 *   micro     a press, a hover, a magnetic nudge. Settles in ~0.18 s.
 *   standard  a sliding indicator, a number, a card entering. ~0.27 s.
 *   major     the interface re-ordering itself. ~0.5 s, so a moved section
 *             reads as an object with weight rather than a snap.
 *
 * Every one is damped to a ratio of 0.87 or higher (see the maths below), so
 * the overshoot is at most 0.4% of the distance travelled: it arrives and
 * stops. Nothing here wobbles. A cartoon bounce would make a re-ordering
 * Home page read as unstable; the aim is the opposite, "it understood".
 *
 *   damping ratio  = damping / (2 * sqrt(stiffness * mass))
 *   overshoot      = exp(-pi * ratio / sqrt(1 - ratio^2))      (ratio < 1)
 *   settle time    = 4 / (ratio * sqrt(stiffness / mass))
 *
 *   micro     520 / 36 / 0.8   ratio 0.88   overshoot 0.3%   settle 0.18 s
 *   standard  300 / 30 / 1.0   ratio 0.87   overshoot 0.4%   settle 0.27 s
 *   major      90 / 20 / 1.2   ratio 0.96   overshoot ~0%    settle 0.48 s
 *
 * These sit alongside `SPRING_LAYOUT` in `src/lib/motion.ts` (260 / 32, ratio
 * 0.99). The kit keeps its own copy so it has no dependency on files that other
 * work is editing; re-export from `src/lib/motion.ts` later if one source of
 * truth is wanted.
 */
export const SPRING_PARAMS = {
  micro: { stiffness: 520, damping: 36, mass: 0.8 },
  standard: { stiffness: 300, damping: 30, mass: 1 },
  major: { stiffness: 90, damping: 20, mass: 1.2 },
} as const;

/** The three spring tiers, as framer-motion `transition` objects. */
export const SPRING = {
  micro: { type: "spring", ...SPRING_PARAMS.micro },
  standard: { type: "spring", ...SPRING_PARAMS.standard },
  major: { type: "spring", ...SPRING_PARAMS.major },
} as const satisfies Record<string, Transition>;

export type SpringToken = keyof typeof SPRING;

/** The same curve as the CSS `--ease-out-soft`, for the few things that tween. */
export const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds, for opacity fades and the highlight sweep. */
export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.45,
  /** How long the "promoted" highlight is visible in total. */
  highlight: 1.6,
} as const;

/** Offsets in px. Small on purpose: motion explains, it does not perform. */
export const DISTANCE = {
  /** A hover lift. */
  lift: 4,
  /** An item entering the stage. */
  rise: 12,
  /** A block revealing on scroll. */
  reveal: 16,
  /** The most a magnetic button may travel from its rest position. */
  magnet: 8,
} as const;

/** Choreography of one evolution: who moves when. */
export const STAGGER = {
  /** The gap between neighbours starting to move, in seconds. */
  step: 0.04,
  /** Neighbours wait this long for the promoted item to start first. */
  lead: 0.06,
  /** A ceiling, so a long list never takes more than this to start moving. */
  max: 0.3,
  /** How long an entering item waits for the others to make room. */
  enter: 0.12,
} as const;

/** The transition to use when nothing should animate. */
export const INSTANT: Transition = { duration: 0 };

/**
 * An opacity-only tween. The reduced-motion stand-in for any movement.
 *
 * The duration is stretched or shrunk by the person's learned pace (`getDurationScale()`, 0.8 to 1.25). It is
 * exactly 1 when pace matching is off, adaptation is off or motion is reduced, so then nothing changes.
 */
export function fade(duration: number = DURATION.base, delay = 0): Transition {
  return { duration: duration * getDurationScale(), delay, ease: EASE_OUT_SOFT };
}

const scaledCache = new Map<string, Transition>();

/**
 * A spring token run `scale` times slower (above 1) or faster (below 1), with the same damping ratio, so it still
 * arrives without overshoot. Settle time goes as 1 / sqrt(stiffness / mass), so stiffness is divided by scale
 * squared and damping by scale. At scale 1 this is the token itself.
 */
export function scaledSpring(token: SpringToken, scale: number): Transition {
  if (scale === 1) return SPRING[token];
  const key = `${token}:${scale}`;
  let t = scaledCache.get(key);
  if (!t) {
    const p = SPRING_PARAMS[token];
    t = {
      type: "spring",
      stiffness: p.stiffness / (scale * scale),
      damping: p.damping / scale,
      mass: p.mass,
    };
    scaledCache.set(key, t);
  }
  return t;
}
