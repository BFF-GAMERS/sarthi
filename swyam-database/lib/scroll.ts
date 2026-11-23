import type Lenis from "lenis";

// Shared handle to the active Lenis instance so ScrollToTop (and anything
// else) can drive the smooth scroller instead of window.scrollTo.
let lenis: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  lenis = l;
};

export const getLenis = () => lenis;
