/**
 * The Evolution Engine's motion kit. Import from here:
 *
 *   import { EvolutionStage, NavActiveIndicator, PressScale } from "@/components/motion";
 *
 * See docs/evolution/motion-kit.md for where each primitive goes.
 */
export {
  SPRING,
  SPRING_PARAMS,
  EASE_OUT_SOFT,
  DURATION,
  DISTANCE,
  STAGGER,
  INSTANT,
  fade,
  type SpringToken,
} from "./tokens";
export {
  useReducedMotionPref,
  useFinePointer,
  usePageFrozen,
  useMotionPrefs,
  useSpringTransition,
  type MotionPrefs,
} from "./hooks";
export { diffStageKeys, staggerDelays, type StageDiff } from "./evolution-diff";
export {
  EvolutionStage,
  type EvolutionStageProps,
  type StageItemContext,
  type StageContainerTag,
  type StageItemTag,
} from "./EvolutionStage";
export { NavActiveIndicator, type NavActiveIndicatorProps } from "./NavActiveIndicator";
export { PressScale, usePressProps, type PressScaleProps, type PressOptions } from "./PressScale";
export { HoverLift, type HoverLiftProps } from "./HoverLift";
export { MagneticButton, type MagneticButtonProps } from "./MagneticButton";
export { AnimatedNumber, type AnimatedNumberProps } from "./AnimatedNumber";
export {
  RevealOnView,
  RevealItem,
  type RevealOnViewProps,
  type RevealItemProps,
} from "./RevealOnView";
export { AdaptingPulse, type AdaptingPulseProps } from "./AdaptingPulse";
export type { MotionTag } from "./tags";
