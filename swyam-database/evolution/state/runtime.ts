/**
 * The real EvolutionRuntimeApi (frozen in state/types.ts).
 *
 *   track() -> ingestBatch -> run-engine (engine facade) -> persisted stores -> coordinator -> presenter
 *   -> snapshot -> hooks. React state changes ONLY when the presenter releases (or a pref / AI status
 *   changes), and the compiled UIState keeps its identity while its renderKey is unchanged.
 *
 * Non-React and DOM-free apart from injectable ports; every storage touch goes through the guarded adapter, so
 * a throwing localStorage degrades to memory and nothing here can break the UI.
 */
import { compose, UNIVERSAL_DECISION } from "../core/evolution/compose";
import {
  createEngine,
  replayEvents,
  sanitizeInput,
  type EngineState,
} from "../core/evolution/engine";
import { renderReason } from "../core/evolution/reasons";
import { PERSONAS } from "../core/fixtures/journeys";
import type { AnalyzerAdvice } from "../core/analyzer/types";
import { clock } from "../platform/clock";
import { focusPort, prefersInstant } from "../platform/dom";
import { newSessionId } from "../platform/ids";
import { startInteractionGuard } from "../platform/quiet";
import type { StorageAdapter } from "../platform/storage/adapter";
import { createMemoryAdapter } from "../platform/storage/memory";
import {
  BOOT_KEY,
  deviceStorage,
  keyOf,
  onQuotaExceeded,
  removeScope,
} from "../platform/storage/keys";
import {
  createCoordinator,
  type Coordinator,
  type CoordinatorPorts,
} from "../runtime/evolution/coordinator";
import {
  createPresenter,
  type Presenter,
  type PresenterPorts,
} from "../runtime/evolution/presenter";
import {
  committedOf,
  maxSeq,
  runAdvice,
  runIngest,
  runReplay,
  runResetBehaviour,
  runResetEvolution,
  runSessionStart,
  runUndo,
  statusOf,
  type RunOutput,
} from "../runtime/evolution/run-engine";
import {
  createSyncController,
  defaultSyncDeps,
  fromRemoteProfile,
  registerSyncController,
  remoteIsNewer,
  type SyncController,
} from "../sync/supabase-sync";
import { pushAllRing } from "../lib/ring";
import type {
  AdaptiveSetting,
  AiStatus,
  BehaviourEvent,
  ComposeContext,
  DecisionSource,
  EvolutionSnapshot,
  PersonaId,
  Scope,
  TrackInput,
  UIState,
} from "../types";
import { INSTANT_SOURCES, isTrivialDelta, type Committed } from "./committed";
import { defaultSnapshot, IDLE_AI } from "./defaults";
import { describeChange, noticeBus, type NoticeKind } from "./notice";
import { COMMIT_REASON, decisionForRef, previewTarget } from "./preview";
import {
  createSessionPort,
  isAccountScope,
  isSyncableScope,
  LAB_SCOPE,
  mergeGuestIntoAccount,
  previewScope,
  resolveSession,
  scopeFor,
  SESSION_GAP_MS,
  type SessionPort,
} from "./scope";
import { refresh, write } from "./persisted";
import {
  appendEvents,
  compactBehaviour,
  createScopeStores,
  HISTORY_CAP,
  initialEngineRecord,
  type EngineRecord,
  type ScopeStores,
} from "./stores";
import type {
  AuthContextForEvolution,
  EvolutionRuntimeApi,
  PreviewOptions,
  PreviewPlan,
  PreviewTarget,
} from "./types";

/** The concrete runtime: the frozen API plus what only EvolutionRuntime.tsx needs. */
export interface EvolutionRuntimeHandle extends EvolutionRuntimeApi {
  /** Every resolved route (a fresh arrival is a safe point for a release). */
  setRoute(pathname: string): void;
  /** pagehide: remember that an AI analysis is due next visit, and push any waiting sync. */
  onPageHide(): void;
  dispose(): void;
}

export interface RuntimeDeps {
  adapter?: StorageAdapter;
  session?: SessionPort;
  now?: () => number;
  sync?: SyncController | null;
  coordinatorPorts?: Partial<CoordinatorPorts>;
  presenterPorts?: PresenterPorts;
}

