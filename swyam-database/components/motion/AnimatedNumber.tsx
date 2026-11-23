import { useCallback, useEffect, useMemo } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useReducedMotionPref, usePageFrozen } from "./hooks";
import { SPRING, type SpringToken } from "./tokens";

export interface AnimatedNumberProps {
  /** The figure to show. When it changes, the display rolls to the new one. */
  value: number;
  /** Digits after the decimal point. Default 0. */
  decimals?: number;
  /** Text before the number, e.g. "Rs ". */
  prefix?: string;
  /** Text after the number, e.g. "%". */
  suffix?: string;
  /** Replaces the built-in formatting (grouping, decimals). Receives the in-flight value. */
  format?: (n: number) => string;
  /**
   * Locale for digit grouping. Default `en-IN` (12,34,567), fixed rather than
   * read from the browser so the server and the client always format alike.
   */
  locale?: string;
  /** Which spring drives the roll. Default `standard`. */
  spring?: SpringToken;
  className?: string;
}

/**
 * A figure that rolls to its new value instead of jumping.
 *
 * For scores and percentages that change while someone is looking at them:
 * the Lab's behaviour bars, a match score, a progress figure. The digits
 * follow a critically-damped spring, so a 62 to 71 change reads as one
 * movement and settles without overshooting (no flicker through 73 and back).
 *
 * Choices that matter:
 *
 *   - It renders the real value on the very first paint, on the server and the
 *     client alike, and only animates on later *changes*. A number that starts
 *     from zero is a lie to anyone whose frames never arrive. For a hero
 *     statistic that should count up on first sight, use `CountUp`.
 *   - The digits are written straight to the DOM from the animation, not
 *     through React state, so a roll never re-renders the component.
 *   - Digits are tabular so the width does not shimmer while they change.
 *   - Screen readers get the settled value once, in a visually hidden node;
 *     the rolling digits are `aria-hidden`, so nothing is read out mid-roll.
 *   - Reduced motion, and a hidden tab, jump straight to the new value.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  format,
  locale = "en-IN",
  spring = "standard",
  className,
}: AnimatedNumberProps) {
  const reduced = useReducedMotionPref();
  const frozen = usePageFrozen();
  const motionValue = useMotionValue(value);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [locale, decimals],
  );
  const toText = useCallback(
    (n: number) => `${prefix}${format ? format(n) : formatter.format(n)}${suffix}`,
    [prefix, suffix, format, formatter],
  );
  const display = useTransform(motionValue, toText);

  useEffect(() => {
    if (reduced || frozen) {
      motionValue.jump(value);
      return;
    }
    const controls = animate(motionValue, value, SPRING[spring]);
    return () => controls.stop();
  }, [value, reduced, frozen, spring, motionValue]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      <motion.span aria-hidden>{display}</motion.span>
      <span className="sr-only">{toText(value)}</span>
    </span>
  );
}
