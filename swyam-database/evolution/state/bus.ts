/** A minimal external store for UI-only state (notice, WhyPanel, sync status). Read with useBus() in react/hooks. */
export interface Bus<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createBus<T>(initial: T): Bus<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const v = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      for (const l of [...listeners]) {
        try {
          l();
        } catch {
          /* a listener must never break a commit */
        }
      }
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
