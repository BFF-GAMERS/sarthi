import { useEffect, useState } from "react";

const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts a plain finite number from 0 up to `value` on mount (and again if
 * `value` changes). Any other value (strings, NaN, Infinity, nodes) is returned
 * unchanged. With prefers-reduced-motion, the target is shown immediately.
 */
export function useCountUp<T>(value: T, duration = 900): T {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const target = isNum ? (value as number) : 0;
  const [shown, setShown] = useState<number>(() => (isNum && prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (!isNum) return;
    if (prefersReducedMotion()) {
      setShown(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? Math.round(target * eased) : target);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isNum, target, duration]);

  return (isNum ? shown : value) as T;
}
