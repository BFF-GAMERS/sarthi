/**
 * Test-only builders for the analyzer, the AI route and the scheduler.
 * Never imported by app code.
 */
import { EVOLUTION_CONFIG as C } from "../../config/evolution-config";
import type {
  BehaviourEvent,
  BehaviourMode,
  BehaviourScores,
  DomainId,
  EventType,
  EvolutionDecision,
  EvolutionState,
  Tier,
} from "../../types";
import { createEngine, type EngineState } from "../evolution/engine";
import { summarize } from "./summarize";
import type { AnalyzerRequest } from "./types";

/** A coherent decision for a state, straight from config. */
export function decide(
  state: EvolutionState,
  mode: BehaviourMode = "RESEARCH",
  confidence = 0.8,
  reason = "Usage points this way.",
): EvolutionDecision {
  const s = C.states[state];
  return {
    primaryState: state,
    behaviourMode: mode,
    navigationMode: s.nav,
    homepageLayout: s.layout,
    priorityActions: [...C.priorityActions[state]],
    reason,
    confidence,
  };
}

export interface EngineOverrides {
  scores?: Partial<BehaviourScores>;
  meaningful?: number;
  domains?: Partial<Record<DomainId, number>>;
  countsByType?: Partial<Record<EventType, number>>;
  decision?: EvolutionDecision;
  epoch?: number;
  tier?: Tier;
  sessions?: number;
}

/** A guest engine with the given profile numbers. The engine facade itself is not exercised. */
export function engineWith(o: EngineOverrides = {}): EngineState {
  const base = createEngine("guest");
  return {
    ...base,
    epoch: o.epoch ?? 0,
    tier: o.tier ?? 0,
    decision: o.decision ?? base.decision,
    profile: {
      ...base.profile,
      scores: { ...base.profile.scores, ...o.scores },
      meaningfulCount: o.meaningful ?? 0,
      sessionCount: o.sessions ?? 1,
      countsByDomain: { ...base.profile.countsByDomain, ...o.domains },
      countsByType: o.countsByType ?? {},
    },
  };
}

let seq = 0;
export function ev(type: EventType, over: Partial<BehaviourEvent> = {}): BehaviourEvent {
  seq += 1;
  return {
    v: 1,
    seq,
    type,
    timestamp: 1_700_000_000_000 + seq * 1000,
    sessionId: "s1",
    service: "PLATFORM",
    entityId: null,
    metadata: {} as BehaviourEvent["metadata"],
    ...over,
  };
}

/** A valid request, summarised from an engine that has seen enough to qualify. */
export function validRequest(o: EngineOverrides = {}): AnalyzerRequest {
  const engine = engineWith({
    meaningful: 20,
    domains: { LEARNING: 8, CAREER: 12 },
    scores: { careerAffinity: 0.62, learningAffinity: 0.3 },
    countsByType: { job_viewed: 12, course_viewed: 8 },
    ...o,
  });
  return summarize(engine, [ev("job_viewed"), ev("job_viewed")], "threshold");
}
