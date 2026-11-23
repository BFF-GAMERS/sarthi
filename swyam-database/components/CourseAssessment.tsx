import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Lock, Timer } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { assessmentStanding, listCourseAssessments } from "../lib/assessments";
import AssessmentRunner from "./AssessmentRunner";
import { useTx } from "../lib/i18n";

/**
 * The exam section on a course page.
 *
 * Renders nothing at all when the course has no published assessment, which is
 * most of them for now — an empty "Assessment" heading would read as something
 * broken rather than something not written yet.
 *
 * This is the piece that connects the two halves of the platform. Finishing
 * the lessons proves you turned up; passing this is what puts an `assessment`
 * row on your skill record, and that — together with the completed course — is
 * what the verification ladder needs before it will let you teach the skill.
 * Without it the whole trainer path was unreachable no matter how much anyone
 * studied.
 */
export default function CourseAssessment({ courseSlug }: { courseSlug: string }) {
  const tx = useTx();
  const { user } = useAuth();
  const [running, setRunning] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["course-assessments", courseSlug],
    queryFn: () => listCourseAssessments(courseSlug),
  });

  const assessments = list.data ?? [];
  if (list.isLoading || assessments.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-ink">{tx("Assessment")}</h2>
      <p className="mt-2 font-body text-sm text-ink-soft">
        {tx(
          "Pass this and the certificate is issued — and the skill counts toward being able to teach it.",
        )}
      </p>

      <div className="mt-5 space-y-3">
        {assessments.map((a) => (
          <AssessmentCard
            key={a.id}
            assessment={a}
            signedIn={Boolean(user)}
            onStart={() => setRunning(a.id)}
          />
        ))}
      </div>

      {running && (
        <AssessmentRunner
          assessment={assessments.find((a) => a.id === running)!}
          onClose={() => setRunning(null)}
        />
      )}
    </div>
  );
}

function AssessmentCard({
  assessment,
  signedIn,
  onStart,
}: {
  assessment: ReturnType<typeof Object> extends never
    ? never
    : import("../lib/assessments").AssessmentSummary;
  signedIn: boolean;
  onStart: () => void;
}) {
  const tx = useTx();

  // Only asked for once somebody is signed in — it is a per-person answer, and
  // for a logged-out visitor there is nothing to report.
  const standing = useQuery({
    queryKey: ["assessment-standing", assessment.id],
    queryFn: () => assessmentStanding(assessment.id),
    enabled: signedIn,
  });

  const s = standing.data;
  const passed = Boolean(s?.passed);

  return (
    <div className="card flex flex-wrap items-center gap-4 p-5">
      <span
        aria-hidden
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
          passed ? "bg-emeraldx-400/15 text-emeraldx-400" : "bg-saffron-50 text-saffron-500"
        }`}
      >
        {passed ? <Award size={20} /> : <Timer size={20} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-body text-[15px] font-medium text-ink">{assessment.title}</p>
        <p className="mt-0.5 font-body text-[12px] text-ink-mute">
          {assessment.questionCount} {tx("questions")} · {tx("pass at")} {assessment.passScore}%
          {assessment.timeLimitMinutes ? ` · ${assessment.timeLimitMinutes} min` : ""}
          {passed && s?.bestScore !== null && s?.bestScore !== undefined
            ? ` · ${tx("you scored")} ${s.bestScore}%`
            : ""}
        </p>
      </div>

      {!signedIn ? (
        <span className="flex shrink-0 items-center gap-1.5 font-body text-[12px] text-ink-mute">
          <Lock size={13} aria-hidden /> {tx("Log in to take this")}
        </span>
      ) : (
        <button onClick={onStart} className="btn-primary shrink-0 !py-2.5 !text-xs">
          {passed ? tx("View result") : s?.openAttempt ? tx("Resume") : tx("Take assessment")}
        </button>
      )}
    </div>
  );
}
