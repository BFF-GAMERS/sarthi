import { useEffect } from "react";

/**
 * Anything fixed to the bottom of the page, declaring itself.
 *
 * Three things want that edge — the phone's navigation, a page's action bar
 * (enrol, apply, compare) and the assistant's pill — and each was solving the
 * collision by hand: the bars kept a 5.5rem hole on the right for a pill that
 * may not be there, which squeezed "₹18,000 – ₹26,000/month" down to
 * "₹18,000 …". So the bar says how tall it is, the pill reads it, and neither
 * has to guess.
 */
const HEIGHT = "4.25rem";

export function useStickyBar(active = true): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.style.setProperty("--sticky-bar", HEIGHT);
    return () => root.style.setProperty("--sticky-bar", "0px");
  }, [active]);
}
