import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { getLenis } from "../lib/scroll";
import { listKeyForPath, noteNavigation, returnFor } from "../lib/list-return";

/**
 * Every route change starts at the top of the new page.
 *
 * The router's own scroll restoration is switched off (see src/router.tsx),
 * because restoring the previous offset made a freshly opened page appear to
 * start halfway down. Lenis owns the scroll position when smooth scrolling is
 * active, so it has to be reset through the instance as well as the window —
 * resetting only one of the two leaves the other out of sync.
 *
 * One exception: coming BACK to a list (jobs, internships, courses, skills)
 * from the card that was opened there. That page puts itself back where it was
 * (useListReturn), so jumping to the top first would only make it flash.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    noteNavigation(pathname);
    const list = listKeyForPath(pathname);
    if (list && returnFor(list)) return;

    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(0, { immediate: true, force: true });
    }
    // `instant` (not `smooth`) so the page is simply already at the top rather
    // than visibly flying there, and so it works with reduced-motion users.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
