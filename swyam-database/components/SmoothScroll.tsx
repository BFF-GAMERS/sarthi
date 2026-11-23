import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { setLenis } from "../lib/scroll";
import { getEffective, subscribeEffective } from "../lib/pace/effective";
import PaceRuntime from "./pace/PaceRuntime";

/**
 * Lenis smooth scrolling, driven by a plain animation frame.
 *
 * This used GSAP and ScrollTrigger, for two things: a ticker to advance
 * Lenis, and a tween that scrubbed the progress bar below. GSAP and its
 * plugin are 252 kB — 66 kB gzipped — and they were in the entry chunk, so
 * every visitor downloaded them before a word of the page appeared.
 *
 * For a platform whose members are often on a 2G connection and a data pack
 * they are counting, that is not a library choice, it is a tax. Both jobs
 * are a handful of lines of `requestAnimationFrame`, which is what they are
 * now. Nothing on screen changed.
 *
 * Skipped entirely for prefers-reduced-motion, who keep native scrolling.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const feel = getEffective();
    const lenis = new Lenis({
      // `lerp` rather than `duration`.
      //
      // With `duration: 1.1` every wheel notch became a 1.1-second animation,
      // and for the whole of it the painted page trailed the real scroll
      // position. That long window is what made the desync below visible:
      // scroll, and the content is briefly not where the browser thinks it
      // is. A lerp settles in about a sixth of that and tracks the wheel
      // instead of replaying it.
      //
      // `feel` is the learned pace: unhurried scrolls softer and slower, quick scrolls tighter. With pace
      // matching off it is 0.12 and 1, exactly what this was before.
      lerp: feel.lerp,
      wheelMultiplier: feel.wheel,
      smoothWheel: true,
    });
    setLenis(lenis);

    // Follow the pace live, so a change in Settings (or switching it off) is felt on the next wheel notch.
    const retune = () => {
      const f = getEffective();
      const o = lenis.options as { lerp?: number; wheelMultiplier?: number };
      o.lerp = f.lerp;
      o.wheelMultiplier = f.wheel;
    };
    const unsubscribePace = subscribeEffective(retune);

    /*
     * Do not advance the scroll while the page is not painting.
     *
     * This is the other half of the desync described below. That comment
     * explains how the offset runs ahead of the paint; this stops it running
     * at all when there is no paint to keep up with, so there is usually
     * nothing left to repair.
     *
     * `requestAnimationFrame` already stops in a hidden tab, which is most of
     * what GSAP's `lagSmoothing(0)` was guarding against; the explicit check
     * covers a window that is visible but throttled.
     */
    let frame = 0;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      lenis.raf(time);
    };
    frame = requestAnimationFrame(tick);

    /*
     * Put the paint back in step with the scroll position.
     *
     * Lenis owns scrolling: it swallows the wheel event and moves the page
     * itself, one animation frame at a time. So when frames stop — a
     * background tab, a hidden window, a throttled renderer — the scroll
     * offset can move on while nothing repaints, and you come back to a page
     * that is blank, or showing the wrong band of content with the fixed
     * header stranded mid-screen. It rights itself on the next scroll,
     * because that finally forces a repaint, which is exactly how it was
     * described: "paints blank after scrolling, recovers on next scroll".
     *
     * Rather than trusting frames to keep coming, resynchronise whenever the
     * document becomes visible again — including a back-button restore from
     * the bfcache, which replays neither.
     */
    const resync = () => {
      if (document.hidden) return;
      lenis.resize();
      lenis.scrollTo(window.scrollY, { immediate: true, force: true });
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("pageshow", resync);
    // A window can regain focus without firing visibilitychange, and an
    // unfocused but visible window still has its frames throttled.
    window.addEventListener("focus", resync);

    return () => {
      unsubscribePace();
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("pageshow", resync);
      window.removeEventListener("focus", resync);
      cancelAnimationFrame(frame);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  // Starts the pace system (signals, apply, steady-hands guard). Renders nothing until a confirm is needed.
  return <PaceRuntime />;
}

/**
 * The thin bar across the top, showing how far down the page you are.
 *
 * Was a GSAP ScrollTrigger scrub. It is one division: how far the document
 * has scrolled, over how far it can. Read inside an animation frame so a
 * fast scroll costs one layout read per paint rather than one per event.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let queued = false;
    const paint = () => {
      queued = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      // A page shorter than the window has no progress to report, and
      // dividing by zero would leave the bar full on every short page.
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left scale-x-0 bg-gradient-to-r from-saffron-500 via-saffron-400 to-emeraldx-400"
    />
  );
}
