/**
 * Sessions (D10): a new session starts after 30 minutes idle OR in a fresh tab/browser session
 * (no sessionStorage marker). A page refresh keeps the session. Pure: the caller passes the clock.
 */
export const SESSION_GAP_MS = 1_800_000;

export interface SessionMark {
  id: string;
  startedAt: number;
  lastAt: number;
}

export interface NextSession {
  session: SessionMark;
  /** True when a new session opened (the caller then calls the engine's startSession). */
  isNew: boolean;
}

/** Deterministic id from the opening timestamp (never random). */
export const sessionIdAt = (now: number): string => `s${Math.max(0, Math.floor(now)).toString(36)}`;

export function nextSession(prev: SessionMark | null, now: number, freshTab: boolean): NextSession {
  if (prev && !freshTab && now - prev.lastAt <= SESSION_GAP_MS) {
    return { session: { ...prev, lastAt: Math.max(prev.lastAt, now) }, isNew: false };
  }
  return { session: { id: sessionIdAt(now), startedAt: now, lastAt: now }, isNew: true };
}
