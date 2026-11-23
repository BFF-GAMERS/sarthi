import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ExternalLink, Loader2, PlayCircle, RotateCcw, Sparkles } from "lucide-react";
import { currentAccount } from "../lib/auth";
import { CLASS_LEVELS, chapterMeta, clearGenerated, fetchVideos, generateChapter, getChapter, getSubject, listSubjects } from "../lib/content";
import type { Chapter, ClassLevel, Lecture, Subject } from "../data/curriculum";
import { chapterStatus, getProgress, markLectureWatched, submitQuiz, type Progress } from "../lib/progress";
import AskInline from "../components/AskInline";

function parseClass(raw: string | null): ClassLevel | null {
  const n = Number(raw);
  return (CLASS_LEVELS as number[]).includes(n) ? (n as ClassLevel) : null;
}

const youtubeSearchUrl = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
export const formatViews = (n: number) =>
  n >= 1e7 ? `${(n / 1e7).toFixed(1)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} L` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);

export default function Learn() {
  const [params, setParams] = useSearchParams();
  const account = useMemo(() => currentAccount(), []);
  const classLevel: ClassLevel = parseClass(params.get("class")) ?? account?.classLevel ?? 10;
  const subjectId = params.get("subject");
  const chapterId = params.get("chapter");

  if (chapterId && getChapter(chapterId)) {
    return <ChapterView key={chapterId} chapterId={chapterId} />;
  }

  const subjects = listSubjects(classLevel);
  const subject = subjectId ? getSubject(classLevel, subjectId) : undefined;
  const own = (account?.subjects ?? []).map((s) => s.toLowerCase());
  const ordered = [...subjects].sort((a, b) => Number(own.includes(b.id)) - Number(own.includes(a.id)));
  const progress = getProgress();

  return (
    <section className="container-x py-12">
      <p className="kicker">Learning hub · CBSE</p>
      <h1 className="type-xl mt-3">Learn</h1>
      <p className="mt-2 max-w-2xl opacity-80">Board → Class → Subject → Chapter → Lectures, notes, quiz. Everything here is free.</p>

      <div role="group" aria-label="Choose class" className="mt-6 flex flex-wrap gap-2">
        {CLASS_LEVELS.map((c) => (
          <button key={c} type="button" className="filter-pill" aria-pressed={c === classLevel} onClick={() => setParams({ class: String(c) })}>
            Class {c}
          </button>
        ))}
      </div>

      {!subject && (
        <>
          <h2 className="section-title mt-10">Subjects · Class {classLevel}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((s) => {
              const done = s.chapters.filter((c) => progress.completedChapters.includes(c.id)).length;
              const pct = Math.round(s.chapters.reduce((n, c) => n + chapterStatus(c.id, undefined, progress).pct, 0) / Math.max(1, s.chapters.length));
              return (
                <Link
                  key={s.id}
                  to={`/learn?class=${classLevel}&subject=${s.id}`}
                  className="card block p-5 no-underline transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="type-lg">{s.name}</h3>
                    {own.includes(s.id) && <span className="chip-accent">Your subject</span>}
                  </div>
                  <p className="mt-2 text-sm opacity-80">
                    {s.chapters.length} chapters · {done} completed
                  </p>
                  <div className="mt-3 flex justify-between text-xs">
                    <span className="opacity-75">Progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="progress-track mt-1.5" role="progressbar" aria-label={`${s.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {subject && <ChapterList subject={subject} classLevel={classLevel} progress={progress} />}
    </section>
  );
}

function ChapterList({ subject, classLevel, progress }: { subject: Subject; classLevel: ClassLevel; progress: Progress }) {
  return (
    <>
      <p className="mt-6">
        <Link to={`/learn?class=${classLevel}`} className="btn-text">
          ← All subjects
        </Link>
      </p>
      <h2 className="type-lg mt-4">
        {subject.name} · Class {classLevel}
      </h2>
      <div className="mt-6 grid gap-3">
        {subject.chapters.map((c) => {
          const st = chapterStatus(c.id, undefined, progress);
          return (
            <Link
              key={c.id}
              to={`/learn?chapter=${c.id}`}
              className="card-flat flex items-center gap-4 p-4 no-underline transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-saffron-500)]"
            >
              <span className="stat-figure !text-2xl w-10 shrink-0 text-center" aria-hidden="true">
                {c.number}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">
                  <span className="text-xs font-normal opacity-60">Module {c.number} · </span>
                  {c.title}
                </h3>
                <p className="text-sm opacity-75">
                  {c.source === "pending" ? "Notes & quiz prepared by Sarthi on first open" : `${c.topics.length} topics · ${c.quiz.length} quiz questions`}
                  {st.bestScorePct !== null && ` · best quiz ${st.bestScorePct}%`}
                </p>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="opacity-75">{st.completed ? "Completed" : st.pct > 0 ? "In progress" : "Not started"}</span>
                  <span>{st.pct}%</span>
                </div>
                <div className="progress-track mt-1.5" role="progressbar" aria-label={`${c.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={st.pct}>
                  <div className="progress-fill" style={{ width: `${st.pct}%` }} />
                </div>
              </div>
              {st.completed && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 size={16} aria-hidden="true" /> Completed
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}

function summarise(before: Progress, after: Progress, chapterId: string, leadIn: string): string {
  const gained = after.points - before.points;
  let msg = gained > 0 ? `${leadIn} +${gained} SkillPoints.` : leadIn;
  if (!before.completedChapters.includes(chapterId) && after.completedChapters.includes(chapterId)) msg += " 🎉 Chapter completed!";
  return msg;
}

export function ChapterView({ chapterId, embedded = false, onChange }: { chapterId: string; embedded?: boolean; onChange?: () => void }) {
  const meta = chapterMeta(chapterId);
  const [chapter, setChapter] = useState<Chapter>(() => getChapter(chapterId)!);
  const [progress, setProgress] = useState<Progress>(() => getProgress());
  const [notice, setNotice] = useState("");
  const [genState, setGenState] = useState<"idle" | "loading" | "error">("idle");
  const [genError, setGenError] = useState("");
  const status = chapterStatus(chapter.id, undefined, progress);

  async function prepare() {
    setGenState("loading");
    const res = await generateChapter(chapterId);
    if (res.ok) {
      setChapter(res.chapter);
      setGenState("idle");
    } else {
      setGenError(res.error);
      setGenState("error");
    }
  }

  const [videoNote, setVideoNote] = useState("");
  const [videosLoading, setVideosLoading] = useState(true);
  useEffect(() => {
    if (chapter.source === "pending") void prepare();
    void fetchVideos(chapterId)
      .then((r) => {
        if (r.ok) setChapter((c) => ({ ...c, lectures: r.chapter.lectures }));
        else if (r.configured) setVideoNote(r.error);
      })
      .finally(() => setVideosLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleWatch(lecture: Lecture) {
    const before = progress;
    const next = markLectureWatched(chapter.id, lecture.id);
    setProgress(next);
    setNotice(summarise(before, next, chapter.id, "Lecture marked as watched."));
  }

  function regenerate() {
    if (!confirm("Ask Sarthi to write fresh notes and a new quiz for this chapter?")) return;
    clearGenerated(chapter.id);
    setChapter(getChapter(chapterId)!);
    void prepare();
  }

  const back = meta ? `/learn?class=${meta.classLevel}&subject=${meta.subjectId}` : "/learn";

  useEffect(() => {
    onChange?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, chapter]);

  return (
    <section className={embedded ? "" : "container-x py-12"}>
      {!embedded && (
      <>
      <p className="kicker">
        CBSE · Class {meta?.classLevel} · {meta?.subjectName} · Chapter {chapter.number}
      </p>
      <h1 className="type-xl mt-3">{chapter.title}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {chapter.topics.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link to={back} className="btn-text">
          ← Back to chapters
        </Link>
        <Link to={`/sarthi?chapter=${chapter.id}`} className="btn-primary">
          Open Sarthi voice tutor
        </Link>
      </div>

      <div className="card-flat mt-6 p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            Lectures {status.lecturesWatched}/{status.lecturesTotal}
          </span>
          <span>Best quiz {status.bestScorePct === null ? "—" : `${status.bestScorePct}%`}</span>
          <span>{status.completed ? "✅ Completed" : "In progress"}</span>
        </div>
        <div className="mt-3 flex justify-between text-xs">
          <span className="opacity-75">Chapter progress</span>
          <span>{status.pct}%</span>
        </div>
        <div className="progress-track mt-1.5" role="progressbar" aria-label="Chapter progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.pct}>
          <div className="progress-fill" style={{ width: `${status.pct}%` }} />
        </div>
        <p className="mt-2 text-xs opacity-70">Complete = watch every lecture + score 60% or more in the quiz.</p>
      </div>
      </>
      )}

      <p role="status" className="mt-4 font-semibold">
        {notice}
      </p>

      {/* ── Lectures ── */}
      {!embedded && (
      <>
      <h2 className="section-title mt-8 flex items-center gap-2">
        <PlayCircle aria-hidden="true" /> Lectures
      </h2>
      {videosLoading && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm opacity-75">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Latest lectures load ho rahe hain…
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {chapter.lectures.map((lecture) => {
          const watched = progress.watched[`${chapter.id}/${lecture.id}`] === true;
          return (
            <article key={lecture.id} className="card p-5">
              <div className="flex flex-wrap gap-2">
                {lecture.oneShot && <span className="chip-accent">One shot</span>}
                {lecture.views !== undefined && <span className="chip">{formatViews(lecture.views)} views</span>}
              </div>
              <h3 className="type-lg mt-2">{lecture.title}</h3>
              <p className="mt-1 text-sm opacity-75">
                {lecture.channel ? `${lecture.channel} · ` : ""}~{lecture.durationMin} min · {watched ? "Watched" : "Not watched yet"}
              </p>
              {lecture.youtubeId && (
                <iframe
                  className="mt-4"
                  src={`https://www.youtube-nocookie.com/embed/${lecture.youtubeId}`}
                  title={lecture.title}
                  style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href={lecture.youtubeId ? `https://www.youtube.com/watch?v=${lecture.youtubeId}` : youtubeSearchUrl(lecture.searchQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost flex items-center gap-1"
                >
                  {lecture.youtubeId ? "Open on YouTube" : "Find on YouTube"} <ExternalLink size={14} />
                </a>
                <button type="button" className="btn-primary" disabled={watched} onClick={() => handleWatch(lecture)}>
                  {watched ? "✓ Watched" : "Mark as watched"}
                </button>
              </div>
              <p className="mt-3 text-xs opacity-60">Videos stream from YouTube and need internet.</p>
            </article>
          );
        })}
      </div>
      {videoNote && <p className="mt-3 text-sm opacity-70">{videoNote} Showing a YouTube search link instead.</p>}
      </>
      )}

      {/* ── Notes ── */}
      <h2 className="section-title mt-10 flex items-center gap-2">
        <BookOpen /> Notes
      </h2>
      {chapter.source === "ai" && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm opacity-80">
          <Sparkles size={14} /> Written by Sarthi AI for this chapter. Cross-check key facts with your NCERT book.
          <button type="button" className="btn-text !text-sm flex items-center gap-1" onClick={regenerate}>
            <RotateCcw size={12} /> Regenerate
          </button>
        </p>
      )}

      {chapter.source === "pending" && (
        <div className="card mt-4 p-6">
          {genState === "error" ? (
            <>
              <p className="font-semibold">Couldn’t prepare this chapter yet.</p>
              <p className="mt-1">{genError}</p>
              <button type="button" className="btn-primary mt-4" onClick={() => void prepare()}>
                Try again
              </button>
            </>
          ) : (
            <p className="flex items-center gap-3">
              <Loader2 className="animate-spin" /> Sarthi is writing notes, a summary and a quiz for this chapter… (about 10 seconds, only the first time)
            </p>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-6">
        {chapter.notes.map((section) => (
          <article key={section.heading} className="card-flat p-6">
            <h3 className="type-lg">{section.heading}</h3>
            {section.body.map((para, i) => (
              <p key={i} className="mt-3 leading-relaxed">
                {para}
              </p>
            ))}
            {section.definitions && section.definitions.length > 0 && (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {section.definitions.map((d) => (
                  <div key={d.term} className="panel p-3">
                    <dt className="font-semibold">{d.term}</dt>
                    <dd className="mt-1 text-sm">{d.meaning}</dd>
                  </div>
                ))}
              </dl>
            )}
            {section.formulas && section.formulas.length > 0 && (
              <ul className="mt-4 grid gap-2">
                {section.formulas.map((f) => (
                  <li key={f} className="panel p-3 font-mono">
                    {f}
                  </li>
                ))}
              </ul>
            )}
            {section.examples?.map((ex) => (
              <div key={ex.question} className="panel mt-4 p-4">
                <p className="font-semibold">Solved example: {ex.question}</p>
                <p className="mt-2">{ex.answer}</p>
              </div>
            ))}
          </article>
        ))}
      </div>

      {chapter.summary && chapter.summary.length > 0 && (
        <div className="card mt-6 p-6">
          <p className="kicker">Quick revision</p>
          <ul className="mt-3 grid list-disc gap-2 pl-5">
            {chapter.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {chapter.examFocus && chapter.examFocus.length > 0 && (
        <div className="card mt-6 p-6">
          <p className="kicker">Most likely in exams</p>
          <p className="mt-1 text-xs opacity-70">Sarthi’s prediction from common CBSE question patterns — not an official paper.</p>
          <ol className="mt-4 grid gap-3">
            {chapter.examFocus.map((q, i) => (
              <li key={i} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">
                    {i + 1}. {q.question}
                  </p>
                  {q.marks && <span className="chip shrink-0">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>}
                </div>
                {q.hint && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer opacity-80">Show answer hint</summary>
                    <p className="mt-1">{q.hint}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {chapter.notes.length > 0 && (
        <div className="mt-8">
          <AskInline chapter={chapter} />
        </div>
      )}

      <QuizSection chapter={chapter} progress={progress} onProgress={setProgress} onNotice={setNotice} />
    </section>
  );
}

function QuizSection({
  chapter,
  progress,
  onProgress,
  onNotice,
}: {
  chapter: Chapter;
  progress: Progress;
  onProgress: (p: Progress) => void;
  onNotice: (msg: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number; picked: number[] } | null>(null);

  if (chapter.quiz.length === 0) return null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const picked = chapter.quiz.map((q) => answers[q.id] ?? -1);
    if (picked.includes(-1) && !confirm("Some questions are unanswered. Submit anyway?")) return;
    const before = progress;
    const res = submitQuiz(chapter.id, picked);
    onProgress(res.progress);
    setResult({ score: res.score, total: res.total, picked });
    onNotice(
      res.earned > 0 || res.progress.completedChapters.length > before.completedChapters.length
        ? summarise(before, res.progress, chapter.id, `Quiz submitted: ${res.score}/${res.total}.`)
        : `Quiz submitted: ${res.score}/${res.total}. (Quiz points are given once per chapter every 24 hours.)`,
    );
  }

  const pct = result ? Math.round((result.score / result.total) * 100) : 0;

  return (
    <>
      <h2 id="quiz" className="section-title mt-10 scroll-mt-24">Chapter quiz</h2>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
        {chapter.quiz.map((q, qi) => {
          const done = result !== null;
          const picked = result?.picked[qi];
          return (
            <fieldset key={q.id} className="card-flat p-5" disabled={done}>
              <legend className="font-semibold">
                {qi + 1}. {q.question}
              </legend>
              <div className="mt-3 grid gap-2">
                {q.options.map((opt, oi) => {
                  const id = `${q.id}-${oi}`;
                  const isRight = done && oi === q.correctIndex;
                  const isWrongPick = done && oi === picked && oi !== q.correctIndex;
                  return (
                    <label
                      key={id}
                      htmlFor={id}
                      className={`flex cursor-pointer items-start gap-3 rounded p-2 ${isRight ? "bg-emerald-500/15" : ""} ${isWrongPick ? "bg-red-500/15" : ""}`}
                    >
                      <input
                        id={id}
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === oi}
                        onChange={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                        className="mt-1"
                      />
                      <span>
                        {opt} {isRight && "✓"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {done && picked !== q.correctIndex && (
                <p className="panel mt-3 p-3 text-sm">
                  <strong>Why:</strong> {q.explanation}
                </p>
              )}
            </fieldset>
          );
        })}
        {!result && (
          <div>
            <button type="submit" className="btn-primary">
              Submit quiz
            </button>
          </div>
        )}
      </form>

      {result && (
        <div aria-live="polite" className="card mt-6 p-6">
          <p className="stat-figure">{pct}%</p>
          <p>
            {result.score} of {result.total} correct · {pct >= 60 ? "Passed 🎉" : "Below 60% — revise the topics marked red and try again"}
          </p>
          <button
            type="button"
            className="btn-ghost mt-4"
            onClick={() => {
              setAnswers({});
              setResult(null);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </>
  );
}
