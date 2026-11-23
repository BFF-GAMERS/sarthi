/**
 * run-engine: folds events and commands through the engine facade (core/evolution/engine.ts). Pure over an
 * EngineRecord: no storage, no React, no clock (time is passed in). The runtime writes the result.
 *
 * Every function returns the NEW record plus the events and history entries that were produced, and bumps
 * `rev` exactly when the committed decision, tier or reason changed.
 */
import {
  applyAdvice,
  createEngine,
  ingest,
  renderReason,
  replayEvents,
  resetEngine,
  startSession,
  undoChange,
  type EngineChange,
  type EngineState,
} from "../../core/evolution/engine";
import type { AnalyzerAdvice } from "../../core/analyzer/types";
import { EVOLUTION_CONFIG } from "../../config/evolution-config";
import { newHistoryId } from "../../platform/ids";
import { refOf, structureKey, type Committed } from "../../state/committed";
import type { EngineRecord } from "../../state/stores";
import type {
  BehaviourEvent,
  DecisionSource,
  EvolutionHistoryEntry,
  EvolutionStatus,
  PersonaId,
  Scope,
  TrackInput,
} from "../../types";

export interface RunOutput {
  rec: EngineRecord;
  events: BehaviourEvent[];
  history: EvolutionHistoryEntry[];
}

interface StepChange {
  change: EngineChange;
  seq: number;
}

const sig = (c: Pick<Committed, "decision" | "tier" | "reasonCode">): string =>
  JSON.stringify([c.decision, c.tier, c.reasonCode]);

/** The newest engine decision of a record, as a commit. */
export const committedOf = (rec: EngineRecord): Committed => ({
  rev: rec.rev,
  decision: rec.engine.decision,
  tier: rec.engine.tier,
  reasonCode: rec.engine.reasonCode,
  source: rec.committedSource,
  at: rec.committedAt,
});

function settle(
  rec: EngineRecord,
  engine: EngineState,
  now: number,
  source: DecisionSource,
  changes: readonly StepChange[],
): { rec: EngineRecord; history: EvolutionHistoryEntry[] } {
  const prev = committedOf(rec);
  const next: Committed = {
    rev: rec.rev,
    decision: engine.decision,
    tier: engine.tier,
    reasonCode: engine.reasonCode,
    source,
    at: now,
  };
  const moved = sig(prev) !== sig(next);
  const history: EvolutionHistoryEntry[] = changes.map(({ change, seq }) => ({
    id: newHistoryId(seq, now),
    at: now,
    seq,
    from: change.from,
    to: change.to,
    confidence: change.confidence,
    source: change.source,
    reasonCode: change.reasonCode,
  }));
  // A structural move with no engine change object (a session start unlocking tier 3, a reset) still gets a row.
  if (moved && history.length === 0 && structureKey(prev) !== structureKey(next)) {
    history.push({
      id: newHistoryId(engine.seq, now),
      at: now,
      seq: engine.seq,
      from: refOf(prev),
      to: refOf(next),
      confidence: next.decision.confidence,
      source,
      reasonCode: next.reasonCode,
    });
  }
  const lastSource =
    changes.length > 0 ? (changes[changes.length - 1]?.change.source ?? source) : source;
  return {
    rec: {
      ...rec,
      engine,
      rev: moved ? rec.rev + 1 : rec.rev,
      committedSource: moved ? lastSource : rec.committedSource,
      committedAt: moved ? now : rec.committedAt,
      updatedAt: now,
    },
    history,
  };
}

/** Fold tracker inputs: sanitise, accumulate, decide, step. */
export function runIngest(
  rec: EngineRecord,
  inputs: readonly TrackInput[],
  ctx: { now: number; sessionId: string; source: DecisionSource },
): RunOutput {
  let engine = rec.engine;
  const events: BehaviourEvent[] = [];
  const changes: StepChange[] = [];
  for (const input of inputs) {
    const r = ingest(engine, input, { now: ctx.now, sessionId: ctx.sessionId, source: ctx.source });
    engine = r.state;
    if (r.event) events.push(r.event);
    if (r.change) changes.push({ change: r.change, seq: r.event?.seq ?? engine.seq });
  }
  if (events.length === 0 && engine === rec.engine) return { rec, events, history: [] };
  const out = settle(rec, engine, ctx.now, ctx.source, changes);
  return { ...out, events };
}

