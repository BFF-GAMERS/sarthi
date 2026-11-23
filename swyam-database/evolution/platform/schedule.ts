/** Idle scheduling: requestIdleCallback with a timeout, else setTimeout(min(timeout, 200)). Returns cancel. */
interface IdleGlobals {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
}

export const IDLE_FALLBACK_MAX_MS = 200;

export function idle(cb: () => void, o: { timeout: number }): () => void {
  const g = globalThis as unknown as IdleGlobals;
  const ric = g.requestIdleCallback;
  const cic = g.cancelIdleCallback;
  if (typeof ric === "function" && typeof cic === "function") {
    const id = ric.call(globalThis, () => cb(), { timeout: o.timeout });
    return () => cic.call(globalThis, id);
  }
  const t = setTimeout(cb, Math.min(o.timeout, IDLE_FALLBACK_MAX_MS));
  return () => clearTimeout(t);
}
