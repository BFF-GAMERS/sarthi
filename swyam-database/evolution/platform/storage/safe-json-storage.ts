/**
 * Safe JSON storage for zustand persist: never throws; corrupt or non-envelope data is kept at
 * `swayam.evo.quarantine.<key>` (never silently destroyed) and `null` is returned, so persist hydrates the
 * defaults and hasHydrated() becomes true.
 */
import type { PersistStorage, StorageValue } from "zustand/middleware";
import type { StorageAdapter } from "./adapter";
import { EVO_PREFIX } from "./adapter";

export const QUARANTINE_PREFIX = `${EVO_PREFIX}quarantine.`;

export const quarantineKeyOf = (name: string): string =>
  QUARANTINE_PREFIX + (name.startsWith(EVO_PREFIX) ? name.slice(EVO_PREFIX.length) : name);

function isEnvelope<P>(v: unknown): v is StorageValue<P> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as { version?: unknown }).version === "number"
  );
}

export function safeJSONStorage<P>(a: StorageAdapter): PersistStorage<P> {
  const parse = (name: string, raw: string | null): StorageValue<P> | null => {
    if (raw == null) return null;
    try {
      const v: unknown = JSON.parse(raw);
      if (isEnvelope<P>(v)) return v;
    } catch {
      /* fall through to quarantine */
    }
    try {
      a.setItem(quarantineKeyOf(name), raw);
    } catch {
      /* ignore */
    }
    return null;
  };
  return {
    getItem(name) {
      try {
        return parse(name, a.getItem(name));
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      try {
        a.setItem(name, JSON.stringify(value));
      } catch {
        /* never throws */
      }
    },
    removeItem(name) {
      try {
        a.removeItem(name);
      } catch {
        /* never throws */
      }
    },
  };
}
