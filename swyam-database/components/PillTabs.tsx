import { motion } from "framer-motion";
import { usePreferences } from "../context/PreferencesContext";

/**
 * A row of filter pills with one indicator that travels between them.
 *
 * The pills already worked: press one, it turns saffron, the one before it
 * turns back. What that loses is *which* one you came from — the highlight
 * teleports, so on a row of seven admin tabs, or a filter bar you are sweeping
 * through, every change looks the same and you navigate by re-reading labels.
 *
 * A single shared element that slides tells you the direction you moved and
 * how far, which is the whole reason the pattern exists. `layoutId` is what
 * makes it one element rather than seven that fade: framer-motion matches the
 * two positions across the re-render and animates between them.
 *
 * The indicator sits *behind* the label in its own layer, so the text is never
 * animated and never blurs mid-transition — and if the animation does not run,
 * the selected pill is still filled, because the fill is the element, not an
 * effect applied to it.
 */
export interface PillTab<T extends string> {
  id: T;
  label: string;
  /** Optional count shown after the label, e.g. a result total. */
  count?: number;
}

export default function PillTabs<T extends string>({
  tabs,
  selected,
  onSelect,
  /** Must be unique per row on the page; two rows sharing it would swap pills. */
  layoutGroup,
  className = "",
  ariaLabel,
}: {
  tabs: ReadonlyArray<PillTab<T>>;
  selected: T;
  onSelect: (id: T) => void;
  layoutGroup: string;
  className?: string;
  ariaLabel?: string;
}) {
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const active = t.id === selected;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(t.id)}
            className={`relative isolate inline-flex min-h-11 items-center rounded-full border px-3.5 py-1.5 font-body text-[13px] font-medium transition-colors ${
              active
                ? "border-transparent text-paper-light"
                : "border-ink-line text-ink-mute hover:border-saffron-200 hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                // Shared across the row: the same element, moved.
                layoutId={`pill-${layoutGroup}`}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-saffron-500"
                transition={
                  still
                    ? { duration: 0 }
                    : // A spring, not a duration: the travel reads as one
                      // object with weight rather than a crossfade on a timer.
                      { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                }
              />
            )}
            <span className="relative">
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`ml-1.5 font-mono text-[11px] tabular-nums ${
                    active ? "text-paper" : "text-ink-mute/70"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
