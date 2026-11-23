import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useLocation } from "@tanstack/react-router";
import { Clock, Undo2 } from "lucide-react";
import { getUndoQueue, UNDO_CONTROL_ATTR, type UndoView } from "../../lib/undo/undo-queue";
import { useTx } from "../../lib/i18n";
import Portal from "../Portal";
import { useUndoHold } from "./useUndoable";

const NONE: UndoView[] = [];

/**
 * The undo window, made visible and audible. Mounted once, inside the toast
 * provider.
 *
 *  - a polite live region says "Application queued. Undo available for 10
 *    seconds" when a window opens and "Undone" when it is used;
 *  - a bar offers Undo as a real button: reachable by Tab, 44 px tall, and
 *    the countdown is words ("8s left") as well as a draining line;
 *  - hovering or focusing the bar holds the timer;
 *  - a route change closes the window (and commits).
 */
export default function UndoHost() {
  const tx = useTx();
  const queue = getUndoQueue();
  const views = useSyncExternalStore(queue.subscribe, queue.getView, () => NONE);
  const current = useMemo(() => views.filter((v) => v.phase === "pending").at(-1), [views]);

  const { pathname } = useLocation();
  useEffect(() => {
    void getUndoQueue().flushAll();
  }, [pathname]);

  /* Live region: written when a window opens, and again when it is undone. */
  const [said, setSaid] = useState("");
  const seq = current?.seq;
  const announce = current?.announce;
  useEffect(() => {
    // The trailing no-break space on alternate runs makes a repeated sentence fresh to a screen reader.
    if (announce && seq !== undefined) setSaid(announce + (seq % 2 ? "" : " "));
  }, [announce, seq]);
  useEffect(
    () =>
      getUndoQueue().onFinal((f) => {
        if (f.phase === "undone")
          setSaid(f.undoneLabel + " ".repeat(1 + Math.round(Math.random())));
        else setSaid("");
      }),
    [],
  );

  /* Ctrl/Cmd+Z undoes the open action, anywhere but in a text field (which keeps its own undo). */
  const openId = current?.id;
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z")
        return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      e.preventDefault();
      void getUndoQueue().undo(openId);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

  /* The countdown in words. */
  const [, tick] = useState(0);
  useEffect(() => {
    if (!current) return;
    const t = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, [current]);

  const hold = useUndoHold("bar");

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
      </div>

      {current && (
        <Portal>
          {/* Above the bottom navigation on a phone, bottom-left on a laptop (toasts are bottom-right). */}
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-[119] flex justify-center px-3 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:justify-start sm:px-0">
            <div
              role="group"
              aria-label={tx("Undo")}
              {...{ [UNDO_CONTROL_ATTR]: "" }}
              {...hold}
              data-paused={current.paused}
              style={{ "--undo-ms": `${current.delayMs}ms` } as CSSProperties}
              className="undo-bar pointer-events-auto w-full max-w-sm rounded-2xl border border-ink-line bg-paper-light p-3 shadow-[var(--shadow-float)]"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-saffron-50 text-saffron-600"
                >
                  <Clock size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13.5px] font-semibold leading-snug text-ink">
                    {current.label}
                  </p>
                  {/* Not read out: the live region has already said it, and a ticking number is noise. */}
                  <p
                    aria-hidden
                    className="font-mono text-[11.5px] tabular-nums leading-snug text-ink-mute"
                  >
                    {current.paused
                      ? tx("Paused while you decide")
                      : `${Math.max(1, Math.ceil(queue.remainingMs(current.id) / 1000))}s ${tx("left")}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-keyshortcuts="Control+Z Meta+Z"
                  onClick={() => void queue.undo(current.id)}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-paper-light px-4 font-body text-[13px] font-semibold text-ink transition-colors hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <Undo2 size={14} aria-hidden />
                  {tx("Undo")}
                </button>
              </div>
              <div className="undo-bar__track mt-2.5" aria-hidden>
                <div key={current.seq} className="undo-bar__fill" />
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

/**
 * The same Undo, right beside the button that started the action, so Tab goes
 * straight to it. `what` completes the accessible name: "Undo application".
 */
export function InlineUndo({
  onUndo,
  what,
  className = "",
}: {
  onUndo: () => void;
  what: string;
  className?: string;
}) {
  const tx = useTx();
  const hold = useUndoHold("inline");
  return (
    <div {...{ [UNDO_CONTROL_ATTR]: "" }} className={`flex justify-center ${className}`}>
      <button
        type="button"
        onClick={onUndo}
        {...hold}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-4 font-body text-[13px] font-semibold text-ink underline underline-offset-4 transition-colors hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Undo2 size={14} aria-hidden />
        {tx("Undo")}
        <span className="sr-only"> {what}</span>
      </button>
    </div>
  );
}
