/**
 * Optional account sync (plan §3.5). It syncs the AGGREGATE profile and the change history only; raw events
 * never leave the device. Everything here is best effort and silent:
 *   - pushes are debounced by 15 s and also run on pagehide;
 *   - on sign-in the newer client_updated_at wins (the runtime reconciles; this module only moves rows);
 *   - one retry at most; errors are swallowed;
 *   - a missing table (PostgREST PGRST205 / Postgres 42P01) means local-only for the rest of the session;
 *   - off for minors, for lab/preview scopes and whenever adaptive is not "on" (the runtime decides and calls
 *     setTarget(null)).
 * The database port is injected so the logic is testable without a network.
 */
import { createEngine, emptyProfile, renderReason } from "../core/evolution/engine";
import { actionsFor } from "../core/evolution/compose";
import { validateDecision } from "../core/ui-state/validate";
import { EVOLUTION_CONFIG } from "../config/evolution-config";
import { BEHAVIOUR_MODES, DOMAIN_IDS, EVOLUTION_STATES, TIERS } from "../config/ids";
import { getSupabase } from "../../lib/supabase";
import { clock } from "../platform/clock";
import { createBus } from "../state/bus";
import type { EngineRecord } from "../state/stores";
import type {
  BehaviourScores,
  BehaviourMode,
  EvolutionDecision,
  EvolutionHistoryEntry,
  EvolutionState,
  Scope,
  Tier,
} from "../types";

export const PUSH_DEBOUNCE_MS = 15_000;
export const RETRY_MS = 30_000;
/** PostgREST schema-cache miss and Postgres undefined_table: the migration has not been run. */
export const MISSING_TABLE_CODES: readonly string[] = ["PGRST205", "42P01"];

export interface SyncError {
  code?: string | null;
  message?: string;
}

/** The row shape of public.evolution_profiles (db/025). */
export interface RemoteProfile {
  profile_id: string;
  state: EvolutionState;
  mode: BehaviourMode;
  tier: Tier;
  confidence: number;
  scores: Record<string, number>;
  action_counts: Record<string, number>;
  domain_counts: Record<string, number>;
  session_count: number;
  meaningful_count: number;
  locked: boolean;
  client_updated_at: string;
}

/** The row shape of public.evolution_history (db/025). `persona` is never synced. */
export interface RemoteHistoryRow {
  at: string;
  from_state: EvolutionState;
  to_state: EvolutionState;
  source: "deterministic" | "ai" | "reset" | "undo" | "manual";
  reason: string;
  confidence: number;
}

export interface SyncClient {
  select(): Promise<{ data: RemoteProfile | null; error: SyncError | null }>;
  push(profile: RemoteProfile, history: RemoteHistoryRow[]): Promise<{ error: SyncError | null }>;
  remove(): Promise<{ error: SyncError | null }>;
}

/** What a push is made from. Built by the runtime from the persisted stores, at push time. */
export interface SyncPayload {
  profileId: string;
  rec: EngineRecord;
  locked: boolean;
  history: readonly EvolutionHistoryEntry[];
}

export interface SyncStatus {
  /** The aggregate exists on the server (a push or a restore succeeded). */
  synced: boolean;
  /** The table is missing: everything stays on this device. */
  localOnly: boolean;
  at: number | null;
}

/** Read by YourSwayamSettings ("Delete synced copy" shows only when synced). */
export const syncStatusBus = createBus<SyncStatus>({ synced: false, localOnly: false, at: null });

// ─── mapping ───────────────────────────────────────────────────────────────────────────────────────────

const num01 = (x: unknown): number =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
const count = (x: unknown): number =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.min(1_000_000, Math.floor(x)) : 0;

export function toRemoteProfile(p: SyncPayload): RemoteProfile {
  const { engine } = p.rec;
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(engine.profile.scores))
    scores[k] = Math.round(num01(v) * 1000) / 1000;
  const actionCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(engine.profile.countsByType)) actionCounts[k] = count(v);
  const domainCounts: Record<string, number> = {};
  for (const d of DOMAIN_IDS) domainCounts[d] = count(engine.profile.countsByDomain[d]);
  return {
    profile_id: p.profileId,
    state: engine.decision.primaryState,
    mode: engine.decision.behaviourMode,
    tier: engine.tier,
    confidence: Math.round(num01(engine.decision.confidence) * 1000) / 1000,
    scores,
    action_counts: actionCounts,
    domain_counts: domainCounts,
    session_count: count(engine.profile.sessionCount),
    meaningful_count: count(engine.profile.meaningfulCount),
    locked: p.locked,
    client_updated_at: new Date(p.rec.updatedAt || clock.now()).toISOString(),
  };
}

