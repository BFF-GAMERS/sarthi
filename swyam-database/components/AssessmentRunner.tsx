import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Clock, Loader2, X } from "lucide-react";
import {
  assessmentStanding,
  saveAnswer,
  startAttempt,
  submitAttempt,
  type AssessmentSummary,
  type AttemptResult,
  type OpenAttempt,
} from "../lib/assessments";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../context/AuthContext";
import { captureWrongAnswers } from "../lib/learning/capture";
import { scopeFor } from "../lib/learning/mistakes";
import Portal from "./Portal";
import { useTx } from "../lib/i18n";
import { EV } from "@/evolution";
import { trackOnce } from "@/evolution/runtime/tracker/track";

/**
 * Sitting the assessment.
 *
 * One question at a time rather than a long scrolling paper. Most of the
 * people this is for are on a phone, and a single prompt with four large touch
 * targets is the difference between an exam and a fight with a viewport. The
 * rail across the top is the map, and it doubles as navigation so nobody is
 * trapped in a linear march.
 *
 * Every answer is written to the server the moment it is chosen. That is the
 * whole reason there is no "save" button: a flat battery, a dropped signal or
 * a closed tab mid-exam should not cost one of two attempts, and on the
 * connections this is designed for that is not a rare case.
 *
 * The score is never computed here. The client cannot read the answer key —
 * it is in a table no browser role can select — so this component genuinely
 * does not know whether an answer is right until the server says so.
 */

