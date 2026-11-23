/**
 * Journey runner for tests, the sim script and the Lab: streams TrackInputs through the engine with
 * a fixed clock and a session boundary between sessions, recording what the engine saw and did.
 * No clock reads: time is `T0 + n * gapMs`, sessions are separated by `SESSION_GAP_MS + 1`.
 */
import { SESSION_GAP_MS, sessionIdAt } from "../behaviour/session";
import {
  createEngine,
  ingest,
  startSession,
  type EngineChange,
  type EngineState,
} from "../evolution/engine";
import type { PersonaJourney } from "./journeys";
import type { Scope, Tier, TrackInput } from "../../types";

/** 2026-10-06 09:00 UTC, a fixed origin. */
export const JOURNEY_T0 = 1_791_277_200_000;

export interface TraceRow {
  /** Meaningful count after this event. */
  k: number;
  session: number;
  type: TrackInput["type"];
  tier: Tier;
  state: string;
  mode: string;
  change: EngineChange | null;
}

export interface JourneyRun {
  final: EngineState;
  rows: TraceRow[];
  /** Meaningful count at each visible change, in order. */
  changes: { k: number; to: EngineChange["to"] }[];
}

export function runSessions(
  sessions: ReadonlyArray<ReadonlyArray<TrackInput>>,
  opts: { gapMs?: number; scope?: Scope; start?: EngineState; callStartSession?: boolean } = {},
): JourneyRun {
  const gap = opts.gapMs ?? 8_000;
  let s = opts.start ?? createEngine(opts.scope ?? "lab_trace");
  let t = JOURNEY_T0;
  const rows: TraceRow[] = [];
  const changes: JourneyRun["changes"] = [];
  sessions.forEach((events, si) => {
    if (si > 0) t += SESSION_GAP_MS + 1;
    const sessionId = sessionIdAt(t);
    if (opts.callStartSession) s = startSession(s, t);
    for (const input of events) {
      t += gap;
      const r = ingest(s, input, { now: t, sessionId });
      s = r.state;
      if (r.change) changes.push({ k: s.profile.meaningfulCount, to: r.change.to });
      rows.push({
        k: s.profile.meaningfulCount,
        session: si + 1,
        type: input.type,
        tier: s.tier,
        state: s.decision.primaryState,
        mode: s.decision.behaviourMode,
        change: r.change,
      });
    }
  });
  return { final: s, rows, changes };
}

export const runPersona = (
  p: PersonaJourney,
  opts: { gapMs?: number; callStartSession?: boolean } = {},
): JourneyRun => runSessions(p.sessions, { scope: `lab_${p.id}`, ...opts });
