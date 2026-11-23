import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { useTx } from "../lib/i18n";
import { whenIdle } from "../lib/use-idle";

/*
 * The Sarthi assistant is a 200 kB chunk (plus a markdown renderer) that
 * nobody needs until they open it. This is the button that stands in for it:
 * the same pixels as the assistant's own floating button, rendered with the
 * page, so nothing pops in late and nothing shifts. The real component loads
 * when someone reaches for the button (pointer, focus or touch), when
 * something calls `openSarthi()`, or, so a tap is instant, once the page has
 * been quiet for a while.
 */
const AIAssistant = lazy(() => import("./AIAssistant"));

/** Same string as `SARTHI_OPEN_EVENT` in AIAssistant, which this file must not import. */
const SARTHI_OPEN_EVENT = "sarthi:open";

/** The assistant's own button animates in over about a second; the stand-in leaves after it. */
const HANDOFF_MS = 1200;

/** Re-sends the open request once the assistant exists to hear it. */
function ReplayOpen({
  wantsOpen,
  onMounted,
}: {
  wantsOpen: { current: boolean };
  onMounted: () => void;
}) {
  useEffect(() => {
    if (wantsOpen.current) window.dispatchEvent(new CustomEvent(SARTHI_OPEN_EVENT));
    onMounted();
    // Runs once, when the lazy sibling above it has committed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/*
 * On a phone the button floats over the page, so a hero figure can scroll under it and the third stat
 * ends up behind a sparkle. While a stats figure sits beneath the button, `html[data-fab-yield]`
 * eases the button aside (styles.css) and brings it back the moment it is clear. Pointer-only, never
 * while it has keyboard focus, and only below the laptop breakpoint where the rail takes over.
 */
const FAB_SELECTOR = 'button[class*="bottom-[calc(1.5rem+var(--bottom-bar"]';
/** What the button gets out of the way of: count-up figures, the hero's stats row, and anything marked `data-fab-avoid`. */
const FIGURES = "[data-countup], .hero-stats, [data-fab-avoid]";

function useFigureYield(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const root = document.documentElement;
    const phone = window.matchMedia("(max-width: 1023px)");
    let raf = 0;
    const check = (): void => {
      raf = 0;
      let over = false;
      if (phone.matches) {
        const fab = document.querySelector<HTMLElement>(FAB_SELECTOR);
        if (fab) {
          const f = fab.getBoundingClientRect();
          for (const el of document.querySelectorAll<HTMLElement>(FIGURES)) {
            const r = el.getBoundingClientRect();
            if (r.bottom > f.top && r.top < f.bottom && r.right > f.left && r.left < f.right) {
              over = true;
              break;
            }
          }
        }
      }
      if (over !== root.hasAttribute("data-fab-yield"))
        root.toggleAttribute("data-fab-yield", over);
    };
    const queue = (): void => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    queue();
    const late = [window.setTimeout(queue, 400), window.setTimeout(queue, 1500)];
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      late.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      root.removeAttribute("data-fab-yield");
    };
  }, [pathname]);
}

export default function AssistantLauncher() {
  const tx = useTx();
  useFigureYield();
  const [engaged, setEngaged] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [gone, setGone] = useState(false);
  const [openRequested, setOpenRequested] = useState(false);
  const wantsOpen = useRef(false);
  const button = useRef<HTMLButtonElement>(null);

  // Warm the chunk when the page has settled, so the first tap is not a wait.
  useEffect(() => whenIdle(() => void import("./AIAssistant"), 8000), []);

  // `openSarthi()` from anywhere on the site, before the assistant has loaded.
  useEffect(() => {
    if (engaged) return;
    const onOpen = () => {
      wantsOpen.current = true;
      setOpenRequested(true);
      setEngaged(true);
    };
    window.addEventListener(SARTHI_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SARTHI_OPEN_EVENT, onOpen);
  }, [engaged]);

  // After the assistant's own button has finished arriving, step aside.
  useEffect(() => {
    if (!mounted) return;
    const id = window.setTimeout(() => {
      const hadFocus = document.activeElement === button.current;
      setGone(true);
      if (hadFocus) {
        document
          .querySelector<HTMLButtonElement>(
            "button[data-sarthi-button]:not([data-sarthi-launcher])",
          )
          ?.focus();
      }
    }, HANDOFF_MS);
    return () => window.clearTimeout(id);
  }, [mounted]);

  return (
    <>
      {engaged && (
        <Suspense fallback={null}>
          <AIAssistant />
          <ReplayOpen wantsOpen={wantsOpen} onMounted={() => setMounted(true)} />
        </Suspense>
      )}
      {!gone && (
        <button
          data-tour="home-sarthi"
          ref={button}
          type="button"
          data-sarthi-launcher=""
          aria-label={tx("Ask Sarthi")}
          aria-hidden={mounted || undefined}
          tabIndex={mounted ? -1 : undefined}
          onPointerEnter={() => setEngaged(true)}
          onFocus={() => setEngaged(true)}
          onTouchStart={() => setEngaged(true)}
          onClick={() => {
            // Already loaded: just ask. Still loading: ReplayOpen asks when it lands.
            if (mounted) window.dispatchEvent(new CustomEvent(SARTHI_OPEN_EVENT));
            else wantsOpen.current = true;
            setOpenRequested(true);
            setEngaged(true);
          }}
          className={`fixed bottom-[calc(1.5rem+var(--bottom-bar,0px)+var(--sticky-bar,0px))] right-4 z-[45] flex h-14 items-center gap-2 rounded-[var(--radius-pill)] bg-gradient-to-br from-saffron-500 to-saffron-600 px-5 text-[color:var(--color-on-accent)] shadow-[var(--shadow-float)] transition-[transform,opacity] duration-200 ease-out hover:-translate-y-[3px] active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:right-6 ${
            mounted && openRequested ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <Sparkles size={22} />
          <span className="hidden font-body text-sm font-semibold sm:inline">
            {tx("Ask Sarthi")}
          </span>
        </button>
      )}
    </>
  );
}
