/**
 * AI scheduler (plan §5.5). Decides WHEN to ask the optional AI brain, asks at
 * most a handful of times a day, and hands the answer to the merge policy.
 *
 * The UI never waits on any of this. The deterministic engine has already
 * decided and rendered; if the AI is off, unconfigured, capped, slow, wrong or
 * unreachable, nothing changes and the user cannot tell. Every failure path
 * ends in a status line for the Lab, never in an exception.
 *
 * Gates (all must pass for a background call):
 *   kill switch VITE_EVOLUTION_AI != off · adaptive === "on" · not a Lab demo ·
 *   armed (never on first paint) · one request in flight · not locked out
 *   (429 → until tomorrow, 3 failures → this session) · ≤ 6 calls per scope
 *   per day · ≥ 12 meaningful events across ≥ 2 domains · ≥ 3 minutes since
 *   the last call · the summary hash changed.
 *
 * `requestAiAnalysis` (the Lab's button, persona end) bypasses the count and
 * 3-minute gates only. Daily caps and the cache still apply.
 */
import { AI_FALLBACKS } from "../../config/ids";
import { mergeAdvice } from "../../core/analyzer/merge";
import {
  COMPLETED_ACTION_TYPES,
  activeDomains,
  hashSummary,
  summarize,
} from "../../core/analyzer/summarize";
import { EVOLUTION_FIXTURE_HEADER, type EvolutionFixtureMode } from "../../core/analyzer/types";
import { validateDecision } from "../../core/ui-state/validate";
import type { EvolutionRuntimeApi } from "../../state/types";
import type {
  AiFallback,
  AiStatus,
  AnalyzerTrigger,
  EventType,
  EvolutionDecision,
} from "../../types";

export const MIN_MEANINGFUL = 12;
export const MIN_DOMAINS = 2;
export const MIN_GAP_MS = 3 * 60_000;
export const MAX_CALLS_PER_DAY = 6;
export const THRESHOLD_EVENTS = 15;
export const CONFIDENCE_SHIFT = 0.15;
export const REPEAT_TRIGGER = 5;
export const REQUEST_TIMEOUT_MS = 8_000;
export const MAX_FAILURES = 3;
/** Background triggers wait this long after start, so nothing ever fires on first paint. */
export const ARM_DELAY_MS = 2_000;

export const UNAVAILABLE_TEXT = "AI unavailable — the on-device engine decided";

const ENDPOINT = "/api/evolution";
const COMPLETED: ReadonlySet<EventType> = new Set(COMPLETED_ACTION_TYPES);
const FIXTURE_MODES: readonly string[] = ["timeout", "invalid", "rate_limited", "unavailable"];

const REJECT_TEXT = {
  evidence_floor: "not enough local evidence for that state",
  stale: "the answer arrived too late",
  wrong_epoch: "the layout was reset meanwhile",
  locked: "your layout is locked",
  invalid: "the AI answer failed validation",
  same: "AI agrees with the on-device engine",
} as const;

/** What this scheduler keeps in `swayam.evo.<scope>.ai`. Fields written by others are preserved. */
interface AiRecord {
  /** Local calendar day of `calls`, "YYYY-MM-DD". */
  day?: string;
  calls?: number;
  lastCallAt?: number;
  /** Summary hash and the validated decision it produced (the client-side cache). */
  hash?: string;
  decision?: unknown;
  /** Meaningful count and confidence at the last analysis: baselines for the triggers. */
  meaningfulAt?: number;
  confidenceAt?: number;
  /** A 429 switches the AI off for this local day. */
  disabledDay?: string;
  /** Set on pagehide; consumed on the next visit. */
  pendingAnalysis?: boolean;
}

export interface SchedulerDeps {
  now: () => number;
  fetchImpl: () => typeof fetch | null;
  storage: () => Storage | null;
  /** VITE_EVOLUTION_AI === "off" */
  killSwitch: () => boolean;
  /** requestIdleCallback with a timer fallback. */
  idle: (fn: () => void) => void;
  onPageHide: (fn: () => void) => () => void;
  isClient: () => boolean;
}

