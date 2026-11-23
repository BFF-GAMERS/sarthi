/**
 * A committed (engine-decided) state, as the presenter and coordinator see it.
 *
 * `rev` is monotonic per scope and bumps whenever the engine's decision, tier or reason changes. What the user
 * is SHOWN is the presented commit; the coordinator decides when a newer commit becomes the presented one.
 */
import type {
  DecisionSource,
  EvolutionDecision,
  EvolutionSnapshotRef,
  ReasonCode,
  Tier,
} from "../types";

export interface Committed {
  rev: number;
  decision: EvolutionDecision;
  tier: Tier;
  reasonCode: ReasonCode;
  source: DecisionSource;
  at: number;
}

/** Everything that changes what is rendered (reason and confidence excluded, like UIState.renderKey). */
export const structureKey = (c: Pick<Committed, "decision" | "tier">): string =>
  [
    c.decision.primaryState,
    c.decision.behaviourMode,
    c.tier,
    c.decision.navigationMode,
    c.decision.homepageLayout,
    c.decision.priorityActions.join(","),
  ].join("|");

/** Confidence moves by less than this are "trivial": never worth a new snapshot on their own. */
export const TRIVIAL_CONFIDENCE_DELTA = 0.03;

/** True when going from `a` to `b` changes nothing the user would see or read. */
export function isTrivialDelta(a: Committed, b: Committed): boolean {
  return (
    structureKey(a) === structureKey(b) &&
    a.reasonCode.key === b.reasonCode.key &&
    Math.abs(a.decision.confidence - b.decision.confidence) < TRIVIAL_CONFIDENCE_DELTA
  );
}

export const refOf = (c: Pick<Committed, "decision" | "tier">): EvolutionSnapshotRef => ({
  state: c.decision.primaryState,
  mode: c.decision.behaviourMode,
  nav: c.decision.navigationMode,
  layout: c.decision.homepageLayout,
  tier: c.tier,
});

/** Sources that come from a user command or a demo: released instantly, never queued behind a safe point. */
export const INSTANT_SOURCES: ReadonlySet<DecisionSource> = new Set<DecisionSource>([
  "reset",
  "undo",
  "persona",
  "manual",
]);
