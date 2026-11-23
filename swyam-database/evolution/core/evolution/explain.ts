/**
 * explain(): the read-only Lab view of the engine (scores, confidences, targets, pending counters,
 * pacing remaining and the next threshold in words). Never changes state.
 */
import { DOMAIN_IDS } from "../../config/ids";
import type { BehaviourMode, BehaviourScores, DomainId, Tier } from "../../types";
import {
  behaviourScores,
  conf,
  eligibility,
  scores,
  sessionsUsing,
  topDomain,
  windowStats,
} from "./accumulate";
import { modeTarget, primaryTarget, type PrimaryTarget } from "./decide";
import { EVOLUTION_PARAMS as PR, type Trait } from "./params";
import { DOMAIN_LABEL, DOMAIN_WORD } from "./reasons";
import type { EngineInternal, ModePending, PrimaryPending } from "./types";

export interface Explanation {
  k: number;
  scores: BehaviourScores;
  /** c(d) per domain, 0..1. */
  confidence: Record<DomainId, number>;
  /** The two domains with the most evidence, canonical order on ties. */
  top: [DomainId, DomainId];
  primary: DomainId | null;
  tier: Tier;
  mode: BehaviourMode;
  targets: { primary: PrimaryTarget; mode: BehaviourMode };
  pending: { primary: PrimaryPending | null; mode: ModePending | null };
  eligible: Record<Trait, boolean>;
  dwellRemaining: number;
  budgetRemaining: number;
  lockRemaining: number;
  nextThreshold: string | null;
}

export function explain(s: EngineInternal): Explanation {
  const sc = scores(s);
  const ws = windowStats(s);
  const el = eligibility(s, ws);
  const confidence = {} as Record<DomainId, number>;
  for (const d of DOMAIN_IDS) confidence[d] = conf(s, d);
  const ranked = [...DOMAIN_IDS].sort(
    (a, b) => s.E[b] - s.E[a] || DOMAIN_IDS.indexOf(a) - DOMAIN_IDS.indexOf(b),
  );
  const since = s.k - s.lastVisibleK;
  return {
    k: s.k,
    scores: behaviourScores(s),
    confidence,
    top: [ranked[0] as DomainId, ranked[1] as DomainId],
    primary: s.P,
    tier: s.P === null ? 0 : s.ptier,
    mode: s.mode,
    targets: { primary: primaryTarget(s, ws), mode: modeTarget(s, sc, el) },
    pending: { primary: s.primPending, mode: s.modePending },
    eligible: el,
    dwellRemaining: Math.max(0, PR.DWELL - since),
    budgetRemaining: Math.max(0, PR.SESSION_BUDGET - s.sessionChanges),
    lockRemaining: s.prevKey === null ? 0 : Math.max(0, PR.REVERSAL_LOCK - since),
    nextThreshold: nextStepText(s),
  };
}

/** "2 more career actions to Career navigation", or null at the top tier or when nothing is close. */
export function nextStepText(s: EngineInternal): string | null {
  const top = topDomain(s);
  if (s.E[top] === 0) return null;
  const d = s.P ?? top;
  const next = s.P === null ? 1 : s.ptier < 3 ? ((s.ptier + 1) as 1 | 2 | 3) : null;
  if (next === null) return null;
  const word = DOMAIN_WORD[d];
  const label = DOMAIN_LABEL[d];
  const ws = windowStats(s);
  const p = ws.per[d];
  let needed = Math.max(
    PR.GATE_N[next] - p.n,
    PR.MIN_TOTAL - s.k,
    p.types.length < PR.GATE_TYPES ? 1 : 0,
  );
  const pend = s.primPending;
  if (pend !== null && pend.dir === "up" && pend.target.P === d)
    needed = Math.max(needed, PR.CONFIRM_UP - pend.count);
  else needed = Math.max(needed, PR.CONFIRM_UP);
  needed = Math.max(1, needed);
  const noun = needed === 1 ? "action" : "actions";
  if (next === 3 && sessionsUsing(s, d) < PR.VH_SESSIONS)
    return `another visit with ${word} activity for more room on Home`;
  const to =
    next === 1
      ? "to move it up on Home"
      : next === 2
        ? `to ${label} navigation`
        : "for more room on Home";
  return `${needed} more ${word} ${noun} ${to}`;
}
