/**
 * Public API of the Swayam Evolution Engine. FROZEN by the contracts step:
 * lanes change the implementations behind these names, never this file.
 *
 *   track(EV.COURSE_VIEWED, { level: "beginner" }, { entityId: "crs_python" })
 *   const ui = useUiState()
 *   resetExperience()
 */
export * from "./types";
export { EV, EVENT_TYPES } from "./config/ids";
export { EVOLUTION_CONFIG } from "./config/evolution-config";
export { NAV_REGISTRY, hrefFor, pathOf } from "./config/navigation";
export { SECTION_META } from "./config/sections";
export { PRIORITY_ACTIONS } from "./config/actions";

export { track, flushNow, suspendTracking, isTrackingSuspended } from "./runtime/tracker/track";
export type { TrackOptions } from "./runtime/tracker/track";
export { TrackingScope } from "./runtime/tracker/TrackingScope";

export {
  useEvolutionSnapshot,
  useUiState,
  useNavPlan,
  useHomePlan,
  useEvolutionStatus,
  useEvolutionHistory,
  useAiStatus,
  useEvolutionPrefs,
  useEvolutionHydrated,
} from "./react/hooks";
export type { NavPlan, HomePlan } from "./react/hooks";

export {
  getRuntime,
  resetBehaviour,
  resetEvolution,
  resetExperience,
  setLocked,
  setAdaptive,
  undoLastChange,
} from "./state/commands";
export type { EvolutionRuntimeApi, EvolutionCommands } from "./state/types";
