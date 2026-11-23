/**
 * ENGINE FACADE — the only engine surface other lanes import.
 *
 * Port of ONE's tested deterministic engine, adapted to Swayam's four domains:
 * sanitise → accumulate → decide → step/hysteresis → compose. The signatures below are frozen.
 *
 * Pure: no react, no DOM, no Date.now, no Math.random. Time is passed in. The whole EngineState
 * is plain JSON, so it survives persist/restore and replays bit-identically.
 */
import { DOMAIN_IDS } from "../../config/ids";
import type { AnalyzerAdvice } from "../analyzer/types";
import type {
  BehaviourEvent,
  BehaviourProfile,
  DecisionSource,
  DomainId,
  EvolutionDecision,
  EvolutionSnapshotRef,
  ReasonCode,
  Scope,
  Tier,
  TrackInput,
} from "../../types";
import { sanitize } from "../behaviour/sanitize";
import { SESSION_GAP_MS } from "../behaviour/session";
import { EVENT_SPEC, MEANINGFUL_MIN_WEIGHT } from "../behaviour/taxonomy";
import {
  accumulate,
  behaviourScores,
  closeSession,
  conf,
  draftOf,
  feedAffinityOnly,
  openSession,
  staleDecay,
} from "./accumulate";
import { UNIVERSAL_DECISION } from "./compose";
import { explain as explainInternal, nextStepText, type Explanation } from "./explain";
import { freshInternal, resetInternal, undoInternal } from "./memory";
import { EVOLUTION_PARAMS as PR } from "./params";
import { renderReason as renderReasonImpl } from "./reasons";
import { evaluate } from "./step";
import type { EngineInternal } from "./types";

/** Opaque to other lanes except for these read-only fields. The engine lane may add fields. */
export interface EngineState {
  readonly v: 1;
  readonly scope: Scope;
  /** +1 on resetEvolution(); advice from another epoch is dropped. */
  readonly epoch: number;
  /** Last ingested seq. */
  readonly seq: number;
  readonly tier: Tier;
  readonly decision: EvolutionDecision;
  readonly reasonCode: ReasonCode;
  readonly profile: BehaviourProfile;
  /** Engine-internal accumulators (E, B, F, P, pending, dwell, vetoes, budget…). */
  readonly internal: unknown;
}

/** A visible structural change the presenter/coordinator may release. */
export interface EngineChange {
  from: EvolutionSnapshotRef;
  to: EvolutionSnapshotRef;
  confidence: number;
  source: DecisionSource;
  reasonCode: ReasonCode;
}

export interface StepResult {
  state: EngineState;
  /** The sanitised, stamped event, or null when the sanitiser dropped the input. */
  event: BehaviourEvent | null;
  change: EngineChange | null;
}

export interface IngestContext {
  now: number;
  sessionId: string;
  source?: DecisionSource;
}

export interface TraceStep {
  seq: number;
  event: BehaviourEvent;
  tier: Tier;
  decision: EvolutionDecision;
  change: EngineChange | null;
}

const ZERO_SCORES = {
  learningAffinity: 0,
  careerAffinity: 0,
  skillExchangeAffinity: 0,
  communityAffinity: 0,
  quickUser: 0,
  researchUser: 0,
  repeatUser: 0,
  explorer: 0,
  careerFocused: 0,
  learningFocused: 0,
  skillFocused: 0,
  minimalUser: 0,
};

export function emptyProfile(scope: Scope): BehaviourProfile {
  return {
    scope,
    scores: { ...ZERO_SCORES },
    countsByType: {},
    countsByDomain: { LEARNING: 0, CAREER: 0, SKILL_EXCHANGE: 0, COMMUNITY: 0 },
    meaningfulCount: 0,
    sessionCount: 0,
    lastSeen: 0,
    recent: [],
  };
}

const internalOf = (s: EngineState): EngineInternal => s.internal as EngineInternal;

const refOf = (d: EvolutionDecision, tier: Tier): EvolutionSnapshotRef => ({
  state: d.primaryState,
  mode: d.behaviourMode,
  nav: d.navigationMode,
  layout: d.homepageLayout,
  tier,
});

