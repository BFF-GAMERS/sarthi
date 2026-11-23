import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUndoQueue,
  UNDO_CONTROL_ATTR,
  type ScheduleOptions,
  type UndoHandle,
} from "../../lib/undo/undo-queue";

/**
 * What a button shows while its action goes through the undo window.
 *
 *   idle     the normal label
 *   queued   the window is open: "Done"-style label plus an Undo
 *   working  the window closed and the request is in flight: "Working…"
 *   done     it went through: "Done", for a moment, then back to idle
 */
export type ActionPhase = "idle" | "queued" | "working" | "done";

/**
 * Put one action behind the undo window.
 *
 *   const undoable = useUndoable();
 *   undoable.start({ id, label, commit });      // irreversible: nothing is sent yet
 *   undoable.start({ id, label, optimistic, revert, commit }); // reversible: applied now
 *
 * `controlProps` goes on the action button so tapping it again while queued
 * does not close the window; `undo` is for the inline Undo next to it.
 */
export function useUndoable({ doneMs = 2200 }: { doneMs?: number } = {}) {
  const [phase, setPhase] = useState<ActionPhase>("idle");
  const handle = useRef<UndoHandle | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const start = useCallback(
    (opts: ScheduleOptions): UndoHandle => {
      origin.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.clearTimeout(timer.current);
      handle.current = getUndoQueue().schedule({
        ...opts,
        onPhase: (p, err) => {
          opts.onPhase?.(p, err);
          if (!alive.current) return;
          if (p === "pending") setPhase("queued");
          else if (p === "committing") setPhase("working");
          else if (p === "committed") {
            setPhase("done");
            timer.current = window.setTimeout(() => alive.current && setPhase("idle"), doneMs);
          } else {
            setPhase("idle");
            if (p === "undone") {
              // Undo was pressed in a control that has just left the page:
              // hand focus back to the button that started this.
              requestAnimationFrame(() => {
                const a = document.activeElement;
                const lost =
                  !a ||
                  a === document.body ||
                  Boolean((a as HTMLElement).closest?.(`[${UNDO_CONTROL_ATTR}]`));
                const o = origin.current;
                if (lost && o && o.isConnected) o.focus({ preventScroll: true });
              });
            }
          }
        },
      });
      return handle.current;
    },
    [doneMs],
  );

  const undo = useCallback(() => {
    void handle.current?.undo();
  }, []);

  const queued = phase === "queued";
  return {
    phase,
    start,
    undo,
    queued,
    working: phase === "working",
    /** Spread on the action button: it counts as part of the Undo control while queued. */
    controlProps: queued ? ({ [UNDO_CONTROL_ATTR]: "" } as Record<string, string>) : {},
  };
}

/**
 * Hover and focus hold the timer. Spread the result on any element that
 * belongs to the Undo control, with a key unique to that element.
 */
export function useUndoHold(key: string) {
  useEffect(() => {
    const q = getUndoQueue();
    return () => {
      q.hold(`${key}:hover`, false);
      q.hold(`${key}:focus`, false);
    };
  }, [key]);

  return {
    // Only a real mouse hovers. A tap on a phone never "leaves", which would pin the window open.
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") getUndoQueue().hold(`${key}:hover`, true);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") getUndoQueue().hold(`${key}:hover`, false);
    },
    onFocus: () => getUndoQueue().hold(`${key}:focus`, true),
    onBlur: () => getUndoQueue().hold(`${key}:focus`, false),
  };
}
