/**
 * Engine state → AnalyzerRequest (plan §5.2).
 *
 * AGGREGATES ONLY. Nothing here can carry free text, an entity id, a name or a
 * user id: the output is built from enum values (event types, nav item ids,
 * states) and rounded numbers. Scores are rounded to 0.05, which also makes
 * the summary a good cache key and keeps near-identical sessions from costing
 * a call each.
 *
 * Pure: no react, no DOM, no clock.
 */
import { EVENT_TYPES, NAV_ITEM_IDS } from "../../config/ids";
import type {
  AnalyzerTrigger,
  BehaviourEvent,
  BehaviourProfile,
  BehaviourScores,
  EventType,
  NavItemId,
} from "../../types";
import type { EngineState } from "../evolution/engine";
import type { AnalyzerRequest } from "./types";

export const MAX_TOP_ACTIONS = 8;
export const MAX_REPEATED = 5;
export const MAX_NAV_PATTERN = 10;
/** An action type seen at least this often in one session counts as repeated. */
export const REPEAT_MIN = 3;

/** Completed actions (plan §5.5): each is a moment worth re-analysing. */
export const COMPLETED_ACTION_TYPES: readonly EventType[] = [
  "course_completed",
  "job_applied",
  "course_started",
  "application_started",
  "skill_swap_requested",
];

/** Navigation noise: it says where people went, not what they care about. */
const NOISE: ReadonlySet<EventType> = new Set<EventType>(["page_viewed"]);

const NAV_IDS: ReadonlySet<string> = new Set(NAV_ITEM_IDS);
const TYPE_ORDER = new Map<EventType, number>(EVENT_TYPES.map((t, i) => [t, i]));

/** Round to the nearest 0.05 (and to a clean two-decimal number). */
export const round05 = (v: number): number =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 20) / 20)) : 0;

export function roundScores(s: BehaviourScores): BehaviourScores {
  return {
    learningAffinity: round05(s.learningAffinity),
    careerAffinity: round05(s.careerAffinity),
    skillExchangeAffinity: round05(s.skillExchangeAffinity),
    communityAffinity: round05(s.communityAffinity),
    quickUser: round05(s.quickUser),
    researchUser: round05(s.researchUser),
    repeatUser: round05(s.repeatUser),
    explorer: round05(s.explorer),
    careerFocused: round05(s.careerFocused),
    learningFocused: round05(s.learningFocused),
    skillFocused: round05(s.skillFocused),
    minimalUser: round05(s.minimalUser),
  };
}

interface TypeCount {
  type: EventType;
  count: number;
}

const byCountThenOrder = (a: TypeCount, b: TypeCount): number =>
  b.count - a.count || (TYPE_ORDER.get(a.type) ?? 0) - (TYPE_ORDER.get(b.type) ?? 0);

/** How many of the four domains have at least one event (the scheduler's "≥ 2 domains" gate). */
export function activeDomains(profile: BehaviourProfile): number {
  return Object.values(profile.countsByDomain).filter((n) => n > 0).length;
}

export function summarize(
  engine: EngineState,
  events: readonly BehaviourEvent[],
  trigger: AnalyzerTrigger,
): AnalyzerRequest {
  const profile = engine.profile;

  const topActions = (Object.entries(profile.countsByType) as [EventType, number][])
    .filter(([type, count]) => !NOISE.has(type) && count > 0)
    .map(([type, count]) => ({ type, count: Math.floor(count) }))
    .sort(byCountThenOrder)
    .slice(0, MAX_TOP_ACTIONS);

  // The latest session, from the events the runtime holds (newest last).
  const latest = events.length ? events[events.length - 1]!.sessionId : null;
  const inSession = latest === null ? [] : events.filter((e) => e.sessionId === latest);

  const sessionCounts = new Map<EventType, number>();
  for (const e of inSession) {
    if (NOISE.has(e.type)) continue;
    sessionCounts.set(e.type, (sessionCounts.get(e.type) ?? 0) + 1);
  }
  const repeated = [...sessionCounts]
    .filter(([, count]) => count >= REPEAT_MIN)
    .map(([type, count]) => ({ type, count }))
    .sort(byCountThenOrder)
    .slice(0, MAX_REPEATED);

  const navPattern: NavItemId[] = [];
  for (const e of events) {
    if (e.type !== "navigation_item_clicked") continue;
    const item = (e.metadata as { item?: unknown }).item;
    if (typeof item === "string" && NAV_IDS.has(item)) navPattern.push(item as NavItemId);
  }

  let minutes = 0;
  if (inSession.length > 1) {
    const span = inSession[inSession.length - 1]!.timestamp - inSession[0]!.timestamp;
    minutes = Math.min(600, Math.max(0, Math.round(span / 60_000)));
  }

  const completed = COMPLETED_ACTION_TYPES.reduce((n, t) => n + (profile.countsByType[t] ?? 0), 0);

  const d = engine.decision;
  return {
    v: 1,
    trigger,
    scores: roundScores(profile.scores),
    topActions,
    repeated,
    navPattern: navPattern.slice(-MAX_NAV_PATTERN),
    session: {
      events: Math.max(0, Math.floor(profile.meaningfulCount)),
      minutes,
      sessions: Math.max(0, Math.floor(profile.sessionCount)),
      completed: Math.max(0, Math.floor(completed)),
    },
    current: {
      primaryState: d.primaryState,
      behaviourMode: d.behaviourMode,
      confidence: round05(d.confidence),
      tier: engine.tier,
    },
    deterministic: { ...d, priorityActions: [...d.priorityActions] },
  };
}

/**
 * The canonical text of a summary: what the AI would actually be asked, in a
 * fixed key order, with numbers rounded again (idempotent) and the local
 * `reason` and the trigger left out because neither changes the answer. The
 * server uses it as its LRU key; the client hashes it to skip an unchanged one.
 */
export function summaryKey(r: AnalyzerRequest): string {
  const s = roundScores(r.scores);
  return JSON.stringify([
    r.v,
    [
      s.learningAffinity,
      s.careerAffinity,
      s.skillExchangeAffinity,
      s.communityAffinity,
      s.quickUser,
      s.researchUser,
      s.repeatUser,
      s.explorer,
      s.careerFocused,
      s.learningFocused,
      s.skillFocused,
      s.minimalUser,
    ],
    r.topActions.map((a) => [a.type, a.count]),
    r.repeated.map((a) => [a.type, a.count]),
    r.navPattern,
    [r.session.events, r.session.minutes, r.session.sessions, r.session.completed],
    [
      r.current.primaryState,
      r.current.behaviourMode,
      round05(r.current.confidence),
      r.current.tier,
    ],
    [
      r.deterministic.primaryState,
      r.deterministic.behaviourMode,
      r.deterministic.navigationMode,
      r.deterministic.homepageLayout,
      r.deterministic.priorityActions,
      round05(r.deterministic.confidence),
    ],
  ]);
}

/** 53-bit cyrb53 over the canonical text, as 14 hex characters. Not security, just change detection. */
export function hashSummary(r: AnalyzerRequest): string {
  const str = summaryKey(r);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, "0");
}