/** A fresh engine for a scope (UNIVERSAL, tier 0). */
export function createEngine(scope: Scope): EngineState {
  return {
    v: 1,
    scope,
    epoch: 0,
    seq: 0,
    tier: 0,
    decision: UNIVERSAL_DECISION,
    reasonCode: { key: "START" },
    profile: emptyProfile(scope),
    internal: freshInternal(),
  };
}

/** Sanitise one tracker input into a stamped event (null = dropped). Allow-listed fields only. */
export function sanitizeInput(
  input: TrackInput,
  ctx: IngestContext,
  seq: number,
): BehaviourEvent | null {
  return sanitize(input, { now: ctx.now, sessionId: ctx.sessionId }, seq);
}

/** Fold one input through sanitise → accumulate → decide → step. */
export function ingest(state: EngineState, input: TrackInput, ctx: IngestContext): StepResult {
  const event = sanitizeInput(input, ctx, state.seq + 1);
  if (!event) return { state, event: null, change: null };
  const d = draftOf(internalOf(state));
  const prev = state.profile;
  let sessionCount = prev.sessionCount;

  // Session boundary: a new sessionId or a 30-minute gap. startSession() may already have counted it.
  if (
    d.cur === null ||
    d.cur.id !== event.sessionId ||
    event.timestamp - d.cur.lastTs > SESSION_GAP_MS
  ) {
    closeSession(d);
    if (!d.sessionOpened) {
      sessionCount += 1;
      if (prev.lastSeen > 0) staleDecay(d, event.timestamp - prev.lastSeen);
    }
    d.sessionOpened = false;
    openSession(d, event.sessionId, event.timestamp);
  }

  const dom: DomainId | null = event.service === "PLATFORM" ? null : event.service;
  const countsByType = {
    ...prev.countsByType,
    [event.type]: (prev.countsByType[event.type] ?? 0) + 1,
  };
  const countsByDomain =
    dom === null
      ? prev.countsByDomain
      : { ...prev.countsByDomain, [dom]: prev.countsByDomain[dom] + 1 };

  const spec = EVENT_SPEC[event.type];
  let commit = null as ReturnType<typeof evaluate>;
  let recent = prev.recent;
  if (spec.w >= MEANINGFUL_MIN_WEIGHT) {
    accumulate(d, event);
    if (event.entityId !== null) {
      const id = event.entityId;
      recent = [
        { entityId: id, type: event.type, at: event.timestamp },
        ...prev.recent.filter((r) => r.entityId !== id),
      ].slice(0, PR.RECENT_CAP);
    }
    commit = evaluate(d, state.decision.reason);
  } else {
    // Weak events (nav clicks, list filter/search) feed affinity only; page_viewed has none.
    if (spec.aff > 0) feedAffinityOnly(d, event);
    if (d.cur !== null && event.timestamp > d.cur.lastTs) d.cur.lastTs = event.timestamp;
  }

  const next: EngineState = {
    ...state,
    seq: event.seq,
    tier: commit ? commit.tier : state.tier,
    decision: commit ? commit.decision : state.decision,
    reasonCode: commit?.reasonCode ?? state.reasonCode,
    profile: {
      ...prev,
      scores: behaviourScores(d),
      countsByType,
      countsByDomain,
      meaningfulCount: d.k,
      sessionCount,
      lastSeen: Math.max(prev.lastSeen, event.timestamp),
      recent,
    },
    internal: d,
  };
  const change: EngineChange | null =
    commit && commit.visible && commit.reasonCode
      ? {
          from: refOf(state.decision, state.tier),
          to: refOf(commit.decision, commit.tier),
          confidence: commit.decision.confidence,
          source: ctx.source ?? "deterministic",
          reasonCode: commit.reasonCode,
        }
      : null;
  return { state: next, event, change };
}

/**
 * Start of a new session (D10): sessionCount + 1 and stale decay (6 steps per 14 idle days).
 * Idempotent until the next event, so calling it and then ingesting never counts a session twice.
 */
