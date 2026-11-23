/**
 * Local-first Swayam Plus events (docs/evolution/subscriptions.md §7). They are kept on this device in a small
 * ring (`swayam.plan.events`, newest last, 50 entries) and offered to in-page listeners; nothing here is sent
 * anywhere. Props are enum-ish only: short ids and numbers, never free text, an age or a price.
 */
import type { PlusEvent, PlusEventName, PlusEventProps } from "../config/events";

export const EVENTS_KEY = "swayam.plan.events";
export const MAX_EVENTS = 50;

const SAFE = /^[A-Za-z0-9_:.-]{1,40}$/;
const clean = (props: object): Record<string, string | number | boolean> => {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!SAFE.test(k)) continue;
    if (typeof v === "string" && SAFE.test(v)) out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
  }
  return out;
};

const memory: PlusEvent[] = [];
const listeners = new Set<(e: PlusEvent) => void>();

function load(): PlusEvent[] {
  try {
    if (typeof localStorage !== "undefined") {
      const parsed: unknown = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? "[]");
      if (Array.isArray(parsed)) return parsed.slice(-MAX_EVENTS) as PlusEvent[];
    }
  } catch {
    /* corrupt or blocked: start from the in-memory ring */
  }
  return [...memory];
}

/** Record one event. Never throws; storage trouble leaves the in-memory ring and the listeners working. */
export function recordPlusEvent<N extends PlusEventName>(
  name: N,
  props: PlusEventProps[N],
  now: number = Date.now(),
): void {
  const event = { name, props: clean(props), at: now } as unknown as PlusEvent;
  memory.push(event);
  if (memory.length > MAX_EVENTS) memory.shift();
  try {
    if (typeof localStorage !== "undefined") {
      const ring = [...load(), event].slice(-MAX_EVENTS);
      localStorage.setItem(EVENTS_KEY, JSON.stringify(ring));
    }
  } catch {
    /* quota or blocked */
  }
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      /* a listener must never break the page */
    }
  }
}

export function onPlusEvent(listener: (e: PlusEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The recorded events, oldest first. */
export const readPlusEvents = (): PlusEvent[] => load();

/** Tests only. */
export const _resetEventsForTests = (): void => {
  memory.length = 0;
  listeners.clear();
};
