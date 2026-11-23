/**
 * Decision targets (plan §3.3): gates, the primary target with hysteresis, the mode target, and
 * the mapping from a machine position to an EvolutionDecision.
 *
 * EvolutionState is DERIVED, never stored as a fifth domain:
 *   state = P ? `${P}_FIRST` : mode === EXPLORER ? EXPLORER : UNIVERSAL
 * There is no direct domain -> domain rule, so G3 holds by construction: a new domain enters only
 * from P = null, and the incumbent relaxes through its exit bands first.
 */
import { EVOLUTION_CONFIG as C } from "../../config/evolution-config";
import type { BehaviourMode, DomainId, EvolutionDecision, EvolutionState, Tier } from "../../types";
import {
  conf,
  sessionsTotal,
  sessionsUsing,
  topDomain,
  type Scores,
  type WindowStats,
} from "./accumulate";
import { compose, actionsFor } from "./compose";
import { EVOLUTION_PARAMS as PR, MODE_PRECEDENCE, allowedModes, type Trait } from "./params";
import type { EngineInternal, Position } from "./types";

export interface PrimaryTarget {
  P: DomainId | null;
  ptier: Tier;
}

/** Eligibility of `d` for tier >= 1. */
export function gatesOK(s: EngineInternal, ws: WindowStats, d: DomainId, tier: 1 | 2 | 3): boolean {
  if (s.k < PR.MIN_TOTAL) return false;
  const p = ws.per[d];
  if (p.n < PR.GATE_N[tier] || p.types.length < PR.GATE_TYPES) return false;
  if (tier === 3 && sessionsUsing(s, d) < PR.VH_SESSIONS) return false;
  return true;
}

const adviceFresh = (s: EngineInternal): boolean =>
  s.advice !== null && s.k - s.advice.atK <= PR.AI_MAX_AGE_EVENTS;

/** The local primary target. NO direct domain -> domain rule (G3). */
export function primaryTarget(s: EngineInternal, ws: WindowStats): PrimaryTarget {
  if (s.P === null) {
    const top = topDomain(s);
    if (conf(s, top) >= PR.ENTER[1] && gatesOK(s, ws, top, 1)) return { P: top, ptier: 1 };
    // Held AI advice may enter a domain from neutral, still bounded by the local stay band and gates.
    const a = s.advice;
    if (
      a !== null &&
      adviceFresh(s) &&
      a.P !== null &&
      conf(s, a.P) >= PR.EXIT[1] &&
      gatesOK(s, ws, a.P, 1)
    )
      return { P: a.P, ptier: 1 };
    return { P: null, ptier: 0 };
  }
  const cP = conf(s, s.P);
  const top = topDomain(s);
  if (cP < PR.EXIT[s.ptier]) {
    // demote straight to the highest tier whose stay band still holds
    let t = s.ptier - 1;
    while (t > 0 && cP < (PR.EXIT[t] as number)) t -= 1;
    return t === 0 ? { P: null, ptier: 0 } : { P: s.P, ptier: t as Tier };
  }
  if (top === s.P && s.ptier < 3) {
    const next = (s.ptier + 1) as 1 | 2 | 3;
    if (cP >= PR.ENTER[next] && gatesOK(s, ws, s.P, next)) return { P: s.P, ptier: next };
  }
  return { P: s.P, ptier: s.ptier };
}

/** Modes a position may carry right now: no-domain modes wait for the second session. */
export function candidateModes(
  P: DomainId | null,
  s: Pick<EngineInternal, "sessions" | "cur">,
): readonly Trait[] {
  if (P === null && sessionsTotal(s) < PR.VH_SESSIONS) return [];
  return allowedModes(P);
}

/** Best eligible candidate (score >= MODE_ENTER); within MODE_TIE of the max, precedence wins. */
export function bestMode(
  cands: readonly Trait[],
  sc: Readonly<Record<Trait, number>>,
  el: Readonly<Record<Trait, boolean>>,
  exclude?: BehaviourMode,
): Trait | null {
  const ok = (m: Trait): boolean =>
    m !== exclude && cands.includes(m) && el[m] && sc[m] >= PR.MODE_ENTER;
  let max = -1;
  for (const m of MODE_PRECEDENCE) if (ok(m) && sc[m] > max) max = sc[m];
  if (max < 0) return null;
  for (const m of MODE_PRECEDENCE) if (ok(m) && sc[m] >= max - PR.MODE_TIE) return m;
  return null;
}

