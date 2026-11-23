import { useEffect } from "react";
import { getLenis } from "../../lib/scroll";
import {
  returnFor,
  returnIdOf,
  saveReturn,
  type ListKey,
  type ReturnEntry,
} from "../../lib/list-return";

/**
 * Call once in each list page.
 *
 * Going out: using the link of any `[data-return-id]` card records which card
 * and how far down the page it was. Coming back (Back, or a link from the
 * page that card opened): wait for the cards to exist, put the page back where
 * it was, and mark the card `data-returned` for about four seconds. The mark
 * itself is drawn by <ReturnTick /> and return.css.
 *
 * Gives up quietly: if the list never reappears, if the person starts
 * scrolling first, or if storage is blocked, the list just starts at the top.
 */

const POLL_MS = 2000;
const SHOW_MS = 3600;
const GONE_MS = 4400;
/** The fixed navigation covers about this much of the top of the viewport. */
const NAV_CLEARANCE = 96;

function currentScroll(): number {
  return getLenis()?.scroll ?? window.scrollY;
}

function scrollTo(y: number) {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
}

function findCard(id: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-return-id]")) {
    if (el.getAttribute("data-return-id") === id) return el;
  }
  return null;
}

export function useListReturn(listKey: ListKey): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    /* ── going out ── */
    const record = (target: EventTarget | null) => {
      const hit = returnIdOf(target);
      if (!hit) return;
      saveReturn({
        listKey,
        id: hit.id,
        scrollY: Math.max(0, Math.round(currentScroll())),
        ts: Date.now(),
        href: hit.href,
      });
    };
    const onClick = (e: MouseEvent) => {
      // A new-tab click leaves this page where it is: nothing to come back to.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      record(e.target);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") record(e.target);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);

    /* ── coming back ── */
    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];
    let marked: HTMLElement | null = null;

    const stop = () => {
      cancelled = true;
    };
    const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    const unlisten = () => userEvents.forEach((n) => window.removeEventListener(n, stop));

    const mark = (card: HTMLElement) => {
      marked = card;
      // A tall card can come back with its top edge under the nav bar: keep the tick where it can be seen.
      const r = card.getBoundingClientRect();
      if (r.top < NAV_CLEARANCE && r.height > 88) {
        card.style.setProperty(
          "--return-tick-top",
          `${Math.round(Math.min(r.height - 44, NAV_CLEARANCE - r.top + 8))}px`,
        );
      }
      card.setAttribute("data-returned", "1");
      timers.push(window.setTimeout(() => card.setAttribute("data-returned", "fading"), SHOW_MS));
      timers.push(
        window.setTimeout(() => {
          card.removeAttribute("data-returned");
          card.style.removeProperty("--return-tick-top");
        }, GONE_MS),
      );
    };

    const restore = (card: HTMLElement, entry: ReturnEntry) => {
      scrollTo(entry.scrollY);
      // If the list has changed since, the offset may no longer show the card.
      raf = requestAnimationFrame(() => {
        if (cancelled) return;
        const r = card.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) {
          card.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        }
        mark(card);
        // Keyboard and screen-reader users land on the card they left.
        if (!document.activeElement || document.activeElement === document.body) {
          card.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });
        }
        unlisten();
      });
    };

    const begin = () => {
      const entry = returnFor(listKey);
      if (!entry) return;
      userEvents.forEach((n) => window.addEventListener(n, stop, { passive: true }));
      const t0 = performance.now();
      const tick = () => {
        if (cancelled) return unlisten();
        const waited = performance.now() - t0;
        const card = findCard(entry.id);
        const tall =
          document.documentElement.scrollHeight - window.innerHeight >= entry.scrollY - 2;
        if (card && (tall || waited > POLL_MS / 2)) return restore(card, entry);
        if (waited > POLL_MS) return unlisten();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // One frame later, so ScrollToTop has noted this navigation first.
    raf = requestAnimationFrame(begin);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      marked?.removeAttribute("data-returned");
      marked?.style.removeProperty("--return-tick-top");
      unlisten();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [listKey]);
}
