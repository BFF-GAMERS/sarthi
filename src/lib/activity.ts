import { getItem, setItem } from "./store";

export type ActivityEvent = {
  id: string;
  at: string;
  type:
    | "login"
    | "role_change"
    | "password_reset"
    | "account_deleted"
    | "account_updated"
    | "account_created"
    | "approval";
  actor: string;
  target: string;
  detail?: string;
};

const KEY = "activity";
const MAX_EVENTS = 500;

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Appends an event. Stored newest first, capped at MAX_EVENTS. Never throws. */
export function logEvent(event: Omit<ActivityEvent, "id" | "at">): void {
  try {
    const entry: ActivityEvent = {
      ...event,
      id: newEventId(),
      at: new Date().toISOString(),
    };
    const events = getItem<ActivityEvent[]>(KEY, []);
    setItem<ActivityEvent[]>(KEY, [entry, ...events].slice(0, MAX_EVENTS));
  } catch {
    /* logging must never break the calling action */
  }
}

/** All logged events, newest first. */
export function getEvents(): ActivityEvent[] {
  return getItem<ActivityEvent[]>(KEY, []);
}

export function clearEvents(): void {
  setItem<ActivityEvent[]>(KEY, []);
}
