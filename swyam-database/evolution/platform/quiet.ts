/**
 * The coordinator's DOM-state port. Passive listeners record the last input/scroll times; everything else is
 * read on demand. The coordinator only sees the InteractionGuard interface, so tests fake it. Only KEYBOARD
 * focus inside a moving region blocks a release; a resting pointer never does.
 */
import { clock } from "./clock";

export interface InteractionGuard {
  /** pointer move/down, key, wheel, input */
  msSinceInput(): number;
  msSinceScroll(): number;
  scrollY(): number;
  editableFocused(): boolean;
  /** e.g. "[data-evo-region]" */
  keyboardFocusWithin(selector: string): boolean;
  /** dialog[open], :popover-open, aria-modal dialogs */
  overlayOpen(): boolean;
  stop(): void;
}

const INPUT_EVENTS = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "input",
  "touchstart",
] as const;

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return ![
      "button",
      "submit",
      "reset",
      "checkbox",
      "radio",
      "range",
      "color",
      "file",
      "image",
    ].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

function matchesSafe(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

export const NULL_GUARD: InteractionGuard = {
  msSinceInput: () => Number.POSITIVE_INFINITY,
  msSinceScroll: () => Number.POSITIVE_INFINITY,
  scrollY: () => 0,
  editableFocused: () => false,
  keyboardFocusWithin: () => false,
  overlayOpen: () => false,
  stop: () => {},
};

export function startInteractionGuard(win?: Window): InteractionGuard {
  const w = win ?? (typeof window === "undefined" ? undefined : window);
  if (!w) return NULL_GUARD;
  const doc = w.document;
  let lastInput = clock.now();
  let lastScroll = Number.NEGATIVE_INFINITY;

  const onInput = () => {
    lastInput = clock.now();
  };
  const onScroll = () => {
    lastScroll = clock.now();
  };
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  for (const t of INPUT_EVENTS) w.addEventListener(t, onInput, opts);
  w.addEventListener("scroll", onScroll, opts);

  return {
    msSinceInput: () => clock.now() - lastInput,
    msSinceScroll: () => clock.now() - lastScroll,
    scrollY: () => {
      try {
        return w.scrollY;
      } catch {
        return 0;
      }
    },
    editableFocused: () => isEditable(doc.activeElement),
    keyboardFocusWithin(selector) {
      const el = doc.activeElement;
      if (!el || el === doc.body) return false;
      return matchesSafe(el, ":focus-visible") && el.closest(selector) !== null;
    },
    overlayOpen() {
      try {
        if (doc.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return true;
      } catch {
        /* ignore */
      }
      try {
        return doc.querySelector(":popover-open") !== null;
      } catch {
        return false; // :popover-open unsupported
      }
    },
    stop() {
      for (const t of INPUT_EVENTS) w.removeEventListener(t, onInput, opts);
      w.removeEventListener("scroll", onScroll, opts);
    },
  };
}
