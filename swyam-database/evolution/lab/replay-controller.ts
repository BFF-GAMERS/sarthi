/**
 * Replay controller (plan §6.2): re-folds an event log step by step with the
 * engine's traceEvents. Play, pause and step. It computes everything up front
 * from the log it is given and writes NOTHING to the store; the Lab reads its
 * state to drive the StructureDiagram and HistoryTimeline.
 */
import { traceEvents, type TraceStep } from "../core/evolution/engine";
import type { BehaviourEvent, EvolutionHistoryEntry, Scope } from "../types";

export const REPLAY_INTERVAL_MS = 400;

export interface ReplayState {
  steps: readonly TraceStep[];
  total: number;
  /** Steps applied so far: 0 = before the first event, `total` = fully replayed. */
  index: number;
  playing: boolean;
  /** The last applied step, or null at index 0. */
  current: TraceStep | null;
}

export interface ReplayController {
  getState(): ReplayState;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  /** Pause and apply one more step. */
  step(): void;
  /** Pause and jump to `index` steps applied (clamped). */
  seek(index: number): void;
  /** Back to index 0, paused. */
  restart(): void;
  dispose(): void;
}

export interface ReplayOptions {
  intervalMs?: number;
  trace?: (scope: Scope, events: readonly BehaviourEvent[]) => TraceStep[];
}

/** Committed changes among the first `index` steps, as history entries (oldest first). */
export function replayHistory(steps: readonly TraceStep[], index: number): EvolutionHistoryEntry[] {
  const out: EvolutionHistoryEntry[] = [];
  for (let i = 0; i < Math.min(index, steps.length); i++) {
    const { change, event, seq } = steps[i];
    if (!change) continue;
    out.push({
      id: `replay-${seq}`,
      at: event.timestamp,
      seq,
      from: change.from,
      to: change.to,
      confidence: change.confidence,
      source: change.source,
      reasonCode: change.reasonCode,
    });
  }
  return out;
}

export function createReplayController(
  scope: Scope,
  events: readonly BehaviourEvent[],
  opts: ReplayOptions = {},
): ReplayController {
  const interval = Math.max(0, opts.intervalMs ?? REPLAY_INTERVAL_MS);
  const steps: readonly TraceStep[] = (opts.trace ?? traceEvents)(scope, events);
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const make = (index: number, playing: boolean): ReplayState => ({
    steps,
    total: steps.length,
    index,
    playing,
    current: index > 0 ? steps[index - 1] : null,
  });
  let state = make(0, false);

  const set = (next: ReplayState) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    clear();
    timer = setTimeout(() => {
      timer = null;
      if (disposed || !state.playing) return;
      const index = state.index + 1;
      const playing = index < state.total;
      set(make(index, playing));
      if (playing) schedule();
    }, interval);
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play() {
      if (disposed || state.total === 0) return;
      set(make(state.index >= state.total ? 0 : state.index, true));
      schedule();
    },
    pause() {
      clear();
      if (state.playing) set(make(state.index, false));
    },
    step() {
      clear();
      set(make(Math.min(state.index + 1, state.total), false));
    },
    seek(index) {
      clear();
      set(make(Math.max(0, Math.min(Math.floor(index), state.total)), false));
    },
    restart() {
      clear();
      set(make(0, false));
    },
    dispose() {
      disposed = true;
      clear();
      listeners.clear();
    },
  };
}
