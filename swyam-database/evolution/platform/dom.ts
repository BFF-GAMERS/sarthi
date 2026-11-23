/** Tiny DOM helpers. Safe to import anywhere: every function no-ops without a document. */

export interface HtmlStamp {
  state: string;
  nav: string;
  layout: string;
  density: string;
  tier: number;
}

/** Keeps `<html data-evo-*>` in step with the presented state (the bootstrap script stamped the first paint). */
export function stampHtml(s: HtmlStamp): void {
  try {
    if (typeof document === "undefined") return;
    const d = document.documentElement.dataset;
    d["evoState"] = s.state;
    d["evoNav"] = s.nav;
    d["evoLayout"] = s.layout;
    d["evoDensity"] = s.density;
    d["evoTier"] = String(s.tier);
  } catch {
    /* a hint, never a dependency */
  }
}

/** OS reduced motion or the in-app switch (html[data-motion=reduced]). Evolution still happens, just instantly. */
export function prefersInstant(): boolean {
  try {
    if (document.documentElement.getAttribute("data-motion") === "reduced") return true;
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return true;
  }
}

/** Focus capture/restore around a release (the focused element must keep focus when a region re-renders). */
export const focusPort = {
  capture(): string | null {
    try {
      const a = document.activeElement;
      return a instanceof HTMLElement && a !== document.body && a.id ? a.id : null;
    } catch {
      return null;
    }
  },
  restore(id: string): void {
    try {
      const a = document.activeElement;
      if (a && a !== document.body) return;
      document.getElementById(id)?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  },
};
