/**
 * The guarded localStorage adapter.
 * - One probe write+remove; if it fails (SSR, private mode, blocked) the memory adapter is returned.
 * - Every call is wrapped in try/catch and never throws.
 * - QuotaExceededError: the compaction hook runs once (non-reentrant), then the write is retried once unless
 *   the hook already rewrote that key (its newer, smaller value must not be overwritten by the stale one).
 * - subscribe() listens to the window `storage` event, filtered to `swayam.evo.*`.
 */
import type { StorageAdapter } from "./adapter";
import { EVO_PREFIX, isEvoKey } from "./adapter";
import { createMemoryAdapter } from "./memory";

export interface LocalAdapterOptions {
  /** Called once per quota failure with the key that failed (behaviour store: halve the event ring). */
  onQuota?: (key: string) => void;
}

const PROBE_KEY = `${EVO_PREFIX}__probe__`;

export function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

/** The slice of Window the adapter needs (a fake window in tests). */
export interface WindowLike {
  localStorage: Storage;
  addEventListener(type: string, l: (e: never) => void): void;
  removeEventListener(type: string, l: (e: never) => void): void;
}

export function createLocalAdapter(
  win?: WindowLike,
  opts: LocalAdapterOptions = {},
): StorageAdapter {
  const w: WindowLike | undefined =
    win ?? (typeof window === "undefined" ? undefined : (window as unknown as WindowLike));
  let ls: Storage;
  try {
    if (!w) return createMemoryAdapter();
    ls = w.localStorage;
    ls.setItem(PROBE_KEY, "1");
    ls.removeItem(PROBE_KEY);
  } catch {
    return createMemoryAdapter();
  }

  let handlingQuota = false;
  const writtenDuringHook = new Set<string>();

  const rawSet = (key: string, value: string): void => {
    try {
      ls.setItem(key, value);
      if (handlingQuota) writtenDuringHook.add(key);
    } catch (e) {
      if (!isQuotaError(e) || handlingQuota || !opts.onQuota) return;
      handlingQuota = true;
      writtenDuringHook.clear();
      try {
        opts.onQuota(key);
      } catch {
        /* the hook must never break a write */
      } finally {
        handlingQuota = false;
      }
      if (writtenDuringHook.has(key)) return;
      try {
        ls.setItem(key, value);
      } catch {
        /* still full: carry on in memory (state stays valid, just not persisted) */
      }
    }
  };

  return {
    kind: "local",
    durable: true,
    getItem(key) {
      try {
        return ls.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: rawSet,
    removeItem(key) {
      try {
        ls.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    keys(prefix) {
      try {
        const out: string[] = [];
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k !== null && k.startsWith(prefix)) out.push(k);
        }
        return out;
      } catch {
        return [];
      }
    },
    subscribe(listener) {
      if (!w) return () => {};
      const onStorage = (e: StorageEvent) => {
        try {
          if (e.storageArea && e.storageArea !== ls) return;
          if (e.key === null) listener(null);
          else if (isEvoKey(e.key)) listener(e.key);
        } catch {
          /* a listener must never break the page */
        }
      };
      try {
        w.addEventListener("storage", onStorage as (e: never) => void);
      } catch {
        return () => {};
      }
      return () => {
        try {
          w.removeEventListener("storage", onStorage as (e: never) => void);
        } catch {
          /* ignore */
        }
      };
    },
  };
}
