/**
 * The undo window.
 *
 * A tap on Apply, Enrol or "Send request" used to be final in the same
 * instant: a thumb that slipped onto the wrong card had already written to
 * the database. This queue gives every such action a short, honest grace
 * period.
 *
 *  - An IRREVERSIBLE action (apply, enrol, swap request) is not sent at all
 *    until the window closes. Undo inside it means nothing was ever written.
 *  - A REVERSIBLE action (save, cart) is applied at once through `optimistic`,
 *    and Undo runs `revert`.
 *
 * The window is 10 s. It closes early, and the action is committed, on the
 * person's next interaction elsewhere (pointerdown / keydown outside the Undo
 * control), when the page is hidden or left, or on a route change. It pauses
 * while the Undo control is hovered or focused, so a keyboard or screen-reader
 * user is never raced.
 *
 * Framework-free on purpose: no React, no DOM beyond the optional event
 * targets it is handed, and every clock read goes through timers that fake
 * timers replace. An action is committed at most once, and Undo after commit
 * is a no-op, so a double click, a double flush or a late Undo can never send
 * twice.
 */

export const UNDO_WINDOW_MS = 10_000;

/** Elements carrying this attribute are "the Undo control": touching them does not end the window. */
export const UNDO_CONTROL_ATTR = "data-undo-control";

export type UndoPhase = "pending" | "committing" | "committed" | "undone" | "failed";

export interface ScheduleOptions {
  /** Stable identity of the action, e.g. `apply:<slug>`. Scheduling the same id twice while it is live returns the first handle. */
  id: string;
  /** Visible and announced, e.g. "Application queued". */
  label: string;
  /** Live-region text. Defaults to `${label}. Undo available for N seconds`. */
  announce?: string;
  /** Live-region text after Undo. Defaults to "Undone". */
  undoneLabel?: string;
  delayMs?: number;
  /** The real work. Never runs before the window closes. May reject: the queue swallows it and reports `failed`. */
  commit: () => Promise<void>;
  /** Undoes an `optimistic` effect. Called by Undo only. */
  revert?: () => void | Promise<void>;
  /** A reversible action's immediate effect. Runs synchronously inside `schedule`. */
  optimistic?: () => void | Promise<void>;
  /** Every phase change, so a button can show Working / Done. */
  onPhase?: (phase: UndoPhase, error?: unknown) => void;
}

export interface UndoHandle {
  readonly id: string;
  readonly phase: UndoPhase;
  /** True when the action was stopped. False once it has been committed (or already undone). */
  undo(): Promise<boolean>;
  /** Close the window now and commit. Idempotent. */
  flush(): Promise<void>;
  pause(): void;
  resume(): void;
}

/** What the UI renders. A new array is produced on every change. */
export interface UndoView {
  id: string;
  label: string;
  announce: string;
  undoneLabel: string;
  delayMs: number;
  paused: boolean;
  /** Distinguishes two runs of the same id, so an animation restarts. */
  seq: number;
  phase: UndoPhase;
}

interface Entry {
  opts: ScheduleOptions;
  seq: number;
  phase: UndoPhase;
  delayMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  deadline: number;
  remaining: number;
  paused: boolean;
  optimisticDone: Promise<void>;
  optimisticFailed: boolean;
  settled: Promise<void> | null;
  handle: UndoHandle;
}

type Listener = () => void;

/** Sent once when an action ends: undone, committed or failed. */
export interface UndoFinal {
  id: string;
  label: string;
  undoneLabel: string;
  phase: "committed" | "undone" | "failed";
}

interface Target {
  addEventListener(type: string, fn: EventListener, opts?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, fn: EventListener, opts?: boolean | EventListenerOptions): void;
}

export interface QueueEnv {
  /** Where pointerdown / keydown / visibilitychange are heard. Defaults to `document`. */
  doc?: (Target & { visibilityState?: string }) | null;
  /** Where pagehide is heard. Defaults to `window`. */
  win?: Target | null;
  /** True for a target inside the Undo control. Defaults to `closest('[data-undo-control]')`. */
  isUndoControl?: (target: unknown) => boolean;
}

/** Keys that move focus or change a modifier are not "an interaction elsewhere": Tab is how Undo is reached. */
const PASSIVE_KEYS = new Set([
  "Tab",
  "Shift",
  "Control",
  "Alt",
  "AltGraph",
  "Meta",
  "CapsLock",
  "Escape",
  "ContextMenu",
]);

