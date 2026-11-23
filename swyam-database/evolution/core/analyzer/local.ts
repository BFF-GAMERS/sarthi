/**
 * The deterministic analyzer: what the engine would show NOW if confirmations, dwell, budget,
 * reversal lock and vetoes were already satisfied. It is the `deterministic` field of the AI
 * request, the fallback when the AI is off, and the baseline the merge policy compares against.
 * Pure and synchronous: the engine never awaits an analyzer.
 */
import type { EvolutionDecision, Tier } from "../../types";
import { conf, eligibility, scores, windowStats } from "../evolution/accumulate";
import { decisionOf, modeQualifies, modeTarget, primaryTarget } from "../evolution/decide";
import { candidateModes } from "../evolution/decide";
import type { EngineState } from "../evolution/engine";
import { renderReason, reasonFor } from "../evolution/reasons";
import type { EngineInternal, Position } from "../evolution/types";
import { validateDecision } from "../ui-state/validate";

export function decideLocal(state: EngineState): { decision: EvolutionDecision; tier: Tier } {
  const s = state.internal as EngineInternal;
  const sc = scores(s);
  const ws = windowStats(s);
  const el = eligibility(s, ws);
  const tgt = primaryTarget(s, ws);
  const from: Position = { P: s.P, ptier: s.ptier, mode: s.mode };
  const mt = modeTarget(s, sc, el);
  const to: Position = { P: tgt.P, ptier: tgt.ptier, mode: mt };
  if (to.mode !== "BALANCED" && to.P !== from.P) {
    const keep =
      mt !== from.mode
        ? candidateModes(to.P, s).includes(to.mode)
        : modeQualifies(to.mode, to.P, s, sc, el);
    if (!keep) to.mode = "BALANCED";
  }
  if (to.P === from.P && to.ptier === from.ptier && to.mode === from.mode)
    return { decision: state.decision, tier: state.tier };
  const confidence =
    to.P !== null ? conf(s, to.P) : to.mode !== "BALANCED" ? sc.behaviour[to.mode] : 0;
  const made = decisionOf(to, confidence, renderReason(reasonFor(from, to, ws)));
  const checked = validateDecision(made.decision, "local");
  return checked.ok
    ? { decision: checked.value, tier: made.tier }
    : { decision: state.decision, tier: state.tier };
}
