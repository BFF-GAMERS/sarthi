/**
 * Merge policy for validated AI advice (plan §5.4, ONE's engine.md design).
 *
 * The AI may only SUGGEST the primary state and behaviour mode. Everything
 * else (tier, navigation, layout, actions, the notice text) is recomposed
 * locally, so an AI answer can never reach further than a local one could.
 *
 *  - tier           always from the LOCAL confidence (advice has no tier)
 *  - evidence floor a state whose matching affinity is < 0.25 is rejected
 *  - confidence     min(ai, local + 0.15)
 *  - stale / epoch  advice older than 15 meaningful events, or from before a
 *                   reset, is dropped
 *  - lock           a locked layout never takes advice
 *  - hysteresis     still applied by engine.applyAdvice afterwards
 *
 * Pure: no react, no DOM, no clock.
 */
import type { BehaviourScores, EvolutionDecision, EvolutionState } from "../../types";
import type { EngineState } from "../evolution/engine";
import { validateDecision } from "../ui-state/validate";
import type { MergeOutcome } from "./types";

export const EVIDENCE_FLOOR = 0.25;
export const CONFIDENCE_HEADROOM = 0.15;
export const STALE_AFTER_EVENTS = 15;

/** Which local score has to back each state. UNIVERSAL needs none (it is the neutral state). */
const EVIDENCE: Record<EvolutionState, keyof BehaviourScores | null> = {
  UNIVERSAL: null,
  LEARNING_FIRST: "learningAffinity",
  CAREER_FIRST: "careerAffinity",
  SKILL_EXCHANGE_FIRST: "skillExchangeAffinity",
  COMMUNITY_FIRST: "communityAffinity",
  EXPLORER: "explorer",
};

export interface MergeInput {
  /** The AI's decision (re-validated here; never trusted because the server validated it). */
  decision: unknown;
  /** The engine as it is NOW. */
  engine: EngineState;
  /** The engine's epoch and meaningful count when the request was SENT. */
  sent: { epoch: number; meaningful: number };
  locked: boolean;
}

export function mergeAdvice(input: MergeInput): MergeOutcome {
  const checked = validateDecision(input.decision, "ai");
  if (!checked.ok) return { kind: "rejected", reason: "invalid" };
  const ai: EvolutionDecision = checked.value;
  const { engine, sent } = input;

  if (engine.epoch !== sent.epoch) return { kind: "rejected", reason: "wrong_epoch" };
  if (engine.profile.meaningfulCount - sent.meaningful > STALE_AFTER_EVENTS)
    return { kind: "rejected", reason: "stale" };
  if (input.locked) return { kind: "rejected", reason: "locked" };

  const key = EVIDENCE[ai.primaryState];
  if (key !== null && (engine.profile.scores[key] ?? 0) < EVIDENCE_FLOOR)
    return { kind: "rejected", reason: "evidence_floor" };

  const local = engine.decision;
  if (ai.primaryState === local.primaryState && ai.behaviourMode === local.behaviourMode)
    return { kind: "rejected", reason: "same" };

  return {
    kind: "advice",
    advice: {
      primaryState: ai.primaryState,
      behaviourMode: ai.behaviourMode,
      confidence: Math.max(0, Math.min(ai.confidence, local.confidence + CONFIDENCE_HEADROOM)),
      epoch: sent.epoch,
      meaningfulAt: sent.meaningful,
      aiReason: ai.reason.replace(/\s+/g, " ").trim().slice(0, 160),
    },
  };
}