/** The mode target for the CURRENT primary. */
export function modeTarget(
  s: EngineInternal,
  sc: Scores,
  el: Readonly<Record<Trait, boolean>>,
): BehaviourMode {
  const M = s.mode;
  const b = sc.behaviour;
  const cands = candidateModes(s.P, s);
  const a = s.advice;
  if (
    a !== null &&
    adviceFresh(s) &&
    a.mode !== "BALANCED" &&
    a.mode !== M &&
    s.k >= PR.MODE_MIN_TOTAL &&
    cands.includes(a.mode)
  )
    return a.mode;
  // Fresh advice that has been adopted holds until it ages out; local evidence takes over after that.
  if (
    a !== null &&
    adviceFresh(s) &&
    M === a.mode &&
    (cands as readonly BehaviourMode[]).includes(M)
  )
    return M;
  if (M === "BALANCED") return bestMode(cands, b, el) ?? "BALANCED";
  if (!cands.includes(M) || !el[M] || b[M] < PR.MODE_EXIT)
    return bestMode(cands, b, el, M) ?? "BALANCED";
  const X = bestMode(cands, b, el, M);
  return X !== null && b[X] >= b[M] + PR.MODE_SWITCH ? X : M;
}

/** A mode survives a primary change only if it is allowed for the new primary and still qualifies. */
export function modeQualifies(
  mode: BehaviourMode,
  P: DomainId | null,
  s: EngineInternal,
  sc: Scores,
  el: Readonly<Record<Trait, boolean>>,
): boolean {
  if (mode === "BALANCED") return true;
  return candidateModes(P, s).includes(mode) && el[mode] && sc.behaviour[mode] >= PR.MODE_ENTER;
}

/* ── position → decision ────────────────────────────────────────────── */

export const stateOf = (p: Position): EvolutionState =>
  p.P !== null
    ? (`${p.P}_FIRST` as EvolutionState)
    : p.mode === "EXPLORER"
      ? "EXPLORER"
      : "UNIVERSAL";

/** The displayed tier: the primary's tier, or 3 for a no-domain mode (which waits for session 2), else 0. */
export const tierOfPos = (p: Position): Tier =>
  p.P !== null ? p.ptier : p.mode === "BALANCED" ? 0 : 3;

export const round2 = (x: number): number => Math.round(x * 100) / 100;

export function decisionOf(
  p: Position,
  confidence: number,
  reason: string,
): { decision: EvolutionDecision; tier: Tier } {
  const state = stateOf(p);
  const tier = tierOfPos(p);
  const cfg = C.states[state];
  return {
    tier,
    decision: {
      primaryState: state,
      behaviourMode: p.mode,
      navigationMode: p.P !== null && C.tiers[tier].navChanges ? cfg.nav : "UNIVERSAL",
      homepageLayout: tier >= 1 ? cfg.layout : "UNIVERSAL",
      priorityActions: actionsFor(state, tier),
      reason,
      confidence: round2(confidence),
    },
  };
}

/**
 * The STRUCTURAL identity of an arrangement: what the user would see change (CTA, nav, sections,
 * actions, density, display). A mode change that alters none of it is a silent commit.
 */
export function visualKey(decision: EvolutionDecision, tier: Tier): string {
  const ui = compose(decision, tier, { signedIn: true, stableNav: false, locked: false });
  const d = ui.display;
  return [
    ui.hero.cta,
    ui.hero.ledeKey,
    ui.navigation.top.join(","),
    ui.sections.map((x) => x.id + (x.folded ? "~" : "")).join(","),
    ui.priorityActions.join(","),
    ui.density,
    d.shortcutsRow ? 1 : 0,
    d.showCompare ? 1 : 0,
    d.showFilters ? 1 : 0,
    d.itemsPerSection,
  ].join("|");
}