function useCountdown(expiresAt: string | null): number | null {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return left;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function AssessmentRunner({
  assessment,
  onClose,
  onPassed,
  source,
}: {
  assessment: AssessmentSummary;
  onClose: () => void;
  /** Fired once on a pass, so the course page can offer the certificate. */
  onPassed?: () => void;
  /** Where the learner met this check, shown in their mistake notebook. Defaults to the title. */
  source?: string;
}) {
  const tx = useTx();
  const { profileId } = useAuth();
  const qc = useQueryClient();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;

  const [attempt, setAttempt] = useState<OpenAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [at, setAt] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const standing = useQuery({
    queryKey: ["assessment-standing", assessment.id],
    queryFn: () => assessmentStanding(assessment.id),
  });

  const begin = useMutation({
    mutationFn: () => startAttempt(assessment.id),
    onSuccess: (a) => {
      setAttempt(a);
      setAnswers(a.answers);
      // Resume on the first unanswered question, not back at the start.
      const first = a.questions.findIndex((q) => a.answers[q.id] === undefined);
      setAt(first === -1 ? 0 : first);
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  const hand = useMutation({
    mutationFn: () => submitAttempt(attempt!.id),
    onSuccess: (r) => {
      setResult(r);
      // Wrong answers go to the learner's own on-device notebook. Best effort:
      // it never blocks or changes the result screen.
      if (attempt) {
        void captureWrongAnswers({
          scope: scopeFor(profileId),
          attemptId: attempt.id,
          assessmentId: assessment.id,
          source: source ?? assessment.title,
          questions: attempt.questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            options: q.options,
          })),
          answers,
        });
      }
      void qc.invalidateQueries({ queryKey: ["assessment-standing", assessment.id] });
      void qc.invalidateQueries({ queryKey: ["certificates"] });
      if (r.passed) {
        trackOnce(`practice:assessment:${assessment.id}`, EV.PRACTICE_COMPLETED, {
          surface: "assessment",
        });
        onPassed?.();
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const left = useCountdown(attempt?.expiresAt ?? null);

  // Time up hands the paper in as it stands, which is what an invigilator
  // does. Losing the attempt entirely would be a harsher rule than the one
  // written on the tin.
  const handRef = useRef(hand);
  handRef.current = hand;
  useEffect(() => {
    if (left === 0 && attempt && !result && !handRef.current.isPending) {
      handRef.current.mutate();
    }
  }, [left, attempt, result]);

  const questions = attempt?.questions ?? [];
  const current = questions[at];
  const answered = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );

  const choose = (questionId: string, index: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: index }));
    // Fire and forget: a failed write is retried by the next choice, and
    // blocking the UI on the network would make the exam feel broken.
    void saveAnswer(attempt!.id, questionId, index).catch(() => {
      setError(tx("That answer could not be saved. Check your connection."));
    });
  };

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={assessment.title}
        className="fixed inset-0 z-[90] flex flex-col bg-paper"
      >
        {/* ── Bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-ink-line px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm tracking-tight text-ink">
              {assessment.title}
            </p>
            <p className="font-body text-[11px] text-ink-mute">
              {result
                ? tx("Result")
                : attempt
                  ? `${answered}/${questions.length} ${tx("answered")} · ${tx("pass mark")} ${assessment.passScore}%`
                  : tx("Before you start")}
            </p>
          </div>

          {left !== null && !result && (
            <span
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[12px] tabular-nums ${
                left < 60 ? "bg-saffron-500 text-on-accent" : "bg-paper-dim text-ink-soft"
              }`}
              // Announced at the minute, not every second.
              aria-live={left < 60 ? "assertive" : "off"}
            >
              <Clock size={13} aria-hidden />
              {mmss(left)}
            </span>
          )}

          <button
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-ink-mute transition-colors hover:bg-paper-dim hover:text-ink"
            aria-label={tx("Close")}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* ── Question rail ───────────────────────────────────── */}
        {attempt && !result && (
          <div className="flex gap-1 overflow-x-auto border-b border-ink-line px-4 py-2 sm:px-6">
            {questions.map((q, i) => {
              const done = answers[q.id] !== undefined;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setAt(i);
                    setReviewing(false);
                  }}
                  aria-label={`${tx("Question")} ${i + 1}${done ? ` — ${tx("answered")}` : ""}`}
                  aria-current={i === at}
                  className={`h-1.5 min-w-[1.75rem] flex-1 rounded-full transition-colors ${
                    i === at ? "bg-ink" : done ? "bg-emeraldx-400" : "bg-ink/12 hover:bg-ink/25"
                  }`}
                />
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto" data-lenis-prevent>
          <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-6">
            {error && (
              <p
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-xl border border-saffron-200 bg-saffron-50 px-4 py-3 font-body text-[13px] text-saffron-700"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            {/* ── Result ────────────────────────────────────── */}
            {result ? (
              <Result result={result} passScore={assessment.passScore} onClose={onClose} tx={tx} />
            ) : !attempt ? (
              /* ── Briefing ───────────────────────────────── */
              <Briefing
                assessment={assessment}
                standing={standing.data ?? null}
                loading={standing.isLoading}
                starting={begin.isPending}
                onStart={() => begin.mutate()}
                tx={tx}
              />
            ) : reviewing ? (
              /* ── Review before handing in ───────────────── */
              <div>
                <h2 className="font-display text-xl tracking-tight text-ink">
                  {tx("Ready to hand in?")}
                </h2>
                <p className="mt-2 font-body text-sm text-ink-soft">
                  {answered === questions.length
                    ? tx("Every question is answered. You cannot change them afterward.")
                    : `${questions.length - answered} ${tx("still unanswered. Those score zero.")}`}
                </p>

                <ul className="mt-5 space-y-1.5">
                  {questions.map((q, i) => (
                    <li key={q.id}>
                      <button
                        onClick={() => {
                          setAt(i);
                          setReviewing(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-ink-line bg-paper-light px-3.5 py-2.5 text-left transition-colors hover:border-saffron-200"
                      >
                        <span className="font-mono text-[11px] tabular-nums text-ink-mute">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-body text-[13px] text-ink">
                          {q.prompt}
                        </span>
                        {answers[q.id] !== undefined ? (
                          <Check size={15} className="shrink-0 text-emeraldx-400" aria-hidden />
                        ) : (
                          <span className="shrink-0 font-body text-[11px] text-saffron-600">
                            {tx("Skipped")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => hand.mutate()}
                    disabled={hand.isPending}
                    className="btn-primary disabled:opacity-60"
                  >
                    {hand.isPending && <Loader2 size={15} className="animate-spin" aria-hidden />}
                    {tx("Hand in")}
                  </button>
                  <button onClick={() => setReviewing(false)} className="btn-ghost">
                    {tx("Keep going")}
                  </button>
                </div>
              </div>
            ) : current ? (
              /* ── One question ───────────────────────────── */
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  initial={still ? false : { opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={still ? undefined : { opacity: 0, x: -18 }}
                  transition={{ duration: still ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                    {tx("Question")} {at + 1} / {questions.length}
                  </p>
                  <h2 className="mt-3 whitespace-pre-line font-body text-lg font-medium leading-snug text-ink sm:text-xl">
                    {current.prompt}
                  </h2>

                  <div className="mt-6 space-y-2.5" role="radiogroup" aria-label={current.prompt}>
                    {current.options.map((opt, i) => {
                      const picked = answers[current.id] === i;
                      return (
                        <button
                          key={i}
                          role="radio"
                          aria-checked={picked}
                          onClick={() => choose(current.id, i)}
                          className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                            picked
                              ? "border-saffron-500 bg-saffron-50"
                              : "border-ink-line bg-paper-light hover:border-saffron-200"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                              picked ? "border-saffron-500 bg-saffron-500" : "border-ink-line"
                            }`}
                          >
                            {picked && <Check size={12} className="text-white" />}
                          </span>
                          <span className="font-body text-[15px] leading-snug text-ink">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : null}
          </div>
        </div>

        {/* ── Footer nav ──────────────────────────────────────── */}
        {attempt && !result && !reviewing && (
          <div className="flex items-center gap-2 border-t border-ink-line px-4 py-3 sm:px-6">
            <button
              onClick={() => setAt((i) => Math.max(0, i - 1))}
              disabled={at === 0}
              className="btn-ghost !px-3 !py-2 !text-xs disabled:opacity-40"
            >
              <ChevronLeft size={15} aria-hidden /> {tx("Back")}
            </button>
            <span className="flex-1" />
            {at === questions.length - 1 ? (
              <button onClick={() => setReviewing(true)} className="btn-primary !py-2 !text-xs">
                {tx("Review")}
              </button>
            ) : (
              <button
                onClick={() => setAt((i) => Math.min(questions.length - 1, i + 1))}
                className="btn-primary !py-2 !text-xs"
              >
                {tx("Next")} <ChevronRight size={15} aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
    </Portal>
  );
}

/** What the learner is told before committing one of a small number of tries. */
function Briefing({
  assessment,
  standing,
  loading,
  starting,
  onStart,
  tx,
}: {
  assessment: AssessmentSummary;
  standing: Awaited<ReturnType<typeof assessmentStanding>>;
  loading: boolean;
  starting: boolean;
  onStart: () => void;
  tx: (s: string) => string;
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 font-body text-sm text-ink-mute">
        <Loader2 size={15} className="animate-spin" aria-hidden />
        {tx("Checking your attempts…")}
      </p>
    );
  }

  const attemptsLeft =
    standing?.maxAttempts != null ? standing.maxAttempts - standing.attemptsUsed : null;
  const locked = standing?.readyAt ? new Date(standing.readyAt) : null;
  const blocked = Boolean(standing?.passed) || attemptsLeft === 0 || Boolean(locked);

  return (
    <div>
      <h2 className="font-display text-2xl tracking-tight text-ink">{assessment.title}</h2>
      {assessment.description && (
        <p className="mt-3 font-body text-sm leading-relaxed text-ink-soft">
          {assessment.description}
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink-line py-5 sm:grid-cols-4">
        {[
          [tx("Questions"), String(standing?.questionCount ?? assessment.questionCount)],
          [tx("Pass mark"), `${assessment.passScore}%`],
          [
            tx("Time"),
            assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : tx("No limit"),
          ],
          [
            tx("Attempts"),
            attemptsLeft === null ? tx("Unlimited") : `${attemptsLeft} ${tx("left")}`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">{label}</dt>
            <dd className="mt-1 font-display text-lg text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {standing?.passed ? (
        <p className="mt-5 rounded-xl border border-emeraldx-400/30 bg-emeraldx-400/10 px-4 py-3 font-body text-[13px] text-ink">
          {tx("You have already passed this")}
          {standing.bestScore !== null ? ` — ${standing.bestScore}%.` : "."}{" "}
          {tx("It counts toward teaching this skill.")}
        </p>
      ) : locked ? (
        <p className="mt-5 rounded-xl border border-ink-line bg-paper-light px-4 py-3 font-body text-[13px] text-ink-soft">
          {tx("The next attempt opens at")}{" "}
          <span className="font-medium text-ink">
            {locked.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </span>
          . {tx("Use the time to go back over the lessons.")}
        </p>
      ) : attemptsLeft === 0 ? (
        <p className="mt-5 rounded-xl border border-ink-line bg-paper-light px-4 py-3 font-body text-[13px] text-ink-soft">
          {tx("No attempts left on this assessment.")}
        </p>
      ) : (
        <p className="mt-5 font-body text-[13px] leading-relaxed text-ink-soft">
          {tx(
            "Answers save as you choose them, so you can close this and come back. Starting uses one attempt.",
          )}
        </p>
      )}

      {!blocked && (
        <button
          onClick={onStart}
          disabled={starting}
          className="btn-primary mt-6 disabled:opacity-60"
        >
          {starting && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {standing?.openAttempt ? tx("Resume attempt") : tx("Start")}
        </button>
      )}
    </div>
  );
}

/** Pass or fail, and what it changes. */
function Result({
  result,
  passScore,
  onClose,
  tx,
}: {
  result: AttemptResult;
  passScore: number;
  onClose: () => void;
  tx: (s: string) => string;
}) {
  return (
    <div className="text-center">
      <motion.p
        initial={{ scale: 0.9, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className={`font-display text-6xl leading-none ${
          result.passed ? "text-emeraldx-400" : "text-saffron-600"
        }`}
      >
        {result.score}%
      </motion.p>
      <h2 className="mt-4 font-display text-2xl tracking-tight text-ink">
        {result.passed ? tx("Passed") : tx("Not this time")}
      </h2>
      <p className="mx-auto mt-3 max-w-md font-body text-sm leading-relaxed text-ink-soft">
        {result.passed
          ? tx(
              "This is on your record as proof of the skill, and it counts toward being able to teach it.",
            )
          : `${tx("The pass mark is")} ${passScore}%. ${tx("Go back over the lessons — a wrong answer costs you nothing on your record.")}`}
      </p>
      <button onClick={onClose} className="btn-primary mt-7">
        {tx("Done")}
      </button>
    </div>
  );
}
