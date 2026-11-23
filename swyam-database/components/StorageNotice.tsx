import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useTx } from "../lib/i18n";
import { useUiState } from "../evolution/react/hooks";
import {
  REVEAL_MS,
  isReveal,
  mountOverlayBox,
  overlayBus,
  pickOverlay,
  privacyBarAllowed,
  privacyCollapseIn,
  requestOverlay,
} from "../evolution/state/notice";

/**
 * The first-visit notice, and deliberately not a cookie wall.
 *
 * This site sets no cookies and carries no advertising. A banner offering to
 * "accept all cookies" would be asking permission for something that does not
 * happen, and the habit of clicking past those is exactly what makes real
 * consent worthless.
 *
 * It does learn, though: from what you do here it builds a small behaviour
 * profile, kept on this device, and uses it to arrange the site (the
 * Evolution Engine). So the notice says that plainly, in one line: it learns
 * here, nothing leaves, Details has the rest and the reset lives in Settings
 * and the Lab.
 *
 * One line, not a card. It used to float over the hero, the jobs list, the Lab
 * and the "Swayam moved ... Why?" notice at once. It is now one entry in the
 * bottom overlay queue (the adaptation notice goes first), sits just above the
 * phone's bottom bar, collapses itself after the first interaction (but never
 * before it has been readable) or 8 s, and never shows on the Lab or while the
 * evolved Home is revealing itself.
 *
 * The acknowledgement is itself kept in local storage, which is the only
 * honest place for it: a server record of "this person saw a notice" would
 * be new personal data created by the notice about data.
 */

/* v2: the notice changed meaning (on-device learning), so it is shown once more. */
const KEY = "swayam-notice-v2";
const LEAVE_MS = 180;

export default function StorageNotice() {
  const tx = useTx();
  const { pathname } = useLocation();
  const { state } = useUiState();
  // null until storage has been read, then whether this device still owes the person the line.
  const [unseen, setUnseen] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(0);
  const shownMs = useRef(0);
  const firstTouchAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = performance.now();
    try {
      setUnseen(!localStorage.getItem(KEY));
    } catch {
      /* Private window or storage blocked: say nothing rather than nag. */
      setUnseen(false);
    }
    const t = setTimeout(() => setRevealDone(true), REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const reveal = isReveal({
    pathname,
    state,
    sinceMountMs: revealDone ? REVEAL_MS : 0,
  });
  const wants = unseen === true && !leaving && privacyBarAllowed({ pathname, reveal });

  // One bottom overlay at a time: the adaptation notice goes first.
  useEffect(() => {
    if (!wants) return;
    return requestOverlay("privacy");
  }, [wants]);
  const active = useSyncExternalStore(
    overlayBus.subscribe,
    () => pickOverlay(overlayBus.get()),
    () => null,
  );
  const visible = wants && active === "privacy";

  const finish = (): void => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* Nothing to remember it with; it will appear again, which is fair. */
    }
    setLeaving(true);
    setTimeout(() => setUnseen(false), LEAVE_MS);
  };

  // Collapses after the first interaction (not before it was readable) or 8 s, counting only the time it is on screen.
  useEffect(() => {
    if (!visible || held) return;
    const t0 = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (): void => {
      clearTimeout(timer);
      const visibleMs = shownMs.current + (performance.now() - t0);
      timer = setTimeout(finish, privacyCollapseIn(visibleMs, firstTouchAt.current));
    };
    const onTouch = (): void => {
      if (firstTouchAt.current !== null) return;
      firstTouchAt.current = shownMs.current + (performance.now() - t0);
      arm();
    };
    arm();
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const evs = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
    for (const e of evs) window.addEventListener(e, onTouch, opts);
    return () => {
      clearTimeout(timer);
      for (const e of evs) window.removeEventListener(e, onTouch, opts);
      shownMs.current += performance.now() - t0;
    };
    // finish only closes over setters and constants.
  }, [visible, held]);

  // The Sarthi button measures itself against this bar.
  useEffect(() => {
    const el = box.current;
    if (!visible || !el) return;
    return mountOverlayBox("privacy", el);
  }, [visible]);

  if (!visible && !(leaving && unseen)) return null;

  return (
    <div
      ref={box}
      role="region"
      aria-label={tx("How this site stores things")}
      data-leaving={leaving ? "" : undefined}
      className="overlay-dock overlay-dock--bar"
    >
      <div
        className="privacy-bar"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
      >
        <p className="privacy-bar-text">{tx("स्वYAM learns on this device.")}</p>
        <button type="button" onClick={finish} className="privacy-bar-btn privacy-bar-btn--primary">
          {tx("Got it")}
        </button>
        <Link to="/privacy" onClick={finish} className="privacy-bar-btn">
          {tx("Details")}
        </Link>
      </div>
    </div>
  );
}
