import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type ToastTone = "info" | "success" | "error";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

const DEFAULT_DURATION = 3500;

const TONE_BORDER: Record<ToastTone, string> = {
  info: "border-l-sky-500",
  success: "border-l-emerald-500",
  error: "border-l-red-500",
};

/**
 * Holds a list of toasts. Each toast auto-dismisses after `duration` ms.
 * Usage: const { toasts, show, dismiss } = useToasts();
 */
export function useToasts(duration: number = DEFAULT_DURATION) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return id;
    },
    [dismiss, duration],
  );

  // Clear any pending timers on unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return { toasts, show, dismiss };
}

/** Fixed-position stack of toasts. Render it once, pass the hook's values. */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex min-w-[240px] max-w-sm items-center gap-3 rounded-lg border-l-4 bg-white px-4 py-3 text-slate-900 shadow-lg ${TONE_BORDER[t.tone]}`}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          <button
            type="button"
            className="btn-ghost h-8 w-8 !p-0"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
