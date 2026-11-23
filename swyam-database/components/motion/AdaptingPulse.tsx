import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMotionPrefs } from "./hooks";
import { EASE_OUT_SOFT } from "./tokens";

export interface AdaptingPulseProps {
  /**
   * Fires a new pulse whenever this changes. Pass the evolution's id or the
   * current experience name, so the indicator pulses once for each real change
   * and not otherwise.
   */
  pulseKey?: string | number;
  /** How many rings in one burst. Default 2; never loops beyond that. */
  pulses?: number;
  /** Pulse the first time it appears. Default true: landing on Home should show it. */
  pulseOnMount?: boolean;
  /** Diameter of the dot in px. Default 8. */
  size?: number;
  /** CSS colour of the dot and rings. Defaults to the theme's saffron. */
  color?: string;
  className?: string;
  /** The label, e.g. "Your Swayam is adapting". Announced politely when it changes. */
  children?: ReactNode;
}

const DEFAULT_COLOR = "var(--color-saffron-500, #f05a22)";

/**
 * The small living dot beside "Your Swayam is adapting".
 *
 * A dot that breathes once and sends out two rings, then goes quiet. It is
 * the only motion in the indicator, and it ends: an indicator that pulses
 * forever is a notification badge, and the brief is clear that this must not
 * be an attention trap. Each real change (`pulseKey`) earns one burst and
 * nothing else does.
 *
 * Everything animated is `transform` or `opacity`, and the rings are
 * absolutely positioned inside a fixed-size box, so the pulse never shifts
 * the layout around it. Under reduced motion there are no rings; the dot
 * fades from dim to full once. In a hidden tab it does not animate.
 *
 * The root is a polite live region, so a screen reader hears the label when
 * it changes. The dot and rings are decorative and `aria-hidden`.
 *
 * @example
 * <AdaptingPulse pulseKey={uiState.version}>Your Swayam is adapting</AdaptingPulse>
 */
export function AdaptingPulse({
  pulseKey,
  pulses = 2,
  pulseOnMount = true,
  size = 8,
  color = DEFAULT_COLOR,
  className,
  children,
}: AdaptingPulseProps) {
  const { reduced, frozen } = useMotionPrefs();

  // `fired` counts bursts requested, `finished` counts bursts that ended.
  // A burst is live while they differ. Derived during render so a change in
  // `pulseKey` starts its burst on the same commit.
  const [seenKey, setSeenKey] = useState(pulseKey);
  const [fired, setFired] = useState(pulseOnMount ? 1 : 0);
  const [finished, setFinished] = useState(0);
  if (seenKey !== pulseKey) {
    setSeenKey(pulseKey);
    setFired(fired + 1);
  }
  const live = fired > finished && !frozen;

  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <span
        aria-hidden
        className="relative inline-flex shrink-0"
        style={{ width: size, height: size, color }}
      >
        {live && !reduced && (
          <motion.span
            key={`ring-${fired}`}
            className="absolute inset-0 rounded-full border-[1.5px] border-current"
            // Invisible until it starts, so server-rendered HTML shows no ring.
            initial={{ opacity: 0 }}
            animate={{ scale: [1, 2.8], opacity: [0.55, 0] }}
            transition={{
              duration: 1.3,
              ease: EASE_OUT_SOFT,
              repeat: Math.max(0, pulses - 1),
              repeatDelay: 0.2,
            }}
            onAnimationComplete={() => setFinished(fired)}
          />
        )}
        <motion.span
          key={`dot-${fired}`}
          className="block h-full w-full rounded-full bg-current"
          initial={false}
          animate={live ? (reduced ? { opacity: [0.4, 1] } : { scale: [1, 1.2, 1] }) : undefined}
          transition={{
            duration: reduced ? 0.4 : 0.9,
            times: reduced ? undefined : [0, 0.4, 1],
            ease: "easeInOut",
          }}
          onAnimationComplete={reduced ? () => setFinished(fired) : undefined}
        />
      </span>
      {children}
    </span>
  );
}
