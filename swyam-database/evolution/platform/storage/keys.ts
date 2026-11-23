/**
 * Key map (plan §3.5). `<scope>` = guest | acct_<8 hex> | lab_main | preview_<persona>.
 *   swayam.evo.<scope>.behaviour   ring of 300 events, 30-day TTL
 *   swayam.evo.<scope>.engine      EngineState + presented commit
 *   swayam.evo.<scope>.history     ring of 50
 *   swayam.evo.<scope>.prefs       { adaptive, locked }
 *   swayam.evo.<scope>.ai          last AI status + counters
 *   swayam.evo.boot                projection read by the pre-paint script
 *   swayam.evo.merged              device marker: guest scope merged into the first account once
 *   swayam.evo.quarantine.*        corrupt / newer-schema payloads
 *   swayam.evo.session             sessionStorage marker (D10)
 */
import type { Scope } from "../../types";
import type { StorageAdapter } from "./adapter";
import { EVO_PREFIX } from "./adapter";
import { createLocalAdapter } from "./local";
import { createNullAdapter } from "./null";

export const SLOTS = ["behaviour", "engine", "history", "prefs", "ai"] as const;
export type Slot = (typeof SLOTS)[number];

export const BOOT_KEY = `${EVO_PREFIX}boot`;
export const MERGED_KEY = `${EVO_PREFIX}merged`;
export const SESSION_KEY = `${EVO_PREFIX}session`;

export const keyOf = (scope: Scope, slot: Slot): string => `${EVO_PREFIX}${scope}.${slot}`;
export const scopePrefix = (scope: Scope): string => `${EVO_PREFIX}${scope}.`;

let local: StorageAdapter | null = null;
let server: StorageAdapter | null = null;
let quotaHandler: ((key: string) => void) | null = null;

/** The device adapter: guarded localStorage in the browser, the null adapter on the server. */
export function deviceStorage(): StorageAdapter {
  if (typeof window === "undefined") return (server ??= createNullAdapter());
  local ??= createLocalAdapter(undefined, { onQuota: (k) => quotaHandler?.(k) });
  return local;
}

/** The behaviour store registers its ring compaction here. */
export function onQuotaExceeded(handler: (key: string) => void): () => void {
  quotaHandler = handler;
  return () => {
    if (quotaHandler === handler) quotaHandler = null;
  };
}

/** Removes every key of one scope (and nothing else). */
export function removeScope(adapter: StorageAdapter, scope: Scope): void {
  try {
    for (const k of adapter.keys(scopePrefix(scope))) adapter.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Tests only: forget the cached adapters so a new fake window gets a new probe. */
export function resetStorageRouting(): void {
  local = null;
  server = null;
}
