import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, ExternalLink, MessageCircle, PlayCircle } from "lucide-react";
import { getChapter, getSubject } from "../lib/content";
import { chapterStatus, getProgress, markLectureWatched } from "../lib/progress";
import type { ClassLevel } from "../data/curriculum";
import { ChapterView, formatViews } from "./Learn";
import CourseNotFound from "../components/CourseNotFound";

/** Shared focus ring for keyboard users (visible on every interactive element here). */
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]";

/** Udemy-style course player: video + module/lesson sidebar + notes, exam questions and quiz below. */
export default function CoursePlayer() {
  const { classLevel, subjectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cls = Number(classLevel) as ClassLevel;
  const subject = getSubject(cls, subjectId ?? "");
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  if (!subject) return <CourseNotFound />;

  const progress = getProgress();
  const chapterId = params.get("m") ?? subject.chapters.find((c) => !progress.completedChapters.includes(c.id))?.id ?? subject.chapters[0].id;
  const chapter = getChapter(chapterId) ?? subject.chapters[0];
  const vIndex = Math.min(Number(params.get("v") ?? 0) || 0, Math.max(0, chapter.lectures.length - 1));
  const lecture = chapter.lectures[vIndex];
  const base = `/courses/${cls}/${subject.id}/learn`;
  const go = (m: string, v = 0) => navigate(`${base}?m=${m}&v=${v}`);
  const watched = lecture ? progress.watched[`${chapter.id}/${lecture.id}`] === true : false;
  const modIndex = subject.chapters.findIndex((c) => c.id === chapter.id);
  const coursePct = Math.round(subject.chapters.reduce((n, c) => n + chapterStatus(c.id, undefined, progress).pct, 0) / subject.chapters.length);

  function completeAndNext() {
    if (lecture && !watched) markLectureWatched(chapter.id, lecture.id);
    refresh();
    if (vIndex + 1 < chapter.lectures.length) go(chapter.id, vIndex + 1);
    else document.getElementById("module-notes")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="container-x py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/courses/${cls}/${subject.id}`} className={`btn-text flex items-center gap-1 ${FOCUS_RING}`}>
          <ArrowLeft size={16} aria-hidden="true" /> Class {cls} {subject.name}
        </Link>
        <div className="flex min-w-48 items-center gap-3 text-sm">
          <span className="opacity-75">Course {coursePct}%</span>
          <div className="progress-track w-40" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coursePct}>
            <div className="progress-fill" style={{ width: `${coursePct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── player ── */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-black shadow-[var(--shadow-float)]">
            {lecture?.youtubeId ? (
              <iframe
                key={lecture.youtubeId}
                src={`https://www.youtube-nocookie.com/embed/${lecture.youtubeId}?rel=0&modestbranding=1`}
                title={lecture.title}
                className="block aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="grid aspect-video place-items-center p-6 text-center text-white">
                <div>
                  <PlayCircle size={48} className="mx-auto opacity-70" />
                  <p className="mt-3">No video picked for this module yet.</p>
                  {lecture && (
                    <a className="btn-primary mt-4 inline-flex items-center gap-1" target="_blank" rel="noopener noreferrer" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lecture.searchQuery)}`}>
                      Find on YouTube <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="kicker">
                Module {chapter.number} · Lesson {vIndex + 1} of {Math.max(1, chapter.lectures.length)}
              </p>
              <h1 className="type-lg mt-1">{lecture?.title ?? chapter.title}</h1>
              <p className="mt-1 text-sm opacity-75">
                {lecture?.channel && <>{lecture.channel} · </>}
                {lecture?.views ? <>{formatViews(lecture.views)} views · </> : null}
                {lecture ? `${lecture.durationMin} min` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/sarthi?chapter=${chapter.id}`} className="btn-ghost flex items-center gap-1">
                <MessageCircle size={16} /> Ask Sarthi
              </Link>
              <button type="button" className="btn-primary" onClick={completeAndNext}>
                {watched ? (vIndex + 1 < chapter.lectures.length ? "Next lesson →" : "Go to notes & quiz ↓") : "Mark complete & continue →"}
              </button>
            </div>
          </div>

          <div id="module-notes" className="mt-6">
            <ChapterView key={chapter.id} chapterId={chapter.id} embedded onChange={refresh} />
          </div>

          <div className="mt-10 flex justify-between gap-3">
            {modIndex > 0 ? (
              <button type="button" className="btn-ghost" onClick={() => go(subject.chapters[modIndex - 1].id)}>
                ← Previous module
              </button>
            ) : (
              <span />
            )}
            {modIndex + 1 < subject.chapters.length && (
              <button type="button" className="btn-primary" onClick={() => go(subject.chapters[modIndex + 1].id)}>
                Next module →
              </button>
            )}
          </div>
        </div>

        {/* ── modules sidebar ── */}
        <aside className="card h-fit overflow-hidden p-0 lg:sticky lg:top-24">
          <p className="kicker border-b border-[var(--color-ink-line)] px-4 py-3">Course content · {subject.chapters.length} modules</p>
          <ol className="max-h-[70vh] overflow-y-auto">
            {subject.chapters.map((c) => {
              const st = chapterStatus(c.id, undefined, progress);
              const isCur = c.id === chapter.id;
              const lessonsId = `module-${c.id}-lessons`;
              return (
                <li key={c.id} className="border-b border-[var(--color-ink-line)] last:border-b-0">
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/5 ${isCur ? "bg-[var(--color-saffron-50)]" : ""} ${FOCUS_RING} focus-visible:ring-inset`}
                    onClick={() => go(c.id)}
                    aria-current={isCur ? "true" : undefined}
                    aria-expanded={isCur}
                    aria-controls={isCur ? lessonsId : undefined}
                  >
                    {st.completed ? (
                      <CheckCircle2 size={18} className="shrink-0" style={{ color: "var(--color-emeraldx-500)" }} aria-hidden="true" />
                    ) : (
                      <span className="w-[18px] shrink-0 text-center text-xs opacity-60" aria-hidden="true">
                        {c.number}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${isCur ? "font-semibold" : ""}`}>{c.title}</span>
                      <span className="block text-xs opacity-70">
                        {st.completed ? "Completed" : st.pct > 0 ? `${st.pct}% done` : "Not started"}
                        {isCur && " · Now playing"}
                      </span>
                    </span>
                    <ChevronDown size={14} className={`shrink-0 opacity-50 transition ${isCur ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {isCur && (
                    <ul id={lessonsId} className="pb-2">
                      {c.lectures.map((l, i) => {
                        const done = progress.watched[`${c.id}/${l.id}`] === true;
                        const current = i === vIndex;
                        return (
                          <li key={l.id}>
                            <button
                              type="button"
                              className={`flex w-full items-start gap-2 px-6 py-2 text-left text-sm transition hover:bg-black/5 ${current ? "font-semibold" : "opacity-85"} ${FOCUS_RING} focus-visible:ring-inset`}
                              onClick={() => go(c.id, i)}
                              aria-current={current ? "true" : undefined}
                            >
                              {done ? (
                                <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-emeraldx-500)" }} aria-hidden="true" />
                              ) : current ? (
                                <PlayCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Circle size={15} className="mt-0.5 shrink-0 opacity-50" aria-hidden="true" />
                              )}
                              <span className="min-w-0 flex-1 line-clamp-2">
                                {l.title}
                                <span className="block text-xs font-normal opacity-70">
                                  {done ? "Watched · " : current ? "Now playing · " : ""}
                                  {l.durationMin} min{l.channel ? ` · ${l.channel}` : ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      <li className="px-6 py-1 text-xs opacity-60">+ Notes · Likely exam questions · Quiz</li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </section>
  );
}
