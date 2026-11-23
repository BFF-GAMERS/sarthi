import { motion } from "framer-motion";
import { useSpringTransition } from "./hooks";

export interface NavActiveIndicatorProps {
  /**
   * The shared identity. Every item on one surface renders an indicator with
   * the same `layoutId`, but only the active one is mounted, which is what
   * lets framer-motion slide a single element between them. Keep it constant
   * per surface and put the surface in a `LayoutGroup` (an `EvolutionStage`
   * already is one) so the top nav and the bottom nav cannot swap indicators.
   */
  layoutId: string;
  /** `pill` fills the item behind its label; `underline` is a bar beneath it. */
  variant?: "pill" | "underline";
  /**
   * Replaces the default look entirely (colour, inset, thickness). Keep it
   * `absolute` and behind the label (`-z-10`, or give the label `relative z-10`).
   */
  className?: string;
  /**
   * Border radius in px, applied inline. It must be inline, not a class:
   * framer-motion counter-scales an inline radius while the shared element
   * stretches between two sizes, so a pill stays a pill mid-flight instead of
   * squashing into an ellipse.
   */
  radius?: number;
}

const LOOKS = {
  pill: "absolute inset-0 -z-10 bg-saffron-50",
  underline: "absolute inset-x-2 -bottom-1 h-0.5 bg-saffron-500",
} as const;

/**
 * The sliding marker behind (or under) the active navigation item.
 *
 * Render it inside the active item only:
 *
 *   <li className="relative"> ... {active && <NavActiveIndicator layoutId="nav-top" />} </li>
 *
 * When the active item changes, or when the items re-order, the marker
 * travels to the new position on the `standard` spring. It is an
 * empty, `aria-hidden` element in its own layer, so the label is never
 * transformed or blurred and screen readers never see it; the active state
 * itself must still be conveyed by `aria-current` on the link.
 *
 * Under reduced motion it lands instantly. If the animation never runs, the
 * marker is still exactly where it belongs, because it is the element, not an
 * effect applied to it.
 */
export function NavActiveIndicator({
  layoutId,
  variant = "pill",
  className,
  radius,
}: NavActiveIndicatorProps) {
  const transition = useSpringTransition("standard");
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className={className ?? LOOKS[variant]}
      style={{ borderRadius: radius ?? (variant === "pill" ? 999 : 2) }}
      transition={transition}
    />
  );
}
