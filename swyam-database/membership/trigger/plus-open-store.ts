/**
 * Whether the Swayam Plus sheet is open, and who opened it. A tiny external store, so the trigger, the
 * Settings card and the Lab can all open the one sheet that DeferredOverlays mounts.
 *
 * No React in here: components read it through `usePlusOpen`.
 */
import { useSyncExternalStore } from "react";
import type { PlusMoment } from "./trigger";

export type PlusOpenSource = "trigger" | "settings" | "lab";

export interface PlusOpenState {
  open: boolean;
  source: PlusOpenSource | null;
  moment: PlusMoment | null;
  /** Bumps on every open, so the price animation can play once per open. */
  token: number;
  /** The control that opened it, so focus can go back there. */
  returnTo: HTMLElement | null;
}

const CLOSED: PlusOpenState = { open: false, source: null, moment: null, token: 0, returnTo: null };

let state: PlusOpenState = CLOSED;
const listeners = new Set<() => void>();

function set(next: PlusOpenState): void {
  state = next;
  listeners.forEach((l) => l());
}

export const getPlusOpen = (): PlusOpenState => state;

export function subscribePlusOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openPlus(opts: { source: PlusOpenSource; moment?: PlusMoment | null }): void {
  if (state.open) return;
  const active = typeof document !== "undefined" ? document.activeElement : null;
  set({
    open: true,
    source: opts.source,
    moment: opts.moment ?? null,
    token: state.token + 1,
    returnTo:
      active instanceof HTMLElement && active !== document.body && opts.source !== "trigger"
        ? active
        : null,
  });
}

export function closePlus(): void {
  if (!state.open) return;
  set({ ...state, open: false });
}

export const usePlusOpen = (): PlusOpenState =>
  useSyncExternalStore(subscribePlusOpen, getPlusOpen, () => CLOSED);

/* ── moments that do not come from the evolution events ─────────────── */

export const PLUS_MOMENT_EVENT = "swayam:plus-moment";

/**
 * For code that knows about a good moment the evolution events do not carry (the Coach hitting its real
 * daily cap). Fire and forget; the trigger decides whether anything happens.
 */
export function signalPlusMoment(moment: PlusMoment): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(PLUS_MOMENT_EVENT, { detail: { moment } }));
  } catch {
    /* ignore */
  }
}
