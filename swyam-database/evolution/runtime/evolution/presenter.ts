/**
 * The presenter: non-React owner of "what the user is currently shown". The coordinator and the user commands
 * call release(); the runtime subscribes and publishes a new snapshot inside the callback. That is the ONLY
 * place React-visible state changes, so React state moves on committed snapshots only.
 *
 * With reduced motion the evolution still happens, just instantly (mode "instant").
 */
import type { Committed } from "../../state/committed";

export type PresentMode = "animate" | "instant";
export type PresentListener = (c: Committed, mode: PresentMode, prev: Committed) => void;

export interface PresenterPorts {
  /** OS reduced motion or the in-app switch. */
  prefersInstant(): boolean;
}

export interface Presenter {
  /** What the user is shown now. */
  peek(): Committed;
  /** Shows `c`. Same or stale rev is ignored unless `force`. Returns whether anything changed. */
  release(c: Committed, mode: PresentMode, opts?: { force?: boolean }): boolean;
  /** Replaces what is shown WITHOUT notifying (scope switch / restore: the state the user left). */
  adopt(c: Committed): void;
  subscribe(l: PresentListener): () => void;
}

export function createPresenter(initial: Committed, ports: PresenterPorts): Presenter {
  let shown = initial;
  const listeners = new Set<PresentListener>();
  return {
    peek: () => shown,
    release(c, mode, opts) {
      if (!opts?.force && c.rev <= shown.rev) return false;
      const prev = shown;
      shown = c;
      const finalMode: PresentMode =
        mode === "instant" || ports.prefersInstant() ? "instant" : "animate";
      for (const l of [...listeners]) {
        try {
          l(c, finalMode, prev);
        } catch (e) {
          if (process.env["NODE_ENV"] !== "production")
            console.error("[evolution] listener failed", e);
        }
      }
      return true;
    },
    adopt(c) {
      shown = c;
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
