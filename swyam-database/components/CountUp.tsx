import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { usePreferences } from "../context/PreferencesContext";
import { FX_EVENT, currentFx } from "../evolution/platform/frame-budget";

/**
 * A figure that counts up the first time you scroll to it.
 *
 * Takes the finished string — "32,000+", "1.4 crore", "78%" — rather than a
 * number and a pile of formatting props, because these figures are written
 * inline next to their labels and several of them are translated. Whatever
 * wraps the number is preserved exactly; only the digits move.
 *
 * The point is not decoration. A number that ticks up is read as a quantity
 * rather than skimmed as part of a sentence, and these three are the claim the
 * whole home page rests on.
 *
 * It stands down under Frame-Budget Mode (`html[data-fx]` is `lite` or `static`):
 * a device that is already short of frames should not spend them on a tick.
 *
 * Two rules it will not break:
 *
 *  - The final value is what renders if nothing animates — including when the
 *    figure only arrives from a query after mount, which is what the skill
 *    board does. A stalled frame, a background tab or a reduced-motion
 *    preference leaves the real figure on screen: never a zero, never a
 *    blank, and never the value it happened to have on the first render.
 *  - It runs once. A number that re-counts every time it scrolls past is a
 *    distraction, not an accent.
 */
export default function CountUp({
  children,
  /** Seconds for the full count. Long enough to read, short enough to finish. */
  duration = 1.4,
  className,
}: {
  children: string;
  duration?: number;
  className?: string;
}) {
  const { prefs } = usePreferences();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [shown, setShown] = useState(children);
  // True when the device asked Swayam to lighten itself. Markup is identical either way, so the lazy read is safe.
  const [calm, setCalm] = useState(() => typeof document !== "undefined" && currentFx() !== "full");

  useEffect(() => {
    const read = (): void => setCalm(currentFx() !== "full");
    read();
    window.addEventListener(FX_EVENT, read);
    return () => window.removeEventListener(FX_EVENT, read);
  }, []);

  /*
   * Follow the prop whenever nothing is going to animate.
   *
   * useState only takes its initial value once, so a figure that arrives from
   * a query after mount — every count on the skill board — would otherwise
   * stay at whatever it was on the first render, which is 0. When an
   * animation does run it owns the value and this deliberately stays out of
   * the way.
   */
  useEffect(() => {
    if (prefs.reducedMotion || calm || !inView) setShown(children);
  }, [children, prefs.reducedMotion, calm, inView]);

  useEffect(() => {
    if (prefs.reducedMotion || calm || !inView) return;

    // The first run of digits, with its grouping and decimals intact:
    // "1.4 crore" -> "1.4", "32,000+" -> "32,000".
    const match = /[\d,]*\d(?:\.\d+)?/.exec(children);
    if (!match) return;

    const raw = match[0];
    const target = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(target)) return;

    const decimals = raw.includes(".") ? (raw.split(".")[1]?.length ?? 0) : 0;
    const grouped = raw.includes(",");
    const before = children.slice(0, match.index);
    const after = children.slice(match.index + raw.length);

    const render = (n: number) => {
      const fixed = n.toFixed(decimals);
      // Indian grouping, because these are Indian figures and 32,000 should
      // not become 32.000 or 3,2000 for a reader in another locale.
      const body = grouped
        ? Number(fixed).toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : fixed;
      return `${before}${body}${after}`;
    };

    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => setShown(render(n)),
      // Land exactly on the written string rather than on a rounded
      // reconstruction of it.
      onComplete: () => setShown(children),
    });

    return () => controls.stop();
  }, [inView, children, duration, prefs.reducedMotion, calm]);

  return (
    <span ref={ref} className={className} data-countup="">
      {/* Assistive tech gets the settled figure, not each intermediate tick. */}
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{children}</span>
    </span>
  );
}