type SandboxKind = "lab" | "preview";
interface Sandbox {
  kind: SandboxKind;
  persona: PersonaId | null;
  /** Lab clock: persona events are spaced on a simulated clock so the engine sees realistic time. */
  simNow: number;
  sessionId: string;
  started: boolean;
}

const SIM_STEP_MS = 4_000;
/** Preview journeys are folded on a fixed clock: the same persona always yields the same state. */
const PREVIEW_T0 = Date.UTC(2026, 0, 5, 10, 0, 0);
const PREVIEW_VISIT_GAP_MS = 25 * 60 * 60 * 1000;
const PENDING_BUFFER_MAX = 100;

const universalCommitted = (rev: number): Committed => ({
  rev,
  decision: UNIVERSAL_DECISION,
  tier: 0,
  reasonCode: { key: "START" },
  source: "deterministic",
  at: 0,
});

/** True when the scope's persisted engine record says its aggregate was confirmed on the server. */
function isScopeSynced(ad: StorageAdapter, scope: Scope): boolean {
  try {
    const raw = ad.getItem(keyOf(scope, "engine"));
    const at = raw ? (JSON.parse(raw) as { state?: { syncedAt?: unknown } }).state?.syncedAt : null;
    return typeof at === "number";
  } catch {
    return false;
  }
}

const sameStatus = (a: EvolutionSnapshot["status"], b: EvolutionSnapshot["status"]): boolean =>
  a.scope === b.scope &&
  a.state === b.state &&
  a.mode === b.mode &&
  a.tier === b.tier &&
  a.confidence === b.confidence &&
  a.label === b.label &&
  a.reason === b.reason &&
  a.restored === b.restored &&
  a.lastChangeAt === b.lastChangeAt &&
  a.demo === b.demo &&
  JSON.stringify(a.reasonCode) === JSON.stringify(b.reasonCode);

