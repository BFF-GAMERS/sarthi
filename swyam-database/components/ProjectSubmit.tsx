import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Send } from "lucide-react";
import { getSubmission, submitProject, submissionState, type SubmissionState } from "../lib/learn";
import { useTx } from "../lib/i18n";

/**
 * Handing in the final project.
 *
 * The state is read off the row rather than stored: no `submitted_at` means
 * not started, a date means submitted and waiting, and a `graded_at` means
 * reviewed. Nothing here can claim a state the data does not support — which
 * is the point, since "Under review" is the easiest thing in an LMS to fake.
 *
 * Editing stays open until it is graded. Being able to fix a broken link
 * before anyone has looked is the difference between a submission system and
 * a trapdoor.
 */

const LABEL: Record<SubmissionState, { text: string; tone: string }> = {
  not_started: { text: "Not started", tone: "text-ink-mute" },
  submitted: { text: "Submitted — waiting for review", tone: "text-saffron-700" },
  under_review: { text: "Under review", tone: "text-saffron-700" },
  completed: { text: "Reviewed", tone: "text-emeraldx-400" },
};

export default function ProjectSubmit({
  enrollmentId,
  lessonId,
}: {
  enrollmentId: string;
  lessonId: string;
}) {
  const tx = useTx();
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ["submission", enrollmentId, lessonId],
    queryFn: () => getSubmission(enrollmentId, lessonId),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const s = existing.data;
    if (!s) return;
    setTitle(s.title);
    setBody(s.body);
    setUrl(s.url);
  }, [existing.data]);

  const send = useMutation({
    mutationFn: () => submitProject(enrollmentId, lessonId, { title, body, url }),
    onSuccess: () => {
      setError("");
      void qc.invalidateQueries({ queryKey: ["submission", enrollmentId, lessonId] });
      void qc.invalidateQueries({ queryKey: ["completion"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const state = submissionState(existing.data ?? null);
  const graded = state === "completed";
  const label = LABEL[state];

  return (
    <div className="mt-7 rounded-2xl border border-ink-line bg-paper-light p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="datum">{tx("Your submission")}</p>
        <span className={`flex items-center gap-1.5 font-body text-[12px] ${label.tone}`}>
          {state === "completed" ? (
            <CheckCircle2 size={13} aria-hidden />
          ) : state === "not_started" ? null : (
            <Clock size={13} aria-hidden />
          )}
          {tx(label.text)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="proj-title" className="mb-1.5 block text-sm font-medium text-ink-soft">
            {tx("Project title")}
          </label>
          <input
            id="proj-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={graded}
            placeholder={tx("A booking app for local clinics")}
            className="input disabled:opacity-70"
          />
        </div>

        <div>
          <label htmlFor="proj-url" className="mb-1.5 block text-sm font-medium text-ink-soft">
            {tx("Figma link")}
          </label>
          <input
            id="proj-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={graded}
            inputMode="url"
            placeholder="https://www.figma.com/file/…"
            className="input disabled:opacity-70"
          />
          <p className="mt-1 font-body text-[11px] text-ink-mute">
            {tx("Set sharing to “Anyone with the link can view”, or the reviewer sees nothing.")}
          </p>
        </div>

        <div>
          <label htmlFor="proj-body" className="mb-1.5 block text-sm font-medium text-ink-soft">
            {tx("What you designed, and what you learned")}
          </label>
          <textarea
            id="proj-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={graded}
            rows={5}
            className="input disabled:opacity-70"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 font-body text-[13px] text-saffron-700">
          {error}
        </p>
      )}

      {existing.data?.feedback && (
        <div className="mt-4 rounded-xl border border-emeraldx-400/30 bg-emeraldx-400/10 p-4">
          <p className="datum">{tx("Reviewer feedback")}</p>
          <p className="mt-1.5 font-body text-[14px] leading-relaxed text-ink-soft">
            {existing.data.feedback}
          </p>
          {existing.data.grade !== null && (
            <p className="mt-1.5 font-mono text-[12px] text-ink">
              {tx("Grade")}: {existing.data.grade}
            </p>
          )}
        </div>
      )}

      {!graded && (
        <button
          onClick={() => send.mutate()}
          disabled={send.isPending}
          className="btn-primary mt-5 !py-2.5 !text-xs disabled:opacity-60"
        >
          {send.isPending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Send size={14} aria-hidden />
          )}
          {state === "not_started" ? tx("Submit project") : tx("Update submission")}
        </button>
      )}
    </div>
  );
}
