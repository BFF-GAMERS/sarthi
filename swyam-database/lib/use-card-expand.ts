import { useCallback, useState, type FocusEvent, type PointerEvent } from "react";

/**
 * Per-card expansion state.
 *
 * Every card that uses this hook owns its own `useState`, so hovering one card
 * can never change another. Nothing is lifted, shared, keyed or stored in a
 * parent — there is deliberately no map of ids to booleans, because that is the
 * structure that lets one card's state leak into its neighbours.
 *
 * Why this replaced the pure-CSS `:hover` / `:focus-within` approach:
 *
 *  - `:focus-within` latched. Clicking anywhere inside a card (a link, a
 *    bookmark button, or the card itself when it carried `tabIndex={0}`) left
 *    focus inside it, so the card stayed open after the pointer left and
 *    several cards could sit open at once.
 *  - Expansion now only reacts to a real mouse pointer, and to keyboard focus
 *    via `:focus-visible`, so a mouse click never pins a card open.
 */
export function useCardExpand() {
  const [expanded, setExpanded] = useState(false);

  const onPointerEnter = useCallback((e: PointerEvent<HTMLElement>) => {
    // Touch and pen fire pointerenter but never pointerleave, which would
    // strand the card open. Only a mouse drives hover expansion.
    if (e.pointerType === "mouse") setExpanded(true);
  }, []);

  const onPointerLeave = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") setExpanded(false);
  }, []);

  const onFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    // Keyboard users get the same reveal; mouse clicks do not latch it open.
    const target = e.target as HTMLElement;
    if (typeof target.matches === "function" && target.matches(":focus-visible")) {
      setExpanded(true);
    }
  }, []);

  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    // Stay open while focus moves between controls inside this card; close as
    // soon as it leaves the card entirely.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setExpanded(false);
  }, []);

  return {
    expanded,
    /** Spread onto the card root element. */
    cardProps: {
      "data-expanded": expanded ? ("true" as const) : ("false" as const),
      onPointerEnter,
      onPointerLeave,
      onFocus,
      onBlur,
    },
  };
}
