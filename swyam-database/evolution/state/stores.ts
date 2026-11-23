/**
 * The five persisted stores of one scope (plan §3.5). A scope switch builds a fresh set, hydrated
 * synchronously from storage; nothing here knows about React.
 *
 *   behaviour  ring of 300 events, 30-day TTL
 *   engine     EngineState + the presented commit (what the user was last shown)
 *   history    ring of 50 committed changes
 *   prefs      { adaptive, locked }
 *   ai         last AI status + the analyser's counters
 */
import { createEngine, type EngineState } from "../core/evolution/engine";
import { validateDecision } from "../core/ui-state/validate";
import { ADAPTIVE_SETTINGS, EVENT_TYPES } from "../config/ids";
import type { StorageAdapter } from "../platform/storage/adapter";
import { keyOf, SLOTS, type Slot } from "../platform/storage/keys";
import { pushAllRing, halveRing } from "../lib/ring";
import type {
  AdaptiveSetting,
  AiStatus,
  BehaviourEvent,
  DecisionSource,
  EvolutionHistoryEntry,
  Scope,
} from "../types";
import type { Committed } from "./committed";
import { IDLE_AI } from "./defaults";
import {
  createPersistedStore,
  silently,
  type MigrationTable,
  type PersistedStore,
} from "./persisted";

export const BEHAVIOUR_CAP = 300;
export const BEHAVIOUR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const HISTORY_CAP = 50;
export const STORE_VERSION = 1;

const NO_MIGRATIONS: MigrationTable = {};

export interface BehaviourState {
  events: BehaviourEvent[];
}

/** The persisted engine record. `rev` bumps on every commit; `presented` is what the user last saw. */
export interface EngineRecord {
  engine: EngineState;
  rev: number;
  presented: Committed | null;
  /** The session this scope's engine last counted (D10); a new session id means startSession. */
  sessionId: string | null;
  /** Where the newest commit came from and when (the coordinator releases instant sources at once). */
  committedSource: DecisionSource;
  committedAt: number;
  /** client_updated_at for sync: the newer one wins. */
  updatedAt: number;
  /** When this scope's aggregate was last confirmed on the server (null = never synced). */
  syncedAt: number | null;
}

export interface HistoryState {
  entries: EvolutionHistoryEntry[];
}

export interface PrefsState {
  adaptive: AdaptiveSetting;
  locked: boolean;
}

