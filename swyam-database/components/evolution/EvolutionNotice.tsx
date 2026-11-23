/**
 * One polite aria-live announcement per committed change, with Show me, Undo and Why (plan §4.6).
 * Mounted once in __root.tsx beside ConnectionBar; it also hosts the single WhyPanel.
 *
 * "Swayam moved Jobs and Applications up. Show me · Undo · Why?" stays 8 s (paused while hovered or
 * focused) and Undo vetoes that change. A restored visit-2 arrangement is never announced, neither is a Lab
 * demo, and a change nobody can see on this page (a Home section moved while you are on /cv) stays quiet.
 *
 * It owns the bottom of the screen first: while it is up the privacy bar waits (notice.ts, requestOverlay).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { undoLastChange } from "../../evolution/state/commands";
import {
  NOTICE_MS,
  mountOverlayBox,
  noticeBus,
  noticeVisibleOn,
  openWhy,
  requestOverlay,
  showMeTarget,
  type EvolutionNoticeModel,
} from "../../evolution/state/notice";
import { prefersInstant } from "../../evolution/platform/dom";
import { useEvolutionNotice } from "../../evolution/react/hooks";
import WhyPanel from "./WhyPanel";

/** The topmost of the moved sections, once Home has rendered it. Waits up to ~1.6 s for a fresh route. */
function scrollToSection(first: string, all: readonly string[]): void {
  const started = performance.now();
  const find = (): HTMLElement | null => {
    let best: HTMLElement | null = null;
    for (const id of all.length ? all : [first]) {
      const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
      if (el && (!best || el.getBoundingClientRect().top < best.getBoundingClientRect().top))
        best = el;
    }
    return best;
  };
  const step = (): void => {
    const el = find();
    if (!el) {
      if (performance.now() - started < 1600) requestAnimationFrame(step);
      return;
    }
    el.scrollIntoView({ block: "start", behavior: prefersInstant() ? "auto" : "smooth" });
    // Focus follows the eye, for keyboard and screen-reader users, without a second scroll.
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };
  requestAnimationFrame(step);
}

/** The toast itself. Router-aware, so it only exists while there is something to say (the server renders none). */
function NoticeToast({ notice }: { notice: EvolutionNoticeModel }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [held, setHeld] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { id, kind } = notice;
  const shown = noticeVisibleOn(notice, pathname, Date.now());
  const target = showMeTarget(notice);

  // A removed notice never sees its mouseleave: a new one starts un-held.
  useEffect(() => {
    setHeld(false);
  }, [id]);

  // One bottom overlay at a time: ask for the slot while there is something to say.
  useEffect(() => {
    if (!shown) return;
    return requestOverlay("adaptation");
  }, [shown]);

  // The Sarthi button measures itself against this one.
  useEffect(() => {
    const el = box.current;
    if (!shown || !el) return;
    return mountOverlayBox("adaptation", el);
  }, [shown, id]);

  // The 8 s clock runs only while the notice is actually on screen.
  useEffect(() => {
    if (!shown || held) return;
    const t = setTimeout(
      () => noticeBus.set((cur) => (cur && cur.id === id && cur.kind === kind ? null : cur)),
      NOTICE_MS,
    );
    return () => clearTimeout(t);
  }, [id, kind, shown, held]);

  if (!shown) return null;

  const showMe = (): void => {
    if (!target) return;
    const all = notice.moved ?? [target];
    noticeBus.set(null);
    if (pathname === "/") scrollToSection(target, all);
    else void navigate({ to: "/" }).then(() => scrollToSection(target, all));
  };

  return (
    <div
      ref={box}
      className="evo-notice"
      data-kind={notice.kind}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <p className="evo-notice-text">{notice.message}</p>
      <div className="evo-notice-actions">
        {target ? (
          <>
            <button type="button" className="evo-link" onClick={showMe}>
              Show me
            </button>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        {notice.undoable ? (
          <>
            <button
              type="button"
              className="evo-link"
              onClick={() => {
                undoLastChange();
              }}
            >
              Undo
            </button>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <button
          type="button"
          className="evo-link"
          onClick={(e) => {
            openWhy(e.currentTarget);
            noticeBus.set(null);
          }}
        >
          Why?
        </button>
        <button
          type="button"
          className="evo-link evo-dismiss"
          aria-label="Dismiss"
          onClick={() => noticeBus.set(null)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function EvolutionNotice() {
  const notice = useEvolutionNotice();
  return (
    <>
      <div
        className="evo-notice-live overlay-dock"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice ? <NoticeToast notice={notice} /> : null}
      </div>
      <WhyPanel />
    </>
  );
}