const DEFAULT_DEPS: SchedulerDeps = {
  now: () => Date.now(),
  fetchImpl: () => (typeof fetch === "function" ? fetch : null),
  storage: () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  },
  killSwitch: () => {
    try {
      return import.meta.env["VITE_EVOLUTION_AI"] === "off";
    } catch {
      return false;
    }
  },
  idle: (fn) => {
    const g = globalThis as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    if (typeof g.requestIdleCallback === "function") g.requestIdleCallback(fn, { timeout: 5_000 });
    else setTimeout(fn, 200);
  },
  onPageHide: (fn) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("pagehide", fn);
    return () => window.removeEventListener("pagehide", fn);
  },
  isClient: () => typeof window !== "undefined",
};

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The local calendar day, so "until tomorrow" means the person's tomorrow. */
function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const isSandbox = (scope: string): boolean =>
  scope.startsWith("lab_") || scope.startsWith("preview_");

export interface AiController {
  start(): () => void;
  request(trigger: AnalyzerTrigger): Promise<AiStatus>;
}

export function createAiController(
  rt: EvolutionRuntimeApi,
  overrides: Partial<SchedulerDeps> = {},
): AiController {
  const deps: SchedulerDeps = { ...DEFAULT_DEPS, ...overrides };

  let inflight = false;
  let failures = 0;
  let sessionOff: AiFallback | null = null;
  let armed = false;
  let scheduled = false;
  let pending: AnalyzerTrigger | null = null;
  let runId = 0;
  let active = false;
  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let unsub: (() => void) | null = null;
  let unhide: (() => void) | null = null;

  /* In-memory trigger baselines for the scope being watched. */
  let watching = "";
  let lastSeq = 0;
  let baseMeaningful = 0;
  let baseConfidence = 0;
  let baseState = "";
  const repeatedFired = new Set<string>();

  /* ── persisted record ──────────────────────────────────────────── */

  const keyOf = (scope: string): string => `swayam.evo.${scope}.ai`;

  function read(scope: string): AiRecord {
    try {
      const raw = deps.storage()?.getItem(keyOf(scope));
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return isPlain(parsed) ? (parsed as AiRecord) : {};
    } catch {
      return {};
    }
  }

  function write(scope: string, patch: AiRecord): AiRecord {
    const next = { ...read(scope), ...patch };
    try {
      deps.storage()?.setItem(keyOf(scope), JSON.stringify(next));
    } catch {
      /* storage blocked or full: the in-memory gates still hold for this session */
    }
    return next;
  }

  const callsToday = (rec: AiRecord, now: number): number =>
    rec.day === dayOf(now) ? Math.max(0, rec.calls ?? 0) : 0;

  const callsLeft = (rec: AiRecord, now: number): number =>
    Math.max(0, MAX_CALLS_PER_DAY - callsToday(rec, now));

  /* ── status ────────────────────────────────────────────────────── */

  let last: AiStatus | null = null;
  function commit(patch: Partial<AiStatus>): AiStatus {
    try {
      rt.setAiStatus(patch);
    } catch {
      /* a status line must never break anything */
    }
    last = { ...rt.getSnapshot().ai, ...patch };
    return last;
  }
  const current = (): AiStatus => last ?? rt.getSnapshot().ai;

  function unavailable(trigger: AnalyzerTrigger, fallback: AiFallback, left: number): AiStatus {
    return commit({
      kind: "unavailable",
      lastTrigger: trigger,
      lastDecision: null,
      detail: UNAVAILABLE_TEXT,
      fallback,
      callsLeftToday: left,
      at: deps.now(),
    });
  }

  /* ── gates ─────────────────────────────────────────────────────── */

  /** null = go. "busy" = a request is already in flight. Otherwise the fallback to report. */
  function gate(bypassCount: boolean): { fallback: AiFallback } | "busy" | null {
    if (deps.killSwitch()) return { fallback: "off" };
    const snap = rt.getSnapshot();
    if (snap.prefs.adaptive !== "on") return { fallback: "off" };
    if (sessionOff) return { fallback: sessionOff };
    if (inflight) return "busy";
    const now = deps.now();
    const rec = read(snap.scope);
    if (rec.disabledDay === dayOf(now)) return { fallback: "rate_limited" };
    if (callsToday(rec, now) >= MAX_CALLS_PER_DAY) return { fallback: "rate_limited" };
    if (!bypassCount) {
      const engine = rt.getEngineState();
      if (engine.profile.meaningfulCount < MIN_MEANINGFUL) return { fallback: "off" };
      if (activeDomains(engine.profile) < MIN_DOMAINS) return { fallback: "off" };
      if (now - (rec.lastCallAt ?? 0) < MIN_GAP_MS) return { fallback: "off" };
    }
    return null;
  }

  /* ── one analysis ──────────────────────────────────────────────── */

  async function run(trigger: AnalyzerTrigger, explicit: boolean): Promise<AiStatus> {
    const blocked = gate(explicit);
    if (blocked === "busy") return current();
    const scope = rt.getSnapshot().scope;
    const now = deps.now();
    if (blocked) {
      // A background skip is silent. The Lab asked, so it is told plainly.
      if (!explicit) return current();
      return unavailable(trigger, blocked.fallback, callsLeft(read(scope), now));
    }

    const engine = rt.getEngineState();
    const req = summarize(engine, rt.getEvents(), trigger);
    const hash = hashSummary(req);
    let rec = read(scope);
    const sent = { epoch: engine.epoch, meaningful: engine.profile.meaningfulCount };

    if (rec.hash === hash) {
      // Nothing new since the last analysis. The Lab replays the cached decision; the rest stay quiet.
      const cached = trigger === "lab" ? validateDecision(rec.decision, "ai") : null;
      if (cached?.ok) return finish(cached.value, sent, trigger, rec);
      rebase();
      return current();
    }

    const doFetch = deps.fetchImpl();
    if (!doFetch) return unavailable(trigger, "upstream", callsLeft(rec, now));

    // Count the call when it is SENT: a timeout still spent the server's budget.
    rec = write(scope, {
      day: dayOf(now),
      calls: callsToday(rec, now) + 1,
      lastCallAt: now,
      meaningfulAt: sent.meaningful,
      confidenceAt: engine.decision.confidence,
    });
    rebase();
    commit({
      kind: "pending",
      lastTrigger: trigger,
      detail: null,
      fallback: null,
      callsLeftToday: callsLeft(rec, now),
    });

    inflight = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const forced = devFixtureHeader();
      if (forced) headers[EVOLUTION_FIXTURE_HEADER] = forced;
      const res = await doFetch(ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(req),
        signal: ctrl.signal,
        credentials: "omit",
      });
      if (res.status === 429) return lockOut(scope, trigger, rec);
      if (!res.ok) return failure(trigger, "upstream", rec);
      const body: unknown = await res.json();
      if (!isPlain(body)) return failure(trigger, "invalid", rec);

      if (body["ok"] === true && body["source"] === "ai") {
        const checked = validateDecision(body["decision"], "ai");
        if (!checked.ok) return failure(trigger, "invalid", rec);
        failures = 0;
        write(scope, { hash, decision: checked.value });
        return finish(checked.value, sent, trigger, rec);
      }
      const fallback = body["fallback"];
      if (body["ok"] === false && (AI_FALLBACKS as readonly unknown[]).includes(fallback))
        return handleFallback(fallback as AiFallback, scope, trigger, rec);
      return failure(trigger, "invalid", rec);
    } catch {
      return failure(trigger, ctrl.signal.aborted ? "timeout" : "upstream", rec);
    } finally {
      clearTimeout(timer);
      inflight = false;
    }
  }

  function devFixtureHeader(): EvolutionFixtureMode | null {
    try {
      if (!import.meta.env.DEV) return null;
      const v = deps.storage()?.getItem("swayam.evo.dev.fixture");
      return v && FIXTURE_MODES.includes(v) ? (v as EvolutionFixtureMode) : null;
    } catch {
      return null;
    }
  }

  function handleFallback(
    fallback: AiFallback,
    scope: string,
    trigger: AnalyzerTrigger,
    rec: AiRecord,
  ): AiStatus {
    if (fallback === "rate_limited") return lockOut(scope, trigger, rec);
    if (fallback === "unconfigured" || fallback === "off") {
      // Nothing to retry: stop asking for the rest of the session.
      sessionOff = fallback;
      return unavailable(trigger, fallback, callsLeft(rec, deps.now()));
    }
    return failure(trigger, fallback, rec);
  }

  /** A 429 (ours or Gemini's) switches the AI off until the next local day. */
  function lockOut(scope: string, trigger: AnalyzerTrigger, rec: AiRecord): AiStatus {
    write(scope, { disabledDay: dayOf(deps.now()) });
    return unavailable(trigger, "rate_limited", callsLeft(rec, deps.now()));
  }

  /** Three failures switch the AI off for this session. */
  function failure(trigger: AnalyzerTrigger, fallback: AiFallback, rec: AiRecord): AiStatus {
    failures += 1;
    if (failures >= MAX_FAILURES) sessionOff = fallback;
    return unavailable(trigger, fallback, callsLeft(rec, deps.now()));
  }

  /** Merge a validated decision (fresh or cached) and report what became of it. */
  function finish(
    decision: EvolutionDecision,
    sent: { epoch: number; meaningful: number },
    trigger: AnalyzerTrigger,
    rec: AiRecord,
  ): AiStatus {
    const now = deps.now();
    const outcome = mergeAdvice({
      decision,
      engine: rt.getEngineState(),
      sent,
      locked: rt.getSnapshot().prefs.locked,
    });
    const base = {
      lastTrigger: trigger,
      lastDecision: decision,
      fallback: null,
      callsLeftToday: callsLeft(rec, now),
      at: now,
    } as const;

    if (outcome.kind === "advice") {
      rt.applyAdvice(outcome.advice);
      const d = rt.getSnapshot().decision;
      const shown =
        d.primaryState === outcome.advice.primaryState &&
        d.behaviourMode === outcome.advice.behaviourMode;
      return commit({
        ...base,
        kind: shown ? "applied" : "held",
        detail: shown ? null : "held by stability rules",
      });
    }
    if (outcome.reason === "same" || outcome.reason === "locked")
      return commit({ ...base, kind: "held", detail: `held: ${REJECT_TEXT[outcome.reason]}` });
    return commit({
      ...base,
      kind: "rejected",
      detail: `rejected: ${REJECT_TEXT[outcome.reason]}`,
    });
  }

  /* ── triggers ──────────────────────────────────────────────────── */

  /** Measure future change from now (after a call, or after an unchanged-hash skip). */
  function rebase(): void {
    const engine = rt.getEngineState();
    baseMeaningful = engine.profile.meaningfulCount;
    baseConfidence = engine.decision.confidence;
    baseState = engine.decision.primaryState;
  }

  function watch(scope: string): void {
    const engine = rt.getEngineState();
    const rec = read(scope);
    const events = rt.getEvents();
    watching = scope;
    lastSeq = events.length ? events[events.length - 1]!.seq : 0;
    baseMeaningful = Math.min(rec.meaningfulAt ?? 0, engine.profile.meaningfulCount);
    baseConfidence = rec.confidenceAt ?? engine.decision.confidence;
    baseState = engine.decision.primaryState;
    repeatedFired.clear();
  }

  function queue(trigger: AnalyzerTrigger): void {
    pending = pending ?? trigger;
    schedule();
  }

  function schedule(): void {
    if (scheduled || !armed || !active) return;
    scheduled = true;
    deps.idle(() => {
      scheduled = false;
      const trigger = pending;
      pending = null;
      if (trigger && active) void run(trigger, false);
    });
  }

  function onChange(): void {
    if (!active) return;
    const snap = rt.getSnapshot();
    // Lab demos ask for themselves (trigger "lab"); background triggers must not spend calls while one streams.
    if (snap.prefs.adaptive !== "on" || snap.status.demo || isSandbox(snap.scope)) return;
    if (snap.scope !== watching) {
      watch(snap.scope);
      return;
    }

    const events = rt.getEvents();
    const newest = events.length ? events[events.length - 1]!.seq : 0;
    let completed = false;
    let repeated = false;
    if (newest > lastSeq) {
      for (let i = events.length - 1; i >= 0 && events[i]!.seq > lastSeq; i--) {
        if (COMPLETED.has(events[i]!.type)) completed = true;
      }
      lastSeq = newest;
      const sid = events[events.length - 1]!.sessionId;
      const counts = new Map<EventType, number>();
      for (const e of events) {
        if (e.sessionId !== sid || e.type === "page_viewed") continue;
        const n = (counts.get(e.type) ?? 0) + 1;
        counts.set(e.type, n);
        if (n >= REPEAT_TRIGGER && !repeatedFired.has(`${sid}:${e.type}`)) {
          repeatedFired.add(`${sid}:${e.type}`);
          repeated = true;
        }
      }
    }

    const engine = rt.getEngineState();
    if (completed) return queue("completed_action");
    if (repeated) return queue("repeated_pattern");
    if (
      Math.abs(engine.decision.confidence - baseConfidence) >= CONFIDENCE_SHIFT ||
      engine.decision.primaryState !== baseState
    )
      return queue("confidence_shift");
    if (engine.profile.meaningfulCount - baseMeaningful >= THRESHOLD_EVENTS) queue("threshold");
  }

  /** On pagehide: remember that this session earned an analysis, to run in the next visit's idle time. */
  function markPending(): void {
    try {
      const snap = rt.getSnapshot();
      if (snap.prefs.adaptive !== "on" || snap.status.demo || isSandbox(snap.scope)) return;
      if (deps.killSwitch()) return;
      const engine = rt.getEngineState();
      const rec = read(snap.scope);
      if (
        engine.profile.meaningfulCount >= MIN_MEANINGFUL &&
        activeDomains(engine.profile) >= MIN_DOMAINS &&
        engine.profile.meaningfulCount > (rec.meaningfulAt ?? 0) &&
        callsToday(rec, deps.now()) < MAX_CALLS_PER_DAY
      )
        write(snap.scope, { pendingAnalysis: true });
    } catch {
      /* leaving the page must never throw */
    }
  }

  /* ── lifecycle ─────────────────────────────────────────────────── */

  function stopNow(): void {
    active = false;
    pending = null;
    scheduled = false;
    if (armTimer) clearTimeout(armTimer);
    armTimer = null;
    unsub?.();
    unhide?.();
    unsub = null;
    unhide = null;
  }

  function start(): () => void {
    if (!deps.isClient()) return () => {};
    if (active) stopNow();
    active = true;
    armed = false;
    const id = ++runId;
    const scope = rt.getSnapshot().scope;
    watch(scope);

    unsub = rt.subscribe(onChange);
    unhide = deps.onPageHide(markPending);
    armTimer = setTimeout(() => {
      armed = true;
      if (pending) schedule();
    }, ARM_DELAY_MS);

    // An analysis owed from the last visit: once armed, in idle time, through every gate.
    if (!isSandbox(scope) && read(scope).pendingAnalysis) {
      write(scope, { pendingAnalysis: false });
      pending = "session_end";
    }
    return () => {
      if (id === runId) stopNow();
    };
  }

  return {
    start,
    request: (trigger) => run(trigger, true).catch(() => unavailable(trigger, "upstream", 0)),
  };
}

/* ── frozen public surface ───────────────────────────────────────── */

const controllers = new WeakMap<EvolutionRuntimeApi, AiController>();
function controllerFor(rt: EvolutionRuntimeApi): AiController {
  let c = controllers.get(rt);
  if (!c) {
    c = createAiController(rt);
    controllers.set(rt, c);
  }
  return c;
}

/** Start watching the runtime for triggers. Returns stop(). Client only; the UI never awaits it. */
export function startAiScheduler(runtime: EvolutionRuntimeApi): () => void {
  return controllerFor(runtime).start();
}

/**
 * One analysis now (Lab "Run AI analysis", persona end → trigger 'lab').
 * Bypasses the count/3-minute gates only; daily caps and cache still apply.
 * Resolves with the resulting AiStatus; never rejects.
 */
export function requestAiAnalysis(
  runtime: EvolutionRuntimeApi,
  trigger: AnalyzerTrigger,
): Promise<AiStatus> {
  return controllerFor(runtime).request(trigger);
}
