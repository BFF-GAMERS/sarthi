/**
 * The ONLY place persist() is configured (ported from ONE state/persisted.ts).
 * - Hydration is synchronous at store creation (no skipHydration): no write can happen before hydration.
 * - Every action writes through write(): read-before-write (rehydrate from storage first), so two tabs never
 *   lose each other's writes. The rehydrate is skipped when storage still holds exactly what this instance
 *   last read or wrote.
 * - version + migrate (pure tables); a failed or newer-schema migration quarantines the raw state and falls
 *   back to defaults for THIS store only. Invalid shapes (after migrate) are quarantined too.
 * - silently(fn) applies state without persisting it (cross-tab "site data cleared").
 */
import { persist, type PersistOptions, type StorageValue } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { StorageAdapter } from "../platform/storage/adapter";
import { quarantineKeyOf, safeJSONStorage } from "../platform/storage/safe-json-storage";

export type Migration = (prev: unknown) => unknown;
export type MigrationTable = Readonly<Record<number, Migration>>;

/** Runs every step from `from + 1` to `to`; throws on a newer schema or a missing step. */
export function runMigrations(t: MigrationTable, p: unknown, from: number, to: number): unknown {
  if (from > to) throw new Error("newer-schema");
  let s = p;
  for (let v = from + 1; v <= to; v++) {
    const step = t[v];
    if (!step) throw new Error(`missing v${v}`);
    s = step(s);
  }
  return s;
}

export interface PersistedStore<S> extends StoreApi<S> {
  persist: {
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    getOptions: () => Partial<PersistOptions<S, Partial<S>>>;
  };
  /** True when storage holds something other than what this instance last saw (another tab wrote). */
  storageChanged(): boolean;
  /** Where this store lives (for quarantine and tests). */
  readonly key: string;
}

export interface PersistedConfig<S> {
  adapter: StorageAdapter;
  key: string;
  version: number;
  initial: () => S;
  partialize?: (s: S) => Partial<S>;
  /** Structural guard, run AFTER migrate. */
  isValid: (x: unknown) => x is Partial<S>;
  migrations: MigrationTable;
  /** Optional custom merge for a VALID snapshot (engine: re-validate the decision). Default: shallow. */
  restore?: (p: Partial<S>, cur: S) => S;
}

let silenced = 0;

/** Keeps the raw value as evidence at `swayam.evo.quarantine.<key>`; never throws. */
export function quarantine(adapter: StorageAdapter, key: string, value: unknown): void {
  try {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    if (raw === undefined) return;
    adapter.setItem(quarantineKeyOf(key), raw);
  } catch {
    /* ignore */
  }
}

export function createPersistedStore<S>(cfg: PersistedConfig<S>): PersistedStore<S> {
  const { adapter, key } = cfg;
  /** the raw string this instance last read from or wrote to storage */
  let lastRaw: string | null = null;
  const tracking: StorageAdapter = {
    kind: adapter.kind,
    durable: adapter.durable,
    getItem(k) {
      const raw = adapter.getItem(k);
      if (k === key) lastRaw = raw;
      return raw;
    },
    setItem(k, value) {
      if (silenced > 0) return;
      adapter.setItem(k, value);
      // Record only what actually landed: a write that failed (quota) must not make this tab believe storage
      // holds its unsaved state, or the next read-before-write would roll the in-memory state back.
      if (k === key && adapter.getItem(k) === value) lastRaw = value;
    },
    removeItem: (k) => adapter.removeItem(k),
    keys: (p) => adapter.keys(p),
  };

  const opts: PersistOptions<S, Partial<S>> = {
    name: key,
    version: cfg.version,
    storage: safeJSONStorage<Partial<S>>(tracking),
    partialize: cfg.partialize ?? ((s) => s),
    migrate: (p, from) => {
      try {
        return runMigrations(cfg.migrations, p, from, cfg.version) as Partial<S>;
      } catch {
        quarantine(adapter, key, { state: p, version: from } satisfies StorageValue<unknown>);
        return undefined as unknown as Partial<S>; // merge keeps the defaults
      }
    },
    merge: (p, cur) => {
      if (p === undefined || p === null) return cur;
      if (!cfg.isValid(p)) {
        quarantine(adapter, key, { state: p, version: cfg.version });
        return cur;
      }
      try {
        return cfg.restore ? cfg.restore(p, cur) : { ...cur, ...p };
      } catch {
        quarantine(adapter, key, { state: p, version: cfg.version });
        return cur;
      }
    },
  };

  const base = createStore<S>()(persist(cfg.initial, opts));
  const store = base as unknown as PersistedStore<S>;
  Object.defineProperty(store, "key", { value: key, enumerable: true });
  store.storageChanged = () => {
    try {
      return adapter.getItem(key) !== lastRaw;
    } catch {
      return true;
    }
  };
  return store;
}

/**
 * The ONE write helper every action uses: read-before-write, then one set (= one storage write).
 * A recipe that returns null changes nothing and writes nothing.
 */
export function write<S>(store: PersistedStore<S>, recipe: (s: S) => Partial<S> | null): void {
  if (store.storageChanged()) void store.persist.rehydrate();
  const patch = recipe(store.getState());
  if (patch !== null) store.setState(patch);
}

/** Read-before-read: pick up another tab's write without writing. */
export function refresh<S>(store: PersistedStore<S>): void {
  if (store.storageChanged()) void store.persist.rehydrate();
}

/** Applies state changes without persisting them (used when another tab cleared site data). */
export function silently(fn: () => void): void {
  silenced++;
  try {
    fn();
  } finally {
    silenced--;
  }
}
