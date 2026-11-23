import { useCallback, useMemo, useSyncExternalStore } from "react";
import { NEUTRAL, getEffective, subscribeEffective, type Effective } from "./effective";
import {
  defaultData,
  getPaceData,
  resetPace,
  setPaceEnabled,
  setSteadyMode,
  subscribePace,
  type PaceCounts,
  type PaceData,
  type SteadyMode,
} from "./store";

const SERVER_DATA = defaultData();

export interface PaceView {
  /** Pace learning is switched on (it may still be idle if adaptation is off). */
  enabled: boolean;
  steadyMode: SteadyMode;
  /** What is in force right now. */
  effective: Effective;
  /** The multiplier on animation durations right now. 1 when nothing is adapting. */
  durationScale: number;
  steadyActive: boolean;
  counts: PaceCounts;
  setEnabled: (on: boolean) => void;
  setSteadyMode: (mode: SteadyMode) => void;
  reset: () => void;
}

/** Live pace settings and status, for settings screens and anything that wants to match the person's tempo. */
export function usePace(): PaceView {
  const data: PaceData = useSyncExternalStore(subscribePace, getPaceData, () => SERVER_DATA);
  const effective = useSyncExternalStore(subscribeEffective, getEffective, () => NEUTRAL);
  const setEnabled = useCallback((on: boolean) => setPaceEnabled(on), []);
  const setMode = useCallback((m: SteadyMode) => setSteadyMode(m), []);
  const reset = useCallback(() => resetPace(), []);
  return useMemo(
    () => ({
      enabled: data.enabled,
      steadyMode: data.steadyMode,
      effective,
      durationScale: effective.scale,
      steadyActive: effective.steady,
      counts: data.counts,
      setEnabled,
      setSteadyMode: setMode,
      reset,
    }),
    [data, effective, setEnabled, setMode, reset],
  );
}