/** History rows newer than the last confirmed push; persona demos never leave the device. */
export function toRemoteHistory(
  entries: readonly EvolutionHistoryEntry[],
  since: number | null,
): RemoteHistoryRow[] {
  const out: RemoteHistoryRow[] = [];
  for (const e of entries) {
    if (e.source === "persona") continue;
    if (since !== null && e.at <= since) continue;
    out.push({
      at: new Date(e.at).toISOString(),
      from_state: e.from.state,
      to_state: e.to.state,
      source: e.source,
      reason: renderReason(e.reasonCode).slice(0, 200),
      confidence: Math.round(num01(e.confidence) * 1000) / 1000,
    });
  }
  return out.slice(-50);
}

/**
 * A server row becomes a local engine record, or null when it does not validate (then this device stays
 * local-only and learns from scratch). The decision is rebuilt from the config, never taken on trust.
 */
export function fromRemoteProfile(
  r: unknown,
  scope: Scope,
  base: EngineRecord,
): EngineRecord | null {
  if (!r || typeof r !== "object") return null;
  const row = r as Partial<RemoteProfile>;
  if (!(EVOLUTION_STATES as readonly unknown[]).includes(row.state)) return null;
  if (!(BEHAVIOUR_MODES as readonly unknown[]).includes(row.mode)) return null;
  if (!(TIERS as readonly unknown[]).includes(row.tier)) return null;
  const state = row.state as EvolutionState;
  const tier = row.tier as Tier;
  const cfg = EVOLUTION_CONFIG.states[state];
  const decision: EvolutionDecision = {
    primaryState: state,
    behaviourMode: row.mode as BehaviourMode,
    navigationMode: cfg.nav,
    homepageLayout: cfg.layout,
    priorityActions: actionsFor(state, 3),
    reason: "Arranged for you from your last visit.",
    confidence: num01(row.confidence),
  };
  if (!validateDecision(decision, "local").ok) return null;
  const fresh = createEngine(scope);
  const scores = { ...emptyProfile(scope).scores } as BehaviourScores;
  for (const k of Object.keys(scores) as (keyof BehaviourScores)[])
    scores[k] = num01(row.scores?.[k]);
  const countsByType: Record<string, number> = {};
  for (const [k, v] of Object.entries(row.action_counts ?? {})) countsByType[k] = count(v);
  const countsByDomain = { LEARNING: 0, CAREER: 0, SKILL_EXCHANGE: 0, COMMUNITY: 0 };
  for (const d of DOMAIN_IDS) countsByDomain[d] = count(row.domain_counts?.[d]);
  const updated = row.client_updated_at ? Date.parse(row.client_updated_at) : NaN;
  const at = Number.isFinite(updated) ? updated : clock.now();
  return {
    ...base,
    engine: {
      ...fresh,
      epoch: base.engine.epoch,
      tier,
      decision,
      reasonCode: { key: "RESTORED" },
      profile: {
        ...fresh.profile,
        scores,
        countsByType: countsByType as never,
        countsByDomain,
        sessionCount: count(row.session_count),
        meaningfulCount: count(row.meaningful_count),
        lastSeen: at,
      },
    },
    rev: base.rev + 1,
    committedSource: "manual",
    committedAt: at,
    updatedAt: at,
    syncedAt: at,
  };
}

/** True when the server aggregate is newer than the local one (the newer client_updated_at wins). */
export function remoteIsNewer(remote: RemoteProfile | null, localUpdatedAt: number): boolean {
  if (!remote) return false;
  const t = Date.parse(remote.client_updated_at);
  return Number.isFinite(t) && t > localUpdatedAt;
}

// ─── controller ────────────────────────────────────────────────────────────────────────────────────────

export interface SyncTarget {
  profileId: string;
  /** Called at push time so the push always carries the latest persisted aggregate. */
  payload(): SyncPayload | null;
  /** Called after a confirmed push (the runtime stamps syncedAt). */
  onPushed(at: number): void;
}

export interface SyncDeps {
  clientFor(profileId: string): Promise<SyncClient | null>;
  later(ms: number, fn: () => void): () => void;
  now(): number;
}

export interface SyncController {
  /** null = ineligible (guest, lab, preview, minor, adaptive not "on"): everything stops. */
  setTarget(target: SyncTarget | null): void;
  /** The aggregate changed: push after the debounce. */
  markDirty(): void;
  /** pagehide: push now if anything is waiting. */
  flush(): void;
  pull(): Promise<RemoteProfile | null>;
  /** Delete the server copy (profile row and history). Resolves true when it is gone or never existed. */
  deleteRemote(): Promise<boolean>;
  dispose(): void;
}

