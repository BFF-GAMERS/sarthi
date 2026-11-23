import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import Portal from "./Portal";
import UndoHost from "./undo/UndoHost";

/**
 * The answer to "did that work?".
 *
 * Almost every action on this site wrote to the database and then changed
 * nothing on screen: a save toggled a grey icon, an enrolment reloaded a
 * button, a withdrawn application simply vanished from a list. A person on a
 * slow phone could not tell a completed action from a dropped tap, so they
 * tapped again.
 *
 * One toast, one sentence, optionally one link to where the thing now lives.
 * It is announced to screen readers, it can be dismissed, and it never
 * carries anything a person has to read — the state it confirms is always
 * visible on the page as well.
 */

export type ToastTone = "ok" | "info" | "bad";

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  /** An in-app destination, shown as a link on the toast. */
  action?: { label: string; to: string };
  /** Milliseconds. 0 keeps it until dismissed; errors default to staying. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Show a toast. Safe to call from anywhere under the provider. */
export function useToast(): (t: ToastInput) => void {
  const push = useContext(ToastContext);
  // A no-op rather than a crash: a component rendered outside the provider
  // (a test, a chromeless route) should still work, just silently.
  return push ?? (() => undefined);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: ToastInput) => {
    seq.current += 1;
    const item: ToastItem = { id: seq.current, ...t };
    // Three at a time; the oldest drops off rather than filling the screen.
    setItems((prev) => [...prev, item].slice(-3));
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The undo window for Apply, Enrol, Save and friends: a live region and a bar with Undo. */}
      <UndoHost />
      {items.length > 0 && (
        <Portal>
          {/*
            Under the navigation on a phone, bottom-right on a laptop.
            Deliberately not bottom-centre on a phone: that is exactly where
            the primary button of every form sits, and a confirmation that
            covers the button you are about to press is worse than none.
            Above the compare tray and the sticky course bar, which sit at z-44.
          */}
          <div
            className="pointer-events-none fixed inset-x-0 top-[4.75rem] z-[120] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end"
            role="region"
            aria-label="Notifications"
          >
            {items.map((t) => (
              <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>
        </Portal>
      )}
    </ToastContext.Provider>
  );
}

const ICON: Record<ToastTone, React.ReactNode> = {
  ok: <Check size={14} aria-hidden />,
  info: <Info size={14} aria-hidden />,
  bad: <AlertTriangle size={14} aria-hidden />,
};

/* Tone is carried by an icon and a word as well as a colour, because colour
   alone is not a message — and a third of the ways to read this page do not
   have it. */
const TONE_CLASS: Record<ToastTone, string> = {
  ok: "bg-emeraldx-400/12 text-emeraldx-400",
  info: "bg-saffron-50 text-saffron-600",
  bad: "bg-red-500/12 text-danger",
};

function ToastCard({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const tone = t.tone ?? "ok";
  const [paused, setPaused] = useState(false);
  // An error stays until it is read; everything else clears itself.
  const duration = t.duration ?? (tone === "bad" ? 0 : t.action ? 7000 : 4500);

  useEffect(() => {
    if (!duration || paused) return;
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [duration, paused, onDismiss]);

  return (
    <div
      // Errors interrupt; confirmations wait their turn.
      role={tone === "bad" ? "alert" : "status"}
      aria-live={tone === "bad" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto w-full max-w-sm animate-[toast-in_0.22s_var(--ease-out-soft)] rounded-2xl border border-ink-line bg-paper-light p-3.5 shadow-[var(--shadow-float)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${TONE_CLASS[tone]}`}
        >
          {ICON[tone]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[13.5px] font-semibold leading-snug text-ink">{t.title}</p>
          {t.body && (
            <p className="mt-0.5 font-body text-[12.5px] leading-relaxed text-ink-mute">{t.body}</p>
          )}
          {t.action && (
            <Link
              to={t.action.to}
              onClick={onDismiss}
              className="mt-1.5 inline-block font-body text-[12.5px] font-semibold text-saffron-600 underline underline-offset-2"
            >
              {t.action.label}
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-paper-dim hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
