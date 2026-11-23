/**
 * Guard for a @tanstack/router-core race on fast back-navigation (router-core 1.171.15).
 *
 * Symptom: `TypeError: Cannot read properties of undefined (reading '_nonReactive')` logged by
 * `RouterCore.preloadRoute` -> `loadMatches` -> `loadRouteMatch` (load-matches.js, the final `getMatch(matchId)`).
 *
 * Cause: `defaultPreload: "intent"` starts a preload when the pointer reaches a link. The preload parks its match in
 * `cachedMatches` and then awaits the route's lazy chunk. Every navigation commit ends in `clearExpiredCache()`, whose
 * filter evicts a LOADERLESS route's cached match unconditionally (no `loader` -> "expired"). Press Back or click on
 * within the chunk's flight time and the match vanishes under the await; the next `getMatch` returns undefined.
 * Nothing is wrong with the app's routes: the preload's own bookkeeping is pulled out from under it.
 *
 * Guard: while any preload is in flight, owe the eviction instead of running it, and pay it once the last preload
 * settles. Memory is bounded (the cache is swept a moment later, not skipped) and no preload, navigation or loader
 * changes behaviour. Proper fix is upstream (router-core >= 1.171.34 reworks this loader); drop this on upgrade.
 */
import type { AnyRouter } from "@tanstack/react-router";

type Preload = (opts: unknown) => Promise<unknown>;
interface Guardable {
  preloadRoute?: Preload;
  clearExpiredCache?: () => void;
}

const guarded = new WeakMap<object, { users: number; restore: () => void }>();

/**
 * Installs once per router; later callers share it (StrictMode double-subscribes). Returns a release function:
 * the router's own methods are put back when the last user releases.
 */
export function guardPreloadRace(router: AnyRouter): () => void {
  const r = router as unknown as Guardable;
  const preload = r.preloadRoute;
  const clear = r.clearExpiredCache;
  const shared = guarded.get(router);
  if (shared) {
    shared.users += 1;
    return release(router, shared);
  }
  if (typeof preload !== "function" || typeof clear !== "function") return () => {};

  let inflight = 0;
  let owed = false;
  const sweep = (): void => {
    try {
      clear.call(router);
    } catch {
      /* a failed sweep is retried by the next navigation */
    }
  };

  const guardedPreload: Preload = async (opts) => {
    inflight += 1;
    try {
      return await preload.call(router, opts);
    } finally {
      inflight -= 1;
      if (inflight === 0 && owed) {
        owed = false;
        sweep();
      }
    }
  };
  const guardedClear = (): void => {
    if (inflight > 0) owed = true;
    else sweep();
  };

  r.preloadRoute = guardedPreload;
  r.clearExpiredCache = guardedClear;
  const entry = {
    users: 1,
    restore: () => {
      if (r.preloadRoute === guardedPreload) r.preloadRoute = preload;
      if (r.clearExpiredCache === guardedClear) r.clearExpiredCache = clear;
    },
  };
  guarded.set(router, entry);
  return release(router, entry);
}

function release(router: object, entry: { users: number; restore: () => void }): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    entry.users -= 1;
    if (entry.users > 0) return;
    entry.restore();
    guarded.delete(router);
  };
}
