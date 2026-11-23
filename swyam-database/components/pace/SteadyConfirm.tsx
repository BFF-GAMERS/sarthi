import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyEvent,
} from "react";
import { createPortal } from "react-dom";
import { useSafeTx } from "./useSafeTx";
import { answerConfirm, getPendingConfirm, subscribeConfirm } from "../../lib/pace/steady-guard";

const none = () => null;

/**
 * "Are you sure?" for something that cannot be taken back. Only appears while steady hands is on and the person
 * tapped a control marked irreversible. The safe answer is focused first, Esc and a tap outside both go back,
 * and Tab stays inside the dialog. Marked `data-pace-allow` so the guard never intercepts its own buttons.
 */
export default function SteadyConfirm() {
  const tx = useSafeTx();
  const pending = useSyncExternalStore(subscribeConfirm, getPendingConfirm, none);
  const backRef = useRef<HTMLButtonElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);

  const cancel = () => {
    const control = answerConfirm(false);
    (control as unknown as HTMLElement | null)?.focus?.();
  };

  useEffect(() => {
    if (!pending) return;
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        const control = answerConfirm(false);
        (control as unknown as HTMLElement | null)?.focus?.();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pending]);

  if (!pending || typeof document === "undefined") return null;

  const trap = (e: ReactKeyEvent) => {
    if (e.key !== "Tab") return;
    const first = backRef.current;
    const last = goRef.current;
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const what = pending.label || tx("this action");

  return createPortal(
    <div
      data-pace-allow=""
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pace-confirm-title"
        aria-describedby="pace-confirm-body"
        className="panel w-full max-w-sm p-5"
        onKeyDown={trap}
      >
        <h2 id="pace-confirm-title" className="font-display text-lg tracking-tight text-ink">
          {tx("Are you sure?")}
        </h2>
        <p id="pace-confirm-body" className="mt-2 font-body text-sm leading-snug text-ink-mute">
          {tx("You are about to")} &ldquo;{what}&rdquo;. {tx("This can't be undone.")}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={goRef}
            type="button"
            className="btn-ghost min-h-12"
            onClick={() => {
              answerConfirm(true);
            }}
          >
            {tx("Yes, continue")}
          </button>
          <button ref={backRef} type="button" className="btn-primary min-h-12" onClick={cancel}>
            {tx("Go back")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
