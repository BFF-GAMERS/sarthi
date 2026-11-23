/**
 * track() — the one call feature code makes (plan §4.1–§4.2).
 *
 * CONTRACT: `track`, `flushNow`, `setTrackSink`, `suspendTracking` signatures are frozen.
 * track() is synchronous, O(1), never throws, never touches storage or React state and never
 * awaits anything: it validates the entity id, enqueues, and schedules an idle flush. It is a
 * no-op during SSR and while tracking is suspended (the Lab).
 */
import { ENTITY_ID_RE } from "../../config/ids";
import type { EntityId, EventMetadata, EventType, ServiceId } from "../../types";
import { installLifecycle, scheduleFlush } from "./flush";
import { enqueue } from "./queue";

export { flushNow, setTrackSink } from "./flush";
export { entityId } from "./entity";

/** Optional extras for one event. */
export interface TrackOptions {
  entityId?: EntityId | null;
  service?: ServiceId;
}

let suspended = 0;

export function track<T extends EventType>(
  type: T,
  metadata?: EventMetadata[T],
  opts?: TrackOptions,
): void {
  try {
    if (suspended > 0 || typeof window === "undefined") return;
    const id = opts?.entityId;
    enqueue({
      type,
      metadata,
      entityId: id && ENTITY_ID_RE.test(id) ? id : null,
      service: opts?.service,
    });
    installLifecycle();
    scheduleFlush();
  } catch {
    /* tracking must never break a feature */
  }
}

const SEEN_CAP = 500;
const seen = new Set<string>();

/** Like track(), but only the first call per `key` per page load counts (cart checkout, certificate claims). */
export function trackOnce<T extends EventType>(
  key: string,
  type: T,
  metadata?: EventMetadata[T],
  opts?: TrackOptions,
): void {
  try {
    if (suspended > 0 || seen.has(key)) return;
    if (seen.size >= SEEN_CAP) seen.clear();
    seen.add(key);
    track(type, metadata, opts);
  } catch {
    /* never break a feature */
  }
}

/** Suspend tracking (e.g. inside the Lab). Returns the resume function. Nestable. */
export function suspendTracking(): () => void {
  suspended += 1;
  let done = false;
  return () => {
    if (!done) {
      done = true;
      suspended -= 1;
    }
  };
}

export const isTrackingSuspended = (): boolean => suspended > 0;

/** Tests only. */
export function _resetTrack(): void {
  suspended = 0;
  seen.clear();
}
