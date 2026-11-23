/**
 * Put the learned pace to work: decide what is in force, publish it to the motion kit and smooth scroll, and
 * mirror it on `<html>` for CSS.
 *
 * Rules:
 *   - Pace learning off, or Swayam's adaptation off, or reduced motion on: scale 1, default scroll feel.
 *   - Steady hands "on" is the person's own choice and is always honoured, because it is an accessibility
 *     setting. "Auto" follows what was learned, and only while adaptation is on and motion is not reduced.
 *   - Turning anything off removes the attributes and variables at once, so the page is exactly as it was.
 */
import { DEFAULT_LERP, NEUTRAL, setEffective, type Effective } from "./effective";
import { clampScale } from "./profile";
import type { PaceData } from "./store";

export interface ApplyInput {
  data: PaceData;
  /** `useEvolutionPrefs().adaptive === "off"` */
  adaptiveOff: boolean;
  reduced: boolean;
}

/** What the page should do, given the stored profile and the person's settings. Pure. */
export function computeEffective({ data, adaptiveOff, reduced }: ApplyInput): Effective {
  const learning = data.enabled && !adaptiveOff;
  const paced = learning && !reduced;
  const steady =
    data.steadyMode === "on" || (data.steadyMode === "auto" && paced && data.state.steady);
  if (!paced && !steady) return NEUTRAL;
  return {
    pace: paced ? data.state.pace : "off",
    scale: paced ? clampScale(data.state.durationScale) : 1,
    lerp: paced ? data.state.scrollLerp : DEFAULT_LERP,
    wheel: paced ? data.state.wheelMultiplier : 1,
    steady,
    guard: steady,
  };
}

/** Minimum touch target while steady hands is on, in CSS px. */
export const STEADY_HIT_PX = 48;

function mirror(e: Effective): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (e.pace === "off") {
    root.removeAttribute("data-pace");
    root.style.removeProperty("--pace-dur-scale");
  } else {
    root.setAttribute("data-pace", e.pace);
    root.style.setProperty("--pace-dur-scale", String(e.scale));
  }
  if (e.steady) {
    root.setAttribute("data-steady", "on");
    root.style.setProperty("--steady-hit", `${STEADY_HIT_PX}px`);
  } else {
    root.removeAttribute("data-steady");
    root.style.removeProperty("--steady-hit");
  }
}

export function applyPace(input: ApplyInput): Effective {
  const e = computeEffective(input);
  setEffective(e);
  mirror(e);
  return e;
}

/** Restore every default. Used when the runtime unmounts. */
export function clearPace(): void {
  setEffective(NEUTRAL);
  mirror(NEUTRAL);
}
