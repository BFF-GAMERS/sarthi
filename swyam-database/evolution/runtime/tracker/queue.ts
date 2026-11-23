/**
 * The tracker's in-memory queue. Events wait here until an idle flush hands them to the sink.
 * Never persisted, never a React store. Bounded: when full the OLDEST event is dropped.
 */
import type { TrackInput } from "../../types";

export const QUEUE_CAP = 200;
export const BATCH_SIZE = 64;

let queue: TrackInput[] = [];

export function enqueue(e: TrackInput): void {
  queue.push(e);
  if (queue.length > QUEUE_CAP) queue.splice(0, queue.length - QUEUE_CAP);
}

/** Removes and returns up to `n` oldest events. */
export function take(n: number = BATCH_SIZE): TrackInput[] {
  return queue.splice(0, n);
}

export function queueSize(): number {
  return queue.length;
}

/** Tests only. */
export function clearQueue(): void {
  queue = [];
}