export interface AiState {
  status: AiStatus;
  /** Set on pagehide; the scheduler runs it in idle time on the next visit, never before first paint. */
  pendingAnalysis: boolean;
  summaryHash: string | null;
  /** YYYY-MM-DD of `callsToday`. */
  day: string | null;
  callsToday: number;
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

const isEvent = (e: unknown): e is BehaviourEvent =>
  isObj(e) &&
  isNum(e["seq"]) &&
  isNum(e["timestamp"]) &&
  typeof e["sessionId"] === "string" &&
  typeof e["type"] === "string" &&
  (EVENT_TYPES as readonly string[]).includes(e["type"]);

const isHistoryEntry = (e: unknown): e is EvolutionHistoryEntry =>
  isObj(e) && typeof e["id"] === "string" && isNum(e["at"]) && isObj(e["from"]) && isObj(e["to"]);

/** The engine record is valid when it has the engine's own shape; the decision is re-validated on restore. */
function isEngineRecord(x: unknown): x is Partial<EngineRecord> {
  if (!isObj(x)) return false;
  const e = x["engine"];
  if (e !== undefined) {
    if (
      !isObj(e) ||
      e["v"] !== 1 ||
      !isNum(e["epoch"]) ||
      !isNum(e["seq"]) ||
      !isObj(e["decision"])
    )
      return false;
    if (!isObj(e["profile"])) return false;
  }
  if (x["rev"] !== undefined && !isNum(x["rev"])) return false;
  if (x["presented"] !== undefined && x["presented"] !== null && !isObj(x["presented"]))
    return false;
  return true;
}

const validCommitted = (c: unknown): c is Committed =>
  isObj(c) &&
  isNum(c["rev"]) &&
  isNum(c["tier"]) &&
  isObj(c["reasonCode"]) &&
  validateDecision(c["decision"], "local").ok;

export const initialEngineRecord = (scope: Scope): EngineRecord => ({
  engine: createEngine(scope),
  rev: 0,
  presented: null,
  sessionId: null,
  committedSource: "deterministic",
  committedAt: 0,
  updatedAt: 0,
  syncedAt: null,
});

/**
 * Restore: the stored decision must pass validateDecision. On failure (or a foreign engine version) the
 * engine restarts (epoch + 1, seq 0) so the runtime replays the stored event log, and presented is dropped.
 */
export function restoreEngine(scope: Scope) {
  return (p: Partial<EngineRecord>, cur: EngineRecord): EngineRecord => {
    const merged: EngineRecord = { ...cur, ...p };
    const okDecision = validateDecision(merged.engine.decision, "local").ok;
    if (okDecision && merged.engine.v === 1 && merged.engine.scope === scope) {
      return {
        ...merged,
        presented: merged.presented && validCommitted(merged.presented) ? merged.presented : null,
      };
    }
    const fresh = createEngine(scope);
    return {
      ...merged,
      engine: { ...fresh, epoch: (isNum(merged.engine.epoch) ? merged.engine.epoch : 0) + 1 },
      presented: null,
      rev: merged.rev + 1,
    };
  };
}

export interface ScopeStores {
  readonly scope: Scope;
  readonly adapter: StorageAdapter;
  readonly behaviour: PersistedStore<BehaviourState>;
  readonly engine: PersistedStore<EngineRecord>;
  readonly history: PersistedStore<HistoryState>;
  readonly prefs: PersistedStore<PrefsState>;
  readonly ai: PersistedStore<AiState>;
  /** Slot of a storage key, or null when the key is not one of this scope's. */
  slotOf(key: string): Slot | null;
  storeOf(slot: Slot): PersistedStore<never>;
  /** Re-reads one store from storage (another tab wrote it). */
  refreshSlot(slot: Slot): void;
  /** Applies defaults in memory only (site data was cleared elsewhere). */
  clearInMemory(): void;
}

export function createScopeStores(scope: Scope, adapter: StorageAdapter): ScopeStores {
  const behaviour = createPersistedStore<BehaviourState>({
    adapter,
    key: keyOf(scope, "behaviour"),
    version: STORE_VERSION,
    initial: () => ({ events: [] }),
    isValid: (x): x is Partial<BehaviourState> =>
      isObj(x) && (x["events"] === undefined || Array.isArray(x["events"])),
    migrations: NO_MIGRATIONS,
    restore: (p, cur) => ({
      events: (Array.isArray(p.events) ? p.events : cur.events).filter(isEvent),
    }),
  });
  const engine = createPersistedStore<EngineRecord>({
    adapter,
    key: keyOf(scope, "engine"),
    version: STORE_VERSION,
    initial: () => initialEngineRecord(scope),
    isValid: isEngineRecord,
    migrations: NO_MIGRATIONS,
    restore: restoreEngine(scope),
  });
  const history = createPersistedStore<HistoryState>({
    adapter,
    key: keyOf(scope, "history"),
    version: STORE_VERSION,
    initial: () => ({ entries: [] }),
    isValid: (x): x is Partial<HistoryState> =>
      isObj(x) && (x["entries"] === undefined || Array.isArray(x["entries"])),
    migrations: NO_MIGRATIONS,
    restore: (p, cur) => ({
      entries: (Array.isArray(p.entries) ? p.entries : cur.entries)
        .filter(isHistoryEntry)
        .slice(-HISTORY_CAP),
    }),
  });
  const prefs = createPersistedStore<PrefsState>({
    adapter,
    key: keyOf(scope, "prefs"),
    version: STORE_VERSION,
    initial: () => ({ adaptive: "on", locked: false }),
    isValid: (x): x is Partial<PrefsState> =>
      isObj(x) &&
      (x["adaptive"] === undefined ||
        (ADAPTIVE_SETTINGS as readonly unknown[]).includes(x["adaptive"])) &&
      (x["locked"] === undefined || typeof x["locked"] === "boolean"),
    migrations: NO_MIGRATIONS,
  });
  const ai = createPersistedStore<AiState>({
    adapter,
    key: keyOf(scope, "ai"),
    version: STORE_VERSION,
    initial: () => ({
      status: IDLE_AI,
      pendingAnalysis: false,
      summaryHash: null,
      day: null,
      callsToday: 0,
    }),
    isValid: (x): x is Partial<AiState> =>
      isObj(x) &&
      (x["status"] === undefined ||
        (isObj(x["status"]) && typeof x["status"]["kind"] === "string")),
    migrations: NO_MIGRATIONS,
  });

  const stores = { behaviour, engine, history, prefs, ai } as const;
  const bySlot = stores as unknown as Record<Slot, PersistedStore<never>>;
  const slotByKey = new Map<string, Slot>(SLOTS.map((s) => [keyOf(scope, s), s]));

  return {
    scope,
    adapter,
    ...stores,
    slotOf: (key) => slotByKey.get(key) ?? null,
    storeOf: (slot) => bySlot[slot],
    refreshSlot: (slot) => {
      const s = bySlot[slot];
      if (s.storageChanged()) void s.persist.rehydrate();
    },
    clearInMemory: () =>
      silently(() => {
        behaviour.setState(behaviour.getInitialState(), true);
        engine.setState(engine.getInitialState(), true);
        history.setState(history.getInitialState(), true);
        prefs.setState(prefs.getInitialState(), true);
        ai.setState(ai.getInitialState(), true);
      }),
  };
}

/** Append events newest-last: TTL prune first, then the 300 cap. */
export function appendEvents(
  events: readonly BehaviourEvent[],
  add: readonly BehaviourEvent[],
  now: number,
): BehaviourEvent[] {
  const fresh = events.filter((e) => now - e.timestamp <= BEHAVIOUR_TTL_MS);
  return pushAllRing(fresh, add, BEHAVIOUR_CAP);
}

/** Quota hook: drop the oldest half of the event ring (the behaviour store is the only compactable one). */
export function compactBehaviour(store: PersistedStore<BehaviourState>): void {
  store.setState({ events: halveRing(store.getState().events) });
}