export function createSyncController(deps: SyncDeps): SyncController {
  let target: SyncTarget | null = null;
  let client: SyncClient | null = null;
  let dirty = false;
  let cancel: (() => void) | null = null;
  let retried = false;
  let lastPushed: number | null = null;
  let localOnly = false;
  let busy = false;

  const status = (patch: Partial<SyncStatus>) => syncStatusBus.set((s) => ({ ...s, ...patch }));
  const missing = (e: SyncError | null): boolean =>
    !!e && !!e.code && MISSING_TABLE_CODES.includes(e.code);

  async function getClient(): Promise<SyncClient | null> {
    if (localOnly || !target) return null;
    try {
      client ??= await deps.clientFor(target.profileId);
    } catch {
      client = null;
    }
    return client;
  }

  async function push(): Promise<void> {
    cancel?.();
    cancel = null;
    if (!dirty || busy || !target || localOnly) return;
    const t = target;
    const payload = t.payload();
    const c = await getClient();
    if (!payload || !c || target !== t) return;
    busy = true;
    dirty = false;
    try {
      const { error } = await c.push(
        toRemoteProfile(payload),
        toRemoteHistory(payload.history, lastPushed),
      );
      if (error) {
        if (missing(error)) {
          localOnly = true;
          status({ localOnly: true, synced: false });
        } else if (!retried) {
          retried = true;
          dirty = true;
          cancel = deps.later(RETRY_MS, () => void push());
        }
        return;
      }
      retried = false;
      lastPushed = deps.now();
      t.onPushed(lastPushed);
      status({ synced: true, at: lastPushed, localOnly: false });
    } catch {
      /* swallowed: sync is never allowed to surface */
    } finally {
      busy = false;
    }
  }

  return {
    setTarget(next) {
      if (next?.profileId !== target?.profileId) {
        client = null;
        lastPushed = null;
        retried = false;
      }
      target = next;
      if (!next) {
        cancel?.();
        cancel = null;
        dirty = false;
        status({ synced: false, at: null });
      }
    },
    markDirty() {
      if (!target || localOnly) return;
      dirty = true;
      if (!cancel) cancel = deps.later(PUSH_DEBOUNCE_MS, () => void push());
    },
    flush() {
      if (dirty) void push();
    },
    async pull() {
      const c = await getClient();
      if (!c) return null;
      try {
        const { data, error } = await c.select();
        if (error) {
          if (missing(error)) {
            localOnly = true;
            status({ localOnly: true, synced: false });
          }
          return null;
        }
        if (data) status({ synced: true, at: deps.now() });
        return data;
      } catch {
        return null;
      }
    },
    async deleteRemote() {
      cancel?.();
      cancel = null;
      dirty = false;
      const c = await getClient();
      if (!c) return false;
      try {
        const { error } = await c.remove();
        if (error && !missing(error)) return false;
        lastPushed = null;
        status({ synced: false, at: null });
        return true;
      } catch {
        return false;
      }
    },
    dispose() {
      cancel?.();
      cancel = null;
      target = null;
      client = null;
      dirty = false;
    },
  };
}

// ─── the real database port ────────────────────────────────────────────────────────────────────────────

/** Supabase-backed client for one profile. lib/supabase loads the SDK lazily, so SSR and tests never import it. */
export async function createSupabaseSyncClient(profileId: string): Promise<SyncClient | null> {
  const sb = getSupabase();
  if (!sb) return null;
  return {
    async select() {
      const { data, error } = await sb
        .from("evolution_profiles")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      return { data: (data as unknown as RemoteProfile | null) ?? null, error };
    },
    async push(profile, history) {
      const up = await sb
        .from("evolution_profiles")
        .upsert(profile as never, { onConflict: "profile_id" });
      if (up.error || history.length === 0) return { error: up.error };
      const ins = await sb
        .from("evolution_history")
        .insert(history.map((h) => ({ ...h, profile_id: profileId })) as never);
      return { error: ins.error };
    },
    async remove() {
      const h = await sb.from("evolution_history").delete().eq("profile_id", profileId);
      if (h.error) return { error: h.error };
      const p = await sb.from("evolution_profiles").delete().eq("profile_id", profileId);
      return { error: p.error };
    },
  };
}

/** `profiles.is_minor` for the signed-in member; null when unknown (sync stays off until it is known). */
export async function fetchIsMinor(profileId: string): Promise<boolean | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from("profiles")
      .select("is_minor")
      .eq("id", profileId)
      .maybeSingle();
    if (error || !data) return null;
    return Boolean((data as { is_minor?: boolean }).is_minor);
  } catch {
    return null;
  }
}

/** The controller the runtime uses in the browser. */
export const defaultSyncDeps = (): SyncDeps => ({
  clientFor: createSupabaseSyncClient,
  later: (ms, fn) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
  now: () => clock.now(),
});

/** The live controller, so Settings can delete the synced copy without holding the runtime. */
let live: SyncController | null = null;
export const registerSyncController = (c: SyncController | null): void => {
  live = c;
};
export const deleteSyncedCopy = (): Promise<boolean> =>
  live?.deleteRemote() ?? Promise.resolve(false);