export function startSession(state: EngineState, now: number): EngineState {
  const d = internalOf(state);
  if (d.sessionOpened) {
    return {
      ...state,
      profile: { ...state.profile, lastSeen: Math.max(state.profile.lastSeen, now) },
    };
  }
  const next = draftOf(d);
  if (state.profile.lastSeen > 0) staleDecay(next, now - state.profile.lastSeen);
  next.sessionOpened = true;
  return {
    ...state,
    profile: {
      ...state.profile,
      scores: behaviourScores(next),
      sessionCount: state.profile.sessionCount + 1,
      lastSeen: Math.max(state.profile.lastSeen, now),
    },
    internal: next,
  };
}

/**
 * Apply merged AI advice as primary/mode TARGETS. The tier always comes from local confidence;
 * confirmations, dwell, budget, reversal lock and vetoes still apply on the next events. Advice from
 * another epoch, or older than 15 meaningful events, is dropped.
 */
export function applyAdvice(state: EngineState, advice: AnalyzerAdvice, _now: number): StepResult {
  const d = internalOf(state);
  const none: StepResult = { state, event: null, change: null };
  if (advice.epoch !== state.epoch) return none;
  if (d.k - advice.meaningfulAt > PR.AI_MAX_AGE_EVENTS) return none;
  const ps = advice.primaryState;
  const P = ps.endsWith("_FIRST") ? (ps.slice(0, -"_FIRST".length) as DomainId) : null;
  if (P !== null && !(DOMAIN_IDS as readonly string[]).includes(P)) return none;
  const next: EngineInternal = { ...d, advice: { P, mode: advice.behaviourMode, atK: d.k } };
  return { state: { ...state, internal: next }, event: null, change: null };
}

/** Undo veto for the last change (20 events + rest of session). Returns the reverted state. */
export function undoChange(state: EngineState, _now: number): StepResult {
  const d = internalOf(state);
  const prevP = d.prevPos?.P ?? null;
  const r = undoInternal(d, prevP !== null ? conf(d, prevP) : 0);
  if (!r) return { state, event: null, change: null };
  return {
    state: {
      ...state,
      tier: r.tier,
      decision: r.decision,
      reasonCode: r.reasonCode,
      internal: r.internal,
    },
    event: null,
    change: {
      from: refOf(state.decision, state.tier),
      to: refOf(r.decision, r.tier),
      confidence: r.decision.confidence,
      source: "undo",
      reasonCode: r.reasonCode,
    },
  };
}

/** resetEvolution(): epoch + 1, decision → UNIVERSAL; keeps counts, recents and the session count. */
export function resetEngine(state: EngineState): EngineState {
  const base = createEngine(state.scope);
  return {
    ...base,
    epoch: state.epoch + 1,
    seq: state.seq,
    profile: { ...state.profile, scores: { ...ZERO_SCORES }, meaningfulCount: 0 },
    internal: resetInternal(internalOf(state)),
  };
}

/** Rebuild state from an event log (bit-identical with incremental ingest). */
export function replayEvents(scope: Scope, events: readonly BehaviourEvent[]): EngineState {
  let s = createEngine(scope);
  for (const e of events) s = ingest(s, e, { now: e.timestamp, sessionId: e.sessionId }).state;
  return s;
}

/** Step-by-step trace for the Lab's replay. */
export function traceEvents(scope: Scope, events: readonly BehaviourEvent[]): TraceStep[] {
  let s = createEngine(scope);
  return events.map((e) => {
    const r = ingest(s, e, { now: e.timestamp, sessionId: e.sessionId });
    s = r.state;
    return { seq: e.seq, event: e, tier: s.tier, decision: s.decision, change: r.change };
  });
}

/** Local template text for a reason code (never the AI's words). */
export function renderReason(code: ReasonCode): string {
  return renderReasonImpl(code);
}

/** "2 more career actions to Career navigation" — or null at the top tier. */
export function explainNext(state: EngineState): string | null {
  return nextStepText(internalOf(state));
}

/** Lab: scores, confidences, targets, pending counters and pacing for the current state. */
export function explainState(state: EngineState): Explanation {
  return explainInternal(internalOf(state));
}

export type { Explanation };
