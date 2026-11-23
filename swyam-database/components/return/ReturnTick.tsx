import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useTx } from "../../lib/i18n";

/**
 * "You were here": the mark a list card wears when you come back to the list
 * from the page it opened.
 *
 * The card carries `data-returned` only while it is the one you came back from
 * (set and cleared by `useListReturn`). The words are rendered only while that
 * attribute is present, never in the server HTML or on any other card, so page
 * text, reader modes, copy-paste and a late stylesheet never show "You were
 * here" on every card. return.css positions and animates the mark. A word and
 * an icon, with an outline on the card, so the mark never depends on color. It
 * must sit inside a `position: relative` card with `data-return-id`.
 */
export default function ReturnTick() {
  const tx = useTx();
  const anchor = useRef<HTMLSpanElement>(null);
  const [returned, setReturned] = useState(false);

  useEffect(() => {
    const card = anchor.current?.closest<HTMLElement>("[data-return-id]") ?? null;
    if (!card || typeof MutationObserver === "undefined") return;
    const sync = () => setReturned(card.hasAttribute("data-returned"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(card, { attributes: true, attributeFilter: ["data-returned"] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span ref={anchor} aria-hidden className="return-glow" />
      {returned && (
        <span className="return-tick">
          <MapPin size={12} aria-hidden />
          {tx("You were here")}
        </span>
      )}
    </>
  );
}
