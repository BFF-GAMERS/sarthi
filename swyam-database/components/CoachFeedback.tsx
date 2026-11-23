import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTx } from "../lib/i18n";
import { requireSupabase } from "../lib/supabase";

export type CoachKind = "school" | "college" | "career";

const missingTable = (e: { code?: string; message: string }) =>
  e.code === "42P01" || e.code === "PGRST205" || /does not exist|find the table/i.test(e.message);

async function sendFeedback(profileId: string, kind: CoachKind, helpful: boolean, note: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("coach_feedback").insert({
    profile_id: profileId,
    kind,
    helpful,
    note: note.trim().slice(0, 500) || null,
  });
  if (error) {
    if (missingTable(error)) throw new Error("Feedback is not switched on for this site yet.");
    throw new Error(error.message);
  }
}

/**
 * "Was this helpful?" — the one thing about a coaching session that goes
 * back to the server. A thumb, and an optional line. No marks, no plan.
 */
export default function CoachFeedback({ kind }: { kind: CoachKind }) {
  const tx = useTx();
  const { profileId } = useAuth();
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  const send = useMutation({
    mutationFn: () => sendFeedback(profileId!, kind, helpful!, note),
  });

  if (send.isSuccess) {
    return (
      <div className="mt-6 rounded-2xl border border-ink-line p-4 print:hidden">
        <p className="inline-flex items-center gap-2 font-body text-[13.5px] text-ink">
          <Check size={15} className="text-emeraldx-400" aria-hidden />
          {tx("Thank you. It goes to the people who tune the coach.")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-ink-line p-4 print:hidden">
      <p className="font-body text-[13.5px] font-semibold text-ink">
        {tx("Was this plan helpful?")}
      </p>
      <p className="mt-0.5 font-body text-[12px] text-ink-mute">
        {tx("Only your answer is sent — not your marks, not the plan.")}
      </p>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={tx("Was this plan helpful?")}
      >
        <button
          type="button"
          role="radio"
          aria-checked={helpful === true}
          onClick={() => setHelpful(true)}
          className={`filter-pill !h-10 ${helpful === true ? "!bg-ink !text-paper" : ""}`}
        >
          <ThumbsUp size={14} aria-hidden /> {tx("Yes")}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={helpful === false}
          onClick={() => setHelpful(false)}
          className={`filter-pill !h-10 ${helpful === false ? "!bg-ink !text-paper" : ""}`}
        >
          <ThumbsDown size={14} aria-hidden /> {tx("Not really")}
        </button>
      </div>
      {helpful !== null && (
        <div className="mt-3">
          <label htmlFor="coach-feedback-note" className="datum">
            {helpful ? tx("What helped most?") : tx("What was missing or wrong?")}{" "}
            <span className="font-normal normal-case text-ink-mute">({tx("optional")})</span>
          </label>
          <textarea
            id="coach-feedback-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={2}
            className="input mt-1.5 resize-none !text-[13px]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => send.mutate()}
              disabled={send.isPending || !profileId}
              className="btn-primary !py-2 !text-xs"
            >
              {send.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {tx("Send")}
            </button>
            {send.isError && (
              <p className="font-body text-[12px] text-danger">{(send.error as Error).message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
