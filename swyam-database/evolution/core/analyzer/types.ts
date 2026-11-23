/**
 * AI analyzer contracts (plan §5.2–§5.4). Shared by the client scheduler, the
 * summariser, the merge policy and the server route /api/evolution.
 *
 * The request carries AGGREGATES ONLY: no free text, entity ids, names, user id
 * or raw event stream. The AI only SELECTS enum values; its output is never
 * rendered as HTML, evaluated, or turned into routes, CSS, SQL or commands.
 */
import type {
  AiFallback,
  AnalyzerTrigger,
  BehaviourMode,
  BehaviourScores,
  EventType,
  EvolutionDecision,
  EvolutionState,
  NavItemId,
  Tier,
} from "../../types";

export interface AnalyzerRequest {
  v: 1;
  trigger: AnalyzerTrigger;
  /** Rounded to 0.05; also the cache key. */
  scores: BehaviourScores;
  /** ≤ 8 */
  topActions: { type: EventType; count: number }[];
  /** ≤ 5 */
  repeated: { type: EventType; count: number }[];
  /** ≤ 10 */
  navPattern: NavItemId[];
  session: { events: number; minutes: number; sessions: number; completed: number };
  current: {
    primaryState: EvolutionState;
    behaviourMode: BehaviourMode;
    confidence: number;
    tier: Tier;
  };
  deterministic: EvolutionDecision;
}

/** /api/evolution always answers 200 with one of these. Never model names or quota text. */
export type AnalyzerResponse =
  | { ok: true; source: "ai"; decision: EvolutionDecision; cached?: boolean }
  | { ok: false; fallback: AiFallback };

/**
 * A validated AI decision after the merge policy (core/analyzer/merge.ts).
 * The engine (core/evolution/engine.ts → applyAdvice) may use ONLY the primary
 * and mode targets; tier, navigation, layout and actions stay local.
 */
export interface AnalyzerAdvice {
  primaryState: EvolutionState;
  behaviourMode: BehaviourMode;
  /** min(ai.confidence, local + 0.15) */
  confidence: number;
  /** Engine epoch and meaningful-event count when the request was sent; stale advice is dropped. */
  epoch: number;
  meaningfulAt: number;
  /** Sanitised AI reason, shown in the Lab only, labelled "AI analysis". */
  aiReason: string;
}

export type MergeOutcome =
  | { kind: "advice"; advice: AnalyzerAdvice }
  | {
      kind: "rejected";
      reason: "evidence_floor" | "stale" | "wrong_epoch" | "locked" | "invalid" | "same";
    };

/** Request headers / env (documented in .env.example). */
export const EVOLUTION_FIXTURE_HEADER = "x-evolution-fixture";
export type EvolutionFixtureMode = "timeout" | "invalid" | "rate_limited" | "unavailable";
