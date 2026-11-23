/**
 * evaluate(): the ONLY gate between evidence and a visible change (plan §3.3). Targets come from
 * decide.ts; confirmations, dwell, session budget, reversal lock and undo vetoes live here.
 * Mutates the draft only; the caller owns cloning.
 */
import type { EvolutionDecision, ReasonCode, Tier } from "../../types";
import { validateDecision } from "../ui-state/validate";
import { conf, eligibility, scores, windowStats } from "./accumulate";
import {
  candidateModes,
  decisionOf,
  modeQualifies,
  modeTarget,
  primaryTarget,
  visualKey,
} from "./decide";
import { isVetoed } from "./memory";
import { EVOLUTION_PARAMS as PR } from "./params";
import { reasonFor, renderReason } from "./reasons";
import type { EngineInternal, Position } from "./types";

/** Why a ready change was held back this event. */
export type BlockReason = "dwell" | "budget" | "reversal" | "veto";

export interface Commit {
  from: Position;
  to: Position;
  visible: boolean;
  decision: EvolutionDecision;
  tier: Tier;
  /** Null for a silent commit (the arrangement on screen did not change). */
  reasonCode: ReasonCode | null;
}

/** Pacing guards for a visible change: dwell, session budget, reversal lock, undo veto. */
export function blockedBy(s: EngineInternal, key: string): BlockReason | null {
  const since = s.k - s.lastVisibleK;
  if (since < PR.DWELL) return "dwell";
  if (s.sessionChanges >= PR.SESSION_BUDGET) return "budget";
  if (key === s.prevKey && since < PR.REVERSAL_LOCK) return "reversal";
  if (isVetoed(s, key, s.k, s.cur?.id ?? null)) return "veto";
  return null;
}

export function evaluate(d: EngineInternal, prevReason: string): Commit | null {
  const sc = scores(d);
  const ws = windowStats(d);
  const el = eligibility(d, ws);

  // primary pending (the count follows the direction)
  const tgt = primaryTarget(d, ws);
  const curRank = d.P === null ? 0 : d.ptier;
  const tRank = tgt.P === null ? 0 : tgt.ptier;
  if (tgt.P === d.P && tgt.ptier === d.ptier) d.primPending = null;
  else {
    const dir = tRank > curRank ? "up" : "down";
    d.primPending =
      d.primPending !== null && d.primPending.dir === dir
        ? { dir, count: d.primPending.count + 1, target: tgt }
        : { dir, count: 1, target: tgt };
  }

  // mode pending (resets when the target changes)
  const mt = modeTarget(d, sc, el);
  if (mt === d.mode) d.modePending = null;
  else
    d.modePending =
      d.modePending !== null && d.modePending.target === mt
        ? { target: mt, count: d.modePending.count + 1 }
        : { target: mt, count: 1 };

  const pp = d.primPending;
  const mp = d.modePending;
  const primReady = pp !== null && pp.count >= (pp.dir === "up" ? PR.CONFIRM_UP : PR.CONFIRM_DOWN);
  const modeReady =
    mp !== null &&
    mp.count >= (d.mode === "BALANCED" ? PR.MODE_CONFIRM_ENTER : PR.MODE_CONFIRM_CHANGE);

  // a ready tier-up of an applied domain waits <= MODE_WAIT events for a pending mode (one change)
  let waiting = false;
  if (
    primReady &&
    pp.dir === "up" &&
    d.P !== null &&
    mp !== null &&
    !modeReady &&
    d.primWait < PR.MODE_WAIT
  ) {
    d.primWait += 1;
    waiting = true;
  }
  if (d.primPending === null) d.primWait = 0;
  if (waiting || !(primReady || modeReady)) return null;

  const from: Position = { P: d.P, ptier: d.ptier, mode: d.mode };
  const to: Position = { ...from };
  if (primReady) {
    to.P = pp.target.P;
    to.ptier = pp.target.ptier;
  }
  if (modeReady) to.mode = mp.target;
  // re-qualification: a primary change keeps a mode only if it is allowed and still qualifies
  if (to.mode !== "BALANCED" && to.P !== from.P) {
    const keep = modeReady
      ? candidateModes(to.P, d).includes(to.mode)
      : modeQualifies(to.mode, to.P, d, sc, el);
    if (!keep) to.mode = "BALANCED";
  }
  if (to.P === from.P && to.ptier === from.ptier && to.mode === from.mode) {
    if (primReady) d.primPending = null;
    if (modeReady) d.modePending = null;
    return null;
  }

  const confidence =
    to.P !== null ? conf(d, to.P) : to.mode !== "BALANCED" ? sc.behaviour[to.mode] : 0;
  const code = reasonFor(from, to, ws);
  const made = decisionOf(to, confidence, renderReason(code));
  let decision = made.decision;
  const tier = made.tier;
  const key = visualKey(decision, tier);
  const visible = key !== d.vis;
  if (visible && blockedBy(d, key) !== null) return null; // deferred: counts kept
  if (!visible) decision = { ...decision, reason: prevReason };
  const checked = validateDecision(decision, "local");
  if (!checked.ok) return null; // unreachable by construction; never commit an invalid decision
  decision = checked.value;

  d.P = to.P;
  d.ptier = to.ptier;
  d.mode = to.mode;
  if (primReady) {
    d.primPending = null;
    d.primWait = 0;
  }
  if (modeReady || d.modePending?.target === d.mode) d.modePending = null;
  if (visible) {
    d.prevKey = d.vis;
    d.prevPos = from;
    d.vis = key;
    d.lastVisibleK = d.k;
    d.sessionChanges += 1;
  }
  return { from, to, visible, decision, tier, reasonCode: visible ? code : null };
}
