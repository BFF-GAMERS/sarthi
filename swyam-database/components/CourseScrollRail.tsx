import { useEffect, useRef, useState, type RefObject, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CourseCard } from "./Cards";
import { usePreferences } from "../context/PreferencesContext";
import { useTx } from "../lib/i18n";
import type { Course } from "../data/mock";

/**
 * The course rail, moved by the page instead of by a hidden scrollbar.
 *
 * What was here was a `.rail` — a horizontal overflow strip with
 * `scrollbar-width: none`. It worked, but it never said so: with the
 * scrollbar hidden and the first card clipped at the left edge, a row that
 * had been nudged sideways read as a layout bug rather than as something you
 * were meant to swipe. On a page a judge scrolls through once, that is the
 * only reading it will get.
 *
 * So on a wide screen the section pins itself and the row travels sideways as
 * you scroll down: one gesture, every course, and no second scrollbar to
 * find. The distance is measured rather than guessed — the section is exactly
 * as tall as the row is wide, so the cards travel at the same rate as the
 * page and the motion reads as the page's own rather than an effect on top.
 *
 * NARROW SCREENS AND STILLED MOTION KEEP THE OLD STRIP. Pinning a viewport on
 * a phone to play an animation takes the page away from somebody trying to
 * get past it, and a thumb swipes a horizontal row perfectly well without any
 * of this. `reducedMotion` is a request, not a preference to design around,
 * so it takes the same path.
 */
export default function CourseScrollRail({
  courses,
  plain = false,
  limit = 6,
}: {
  courses: Course[];
  /** Force the plain strip. The pinned rail runs only where it was designed to: the universal order. */
  plain?: boolean;
  /** Tiles before "See all"; the adaptive Home trims it in compact density. */
  limit?: number;
}) {
  const { prefs } = usePreferences();
  const measureRef = useRef<HTMLDivElement>(null);

  /** How far the row must travel, in px. 0 means "do not pin". */
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (prefs.reducedMotion || plain) {
      setDistance(0);
      return;
    }

    const measure = () => {
      // Below the large breakpoint there is not enough width for the pinned
      // version to be worth the viewport it costs.
      if (window.innerWidth < 1024) {
        setDistance(0);
        return;
      }
      const el = measureRef.current;
      if (!el) return;
      // Whatever hangs past the viewport has to travel, plus the container's
      // gutter so the last tile clears the edge rather than touching it.
      setDistance(Math.max(0, el.scrollWidth - window.innerWidth + 80));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [prefs.reducedMotion, plain, courses.length, limit]);

  const tiles = <Tiles courses={courses} limit={limit} />;

  // A separate component, so its effect mounts with the ref already attached
  // rather than on a re-render after `distance` is finally known.
  if (distance > 0)
    return (
      <PinnedRail distance={distance} trackRef={measureRef}>
        {tiles}
      </PinnedRail>
    );

  // The measuring pass and every narrow or stilled viewport get the strip
  // that was always here. It is also what renders on the server, so the
  // markup is complete before any of this has decided anything.
  return (
    <div className="container-x mt-10">
      <div className="rail -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10" ref={measureRef}>
        {tiles}
      </div>
    </div>
  );
}

function PinnedRail({
  distance,
  trackRef,
  children,
}: {
  distance: number;
  trackRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);

  /*
   * Progress is measured here rather than taken from `useScroll({ target })`.
   * That hook pinned the section correctly and then reported zero for the
   * whole of it — the page scrolled, the sticky child stayed put, and the
   * track kept writing `transform: none`. Reading the section's own rect on
   * each frame is a few lines, behaves the same under Lenis, and can be read
   * back out of a live page to prove it is working, which the hook could not.
   */
  const progress = useMotionValue(0);

  useEffect(() => {
    let frame = 0;
    let last = -1;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const el = sectionRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      // Nowhere near the screen: nothing to compute, and no reason to write
      // to a motion value that nothing is looking at.
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;

      // The section is exactly one viewport taller than the travel, so the
      // travel completes as its bottom edge reaches the bottom of the screen.
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;

      const done = Math.min(1, Math.max(0, -rect.top / travel));
      // Sub-pixel churn would set the value sixty times a second while the
      // page is still.
      if (Math.abs(done - last) < 0.0005) return;
      last = done;
      progress.set(done);
    };

    /*
     * A frame loop rather than a scroll listener, for one measured reason:
     * this site fires no scroll events. Lenis swallows the wheel and moves
     * the page on GSAP's ticker, and the browser emits nothing while it does
     * — scrollY moved 600px here with a probe listener on window counting
     * zero. Subscribing to Lenis instead works, but only if Lenis already
     * exists when this effect runs, and effect order is not something this
     * component gets to decide.
     */
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  // The spring sits on the progress, not on the resulting position: it takes
  // the steps out of a mouse wheel without letting the row drift away from
  // where the scroll says it should be, which is what makes scroll-linked
  // motion feel unmoored.
  const eased = useSpring(progress, { stiffness: 260, damping: 40, mass: 0.35 });
  const x = useTransform(eased, [0, 1], [0, -distance]);

  return (
    <div ref={sectionRef} style={{ height: `calc(100vh + ${distance}px)` }} className="relative">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <motion.div
          ref={trackRef}
          style={{ x }}
          /* items-start: a flex row stretches by default, so one expanded card
             would drag every other card to its height. */
          className="flex items-start gap-5 pl-5 sm:pl-8 lg:pl-10"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

function Tiles({ courses, limit }: { courses: Course[]; limit: number }) {
  const tx = useTx();
  return (
    <>
      {courses.slice(0, limit).map((c) => (
        <div key={c.id} className="w-[19rem] shrink-0 sm:w-[21rem]">
          <CourseCard course={c} />
        </div>
      ))}
      <Link
        to="/courses"
        className="flex w-[14rem] shrink-0 flex-col items-start justify-end rounded-[var(--radius-card)] border border-dashed border-ink-line p-6 text-ink-soft transition-colors hover:border-saffron-500 hover:text-saffron-600"
      >
        <span className="font-display text-[1.4rem] font-semibold leading-tight">
          {tx("See all")} {courses.length} {tx("courses")}
        </span>
        <ArrowRight size={20} className="mt-3" aria-hidden />
      </Link>
    </>
  );
}
