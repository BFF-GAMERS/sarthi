/**
 * Motion for the adaptive layout (plan §4.3). Position only, never opacity, so a
 * paused animation clock leaves content readable rather than absent. Reduced
 * motion keeps the evolution: sections still move to their new place, just in
 * zero time. Never touches colour.
 */
import { useReducedMotion, type Transition } from "framer-motion";
import { usePreferences } from "../context/PreferencesContext";
import { fxDuration } from "../evolution/platform/frame-budget";

export const EVO_EASE = [0.22, 1, 0.36, 1] as const;

const SMOOTH: Transition = { type: "tween", duration: 0.45, ease: EVO_EASE };
/** Frame-Budget `static` tier: the same move, in well under half the time (the device is short of frames). */
const SHORT: Transition = { type: "tween", duration: 0.18, ease: EVO_EASE };
const INSTANT: Transition = { duration: 0 };

/** True when the member (Settings) or the OS asks for reduced motion. */
export function useStillMotion(): boolean {
  const { prefs } = usePreferences();
  const os = useReducedMotion();
  return Boolean(prefs.reducedMotion || os);
}

/**
 * Layout transition for a slot that moves when the plan changes. Read at call time, so a tier change
 * (html[data-fx], frame-budget.ts) reaches the next move without a re-mount.
 */
export function layoutTransition(still: boolean): Transition {
  if (still) return INSTANT;
  return fxDuration(0.45) < 0.45 ? SHORT : SMOOTH;
}

export function useEvoMotion(): { still: boolean; transition: Transition } {
  const still = useStillMotion();
  return { still, transition: layoutTransition(still) };
}
