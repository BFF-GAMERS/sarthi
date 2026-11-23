/**
 * Engine-internal state (plan §3.1 table). Everything is plain JSON so the whole EngineState
 * survives JSON.stringify/parse and replays bit-identically.
 */
import type { BehaviourMode, DomainId, EventType, Tier } from "../../types";
import type { EventKind } from "../behaviour/taxonomy";

export type ByDomain = Record<DomainId, number>;

/** One of the last 20 meaningful events, as the gates and eligibility see it. */
export interface WindowEntry {
  type: EventType;
  domain: DomainId | null;
  kind: EventKind;
  research?: true;
  repeat?: true;
  quick?: true;
  commit?: true;
}

export interface SessionSummary {
  id: string;
  n: number;
  domains: DomainId[];
  task: boolean;
  /** minimalUser contribution of the closed session. */
  m: number;
}

export interface OpenSession {
  id: string;
  start: number;
  lastTs: number;
  n: number;
  domains: DomainId[];
  task: boolean;
  novelty: Record<string, number>;
  viewed: Partial<Record<DomainId, string[]>>;
  anchorTs: number;
  anchorSteps: number;
  maxGap: number;
}

/** A position of the machine: primary domain, its tier and the mode. */
export interface Position {
  P: DomainId | null;
  /** Tier of the primary domain (1..3), 0 when P is null. */
  ptier: Tier;
  mode: BehaviourMode;
}

export interface PrimaryPending {
  dir: "up" | "down";
  count: number;
  target: { P: DomainId | null; ptier: Tier };
}

export interface ModePending {
  target: BehaviourMode;
  count: number;
}

export interface Veto {
  key: string;
  untilK: number;
  sessionId: string;
}

/** Validated AI advice, held as primary/mode TARGETS (never tier, nav, layout or actions). */
export interface HeldAdvice {
  P: DomainId | null;
  mode: BehaviourMode;
  /** Meaningful count when it was applied; ages out after AI_MAX_AGE_EVENTS. */
  atK: number;
}

export interface EngineInternal {
  v: 1;
  /** Meaningful events folded since reset. */
  k: number;
  /** Decayed domain evidence. */
  E: ByDomain;
  /** Decayed commit evidence for the *_FOCUSED modes. */
  F: ByDomain;
  /** Decayed event counts (breadth). */
  C: ByDomain;
  /** Research, repeat and quick accumulators. */
  R: number;
  Rp: number;
  Qn: number;
  Qd: number;
  window: WindowEntry[];
  /** Closed sessions, newest first. */
  sessions: SessionSummary[];
  cur: OpenSession | null;
  /** `${domain}:${entityId}` LRU, newest first. */
  seen: string[];
  P: DomainId | null;
  ptier: Tier;
  mode: BehaviourMode;
  primPending: PrimaryPending | null;
  modePending: ModePending | null;
  primWait: number;
  lastVisibleK: number;
  /** Visual key of the arrangement shown before the last visible change (reversal lock). */
  prevKey: string | null;
  /** Position shown before the last visible change (the Undo target). */
  prevPos: Position | null;
  /** Visual key of the arrangement on screen. */
  vis: string;
  sessionChanges: number;
  vetoes: Veto[];
  advice: HeldAdvice | null;
  /** True between startSession() and the first event of that session, so it is not counted twice. */
  sessionOpened: boolean;
}
