/**
 * What every modal needs besides its markup: keyboard focus kept inside, Escape to close, the page
 * behind it held still, and focus handed back to where it came from. One call, one undo.
 *
 * Built on the site's own focus trap so every dialog on Swayam behaves the same way. No React in here,
 * which is also what lets the tests drive it without a browser.
 */
import { trapFocus, type FocusTrapOptions } from "@/lib/focus-trap";

export function attachDialog(panel: HTMLElement, opts: FocusTrapOptions): () => void {
  const body = typeof document !== "undefined" ? document.body : null;
  const before = body ? body.style.overflow : "";
  if (body) body.style.overflow = "hidden";
  const release = trapFocus(panel, opts);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (body) body.style.overflow = before;
    release();
  };
}
