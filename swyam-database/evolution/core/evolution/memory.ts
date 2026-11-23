/**
 * Internal-state factory, vetoes and the two engine COMMANDS (undo, reset).
 * Undo and reset are not behaviour events: they never add evidence.
 */
import type { EvolutionDecision, ReasonCode, Tier } from "../../types";
import { initialInternal } from "./accumulate";
import { UNIVERSAL_DECISION } from "./compose";
import { decisionOf, tierOfPos, visualKey } from "./decide";
import { EVOLUTION_PARAMS as PR } from "./params";
import { renderReason } from "./reasons";
import type { EngineInternal, Position } from "./types";

/** The visual key of the neutral arrangement. Computed lazily: evaluating it at module load
 *  trips an import cycle in the SSR bundle (config not yet initialised). */
let universalVis: string | null = null;
export function universalVisKey(): string {
  return (universalVis ??= visualKey(UNIVERSAL_DECISION, 0));
}

/** A fresh engine internal: UNIVERSAL, k 0. */
export function freshInternal(): EngineInternal {
  return { ...initialInternal(), vis: universalVisKey() };
}

/** Whether `key` is vetoed at meaningful index `k` in session `sessionId` (20 events AND the rest of the session). */
export const isVetoed = (
  s: Pick<EngineInternal, "vetoes">,
  key: string,
  k: number,
  sessionId: string | null,
): boolean => s.vetoes.some((v) => v.key === key && (k < v.untilK || v.sessionId === sessionId));

export interface UndoResult {
  internal: EngineInternal;
  from: Position;
  to: Position;
  decision: EvolutionDecision;
  tier: Tier;
  reasonCode: ReasonCode;
}

/**
 * Undo: restore the position shown before the last visible change, veto the undone arrangement for
 * 20 events AND the rest of the session, and use no change budget. Null when there is nothing to undo.
 */
export function undoInternal(d: EngineInternal, confidence: number): UndoResult | null {
  const prev = d.prevPos;
  if (prev === null) return null;
  const reasonCode: ReasonCode = { key: "UNDO" };
  const { decision, tier } = decisionOf(prev, confidence, renderReason(reasonCode));
  const key = visualKey(decision, tier);
  if (key === d.vis) return null;
  const from: Position = { P: d.P, ptier: d.ptier, mode: d.mode };
  const sessionId = d.cur?.id ?? "";
  const live = d.vetoes.filter((v) => d.k < v.untilK || v.sessionId === sessionId);
  const internal: EngineInternal = {
    ...d,
    P: prev.P,
    ptier: prev.ptier,
    mode: prev.mode,
    primPending: null,
    modePending: null,
    primWait: 0,
    lastVisibleK: d.k,
    prevKey: d.vis,
    prevPos: null,
    vis: key,
    advice: null,
    vetoes: [...live, { key: d.vis, untilK: d.k + PR.UNDO_VETO_EVENTS, sessionId }].slice(
      -PR.VETO_CAP,
    ),
  };
  return { internal, from, to: prev, decision, tier, reasonCode };
}

/** Reset learning: a fresh internal that does not double-count the session that is already open. */
export function resetInternal(d: EngineInternal): EngineInternal {
  const fresh = freshInternal();
  fresh.sessionOpened = d.cur !== null || d.sessionOpened;
  return fresh;
}

export const tierOf = tierOfPos;
