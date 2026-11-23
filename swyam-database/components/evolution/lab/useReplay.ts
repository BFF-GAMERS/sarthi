/** Replay state for the Lab: a read-only controller over the scope event log. */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { compose, UNIVERSAL_DECISION } from "@/evolution/core/evolution/compose";
import {
  createReplayController,
  replayHistory,
  type ReplayController,
  type ReplayState,
} from "@/evolution/lab/replay-controller";
import { getRuntime } from "@/evolution/state/commands";
import type { EvolutionHistory, UIState } from "@/evolution/types";

const noopSubscribe = () => () => {};
const noState = (): ReplayState | null => null;

export interface ReplayApi {
  state: ReplayState | null;
  controller: ReplayController | null;
  /** The structure and history to show instead of the live ones, or null when not replaying. */
  view: { ui: UIState; history: EvolutionHistory } | null;
  start(): void;
  stop(): void;
}

export function useReplay(signedIn: boolean, locked: boolean): ReplayApi {
  const [controller, setController] = useState<ReplayController | null>(null);
  const state = useSyncExternalStore<ReplayState | null>(
    controller?.subscribe ?? noopSubscribe,
    controller?.getState ?? noState,
    noState,
  );

  useEffect(() => () => controller?.dispose(), [controller]);

  const start = useCallback(() => {
    try {
      const rt = getRuntime();
      const next = createReplayController(rt.getSnapshot().scope, rt.getEvents());
      setController(next);
      next.play();
    } catch {
      setController(null);
    }
  }, []);
  const stop = useCallback(() => setController(null), []);

  const view = useMemo(() => {
    if (!state) return null;
    const ctx = { signedIn, stableNav: false, locked };
    const ui = state.current
      ? compose(state.current.decision, state.current.tier, ctx)
      : compose(UNIVERSAL_DECISION, 0, ctx);
    return { ui, history: replayHistory(state.steps, state.index) };
  }, [state, signedIn, locked]);

  return { state, controller, view, start, stop };
}