function defaultIsUndoControl(target: unknown): boolean {
  const el = target as { closest?: (s: string) => unknown } | null;
  try {
    return Boolean(el && typeof el.closest === "function" && el.closest(`[${UNDO_CONTROL_ATTR}]`));
  } catch {
    return false;
  }
}

export function createUndoQueue(env: QueueEnv = {}) {
  const entries = new Map<string, Entry>();
  const listeners = new Set<Listener>();
  const finals = new Set<(f: UndoFinal) => void>();
  const holds = new Set<string>();
  let seq = 0;
  let view: UndoView[] = [];
  let attached = false;

  const doc = () =>
    env.doc !== undefined ? env.doc : typeof document !== "undefined" ? document : null;
  const win = () =>
    env.win !== undefined ? env.win : typeof window !== "undefined" ? window : null;
  const isControl = env.isUndoControl ?? defaultIsUndoControl;

  const live = () => [...entries.values()].filter((e) => e.phase === "pending");

  function emit() {
    view = [...entries.values()].map((e) => ({
      id: e.opts.id,
      label: e.opts.label,
      announce: e.opts.announce ?? announceFor(e.opts.label, e.delayMs),
      undoneLabel: e.opts.undoneLabel ?? "Undone",
      delayMs: e.delayMs,
      paused: e.paused,
      seq: e.seq,
      phase: e.phase,
    }));
    for (const l of [...listeners]) l();
    syncListeners();
  }

  function announceFor(label: string, delayMs: number) {
    return `${label}. Undo available for ${Math.round(delayMs / 1000)} seconds`;
  }

  function setPhase(e: Entry, phase: UndoPhase, error?: unknown) {
    e.phase = phase;
    try {
      e.opts.onPhase?.(phase, error);
    } catch {
      /* a UI callback must never break the queue */
    }
    if (phase === "committed" || phase === "undone" || phase === "failed") {
      const f: UndoFinal = {
        id: e.opts.id,
        label: e.opts.label,
        undoneLabel: e.opts.undoneLabel ?? "Undone",
        phase,
      };
      for (const fn of [...finals]) fn(f);
    }
  }

  function finish(e: Entry) {
    if (entries.get(e.opts.id) === e) entries.delete(e.opts.id);
    if (!live().length) holds.clear();
    emit();
  }

  function clearTimer(e: Entry) {
    if (e.timer !== null) clearTimeout(e.timer);
    e.timer = null;
  }

  function arm(e: Entry, ms: number) {
    clearTimer(e);
    e.deadline = Date.now() + ms;
    e.timer = setTimeout(() => void flushEntry(e), ms);
  }

  function flushEntry(e: Entry): Promise<void> {
    if (e.phase !== "pending") return e.settled ?? Promise.resolve();
    clearTimer(e);
    e.paused = false;
    setPhase(e, "committing");
    emit();
    e.settled = (async () => {
      try {
        await e.optimisticDone;
        if (e.optimisticFailed) throw new Error("optimistic step failed");
        await e.opts.commit();
        setPhase(e, "committed");
      } catch (err) {
        setPhase(e, "failed", err);
      } finally {
        finish(e);
      }
    })();
    return e.settled;
  }

  async function undoEntry(e: Entry): Promise<boolean> {
    // Once the commit has started there is nothing left to stop.
    if (e.phase !== "pending") return false;
    clearTimer(e);
    e.paused = false;
    setPhase(e, "undone");
    finish(e);
    try {
      await e.optimisticDone;
      if (!e.optimisticFailed) await e.opts.revert?.();
    } catch {
      /* the revert's own caller reports it; the window is closed either way */
    }
    return true;
  }

  function pauseEntry(e: Entry) {
    if (e.phase !== "pending" || e.paused) return;
    e.remaining = Math.max(0, e.deadline - Date.now());
    clearTimer(e);
    e.paused = true;
    emit();
  }

  function resumeEntry(e: Entry) {
    if (e.phase !== "pending" || !e.paused) return;
    e.paused = false;
    arm(e, e.remaining);
    emit();
  }

  /* ── early close ─────────────────────────────────────────────── */

  const onPointerDown: EventListener = (ev) => {
    if (!isControl(ev.target)) void flushAll();
  };
  const onKeyDown: EventListener = (ev) => {
    const k = ev as KeyboardEvent;
    if (k.repeat || (k.key && PASSIVE_KEYS.has(k.key))) return;
    // Ctrl/Cmd+Z is the undo gesture itself, not "moving on".
    if ((k.ctrlKey || k.metaKey) && k.key?.toLowerCase() === "z") return;
    if (!isControl(k.target)) void flushAll();
  };
  const onHide: EventListener = () => void flushAll();
  const onVisibility: EventListener = () => {
    if (doc()?.visibilityState === "hidden") void flushAll();
  };

  function syncListeners() {
    const want = live().length > 0;
    if (want === attached) return;
    const d = doc();
    const w = win();
    if (want) {
      d?.addEventListener("pointerdown", onPointerDown, true);
      d?.addEventListener("keydown", onKeyDown, true);
      d?.addEventListener("visibilitychange", onVisibility);
      w?.addEventListener("pagehide", onHide);
    } else {
      d?.removeEventListener("pointerdown", onPointerDown, true);
      d?.removeEventListener("keydown", onKeyDown, true);
      d?.removeEventListener("visibilitychange", onVisibility);
      w?.removeEventListener("pagehide", onHide);
    }
    attached = want;
  }

  /* ── public API ──────────────────────────────────────────────── */

  function flushAll(): Promise<void> {
    return Promise.all([...entries.values()].map((e) => flushEntry(e))).then(() => undefined);
  }

  function schedule(opts: ScheduleOptions): UndoHandle {
    // Double click, double tap, double Enter: the first one is the action.
    const existing = entries.get(opts.id);
    if (existing && (existing.phase === "pending" || existing.phase === "committing")) {
      return existing.handle;
    }

    // One window at a time: starting another action is itself an interaction.
    for (const e of live()) void flushEntry(e);

    const delayMs = Math.max(0, opts.delayMs ?? UNDO_WINDOW_MS);
    const entry: Entry = {
      opts,
      seq: ++seq,
      phase: "pending",
      delayMs,
      timer: null,
      deadline: 0,
      remaining: delayMs,
      paused: false,
      optimisticDone: Promise.resolve(),
      optimisticFailed: false,
      settled: null,
      handle: null as unknown as UndoHandle,
    };
    entry.handle = {
      id: opts.id,
      get phase() {
        return entry.phase;
      },
      undo: () => undoEntry(entry),
      flush: () => flushEntry(entry),
      pause: () => pauseEntry(entry),
      resume: () => resumeEntry(entry),
    };
    entries.set(opts.id, entry);

    if (opts.optimistic) {
      try {
        const r = opts.optimistic();
        if (r && typeof (r as Promise<void>).then === "function") {
          entry.optimisticDone = (r as Promise<void>).catch(() => {
            entry.optimisticFailed = true;
            // The immediate step failed, so there is nothing to confirm or revert.
            if (entry.phase === "pending") {
              clearTimer(entry);
              setPhase(entry, "failed");
              finish(entry);
            }
          });
        }
      } catch {
        entry.optimisticFailed = true;
        setPhase(entry, "failed");
        entries.delete(opts.id);
        emit();
        return entry.handle;
      }
    }

    setPhase(entry, "pending");
    arm(entry, delayMs);
    if (holds.size) {
      pauseEntry(entry);
    }
    emit();
    return entry.handle;
  }

  return {
    schedule,
    flushAll,
    undo(id: string): Promise<boolean> {
      const e = entries.get(id);
      return e ? undoEntry(e) : Promise.resolve(false);
    },
    /** Pause every open window while something holds it (a hover, a focus). Released when all holders let go. */
    hold(key: string, on: boolean) {
      if (on) holds.add(key);
      else holds.delete(key);
      for (const e of live()) (holds.size ? pauseEntry : resumeEntry)(e);
    },
    remainingMs(id: string): number {
      const e = entries.get(id);
      if (!e || e.phase !== "pending") return 0;
      return e.paused ? e.remaining : Math.max(0, e.deadline - Date.now());
    },
    /** Hears every action that ends, so a live region can say "Undone". */
    onFinal(fn: (f: UndoFinal) => void): () => void {
      finals.add(fn);
      return () => {
        finals.delete(fn);
      };
    },
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getView: (): UndoView[] => view,
    /** Tear down listeners and timers. Tests only. */
    dispose() {
      for (const e of entries.values()) clearTimer(e);
      entries.clear();
      holds.clear();
      listeners.clear();
      finals.clear();
      view = [];
      syncListeners();
    },
  };
}

export type UndoQueue = ReturnType<typeof createUndoQueue>;

let shared: UndoQueue | null = null;

/** The one queue the whole app shares. */
export function getUndoQueue(): UndoQueue {
  if (!shared) shared = createUndoQueue();
  return shared;
}
