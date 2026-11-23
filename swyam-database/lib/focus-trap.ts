/**
 * A small focus trap for dialogs and sheets.
 *
 * Moves focus inside on activate, keeps Tab and Shift+Tab cycling within the container, closes on Escape, and
 * hands focus back to where it came from on release. Safe on the server (no document: a no-op).
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface FocusTrapOptions {
  onEscape?: () => void;
  /** Where focus goes on release. Defaults to whatever was focused when the trap started. */
  returnTo?: HTMLElement | null;
  /** First element to focus. Defaults to the first focusable, then the container itself. */
  initialFocus?: HTMLElement | null;
}

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
}

/** Activates the trap and returns `release()`. */
export function trapFocus(container: HTMLElement, opts: FocusTrapOptions = {}): () => void {
  if (typeof document === "undefined") return () => {};
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const first = opts.initialFocus ?? focusables(container)[0] ?? container;
  if (first === container && !container.hasAttribute("tabindex"))
    container.setAttribute("tabindex", "-1");
  try {
    first.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      opts.onEscape?.();
      return;
    }
    if (e.key !== "Tab") return;
    const list = focusables(container);
    if (list.length === 0) {
      e.preventDefault();
      container.focus();
      return;
    }
    const head = list[0]!;
    const tail = list[list.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === head || !container.contains(active))) {
      e.preventDefault();
      tail.focus();
    } else if (!e.shiftKey && (active === tail || !container.contains(active))) {
      e.preventDefault();
      head.focus();
    }
  };
  document.addEventListener("keydown", onKey, true);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    document.removeEventListener("keydown", onKey, true);
    const target = opts.returnTo && opts.returnTo.isConnected ? opts.returnTo : before;
    try {
      if (target && target.isConnected) target.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  };
}
