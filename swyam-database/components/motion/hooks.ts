import { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { MotionConfigContext } from "framer-motion";
import { getDurationScale, subscribeEffective } from "../../lib/pace/effective";
import { INSTANT, scaledSpring, type SpringToken } from "./tokens";

/*
 * Media queries are read through `useSyncExternalStore` with a server
 * snapshot of `false`. That is what makes these hooks safe for server
 * rendering: the server and the first client render both see `false`, so the
 * markup matches, and the real value arrives in the very next render. Reading
 * `matchMedia` during render instead would hydrate with a different tree on
 * any device that has reduced motion on.
 */
const queries = new Map<string, MediaQueryList>();

function mediaStore(query: string) {
  const list = () => {
    let mql = queries.get(query);
    if (!mql) {
      mql = window.matchMedia(query);
      queries.set(query, mql);
    }
    return mql;
  };
  return {
    subscribe(onChange: () => void) {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = list();
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    getSnapshot(): boolean {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return list().matches;
    },
    getServerSnapshot(): boolean {
      return false;
    },
  };
}

const reducedStore = mediaStore("(prefers-reduced-motion: reduce)");
const fineStore = mediaStore("(hover: hover) and (pointer: fine)");

/**
 * Whether movement should be replaced by opacity-only or instant changes.
 *
 * True when the operating system asks for reduced motion, or when the app has
 * forced it with `<MotionConfig reducedMotion="always">` (which is how the
 * in-app "reduce motion" preference is wired). `reducedMotion="never"` wins
 * over the OS, matching framer-motion's own behaviour.
 *
 * Unlike framer-motion's `useReducedMotion`, this follows the OS setting live
 * and renders `false` on the server, so it never causes a hydration mismatch.
 * Reduced motion keeps the structure changing: items still reorder, they just
 * do it without travelling.
 */
export function useReducedMotionPref(): boolean {
  const { reducedMotion } = useContext(MotionConfigContext);
  const os = useSyncExternalStore(
    reducedStore.subscribe,
    reducedStore.getSnapshot,
    reducedStore.getServerSnapshot,
  );
  if (reducedMotion === "always") return true;
  if (reducedMotion === "never") return false;
  return os;
}

/**
 * True on a device with a real hover and a fine pointer (a mouse or trackpad).
 *
 * Hover lifts and magnetic buttons are gated on this. On a touch screen
 * `:hover` sticks after a tap, which would leave a card raised for no reason.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    fineStore.subscribe,
    fineStore.getSnapshot,
    fineStore.getServerSnapshot,
  );
}

/**
 * True once the page has been hidden, or was hidden when the component mounted.
 *
 * Browsers deliver no animation frames to a hidden tab, and an entrance that
 * starts at partial opacity is left stuck there when the tab returns. When
 * this is true, entrances should render their finished state instead. It is
 * sticky on purpose: a tab hidden mid-animation freezes part-way.
 */
export function usePageFrozen(): boolean {
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    if (document.hidden) {
      setFrozen(true);
      return;
    }
    const onChange = () => {
      if (document.hidden) setFrozen(true);
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return frozen;
}

export interface MotionPrefs {
  /** Replace travel with opacity or instant changes. */
  reduced: boolean;
  /** Frames may not arrive (hidden tab): show finished states, skip entrances. */
  frozen: boolean;
  /** Pointer capable of hover: a mouse or trackpad, not touch. */
  finePointer: boolean;
}

/** Everything a motion primitive needs to decide how much to move. */
export function useMotionPrefs(): MotionPrefs {
  return {
    reduced: useReducedMotionPref(),
    frozen: usePageFrozen(),
    finePointer: useFinePointer(),
  };
}

/**
 * A spring token as a transition, or an instant one when reduced motion is on. Follows the learned pace: a
 * calm tempo settles a little slower, a snappy one a little faster, and with pace matching off it is the token.
 */
export function useSpringTransition(token: SpringToken) {
  const reduced = useReducedMotionPref();
  const scale = useSyncExternalStore(subscribeEffective, getDurationScale, () => 1);
  return reduced ? INSTANT : scaledSpring(token, scale);
}