export function createEvolutionRuntime(deps: RuntimeDeps = {}): EvolutionRuntimeHandle {
  const now = deps.now ?? (() => clock.now());
  const adapter = deps.adapter ?? deviceStorage();
  const sessionPort = deps.session ?? createSessionPort();
  const sync: SyncController | null =
    deps.sync === undefined
      ? typeof window === "undefined"
        ? null
        : createSyncController(defaultSyncDeps())
      : deps.sync;
  if (!deps.sync) registerSyncController(sync);

  const serverSnapshot = defaultSnapshot();
  let snapshot: EvolutionSnapshot = serverSnapshot;
  const listeners = new Set<() => void>();

  let auth: AuthContextForEvolution = { profileId: null, isMinor: true, stableNav: false };
  let authSet = false;
  let stores: ScopeStores | null = null;
  let sandbox: Sandbox | null = null;
  let restored = false;
  let disposed = false;
  let syncKey: string | null = null;
  const pendingBatches: TrackInput[] = [];
  let lastBoot: string | null = null;
  /** The scope of the last REAL activation (guest/account); used for sign-in merge and sign-out cleanup. */
  let realScope: Scope | null = null;

  // ─── transient plan override (Time-Scrub, Try-On) ───────────────────────────────────────────────────
  // In memory only: never written to a store, never synced, never fed to the engine. The snapshot below stays
  // the live truth; hooks read the preview separately.
  let preview: PreviewPlan | null = null;
  let previewSeq = 0;
  let stopPreviewTimer: (() => void) | null = null;
  let lastPath: string | null = null;
  const previewListeners = new Set<() => void>();

  const presenter: Presenter = createPresenter(
    universalCommitted(0),
    deps.presenterPorts ?? { prefersInstant },
  );

  // ─── snapshot ────────────────────────────────────────────────────────────────────────────────────────

  const composeCtx = (): ComposeContext => ({
    signedIn: auth.profileId !== null,
    stableNav: auth.stableNav,
    locked: stores ? stores.prefs.getState().locked : false,
  });

  const composeFor = (c: Committed): UIState => compose(c.decision, c.tier, composeCtx());

  /** What the user is shown, given the Off setting (Off renders UNIVERSAL without touching the learned state). */
  function effective(c: Committed): Committed {
    return stores && stores.prefs.getState().adaptive === "off" ? universalCommitted(c.rev) : c;
  }

  function writeBoot(ui: UIState, scope: Scope): void {
    if (sandbox) return; // sandboxes never write the boot hint
    try {
      const raw = JSON.stringify({
        v: 1,
        scope,
        state: ui.state,
        nav: ui.navMode,
        layout: ui.layout,
        density: ui.density,
        tier: ui.tier,
        locked: ui.locked,
      });
      if (raw === lastBoot) return;
      lastBoot = raw;
      if (adapter.getItem(BOOT_KEY) !== raw) adapter.setItem(BOOT_KEY, raw);
    } catch {
      /* the hint must never break a commit */
    }
  }

  function rebuild(): void {
    if (disposed) return;
    const prev = snapshot;
    if (!stores) {
      snapshot = serverSnapshot;
    } else {
      const s = stores;
      const rec = s.engine.getState();
      const prefs = s.prefs.getState();
      const shown = effective(presenter.peek());
      const nextUi = composeFor(shown);
      // The compiled plan keeps its identity while its renderKey is unchanged: consumers do not re-render.
      const ui = prev.hydrated && prev.ui.renderKey === nextUi.renderKey ? prev.ui : nextUi;
      const status = statusOf(shown, s.scope, {
        restored,
        demo: sandbox?.persona ?? null,
        lastChangeAt: presenter.peek().at || null,
      });
      const next: EvolutionSnapshot = {
        scope: s.scope,
        prefs:
          prev.hydrated &&
          prev.prefs.adaptive === prefs.adaptive &&
          prev.prefs.locked === prefs.locked
            ? prev.prefs
            : { adaptive: prefs.adaptive, locked: prefs.locked },
        profile: rec.engine.profile,
        decision: shown.decision,
        tier: shown.tier,
        ui,
        history: s.history.getState().entries,
        status: prev.hydrated && sameStatus(prev.status, status) ? prev.status : status,
        ai: s.ai.getState().status,
        hydrated: true,
      };
      const unchanged =
        prev.hydrated &&
        prev.scope === next.scope &&
        prev.prefs === next.prefs &&
        prev.profile === next.profile &&
        prev.decision === next.decision &&
        prev.tier === next.tier &&
        prev.ui === next.ui &&
        prev.history === next.history &&
        prev.status === next.status &&
        prev.ai === next.ai;
      if (unchanged) return;
      snapshot = next;
      writeBoot(ui, s.scope);
    }
    for (const l of [...listeners]) {
      try {
        l();
      } catch {
        /* a subscriber must never break a commit */
      }
    }
  }

  // ─── storage plumbing ────────────────────────────────────────────────────────────────────────────────

  function persist(out: RunOutput): void {
    const s = stores;
    if (!s) return;
    const t = now();
    if (out.events.length > 0)
      write(s.behaviour, (b) => ({ events: appendEvents(b.events, out.events, t) }));
    if (out.history.length > 0)
      write(s.history, (h) => ({ entries: pushAllRing(h.entries, out.history, HISTORY_CAP) }));
    write(s.engine, () => out.rec);
  }

  /** Read-before-write: pick up another tab's work, compute from the fresh record, write once. */
  function mutate(fn: (rec: EngineRecord) => RunOutput | null): RunOutput | null {
    const s = stores;
    if (!s) return null;
    refresh(s.engine);
    refresh(s.behaviour);
    refresh(s.history);
    const out = fn(s.engine.getState());
    if (!out) return null;
    persist(out);
    return out;
  }

  function releaseInstant(
    c: Committed,
    notice: { kind: NoticeKind; message: string } | null,
  ): void {
    presenter.release(c, "instant", { force: true });
    if (notice)
      noticeBus.set({ id: c.rev, kind: notice.kind, message: notice.message, undoable: false });
    else noticeBus.set(null);
  }

  function afterCommit(out: RunOutput | null, source: DecisionSource): void {
    if (!out || !stores) return;
    if (!sandbox) sync?.markDirty();
    if (INSTANT_SOURCES.has(source)) releaseInstant(committedOf(out.rec), null);
    else {
      coordinator.poke();
      rebuildIfProfileVisible();
    }
  }

  /** The Lab reads the live profile; for real users the snapshot moves only on release (see rebuild()). */
  function rebuildIfProfileVisible(): void {
    if (sandbox?.kind === "lab") rebuild();
  }

  // ─── presenter / coordinator ─────────────────────────────────────────────────────────────────────────

  presenter.subscribe((c) => {
    restored = false;
    const s = stores;
    if (s && !(sandbox?.kind === "preview")) {
      write(s.engine, (r) =>
        r.presented?.rev === c.rev && r.presented.at === c.at ? null : { presented: c },
      );
    }
    rebuild();
  });

  const pending = (): Committed | null => {
    if (!stores) return null;
    const c = committedOf(stores.engine.getState());
    const shown = presenter.peek();
    if (c.rev === shown.rev) return null;
    if (c.rev > shown.rev && isTrivialDelta(shown, c)) return null;
    return c;
  };

  const realPorts: Omit<CoordinatorPorts, "pending" | "frozen" | "presenter" | "onReleased"> = {
    now,
    every: (ms, fn) => {
      const t = setInterval(fn, ms);
      return () => clearInterval(t);
    },
    later: (ms, fn) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    startGuard: () => startInteractionGuard(),
    isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
    onVisibilityChange: (cb) => {
      if (typeof document === "undefined") return () => {};
      document.addEventListener("visibilitychange", cb);
      return () => document.removeEventListener("visibilitychange", cb);
    },
    focus: focusPort,
  };

  const coordinator: Coordinator = createCoordinator({
    ...realPorts,
    pending,
    frozen: () => {
      if (!stores) return true;
      if (preview) return true; // a real change never lands under a preview; it is released when it ends
      const p = stores.prefs.getState();
      return p.locked || p.adaptive !== "on";
    },
    presenter,
    onReleased: (next, prev) => {
      if (sandbox) return;
      const msg = describeChange(composeFor(prev), composeFor(next));
      noticeBus.set({ id: next.rev, kind: "change", message: msg, undoable: true });
    },
    ...deps.coordinatorPorts,
  });
  const stopCoordinator = coordinator.start();

  // ─── scope activation ────────────────────────────────────────────────────────────────────────────────

  let stopStorageWatch: (() => void) | null = null;
  const stopQuota = deps.adapter
    ? () => {}
    : onQuotaExceeded(() => {
        if (stores) compactBehaviour(stores.behaviour);
      });

  function watchStorage(): void {
    stopStorageWatch?.();
    stopStorageWatch = null;
    if (!adapter.subscribe || sandbox?.kind === "preview") return;
    stopStorageWatch = adapter.subscribe((key) => {
      if (disposed || !stores) return;
      try {
        if (key === null) {
          stores.clearInMemory();
          presenter.adopt(committedOf(stores.engine.getState()));
          rebuild();
          return;
        }
        const slot = stores.slotOf(key);
        if (!slot) return;
        stores.refreshSlot(slot);
        if (slot === "engine") coordinator.poke();
        if (slot === "prefs") syncTarget();
        if (slot !== "behaviour") rebuild();
      } catch {
        /* never break the page over a sync event */
      }
    });
  }

  /** D10: a scope counts a session once per session id (new tab, or 30 min of silence). */
  function ensureSession(): string {
    const t = now();
    const sess = resolveSession(sessionPort, t);
    const s = stores;
    if (s && s.engine.getState().sessionId !== sess.id) {
      const out = mutate((rec) => runSessionStart(rec, t, sess.id));
      afterCommit(out, "deterministic");
    }
    return sess.id;
  }

  /** Eligibility for sync; returns true when this call newly made the scope eligible. */
  function syncTarget(): boolean {
    const s = stores;
    const profileId = auth.profileId;
    const eligible =
      !!sync &&
      !!s &&
      !sandbox &&
      !!profileId &&
      !auth.isMinor &&
      isSyncableScope(s.scope) &&
      s.prefs.getState().adaptive === "on";
    if (!eligible || !sync || !s || !profileId) {
      sync?.setTarget(null);
      syncKey = null;
      return false;
    }
    const key = `${s.scope}|${profileId}`;
    if (syncKey === key) return false;
    syncKey = key;
    sync.setTarget({
      profileId,
      payload: () => ({
        profileId,
        rec: s.engine.getState(),
        locked: s.prefs.getState().locked,
        history: s.history.getState().entries,
      }),
      onPushed: (at) => write(s.engine, (r) => ({ ...r, syncedAt: at })),
    });
    return true;
  }

  /** Newer client_updated_at wins: adopt the server aggregate, or push ours. */
  function reconcile(): void {
    const s = stores;
    if (!s || !sync) return;
    void sync.pull().then((remote) => {
      if (disposed || stores !== s) return;
      const rec = s.engine.getState();
      if (remote && remoteIsNewer(remote, rec.updatedAt)) {
        const next = fromRemoteProfile(remote, s.scope, rec);
        if (!next) return;
        write(s.engine, () => next);
        write(s.prefs, () => ({ locked: remote.locked }));
        releaseInstant(committedOf(next), null);
        restored = true;
        rebuild();
      } else if (rec.updatedAt > 0) {
        sync.markDirty();
      }
    });
  }

  function activate(scope: Scope, ad: StorageAdapter): void {
    const s = createScopeStores(scope, ad);
    stores = s;
    watchStorage();
    let rec = s.engine.getState();
    const events = s.behaviour.getState().events;
    // The engine fell behind its own log (an invalid restore or a partial write): rebuild it by replay.
    if (maxSeq(events) > rec.engine.seq) {
      const out = runReplay(rec, scope, events, now());
      write(s.engine, () => out.rec);
      rec = out.rec;
    }
    const committed = committedOf(rec);
    const shown = rec.presented ?? committed;
    presenter.adopt(shown);
    restored =
      rec.presented !== null && (shown.decision.primaryState !== "UNIVERSAL" || shown.tier > 0);
    noticeBus.set(null);
    if (!sandbox) {
      ensureSession();
      if (syncTarget()) reconcile();
    }
    rebuild();
    coordinator.poke();
  }

  function activateReal(): void {
    const scope = scopeFor(auth.profileId);
    if (stores && !sandbox && stores.scope === scope) {
      // Same scope: the account context changed (is_minor resolved, role, ...).
      if (syncTarget()) reconcile();
      rebuild();
      return;
    }
    const prev = realScope;
    // Shared-computer rule: a synced account leaves nothing behind on sign-out (its copy lives on the server).
    if (prev && isAccountScope(prev) && scope === "guest" && isScopeSynced(adapter, prev))
      removeScope(adapter, prev);
    if (isAccountScope(scope)) mergeGuestIntoAccount(adapter, scope);
    syncKey = null;
    realScope = scope;
    activate(scope, adapter);
  }

  // ─── ingest ──────────────────────────────────────────────────────────────────────────────────────────

  function foldLive(inputs: readonly TrackInput[], source: DecisionSource): void {
    const s = stores;
    if (!s || inputs.length === 0) return;
    refresh(s.prefs);
    if (s.prefs.getState().adaptive !== "on") return;
    const sessionId = ensureSession();
    const t = now();
    afterCommit(
      mutate((rec) => runIngest(rec, inputs, { now: t, sessionId, source })),
      source,
    );
  }

  function beginSandboxSession(box: Sandbox): void {
    const out = mutate((rec) => runSessionStart(rec, box.simNow, box.sessionId));
    box.started = true;
    afterCommit(out, "persona");
  }

  // ─── sandbox ─────────────────────────────────────────────────────────────────────────────────────────

  function previewEvents(persona: PersonaId): BehaviourEvent[] {
    const out: BehaviourEvent[] = [];
    let t = PREVIEW_T0;
    let seq = 0;
    PERSONAS[persona].sessions.forEach((session, i) => {
      if (i > 0) t += PREVIEW_VISIT_GAP_MS;
      for (const input of session) {
        t += SIM_STEP_MS;
        const e = sanitizeInput(input, { now: t, sessionId: `pv_${persona}_${i}` }, seq + 1);
        if (e) {
          seq = e.seq;
          out.push(e);
        }
      }
    });
    return out;
  }

  function enterSandbox(kind: SandboxKind, persona: PersonaId | null): void {
    sandbox = { kind, persona, simNow: now(), sessionId: newSessionId(now()), started: false };
    if (kind === "lab") {
      removeScope(adapter, LAB_SCOPE); // the lab scope starts clean every time
      sync?.setTarget(null);
      syncKey = null;
      activate(LAB_SCOPE, adapter);
      return;
    }
    // preview: in memory, read-only, tracking disabled; folded from the persona journey by replay.
    const scope = previewScope(persona ?? "learning-explorer");
    const mem = createMemoryAdapter();
    const s = createScopeStores(scope, mem);
    stores = s;
    stopStorageWatch?.();
    stopStorageWatch = null;
    sync?.setTarget(null);
    syncKey = null;
    const events = persona ? previewEvents(persona) : [];
    const engine: EngineState =
      events.length > 0 ? replayEvents(scope, events) : createEngine(scope);
    const base = initialEngineRecord(scope);
    const t = events.length > 0 ? (events[events.length - 1]?.timestamp ?? PREVIEW_T0) : PREVIEW_T0;
    const rec: EngineRecord = {
      ...base,
      engine,
      rev: 1,
      committedSource: "persona",
      committedAt: t,
      updatedAt: t,
    };
    s.behaviour.setState({ events });
    s.engine.setState(rec);
    presenter.adopt(committedOf(rec));
    restored = false;
    noticeBus.set(null);
    rebuild();
  }

  function exitSandbox(): void {
    if (!sandbox) return;
    sandbox = null;
    stopStorageWatch?.();
    stopStorageWatch = null;
    stores = null;
    lastBoot = null;
    noticeBus.set(null);
    if (authSet) activateReal();
    else rebuild();
  }

  // ─── preview ─────────────────────────────────────────────────────────────────────────────────────────

  function notifyPreview(): void {
    for (const l of [...previewListeners]) {
      try {
        l();
      } catch {
        /* a subscriber must never break a command */
      }
    }
  }

  /** Back to the live plan. Anything the engine decided meanwhile is released at the next safe point. */
  function dropPreview(): void {
    stopPreviewTimer?.();
    stopPreviewTimer = null;
    if (!preview) return;
    preview = null;
    notifyPreview();
    if (stores) coordinator.poke();
  }

  function startPreview(target: PreviewTarget, opts: PreviewOptions = {}): void {
    if (disposed || !stores) return;
    try {
      const r = previewTarget(target, composeCtx(), opts.confidence);
      stopPreviewTimer?.();
      stopPreviewTimer = null;
      const t = now();
      const ttl = opts.ttlMs !== undefined && opts.ttlMs > 0 ? opts.ttlMs : null;
      const id = ++previewSeq;
      preview = {
        id,
        source: opts.source ?? (r.persona ? "tryon" : "scrub"),
        ref: r.ref,
        persona: r.persona,
        ui: r.ui,
        reasonCode: opts.reasonCode ?? (r.persona ? { key: "PERSONA" } : { key: "START" }),
        confidence: r.confidence,
        startedAt: t,
        expiresAt: ttl === null ? null : t + ttl,
      };
      if (ttl !== null) {
        const later = deps.coordinatorPorts?.later ?? realPorts.later;
        stopPreviewTimer = later(ttl, () => {
          if (preview?.id === id) dropPreview();
        });
      }
      notifyPreview();
    } catch {
      /* a preview that cannot be composed simply does not start */
    }
  }

  /** Present the previewed structure and keep it (the existing Keep path: learning continues, structure holds). */
  function commitPreviewNow(): void {
    const s = stores;
    const p = preview;
    if (!s || !p || disposed) return;
    const base = presenter.peek();
    const liveRev = committedOf(s.engine.getState()).rev;
    const decision = {
      ...decisionForRef(p.ref, p.confidence),
      reason: renderReason(COMMIT_REASON),
    };
    const c: Committed = {
      rev: Math.max(liveRev, base.rev),
      decision,
      tier: p.ref.tier,
      reasonCode: COMMIT_REASON,
      source: "manual",
      at: now(),
    };
    const who = p.persona;
    stopPreviewTimer?.();
    stopPreviewTimer = null;
    preview = null;
    write(s.prefs, (pr) => (pr.locked ? null : { locked: true }));
    if (!sandbox) sync?.markDirty();
    releaseInstant(c, {
      kind: "change",
      message: who
        ? "This layout is yours now. Swayam keeps it as it is."
        : "Layout restored. Swayam keeps it as it is.",
    });
    notifyPreview();
  }

  // ─── the API ─────────────────────────────────────────────────────────────────────────────────────────

  const api: EvolutionRuntimeHandle = {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },

    ingestBatch(batch) {
      try {
        if (batch.length > 0) dropPreview(); // any tracked event ends a preview
        if (disposed || batch.length === 0 || sandbox) return; // sandboxes: tracking disabled
        if (!stores) {
          pendingBatches.push(...batch);
          if (pendingBatches.length > PENDING_BUFFER_MAX)
            pendingBatches.splice(0, pendingBatches.length - PENDING_BUFFER_MAX);
          return;
        }
        foldLive(batch, "deterministic");
      } catch {
        /* tracking never blocks the UI */
      }
    },
    ingestNow(input, source = "persona") {
      try {
        dropPreview();
        const s = stores;
        if (!s || disposed) return;
        if (sandbox) {
          if (!sandbox.started) beginSandboxSession(sandbox);
          sandbox.simNow += SIM_STEP_MS;
          const box = sandbox;
          afterCommit(
            mutate((rec) =>
              runIngest(rec, [input], { now: box.simNow, sessionId: box.sessionId, source }),
            ),
            source,
          );
          return;
        }
        refresh(s.prefs);
        if (s.prefs.getState().adaptive !== "on") return;
        const sessionId = ensureSession();
        const t = now();
        afterCommit(
          mutate((rec) => runIngest(rec, [input], { now: t, sessionId, source })),
          source,
        );
      } catch {
        /* never throws into a feature */
      }
    },
    newSession() {
      try {
        dropPreview();
        if (!stores) return;
        if (sandbox) {
          sandbox.simNow += SESSION_GAP_MS + 60_000;
          sandbox.sessionId = newSessionId(sandbox.simNow);
          beginSandboxSession(sandbox);
          return;
        }
        const t = now();
        sessionPort.write({ id: newSessionId(t), lastTs: t });
        ensureSession();
      } catch {
        /* ignore */
      }
    },

    getPreview: () => preview,
    subscribePreview(l) {
      previewListeners.add(l);
      return () => {
        previewListeners.delete(l);
      };
    },
    previewPlan: startPreview,
    clearPreview: dropPreview,
    commitPreview: commitPreviewNow,

    getEngineState: () => stores?.engine.getState().engine ?? createEngine("guest"),
    getEvents: () => stores?.behaviour.getState().events ?? [],

    applyAdvice(advice: AnalyzerAdvice) {
      try {
        const s = stores;
        if (!s || disposed) return;
        refresh(s.prefs);
        if (s.prefs.getState().adaptive !== "on") return;
        const t = sandbox ? sandbox.simNow : now();
        afterCommit(
          mutate((rec) => runAdvice(rec, advice, t)),
          "ai",
        );
      } catch {
        /* the AI never blocks the UI */
      }
    },
    setAiStatus(patch: Partial<AiStatus>) {
      try {
        const s = stores;
        if (!s) return;
        write(s.ai, (a) => ({ status: { ...a.status, ...patch } }));
        rebuild();
      } catch {
        /* ignore */
      }
    },

    setAuth(next) {
      if (next.profileId !== auth.profileId) dropPreview();
      auth = next;
      authSet = true;
      if (disposed) return;
      if (sandbox) {
        rebuild(); // a preview keeps its scope; signed-in nav still follows the account
        return;
      }
      activateReal();
      if (pendingBatches.length > 0) {
        const batch = pendingBatches.splice(0, pendingBatches.length);
        foldLive(batch, "deterministic");
      }
    },

    enterSandbox(kind, persona) {
      dropPreview();
      enterSandbox(kind, persona);
    },
    exitSandbox() {
      dropPreview();
      exitSandbox();
    },

    // ── commands ──
    resetBehaviour() {
      dropPreview();
      const s = stores;
      if (!s) return;
      const t = sandbox ? sandbox.simNow : now();
      refresh(s.engine);
      write(s.behaviour, () => ({ events: [] }));
      write(s.history, () => ({ entries: [] }));
      const out = runResetBehaviour(s.engine.getState(), s.scope, t);
      write(s.engine, () => out.rec);
      if (!sandbox) sync?.markDirty();
      noticeBus.set({
        id: out.rec.rev,
        kind: "reset",
        message: "Swayam forgot what it learned.",
        undoable: false,
      });
      rebuild();
    },
    resetEvolution() {
      dropPreview();
      const s = stores;
      if (!s) return;
      const t = sandbox ? sandbox.simNow : now();
      const out = mutate((rec) => runResetEvolution(rec, t));
      if (!out) return;
      if (!sandbox) sync?.markDirty();
      releaseInstant(committedOf(out.rec), {
        kind: "reset",
        message: "Swayam went back to the standard layout.",
      });
    },
    resetExperience() {
      dropPreview();
      const s = stores;
      if (!s) return;
      const t = sandbox ? sandbox.simNow : now();
      refresh(s.engine);
      write(s.behaviour, () => ({ events: [] }));
      write(s.history, () => ({ entries: [] }));
      const wiped = runResetBehaviour(s.engine.getState(), s.scope, t);
      const out = runResetEvolution(wiped.rec, t);
      write(s.engine, () => ({ ...out.rec, syncedAt: null }));
      write(s.ai, (a) => ({
        ...a,
        status: { ...IDLE_AI, callsLeftToday: a.status.callsLeftToday },
        pendingAnalysis: false,
        summaryHash: null,
      }));
      if (!sandbox && sync && isSyncableScope(s.scope)) void sync.deleteRemote();
      releaseInstant(committedOf(out.rec), {
        kind: "reset",
        message: "Swayam is back to the standard layout and forgot what it learned.",
      });
    },
    setLocked(locked) {
      dropPreview();
      const s = stores;
      if (!s) return;
      write(s.prefs, (p) => (p.locked === locked ? null : { locked }));
      if (!sandbox) sync?.markDirty();
      rebuild();
      if (!locked) coordinator.poke();
    },
    setAdaptive(setting: AdaptiveSetting) {
      dropPreview();
      const s = stores;
      if (!s) return;
      write(s.prefs, (p) => (p.adaptive === setting ? null : { adaptive: setting }));
      const newlyEligible = syncTarget(); // not "on" => the target is cleared
      rebuild();
      if (setting === "on") {
        coordinator.poke();
        if (newlyEligible) reconcile();
      }
    },
    undo() {
      dropPreview();
      const s = stores;
      if (!s) return;
      const t = sandbox ? sandbox.simNow : now();
      const out = mutate((rec) => runUndo(rec, t));
      if (!out) return;
      if (!sandbox) sync?.markDirty();
      releaseInstant(committedOf(out.rec), {
        kind: "undo",
        message: "Undone. Back to how it was.",
      });
    },

    setRoute(pathname) {
      // A different page ends a preview; the same path (a hash or search change) does not.
      if (lastPath !== null && pathname !== lastPath) dropPreview();
      lastPath = pathname;
      coordinator.setRoute(pathname);
    },
    onPageHide() {
      try {
        const s = stores;
        if (
          s &&
          !sandbox &&
          s.prefs.getState().adaptive === "on" &&
          s.engine.getState().engine.profile.meaningfulCount > 0
        )
          write(s.ai, () => ({ pendingAnalysis: true }));
        sync?.flush();
      } catch {
        /* ignore */
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopPreviewTimer?.();
      stopPreviewTimer = null;
      preview = null;
      previewListeners.clear();
      stopCoordinator();
      stopStorageWatch?.();
      stopQuota();
      sync?.flush();
      sync?.dispose();
      if (!deps.sync) registerSyncController(null);
      listeners.clear();
    },
  };

  return api;
}
