/**
 * Flush: one idle slice hands ≤ BATCH_SIZE queued events to the sink (runtime.ingestBatch).
 * `flushNow()` drains synchronously (pagehide / visibilitychange:hidden). The tracker never
 * imports the runtime: the persistence lane registers the sink via `setTrackSink`.
 * With no sink the queue just waits (bounded), so tracking never blocks or throws.
 */
import type { TrackInput } from "../../types";
import { BATCH_SIZE, queueSize, take } from "./queue";

export type Sink = (batch: readonly TrackInput[]) => void;

export const NORMAL_FLUSH_MS = 1000;
export const CONTINUE_FLUSH_MS = 500;
const FALLBACK_DELAY_MS = 250;

let sink: Sink | null = null;
let cancelScheduled: (() => void) | null = null;
let lifecycle: (() => void) | null = null;

function idle(fn: () => void, timeout: number): () => void {
  try {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(fn, { timeout });
      return () => window.cancelIdleCallback?.(id);
    }
  } catch {
    /* fall through to the timer */
  }
  const t = setTimeout(fn, FALLBACK_DELAY_MS);
  return () => clearTimeout(t);
}

function cancel(): void {
  cancelScheduled?.();
  cancelScheduled = null;
}

function deliverSlice(): void {
  if (!sink) return;
  const batch = take(BATCH_SIZE);
  if (batch.length === 0) return;
  try {
    sink(batch);
  } catch {
    /* swallow: the UI never depends on tracking */
  }
}

/** Schedules an idle flush unless one is already pending. */
export function scheduleFlush(timeout: number = NORMAL_FLUSH_MS): void {
  if (cancelScheduled || !sink) return;
  cancelScheduled = idle(flush, timeout);
}

export function isFlushScheduled(): boolean {
  return cancelScheduled !== null;
}

/** One idle slice; reschedules when more is waiting. */
export function flush(): void {
  cancel();
  deliverSlice();
  if (sink && queueSize() > 0) scheduleFlush(CONTINUE_FLUSH_MS);
}

/** Drain the queue into the sink right now. Safe to call any time. */
export function flushNow(): void {
  cancel();
  let guard = 0;
  while (sink && queueSize() > 0 && guard++ < 16) deliverSlice();
}

/** Registered by the runtime on mount; null on unmount. */
export function setTrackSink(next: Sink | null): void {
  sink = next;
  if (sink) flushNow();
  else cancel();
}

/** pagehide / hidden drain (bfcache-safe, never beforeunload). Installed once, on first use. */
export function installLifecycle(): void {
  if (lifecycle || typeof window === "undefined" || typeof document === "undefined") return;
  const w = window;
  const d = document;
  const onHide = () => flushNow();
  const onVisibility = () => {
    if (d.visibilityState === "hidden") flushNow();
  };
  w.addEventListener("pagehide", onHide);
  d.addEventListener("visibilitychange", onVisibility);
  lifecycle = () => {
    w.removeEventListener("pagehide", onHide);
    d.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Tests only. */
export function _resetFlush(): void {
  cancel();
  sink = null;
  lifecycle?.();
  lifecycle = null;
}
