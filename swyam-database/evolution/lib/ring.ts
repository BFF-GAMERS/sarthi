// Fixed-size ring helpers over plain arrays (persisted rings must stay JSON). All functions are pure:
// they never mutate the input and always return a new array of at most `cap` items.

/** Append newest LAST; keeps the newest `cap` items (event ring, window). */
export function pushRing<T>(ring: readonly T[], item: T, cap: number): T[] {
  const next = [...ring, item];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Append many, newest LAST; keeps the newest `cap` items. */
export function pushAllRing<T>(ring: readonly T[], items: readonly T[], cap: number): T[] {
  const next = [...ring, ...items];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Prepend newest FIRST; keeps the newest `cap` items (memory, sessions, orders). */
export function unshiftRing<T>(ring: readonly T[], item: T, cap: number): T[] {
  const next = [item, ...ring];
  return next.length > cap ? next.slice(0, cap) : next;
}

/** Most-recent-first LRU of unique values: moves `item` to the front, trims to `cap` (bought, recent). */
export function lruPush<T>(ring: readonly T[], item: T, cap: number): T[] {
  return [item, ...ring.filter((x) => x !== item)].slice(0, cap);
}

/** Drops the oldest half of a newest-LAST ring (quota compaction). */
export function halveRing<T>(ring: readonly T[]): T[] {
  return ring.slice(Math.floor(ring.length / 2));
}

/** The last `n` items of a newest-LAST ring. */
export function tail<T>(ring: readonly T[], n: number): T[] {
  return n <= 0 ? [] : ring.slice(-n);
}
