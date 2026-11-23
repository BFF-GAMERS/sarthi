import { usePreferences } from "../context/PreferencesContext";

/**
 * The one piece of ornament a screen is allowed, drawn differently in each
 * register.
 *
 * What was here before was two blurred colour orbs behind the headline —
 * the default decoration of every generated landing page, and the reason
 * the hero read as template rather than product. A mark has to mean
 * something or it is noise, so each register gets exactly one, and it is
 * the same idea drawn in that register's own hand:
 *
 *   Night — a signal. Concentric arcs spreading from a point off the top
 *   right, thin saffron strokes at falling opacity. They draw themselves
 *   once on load, outside in, and then hold. Nothing loops.
 *
 *   Paper — a block print. Three diamonds between hairlines, the ornament
 *   a printer sets between sections, in terracotta. It prints in once,
 *   one diamond after another, the way a block lands on a page.
 *
 * Both are decorative, so both are `aria-hidden` and neither can be
 * clicked. Both stop dead under reduced motion, which is not a compromise
 * here: the drawing is an entrance, and the mark is complete without it.
 */
export default function RegisterMark({ className = "" }: { className?: string }) {
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;

  if (prefs.interfaceMode === "genz") {
    return (
      <div
        className={`pointer-events-none absolute -right-32 -top-44 hidden select-none sm:block ${className}`}
        aria-hidden
      >
        <svg width="760" height="760" viewBox="0 0 760 760" fill="none">
          {/* Radii chosen so the gaps widen as they travel — a ring spreading
              out, not a target. */}
          {[120, 214, 322, 444, 580].map((r, i) => (
            <circle
              key={r}
              cx="520"
              cy="240"
              r={r}
              stroke="var(--color-saffron-electric)"
              strokeWidth="1.25"
              strokeOpacity={0.34 - i * 0.055}
              /* The dash is the circumference, so one full offset draws the
                 whole ring and lands with no seam. */
              strokeDasharray={still ? undefined : 2 * Math.PI * r}
              strokeDashoffset={still ? undefined : 2 * Math.PI * r}
              style={
                still
                  ? undefined
                  : {
                      animation: `mark-draw 1.5s var(--ease-out-soft) ${0.1 + i * 0.12}s forwards`,
                    }
              }
            />
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute right-8 top-28 hidden select-none lg:block ${className}`}
      aria-hidden
    >
      <div className="flex w-56 flex-col gap-3">
        <span className="h-px w-full bg-ink-line" />
        <div className="flex items-center justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              width="26"
              height="26"
              viewBox="0 0 26 26"
              fill="none"
              style={
                still
                  ? undefined
                  : {
                      opacity: 0,
                      animation: `mark-print 0.5s ease-out ${0.2 + i * 0.14}s forwards`,
                    }
              }
            >
              <path
                d="M13 0 L26 13 L13 26 L0 13 Z"
                fill="var(--color-saffron-500)"
                fillOpacity={0.9 - i * 0.28}
              />
            </svg>
          ))}
        </div>
        <span className="h-px w-full bg-ink-line" />
      </div>
    </div>
  );
}