/** D10: a new session counts once per scope (sessionCount + 1, stale decay). */
export function runSessionStart(rec: EngineRecord, now: number, sessionId: string): RunOutput {
  const engine = startSession(rec.engine, now);
  const out = settle({ ...rec, sessionId }, engine, now, "deterministic", []);
  return { ...out, events: [] };
}

/** Merged AI advice: only a target; hysteresis, lock and vetoes still apply inside the engine. */
export function runAdvice(rec: EngineRecord, advice: AnalyzerAdvice, now: number): RunOutput {
  const r = applyAdvice(rec.engine, advice, now);
  if (r.state === rec.engine && !r.change) return { rec, events: [], history: [] };
  const out = settle(
    rec,
    r.state,
    now,
    "ai",
    r.change ? [{ change: r.change, seq: r.state.seq }] : [],
  );
  return { ...out, events: [] };
}

/** Undo the last committed change. `null` when there is nothing to undo. */
export function runUndo(rec: EngineRecord, now: number): RunOutput | null {
  const r = undoChange(rec.engine, now);
  if (r.state === rec.engine && !r.change) return null;
  const out = settle(
    rec,
    r.state,
    now,
    "undo",
    r.change ? [{ change: r.change, seq: r.state.seq }] : [],
  );
  return { ...out, events: [] };
}

/** resetEvolution(): epoch + 1, decision back to UNIVERSAL; the profile and events are kept. */
export function runResetEvolution(rec: EngineRecord, now: number): RunOutput {
  const engine: EngineState = { ...resetEngine(rec.engine), reasonCode: { key: "RESET" } };
  const out = settle(rec, engine, now, "reset", []);
  return { ...out, events: [] };
}

/** resetBehaviour(): a clean profile and accumulators; the decision on screen stays until new evidence. */
export function runResetBehaviour(rec: EngineRecord, scope: Scope, now: number): RunOutput {
  const fresh = createEngine(scope);
  const engine: EngineState = {
    ...fresh,
    epoch: rec.engine.epoch,
    decision: rec.engine.decision,
    tier: rec.engine.tier,
    reasonCode: rec.engine.reasonCode,
  };
  const out = settle(rec, engine, now, "reset", []);
  return { ...out, events: [] };
}

/** The engine fell behind its own log (invalid restore, partial write): rebuild it by replay. */
export function runReplay(
  rec: EngineRecord,
  scope: Scope,
  events: readonly BehaviourEvent[],
  now: number,
): RunOutput {
  const replayed = replayEvents(scope, events);
  const engine: EngineState = { ...replayed, epoch: rec.engine.epoch };
  const out = settle(rec, engine, now, "deterministic", []);
  return { ...out, events: [] };
}

/** Highest seq in an event log (0 when empty). */
export const maxSeq = (events: readonly BehaviourEvent[]): number =>
  events.reduce((m, e) => (e.seq > m ? e.seq : m), 0);

// ─── status ────────────────────────────────────────────────────────────────────────────────────────────

/** What the indicator, WhyPanel and Lab read. Reason text is always the local template. */
export function statusOf(
  c: Committed,
  scope: Scope,
  opts: { restored: boolean; demo: PersonaId | null; lastChangeAt: number | null },
): EvolutionStatus {
  const state = c.decision.primaryState;
  const label =
    state === "UNIVERSAL"
      ? EVOLUTION_CONFIG.modeLabels[c.decision.behaviourMode]
      : EVOLUTION_CONFIG.states[state].label;
  return {
    scope,
    state,
    mode: c.decision.behaviourMode,
    tier: c.tier,
    confidence: c.decision.confidence,
    label,
    reason: renderReason(c.reasonCode),
    reasonCode: c.reasonCode,
    restored: opts.restored,
    lastChangeAt: opts.lastChangeAt,
    demo: opts.demo,
  };
}
