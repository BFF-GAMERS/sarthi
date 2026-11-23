import { useCallback, useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Navigation } from "lucide-react";
import { useTx } from "@/lib/i18n";
import SayItDialog from "./SayItDialog";

/** Anything on the page can open the dialog with `window.dispatchEvent(new Event("swayam:say-it"))`. */
export const SAY_IT_EVENT = "swayam:say-it";

/** Sign-in pages have their own flow and no "go anywhere" button. */
const HIDDEN_ON = /^\/(auth|login|signup|register)(\/|$)/;

/**
 * The "Say it" button and its shortcut (Ctrl or Cmd + Shift + K).
 *
 * The button floats just above the assistant's, clear of the phone bottom bar,
 * and steps out of the way while another modal is open. The dialog behind it
 * always asks before it moves anyone. Mounted once, from the deferred overlays.
 */
export default function SayItLauncher() {
  const tx = useTx();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [covered, setCovered] = useState(false);
  const barred = HIDDEN_ON.test(pathname);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (barred) {
      setOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(SAY_IT_EVENT, onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SAY_IT_EVENT, onEvent);
    };
  }, [barred]);

  /* Hide the button while any other modal dialog is up. One query per animation frame at most. */
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      setCovered(document.querySelector('[aria-modal="true"]:not([data-say-it])') !== null);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const watcher = new MutationObserver(schedule);
    watcher.observe(document.body, { childList: true, subtree: true });
    check();
    return () => {
      watcher.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (barred) return null;
  return (
    <>
      {!open && !covered && (
        <button
          type="button"
          className="say-it-fab"
          aria-keyshortcuts="Control+Shift+K Meta+Shift+K"
          onClick={() => setOpen(true)}
        >
          <Navigation size={16} aria-hidden />
          {tx("Say it")}
        </button>
      )}
      {open && <SayItDialog onClose={close} />}
    </>
  );
}
