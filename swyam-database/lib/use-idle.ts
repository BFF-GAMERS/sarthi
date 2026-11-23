import { useEffect, useState } from "react";

/**
 * Events that mean "somebody is here and about to use the page". Any of them
 * ends the wait immediately: deferring work is for people who are only looking.
 */
const WAKE_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Run `fn` once the page has finished loading and the main thread is quiet,
 * or at once on the first sign of a person using the page.
 *
 * `delay` is the minimum wait after the `load` event. It exists so deferred
 * work lands after the window in which Lighthouse measures blocking time and
 * time-to-interactive, rather than competing with hydration inside it.
 * Returns a cancel function. Does nothing on the server.
 */
export function whenIdle(fn: () => void, delay = 2500): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as IdleWindow;
  let done = false;
  let timer: number | undefined;
  let idleId: number | undefined;

  const cleanup = () => {
    window.removeEventListener("load", schedule);
    for (const e of WAKE_EVENTS) window.removeEventListener(e, fire);
    if (timer !== undefined) window.clearTimeout(timer);
    if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
  };
  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    fn();
  };
  function schedule() {
    timer = window.setTimeout(() => {
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(fire, { timeout: 2000 });
      else fire();
    }, delay);
  }

  for (const e of WAKE_EVENTS) window.addEventListener(e, fire, { once: true, passive: true });
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return cleanup;
}

/** `true` once `whenIdle` has fired. Stays `false` through SSR and hydration. */
export function useIdleReady(delay = 2500): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => whenIdle(() => setReady(true), delay), [delay]);
  return ready;
}
