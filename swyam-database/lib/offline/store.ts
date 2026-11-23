import { useSyncExternalStore } from "react";
import { measureBytes, type QuotaEstimate } from "./format";

/**
 * Offline lesson packs, kept in IndexedDB.
 *
 * Text only: lesson titles, the lesson `content` JSON and the transcript. Never
 * `media_url`, captions files or a YouTube id: a downloaded video is somebody
 * else's file, and the Learn page says "video available online only" instead.
 *
 * Every function here is total: no browser without IndexedDB (private mode in
 * older Firefox, a locked-down WebView, the server) can make one throw. They
 * return an empty list, null or a `{ ok: false }` result, and the UI says
 * "not available in this browser".
 */

export const DB_NAME = "swayam-offline";
export const STORE_NAME = "packs";
const DB_VERSION = 1;
const CHANNEL = "swayam-offline";

export interface PackLesson {
  id: string;
  title: string;
  position: number;
  moduleTitle: string;
  /** Position of the module in the course, so a pack lists modules in order. */
  modulePosition?: number;
  kind: string;
  durationMinutes: number | null;
  /** The lesson's `content` JSON, reduced to its text fields. */
  content: unknown;
  transcript: string | null;
}

export interface StoredPack {
  courseSlug: string;
  title: string;
  bytes: number;
  /** Epoch milliseconds. */
  savedAt: number;
  lessons: PackLesson[];
}

/** A pack without its lessons: all a list or a badge needs. */
export interface PackMeta {
  courseSlug: string;
  title: string;
  bytes: number;
  savedAt: number;
  lessonCount: number;
}

export type StoreFailure = "unavailable" | "quota" | "error";
export type StoreResult<T = void> = { ok: true; value: T } | { ok: false; reason: StoreFailure };

/* ── Availability ────────────────────────────────────────────────── */

function factory(): IDBFactory | null {
  try {
    return typeof indexedDB !== "undefined" && indexedDB ? indexedDB : null;
  } catch {
    return null;
  }
}

/** Cheap and synchronous: is there an IndexedDB at all? (Opening it can still fail.) */
export function isStorageAvailable(): boolean {
  return factory() !== null;
}

function isQuotaError(e: unknown): boolean {
  return Boolean(e) && (e as { name?: string }).name === "QuotaExceededError";
}

/** `navigator.storage.estimate()` when the browser has it; null otherwise. */
export async function estimateQuota(): Promise<QuotaEstimate | null> {
  try {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (!storage || typeof storage.estimate !== "function") return null;
    const { usage, quota } = await storage.estimate();
    if (typeof quota !== "number" || !(quota > 0)) return null;
    return { usage: typeof usage === "number" ? usage : 0, quota };
  } catch {
    return null;
  }
}

/* ── Database ────────────────────────────────────────────────────── */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  const idb = factory();
  if (!idb) return Promise.resolve(null);

  const p = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = idb.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "courseSlug" });
          }
        } catch {
          /* surfaces as an error on open */
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  dbPromise = p;
  // A failed open must not be remembered: private mode can be left, space freed.
  void p.then((db) => {
    if (!db && dbPromise === p) dbPromise = null;
  });
  return p;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | null,
): Promise<StoreResult<T>> {
  const db = await openDb();
  if (!db) return { ok: false, reason: "unavailable" };
  return new Promise<StoreResult<T>>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const req = fn(tx.objectStore(STORE_NAME));
      let value: T | undefined;
      if (req) {
        req.onsuccess = () => {
          value = req.result as T;
        };
      }
      tx.oncomplete = () => resolve({ ok: true, value: value as T });
      const fail = () =>
        resolve({ ok: false, reason: isQuotaError(tx.error ?? req?.error) ? "quota" : "error" });
      tx.onerror = fail;
      tx.onabort = fail;
    } catch (e) {
      resolve({ ok: false, reason: isQuotaError(e) ? "quota" : "error" });
    }
  });
}

function isPack(v: unknown): v is StoredPack {
  const p = v as Partial<StoredPack> | null;
  return Boolean(p) && typeof p!.courseSlug === "string" && Array.isArray(p!.lessons);
}

/* ── Operations ──────────────────────────────────────────────────── */

export async function listPacks(): Promise<StoredPack[]> {
  const res = await withStore<unknown[]>("readonly", (s) => s.getAll());
  if (!res.ok || !Array.isArray(res.value)) return [];
  return res.value.filter(isPack).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getPack(courseSlug: string): Promise<StoredPack | null> {
  const res = await withStore<unknown>("readonly", (s) => s.get(courseSlug));
  return res.ok && isPack(res.value) ? res.value : null;
}

export async function putPack(pack: StoredPack): Promise<StoreResult> {
  const res = await withStore<unknown>("readwrite", (s) => s.put(pack));
  if (!res.ok) return res;
  await changed();
  return { ok: true, value: undefined };
}

export async function deletePack(courseSlug: string): Promise<StoreResult> {
  const res = await withStore<unknown>("readwrite", (s) => s.delete(courseSlug));
  if (!res.ok) return res;
  await changed();
  return { ok: true, value: undefined };
}

export async function deleteAllPacks(): Promise<StoreResult> {
  const res = await withStore<unknown>("readwrite", (s) => s.clear());
  if (!res.ok) return res;
  await changed();
  return { ok: true, value: undefined };
}

export function toMeta(p: StoredPack): PackMeta {
  return {
    courseSlug: p.courseSlug,
    title: p.title,
    bytes: Number.isFinite(p.bytes) ? p.bytes : measureBytes(p),
    savedAt: p.savedAt,
    lessonCount: p.lessons.length,
  };
}

/* ── Subscription (useSyncExternalStore) ─────────────────────────── */

export interface PacksSnapshot {
  packs: PackMeta[];
  /** The first read of the database has finished. */
  ready: boolean;
  /** IndexedDB opened. Only meaningful once `ready`. */
  available: boolean;
}

/** What the server, and the first client render, see. A constant: never changes. */
const SERVER_SNAPSHOT: PacksSnapshot = { packs: [], ready: false, available: false };

let snapshot: PacksSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let started = false;
let channel: BroadcastChannel | null = null;

function emit() {
  for (const l of listeners) l();
}

export async function refreshPacks(): Promise<void> {
  const db = await openDb();
  const list = db ? await listPacks() : [];
  snapshot = { packs: list.map(toMeta), ready: true, available: db !== null };
  emit();
}

/** Refresh here and tell the other tabs. */
async function changed(): Promise<void> {
  await refreshPacks();
  try {
    channel?.postMessage("changed");
  } catch {
    /* other tabs catch up on their next read */
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => void refreshPacks();
    }
  } catch {
    channel = null;
  }
  void refreshPacks();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

/** The packs on this device. Empty on the server and until the first read finishes. */
export function usePacks(): PacksSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
