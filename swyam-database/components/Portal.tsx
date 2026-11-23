import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children at the end of `<body>`, outside the page tree.
 *
 * Needed because a `z-index` is only compared against siblings inside the same
 * stacking context. The root layout gives `<main>` `position: relative` and
 * `z-20`, which creates one — so a modal rendered inside a page was capped at
 * that level no matter how high its own z-index went, and the navigation bar
 * (a sibling of `<main>`, at z-40) painted straight over the top of it. The
 * assessment's header collided with the site header, and the close button sat
 * behind the account menu.
 *
 * Raising the modal's z-index cannot fix that; leaving the stacking context is
 * the only thing that does.
 *
 * Mounted after the first client render, because the server has no `document`
 * and a portal on the first pass would not match what was sent down.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
