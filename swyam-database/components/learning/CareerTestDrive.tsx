import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, RotateCcw } from "lucide-react";
import { useTx } from "../../lib/i18n";
import { scopeFor } from "../../lib/learning/mistakes";
import {
  clearDrive,
  loadDrive,
  MAX_NOTE,
  saveDrive,
  summarise,
  type DriveAnswer,
  type Feel,
} from "../../lib/learning/testdrive";
import {
  driveFor,
  DRIVE_LABELS,
  type DriveCareer,
  type DriveMaterial,
  type DriveTask,
} from "../../data/career-test-drive";

/**
 * A short taste of the job.
 *
 * Two to three real mini-tasks, three to five minutes each. It is a taste, not
 * a test: nothing is graded, nothing is a certificate, and nothing leaves this
 * device. The learner says how each task felt, and the summary points at
 * courses that already exist.
 */

export default function CareerTestDrive({
  slug,
  profileId,
}: {
  slug: string;
  profileId: string | null;
}) {
  const career = driveFor(slug);
  return career ? <Drive key={slug} career={career} scope={scopeFor(profileId)} /> : null;
}

type View = "intro" | "task" | "summary";

function Drive({ career, scope }: { career: DriveCareer; scope: string }) {
  const tx = useTx();
  const [view, setView] = useState<View>("intro");
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DriveAnswer>>({});
  const head = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    const saved = loadDrive(scope, career.slug);
    if (!saved) return;
    setAnswers(saved.answers);
    const first = career.tasks.findIndex((t) => !saved.answers[t.id]);
    if (first === -1) setView("summary");
    else setAt(first);
  }, [scope, career]);

  // Move focus to the new step's heading, but only after the learner moved
  // (never on page load, when a saved summary is restored).
  useEffect(() => {
    if (moved.current) head.current?.focus();
  }, [view, at]);

  const minutes = career.tasks.reduce((n, t) => n + t.minutes, 0);
  const doneCount = career.tasks.filter((t) => answers[t.id]).length;
  const task = career.tasks[at];

  const commit = (id: string, a: DriveAnswer) => {
    moved.current = true;
    const next = { ...answers, [id]: a };
    setAnswers(next);
    saveDrive(scope, career.slug, { ts: Date.now(), answers: next });
    if (at + 1 >= career.tasks.length) setView("summary");
    else setAt(at + 1);
  };

  const retake = () => {
    moved.current = true;
    clearDrive(scope, career.slug);
    setAnswers({});
    setAt(0);
    setView("intro");
  };

  return (
    <section aria-labelledby="drive-title" className="panel p-5 sm:p-6">
      <p className="datum">{tx("Try it first")}</p>
      <h2
        id="drive-title"
        ref={view === "intro" ? head : undefined}
        tabIndex={view === "intro" ? -1 : undefined}
        className="mt-1 font-display text-xl tracking-tight text-ink outline-none"
      >
        {tx("A short taste of this job")}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={tx("What this is and is not")}>
        {DRIVE_LABELS.map((l) => (
          <li key={l} className="chip !text-[11px]">
            {tx(l)}
          </li>
        ))}
      </ul>

      {view === "intro" && (
        <div className="mt-4">
          <p className="font-body text-[14px] leading-relaxed text-ink-soft">{career.intro}</p>
          <ol className="mt-3 space-y-1.5">
            {career.tasks.map((t, n) => (
              <li key={t.id} className="flex items-baseline gap-2 font-body text-[13.5px] text-ink">
                <span className="font-mono text-[11px] tabular-nums text-ink-mute">{n + 1}</span>
                <span className="flex-1">{t.title}</span>
                <span className="font-mono text-[11px] text-ink-mute">
                  {t.minutes} {tx("min")}
                </span>
                {answers[t.id] && (
                  <Check size={13} className="text-ink-mute" aria-label={tx("Done")} />
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              moved.current = true;
              if (doneCount >= career.tasks.length) setView("summary");
              else setView("task");
            }}
            className="btn-primary mt-5 !py-2.5 !text-xs"
          >
            {doneCount > 0 ? tx("Continue") : tx("Start")} ({minutes} {tx("min in all")})
            <ArrowRight size={13} aria-hidden />
          </button>
        </div>
      )}

      {view === "task" && task && (
        <TaskStep
          key={task.id}
          task={task}
          index={at}
          total={career.tasks.length}
          headRef={head}
          initial={answers[task.id]}
          last={at + 1 >= career.tasks.length}
          tx={tx}
          onNext={(a) => commit(task.id, a)}
          onLeave={() => {
            moved.current = true;
            setView("intro");
          }}
        />
      )}

      {view === "summary" && (
        <Summary career={career} answers={answers} headRef={head} tx={tx} onRetake={retake} />
      )}
    </section>
  );
}

function Material({ m }: { m: DriveMaterial }) {
  return (
    <figure className="mt-4">
      {m.kind === "table" && m.header && m.rows && (
        <div
          role="region"
          aria-label={m.title}
          tabIndex={0}
          className="overflow-x-auto rounded-xl border border-ink-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron-500"
        >
          <table className="w-full min-w-[20rem] border-collapse text-left font-body text-[13px] text-ink">
            <caption className="sr-only">{m.title}</caption>
            <thead>
              <tr className="bg-paper-dim">
                {m.header.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r, n) => (
                <tr key={n} className="border-t border-ink-line">
                  {r.map((c, k) => (
                    <td key={k} className="px-3 py-2 tabular-nums">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.kind === "code" && (
        <pre
          role="region"
          aria-label={m.title}
          tabIndex={0}
          className="overflow-x-auto rounded-xl border border-ink-line bg-paper-dim p-3 font-mono text-[12px] leading-relaxed text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron-500"
        >
          {(m.lines ?? []).join("\n")}
        </pre>
      )}
      {m.kind === "list" && (
        <ul
          aria-label={m.title}
          className="space-y-1 rounded-xl border border-ink-line bg-paper-dim p-3 font-body text-[13px] text-ink"
        >
          {(m.lines ?? []).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <figcaption className="mt-1.5 font-body text-[12px] text-ink-mute">{m.title}</figcaption>
    </figure>
  );
}

function TaskStep({
  task,
  index,
  total,
  headRef,
  initial,
  last,
  tx,
  onNext,
  onLeave,
}: {
  task: DriveTask;
  index: number;
  total: number;
  headRef: React.RefObject<HTMLHeadingElement | null>;
  initial?: DriveAnswer;
  last: boolean;
  tx: (s: string) => string;
  onNext: (a: DriveAnswer) => void;
  onLeave: () => void;
}) {
  const [pick, setPick] = useState<number | null>(initial?.pick ?? null);
  const [text, setText] = useState(initial?.text ?? "");
  const [ticks, setTicks] = useState<number[]>(initial?.ticks ?? []);
  const [revealed, setRevealed] = useState(false);
  const [feel, setFeel] = useState<Feel | undefined>(initial?.feel);

  const feels: Array<[Feel, string]> = [
    ["enjoyed", tx("I enjoyed this")],
    ["ok", tx("It was okay")],
    ["tricky", tx("Tricky for me")],
  ];

  return (
    <div className="mt-4">
      <p className="font-mono text-[11px] tabular-nums text-ink-mute">
        {tx("Task")} {index + 1} {tx("of")} {total} · {task.minutes} {tx("min")} · {task.skill}
      </p>
      <h3
        ref={headRef}
        tabIndex={-1}
        className="mt-1 font-display text-lg tracking-tight text-ink outline-none"
      >
        {task.title}
      </h3>
      <p className="mt-2 font-body text-[14px] leading-relaxed text-ink-soft">{task.scenario}</p>
      {task.material && <Material m={task.material} />}
      <p className="mt-4 font-body text-[14.5px] font-medium text-ink">{task.prompt}</p>

      {task.kind === "choice" && task.options && (
        <>
          <fieldset className="mt-3" disabled={revealed}>
            <legend className="sr-only">{task.prompt}</legend>
            <div className="space-y-2">
              {task.options.map((o, n) => (
                <label key={n} className={`evo-learn-option ${pick === n ? "evo-learn-on" : ""}`}>
                  <input
                    type="radio"
                    name={`drive-${task.id}`}
                    checked={pick === n}
                    onChange={() => setPick(n)}
                    className="mt-1 accent-[var(--color-saffron-500)]"
                  />
                  <span className="font-body text-[14px] leading-snug text-ink">{o.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {!revealed ? (
            <button
              type="button"
              disabled={pick === null}
              onClick={() => setRevealed(true)}
              className="btn-primary mt-4 !py-2.5 !text-xs disabled:opacity-60"
            >
              {tx("Show me why")}
            </button>
          ) : (
            <ul role="status" aria-live="polite" className="mt-4 space-y-2">
              {task.options.map((o, n) => (
                <li
                  key={n}
                  className="rounded-xl border border-ink-line p-3 font-body text-[13px] leading-relaxed text-ink-soft"
                >
                  <span className="font-medium text-ink">
                    {n === task.answer ? tx("Best answer") : tx("Not quite")}
                    {n === pick ? ` · ${tx("your pick")}` : ""}:
                  </span>{" "}
                  {o.why}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {task.kind === "selfcheck" && (
        <>
          <label className="mt-3 block">
            <span className="sr-only">{tx("Your answer")}</span>
            <textarea
              value={text}
              maxLength={MAX_NOTE}
              rows={4}
              onChange={(e) => setText(e.target.value)}
              placeholder={task.placeholder}
              readOnly={revealed}
              className="w-full rounded-xl border border-ink-line bg-paper-light p-3 font-body text-[14px] text-ink placeholder:text-ink-mute focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron-500"
            />
          </label>
          <p className="mt-1 font-body text-[12px] text-ink-mute">
            {tx("Stays on this device. You can leave it empty and think it through instead.")}
          </p>
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="btn-primary mt-3 !py-2.5 !text-xs"
            >
              {tx("Show a model answer")}
            </button>
          ) : (
            <div role="status" aria-live="polite" className="mt-4">
              <p className="rounded-xl border border-ink-line bg-paper-dim p-3 font-body text-[13.5px] leading-relaxed text-ink">
                <span className="font-medium">{tx("One good answer")}:</span> {task.model}
              </p>
              <fieldset className="mt-3">
                <legend className="font-body text-[13px] text-ink-soft">
                  {tx("Tick what your answer did. There is no score.")}
                </legend>
                <div className="mt-2 space-y-1.5">
                  {(task.rubric ?? []).map((r, n) => (
                    <label
                      key={n}
                      className="flex items-start gap-2 font-body text-[13.5px] text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={ticks.includes(n)}
                        onChange={() =>
                          setTicks((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n]))
                        }
                        className="mt-1 accent-[var(--color-saffron-500)]"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </>
      )}

      {revealed && (
        <fieldset className="mt-5">
          <legend className="font-body text-[13px] text-ink-soft">
            {tx("How did that feel?")}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {feels.map(([k, label]) => (
              <label key={k} className={`evo-learn-pill ${feel === k ? "evo-learn-on" : ""}`}>
                <input
                  type="radio"
                  name={`feel-${task.id}`}
                  checked={feel === k}
                  onChange={() => setFeel(k)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {revealed && (
          <button
            type="button"
            onClick={() =>
              onNext({
                ...(feel ? { feel } : {}),
                ...(pick !== null && task.kind === "choice" ? { pick } : {}),
                ...(task.kind === "selfcheck" && text.trim() ? { text: text.trim() } : {}),
                ...(task.kind === "selfcheck" ? { ticks } : {}),
              })
            }
            className="btn-primary !py-2.5 !text-xs"
          >
            {last ? tx("See my summary") : tx("Next task")} <ArrowRight size={13} aria-hidden />
          </button>
        )}
        <button type="button" onClick={onLeave} className="btn-ghost !py-2.5 !text-xs">
          {tx("Stop for now")}
        </button>
      </div>
    </div>
  );
}

function Summary({
  career,
  answers,
  headRef,
  tx,
  onRetake,
}: {
  career: DriveCareer;
  answers: Record<string, DriveAnswer>;
  headRef: React.RefObject<HTMLHeadingElement | null>;
  tx: (s: string) => string;
  onRetake: () => void;
}) {
  const s = summarise(career, { ts: 0, answers });
  return (
    <div className="mt-4">
      <h3
        ref={headRef}
        tabIndex={-1}
        className="font-display text-lg tracking-tight text-ink outline-none"
      >
        {tx("What you took from it")}
      </h3>
      <p className="mt-1 font-body text-[12.5px] text-ink-mute">
        {tx("In your own words, not a grade. Saved on this device only.")}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="font-body text-[13px] font-medium text-ink">{tx("What you enjoyed")}</h4>
          {s.enjoyed.length > 0 ? (
            <ul className="mt-1.5 space-y-1 font-body text-[13.5px] text-ink-soft">
              {s.enjoyed.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-ink-mute">· {t.skill}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 font-body text-[13.5px] text-ink-soft">
              {tx("Nothing stood out yet. That is useful to know too.")}
            </p>
          )}
        </div>
        <div>
          <h4 className="font-body text-[13px] font-medium text-ink">
            {tx("What you found tricky")}
          </h4>
          {s.tricky.length > 0 ? (
            <ul className="mt-1.5 space-y-1 font-body text-[13.5px] text-ink-soft">
              {s.tricky.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-ink-mute">· {t.skill}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 font-body text-[13.5px] text-ink-soft">
              {tx("Nothing felt out of reach. A good sign, not a verdict.")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h4 className="font-body text-[13px] font-medium text-ink">{tx("A next step")}</h4>
        <p className="mt-1 font-body text-[13.5px] leading-relaxed text-ink-soft">
          {s.tricky.length > 0
            ? tx("Tricky parts are where practice pays most. A course is a gentle place to start.")
            : tx("If you want more of this, a course goes a lot deeper.")}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {career.courses.map((c) => (
            <li key={c.id}>
              <Link
                to="/courses/$id"
                params={{ id: c.id }}
                className="btn-ghost inline-flex items-center gap-1.5 !py-2 !text-xs"
              >
                <BookOpen size={13} aria-hidden /> {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" onClick={onRetake} className="btn-ghost mt-5 !py-2 !text-xs">
        <RotateCcw size={13} aria-hidden /> {tx("Retake")}
      </button>
      <p className="mt-2 font-body text-[12px] text-ink-mute">
        {tx("Retaking clears your answers here and starts fresh. Nothing is sent anywhere.")}
      </p>
    </div>
  );
}
