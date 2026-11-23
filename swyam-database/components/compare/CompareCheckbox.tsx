import { useId, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { useTx } from "../../lib/i18n";
import { track, EV } from "@/evolution";
import { toggleCompareItem, useCompareStatus } from "../../lib/compare";
import type { CompareKind } from "../../lib/compare-fields";

/**
 * "Compare" on a card: a real checkbox, labelled, with a 44 px hit area.
 *
 * Host cards cover the whole card with a link, so this sits above it
 * (`relative z-10`) and stops its own clicks and keys from reaching the card.
 * If a host ever nests it inside an anchor it still never navigates: the
 * click is cancelled and the toggle is done by hand.
 *
 * Disabled with words, not just a dimmed look, when three are already
 * picked or when the picks so far are of the other kind (courses against
 * jobs). Jobs and internships compare together; courses only with courses.
 */
export default function CompareCheckbox({
  kind,
  id,
  title,
  className = "",
}: {
  kind: CompareKind;
  id: string;
  title: string;
  className?: string;
}) {
  const tx = useTx();
  const noteId = useId();
  const input = useRef<HTMLInputElement>(null);
  const { on, blocked } = useCompareStatus(kind, id);
  const disabled = blocked !== null;

  const note =
    blocked === "full"
      ? tx("Max 3 — remove one")
      : blocked === "mixed"
        ? kind === "course"
          ? tx("Jobs are picked — clear them first")
          : tx("Courses are picked — clear them first")
        : null;

  const inAnchor = () => !!input.current?.closest("a");

  function act() {
    const result = toggleCompareItem(kind, id, title);
    if (result === "added") {
      track(EV.LIST_FILTERED, {
        surface: kind === "course" ? "courses" : kind === "job" ? "jobs" : "internships",
        filter: "compare",
      });
    }
  }

  const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

  return (
    <span className={`relative z-10 inline-block ${className}`}>
      <label
        className="cmp-check-wrap"
        data-on={on}
        data-blocked={disabled}
        onClick={(e) => {
          e.stopPropagation();
          // A click on the words (not the box) inside an anchor would follow it.
          if (e.target !== input.current && inAnchor()) {
            e.preventDefault();
            if (!disabled) act();
          }
        }}
        onKeyDown={stop}
      >
        <input
          ref={input}
          type="checkbox"
          className="cmp-check"
          checked={on}
          disabled={disabled}
          aria-describedby={note ? noteId : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (inAnchor()) {
              e.preventDefault();
              act();
            }
          }}
          onChange={() => {
            if (!inAnchor()) act();
          }}
        />
        <span>
          {tx("Compare")}
          <span className="sr-only"> {title}</span>
        </span>
      </label>
      {note && (
        <span id={noteId} className="cmp-check-note">
          {note}
        </span>
      )}
    </span>
  );
}
