/**
 * Scope, session and the one-time guest merge (plan §3.5, D10).
 *
 *   visitor        -> "guest"
 *   signed in      -> "acct_<8 hex>"   (FNV-1a of the profile id; the id itself is never stored)
 *   Lab / preview  -> "lab_main" / "preview_<persona>"  (never synced)
 */
import type { PersonaId, Scope } from "../types";
import type { StorageAdapter } from "../platform/storage/adapter";
import { keyOf, MERGED_KEY, removeScope, SESSION_KEY } from "../platform/storage/keys";
import { newSessionId } from "../platform/ids";

export const LAB_SCOPE: Scope = "lab_main";
export const previewScope = (p: PersonaId): Scope => `preview_${p}`;

/** 32-bit FNV-1a as 8 hex chars. One-way for practical purposes and stable across devices. */
export function hashProfileId(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const scopeFor = (profileId: string | null): Scope =>
  profileId ? `acct_${hashProfileId(profileId)}` : "guest";

export const isAccountScope = (s: Scope): boolean => s.startsWith("acct_");
/** Only an account scope can ever be synced; guest, lab and preview stay on the device. */
export const isSyncableScope = isAccountScope;

// ─── session marker (D10) ──────────────────────────────────────────────────────────────────────────────

/** A session lasts until 30 minutes of silence, or the tab/browser session ends (sessionStorage). */
export const SESSION_GAP_MS = 30 * 60 * 1000;
const MARKER_WRITE_EVERY_MS = 10_000;

export interface SessionMarker {
  id: string;
  lastTs: number;
}

export interface SessionPort {
  read(): SessionMarker | null;
  write(m: SessionMarker): void;
}

/** sessionStorage with a memory fallback. A refresh keeps the marker; a fresh tab does not have one. */
export function createSessionPort(): SessionPort {
  let memory: SessionMarker | null = null;
  const store = (): Storage | null => {
    try {
      return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    read() {
      try {
        const raw = store()?.getItem(SESSION_KEY);
        if (raw) {
          const v: unknown = JSON.parse(raw);
          if (
            v &&
            typeof v === "object" &&
            typeof (v as SessionMarker).id === "string" &&
            typeof (v as SessionMarker).lastTs === "number"
          )
            return v as SessionMarker;
        }
      } catch {
        /* fall through to memory */
      }
      return memory;
    },
    write(m) {
      memory = m;
      try {
        store()?.setItem(SESSION_KEY, JSON.stringify(m));
      } catch {
        /* memory holds it */
      }
    },
  };
}

/** The current session id. `isNew` is true when this call started a new session. */
export function resolveSession(port: SessionPort, now: number): { id: string; isNew: boolean } {
  const m = port.read();
  if (!m || now - m.lastTs > SESSION_GAP_MS || m.lastTs > now + SESSION_GAP_MS) {
    const id = newSessionId(now);
    port.write({ id, lastTs: now });
    return { id, isNew: true };
  }
  if (now - m.lastTs >= MARKER_WRITE_EVERY_MS) port.write({ id: m.id, lastTs: now });
  return { id: m.id, isNew: false };
}

// ─── guest -> account merge ────────────────────────────────────────────────────────────────────────────

/**
 * A device's FIRST sign-in adopts what the guest scope learned, once. The marker is set first, so a crash or a
 * second account never merges twice. Nothing is merged into an account scope that already has data. The guest
 * keys are removed afterwards: that learning now belongs to the account.
 */
export function mergeGuestIntoAccount(adapter: StorageAdapter, acct: Scope): boolean {
  try {
    if (adapter.getItem(MERGED_KEY) !== null) return false;
    adapter.setItem(MERGED_KEY, "1");
    if (
      adapter.getItem(keyOf(acct, "engine")) !== null ||
      adapter.getItem(keyOf(acct, "behaviour")) !== null
    )
      return false;
    let moved = false;
    for (const slot of ["behaviour", "engine", "history", "prefs"] as const) {
      const raw = adapter.getItem(keyOf("guest", slot));
      if (!raw) continue;
      let out = raw;
      if (slot === "engine") {
        const env = JSON.parse(raw) as {
          state?: {
            engine?: { scope?: string; profile?: { scope?: string } };
            syncedAt?: number | null;
          };
        };
        const e = env.state?.engine;
        if (e) {
          e.scope = acct;
          if (e.profile) e.profile.scope = acct;
        }
        if (env.state) env.state.syncedAt = null;
        out = JSON.stringify(env);
      }
      adapter.setItem(keyOf(acct, slot), out);
      moved = true;
    }
    if (moved) removeScope(adapter, "guest");
    return moved;
  } catch {
    return false;
  }
}
