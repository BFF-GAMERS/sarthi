import { useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useTx } from "@/lib/i18n";
import {
  applyDraft,
  buildIcebreakers,
  type IcebreakerDraft,
  type IcebreakerInput,
} from "@/lib/swap-assist/icebreaker";

/**
 * The chips only. No state and no hooks, so it can be rendered and exercised
 * without a browser. A chip hands its draft to `onPick` and does nothing else:
 * there is no send, submit or form here to be triggered by accident.
 */
export function DraftChips({
  drafts,
  caption,
  onPick,
}: {
  drafts: IcebreakerDraft[];
  caption: string;
  onPick: (draft: IcebreakerDraft) => void;
}) {
  return (
    <div className="swap-drafts" role="group" aria-label={caption}>
      <p className="swap-drafts-caption">
        <Lightbulb size={12} aria-hidden /> {caption}
      </p>
      <ul className="swap-drafts-list">
        {drafts.map((d) => (
          <li key={d.tone}>
            <button type="button" className="swap-chip" title={d.text} onClick={() => onPick(d)}>
              {d.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Three starter messages for a swap request.
 *
 * Tapping a chip puts the draft in the message box the parent owns (`value`
 * and `onChange`); the person edits it and presses Send themselves. Nothing
 * here sends, submits or queues a request.
 */
export default function IcebreakerDrafts({
  value,
  onChange,
  textareaId,
  ...input
}: IcebreakerInput & {
  /** The message box's current text. */
  value: string;
  onChange: (next: string) => void;
  /** Where focus goes after a draft is inserted, so the person lands in the box to edit. */
  textareaId?: string;
}) {
  const tx = useTx();
  const last = useRef<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const drafts = buildIcebreakers(input, tx);
  if (drafts.length === 0) return null;

  return (
    <div className="mt-2">
      <DraftChips
        caption={tx("Suggestion - edit before sending")}
        drafts={drafts}
        onPick={(d) => {
          onChange(applyDraft(value, d.text, last.current));
          last.current = d.text;
          setAnnounce(tx("Suggestion added to your note. Edit it, then press Send."));
          if (textareaId && typeof document !== "undefined") {
            requestAnimationFrame(() => document.getElementById(textareaId)?.focus());
          }
        }}
      />
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
