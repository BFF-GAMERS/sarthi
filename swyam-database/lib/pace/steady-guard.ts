/**
 * Steady hands: two small protections for taps that land twice by accident or on the wrong thing.
 *
 *   1. A second click on the same control within 350 ms is ignored.
 *   2. A control that cannot be taken back (marked `data-irreversible`, or a button whose own label says delete,
 *      remove, withdraw, clear all or sign out) asks "Are you sure?" first.
 *
 * Neither ever touches the Undo flow: anything inside `[data-undo-control]`, `[data-undoable]` or
 * `[data-pace-allow]` passes straight through, as does `data-irreversible="false"`. The label is read once, to
 * decide whether to ask, and is only shown back to the person in the dialog; it is never stored or sent.
 *
 * `createClickGuard` takes its environment as arguments so the timing can be tested in node.
 */

export const DOUBLE_TAP_MS = 350;
export const IRREVERSIBLE_RE = /delete|remove|withdraw|clear all|sign out/i;
const MAX_LABEL = 40;

export const CONTROL_SELECTOR =
  'button,a[href],[role="button"],[role="link"],[role="menuitem"],summary,input[type="submit"],input[type="button"]';
const BUTTONISH = 'button,[role="button"],input[type="submit"],input[type="button"]';
const SKIP_SELECTOR = "[data-undo-control],[data-undoable],[data-pace-allow]";

export function isDoubleTap(
  prev: { target: unknown; t: number } | null,
  target: unknown,
  t: number,
  windowMs: number = DOUBLE_TAP_MS,
): boolean {
  return Boolean(prev && prev.target === target && t - prev.t >= 0 && t - prev.t < windowMs);
}

export function isIrreversibleLabel(label: string): boolean {
  const s = label.trim();
  return s.length > 0 && s.length <= MAX_LABEL && IRREVERSIBLE_RE.test(s);
}

/** The minimum surface of an element the guard reads. */
export interface ControlLike {
  closest(selector: string): ControlLike | null;
  matches?(selector: string): boolean;
  getAttribute(name: string): string | null;
  hasAttribute?(name: string): boolean;
  textContent?: string | null;
  value?: string;
}

export function controlLabel(el: ControlLike): string {
  return (el.getAttribute("aria-label") || el.textContent || el.value || "").trim();
}

export function needsConfirm(el: ControlLike): boolean {
  const flag = el.getAttribute("data-irreversible");
  if (flag === "false") return false;
  if (flag !== null) return true;
  if (!el.closest(BUTTONISH)) return false;
  return isIrreversibleLabel(controlLabel(el));
}

export interface ClickLike {
  target: unknown;
  /** 0 for keyboard and programmatic clicks, 1 or more for pointer clicks. */
  detail: number;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}

export interface GuardEnv {
  isActive: () => boolean;
  now: () => number;
  /** Ask the person. `proceed` replays the click once, `cancel` just closes. */
  ask: (label: string, control: ControlLike, proceed: () => void) => void;
}

export type GuardResult = "pass" | "blocked-double" | "blocked-confirm";

export function createClickGuard(env: GuardEnv) {
  let last: { target: unknown; t: number } | null = null;
  let bypass: unknown = null;

  function handle(e: ClickLike, replay: (control: ControlLike) => void): GuardResult {
    if (!env.isActive()) return "pass";
    const t = e.target as ControlLike | null;
    if (!t || typeof t.closest !== "function") return "pass";
    const control = t.closest(CONTROL_SELECTOR);
    if (!control) return "pass";
    const now = env.now();

    if (bypass === control) {
      // The replay of a click the person just confirmed.
      bypass = null;
      last = { target: control, t: now };
      return "pass";
    }
    if (control.closest(SKIP_SELECTOR)) return "pass";
    if (control.getAttribute("aria-disabled") === "true") return "pass";

    if (e.detail > 0 && isDoubleTap(last, control, now)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return "blocked-double";
    }

    if (needsConfirm(control)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      env.ask(controlLabel(control), control, () => {
        bypass = control;
        replay(control);
      });
      return "blocked-confirm";
    }

    last = { target: control, t: now };
    return "pass";
  }

  return { handle };
}

// ── pending confirmation (read by SteadyConfirm) ─────────────────────────────────────────────────────

export interface PendingConfirm {
  label: string;
  control: ControlLike;
  proceed: () => void;
}

let pending: PendingConfirm | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function getPendingConfirm(): PendingConfirm | null {
  return pending;
}

export function subscribeConfirm(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Close the dialog. `ok` replays the held click; otherwise it is dropped. */
export function answerConfirm(ok: boolean): ControlLike | null {
  const p = pending;
  if (!p) return null;
  pending = null;
  emit();
  if (ok) p.proceed();
  return p.control;
}

/** Listen for clicks in the capture phase. `isActive` is read on every click, so toggling is instant. */
export function installSteadyGuard(isActive: () => boolean): () => void {
  if (typeof window === "undefined") return () => {};
  const guard = createClickGuard({
    isActive,
    now: () => performance.now(),
    ask: (label, control, proceed) => {
      pending = { label, control, proceed };
      emit();
    },
  });
  const onClick = (e: MouseEvent) => {
    guard.handle(e as unknown as ClickLike, (control) =>
      (control as unknown as HTMLElement).click(),
    );
  };
  window.addEventListener("click", onClick, true);
  return () => {
    window.removeEventListener("click", onClick, true);
    if (pending) {
      pending = null;
      emit();
    }
  };
}
