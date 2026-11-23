import { useEffect, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronDown, Clock, Loader2, PlayCircle, Sparkles, Target } from "lucide-react";
import { CLASS_LEVELS, chapterVideoCount, getSubject, listSubjects, preloadAllVideos } from "../lib/content";
import { chapterStatus, getProgress } from "../lib/progress";
import { currentAccount } from "../lib/auth";
import type { ClassLevel, Subject } from "../data/curriculum";
import { formatViews } from "./Learn";
import CourseNotFound from "../components/CourseNotFound";

type Filter = "all" | "pcm" | "science" | "sst";
const FILTERS: { id: Filter; label: string; subjects: string[] }[] = [
  { id: "all", label: "All courses", subjects: [] },
  { id: "pcm", label: "PCM", subjects: ["physics", "chemistry", "mathematics"] },
  { id: "science", label: "Science & Biology", subjects: ["science", "biology"] },
  { id: "sst", label: "Social Science", subjects: ["social-science"] },
];

const BLURB: Record<string, string> = {
  science: "Physics, Chemistry and Biology of the NCERT book, chapter by chapter.",
  mathematics: "Every NCERT chapter with solved examples and graded practice.",
  "social-science": "History, Geography, Political Science and Economics in plain language.",
  physics: "Concepts, derivations and numericals for boards and entrance basics.",
  chemistry: "Physical, organic and inorganic chemistry, made clear.",
  biology: "Diagrams-first explanations of every NCERT Biology chapter.",
};

/** Shared focus ring for keyboard users (visible on every interactive element here). */
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]";

function courseStats(s: Subject) {
  let videos = 0;
  let minutes = 0;
  let views = 0;
  let quizzes = 0;
  for (const c of s.chapters) {
    const vc = chapterVideoCount(c.id);
    videos += vc;
    if (vc) {
      minutes += c.lectures.reduce((n, l) => n + l.durationMin, 0);
      views += c.lectures.reduce((n, l) => n + (l.views ?? 0), 0);
    } else minutes += 45;
    if (c.quiz.length) quizzes += 1;
  }
  return { modules: s.chapters.length, videos, hours: Math.round(minutes / 60), views, quizzes };
}

const courseTitle = (cls: number, s: Subject) => `Class ${cls} ${s.name}`;

export function CourseCatalog() {
  const acc = currentAccount();
  const [cls, setCls] = useState<ClassLevel | "all">(acc?.classLevel ?? "all");
  const [filter, setFilter] = useState<Filter>("all");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void preloadAllVideos().finally(() => setReady(true));
  }, []);

  const levels = cls === "all" ? CLASS_LEVELS : [cls];
  const f = FILTERS.find((x) => x.id === filter)!;
  const courses = levels.flatMap((l) =>
    listSubjects(l)
      .filter((s) => !f.subjects.length || f.subjects.includes(s.id))
      .map((s) => ({ cls: l, s })),
  );

  return (
    <section className="container-x py-12">
      <p className="kicker">Swyam Courses · CBSE Class 8–12</p>
      <h1 className="type-xl anim-fade-up mt-3">Complete courses, free for every student</h1>
      <p className="mt-3 max-w-2xl opacity-80">
        Each course is a full subject. Every chapter is a module with the most-watched YouTube lectures for it, Sarthi’s notes, likely exam questions and a quiz.
      </p>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Class">
        <button type="button" className={`filter-pill ${FOCUS_RING}`} aria-pressed={cls === "all"} onClick={() => setCls("all")}>
          All classes
        </button>
        {CLASS_LEVELS.map((c) => (
          <button key={c} type="button" className={`filter-pill ${FOCUS_RING}`} aria-pressed={cls === c} onClick={() => setCls(c)}>
            Class {c}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Stream">
        {FILTERS.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`chip ${FOCUS_RING}`}
            aria-pressed={filter === x.id}
            style={filter === x.id ? { borderColor: "var(--color-saffron-500)", color: "var(--color-saffron-500)" } : undefined}
            onClick={() => setFilter(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {!ready && (
        <p role="status" className="mt-6 flex items-center gap-2 text-sm opacity-75">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Lectures load ho rahe hain…
        </p>
      )}
      {!ready && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton h-64 p-6" />
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map(({ cls: l, s }, i) => {
          const st = courseStats(s);
          const p = getProgress();
          const done = s.chapters.filter((c) => p.completedChapters.includes(c.id)).length;
          const pct = Math.round((done / st.modules) * 100);
          return (
            <Link
              key={`${l}-${s.id}`}
              to={`/courses/${l}/${s.id}`}
              className={`card anim-fade-up group flex flex-col overflow-hidden p-0 no-underline transition hover:-translate-y-0.5 ${FOCUS_RING}`}
              style={{ "--delay": `${Math.min(i, 8) * 70}ms` } as CSSProperties}
            >
              {s.chapters[0]?.lectures[0]?.youtubeId && (
                <div className="relative aspect-video overflow-hidden bg-black">
                  <img
                    src={`https://i.ytimg.com/vi/${s.chapters[0].lectures[0].youtubeId}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white">▶ {st.videos} lectures</span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="kicker">Class {l}</span>
                  <span className="chip-accent">Free</span>
                </div>
                <h2 className="type-lg mt-3">{s.name}</h2>
                <p className="mt-2 flex-1 text-sm opacity-80">{BLURB[s.id]}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="panel p-2">
                    <p className="stat-figure !text-xl">{st.modules}</p>
                    <span>modules</span>
                  </div>
                  <div className="panel p-2">
                    <p className="stat-figure !text-xl">{st.videos || "—"}</p>
                    <span>lectures</span>
                  </div>
                  <div className="panel p-2">
                    <p className="stat-figure !text-xl">{st.hours}h</p>
                    <span>content</span>
                  </div>
                </div>
                {done > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs">
                      <span>
                        {done}/{st.modules} modules done
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="progress-track mt-1.5" role="progressbar" aria-label={`${s.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
                <span className="btn-text mt-4 self-start">View course →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function CourseDetail() {
  const { classLevel, subjectId } = useParams();
  const cls = Number(classLevel) as ClassLevel;
  const subject = getSubject(cls, subjectId ?? "");
  const acc = currentAccount();
  const [open, setOpen] = useState<string | null>(null);
  const [, setLoaded] = useState(0);
  useEffect(() => {
    void preloadAllVideos().then((r) => setLoaded(r.count));
  }, []);

  if (!subject) return <CourseNotFound />;
  const st = courseStats(subject);
  const progress = getProgress();
  const statuses = subject.chapters.map((c) => chapterStatus(c.id, undefined, progress));
  const doneCount = statuses.filter((x) => x.completed).length;
  const coursePct = Math.round(statuses.reduce((n, x) => n + x.pct, 0) / subject.chapters.length);
  const nextIdx = statuses.findIndex((x) => !x.completed);
  const next = subject.chapters[nextIdx === -1 ? 0 : nextIdx];
  const startHref = acc ? `/courses/${cls}/${subject.id}/learn?m=${next.id}` : `/login?mode=register&role=student`;

  return (
    <section className="container-x py-12">
      <Link to="/courses" className={`btn-text ${FOCUS_RING}`}>
        ← All courses
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="kicker">CBSE · NCERT · Class {cls}</p>
          <h1 className="type-xl mt-3">{courseTitle(cls, subject)} — Complete Course</h1>
          <p className="mt-3 max-w-2xl text-lg opacity-85">{BLURB[subject.id]}</p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1">
              <BookOpen size={16} aria-hidden="true" /> {st.modules} modules
            </span>
            <span className="flex items-center gap-1">
              <PlayCircle size={16} aria-hidden="true" /> {st.videos ? `${st.videos} video lectures` : "Video lectures per module"}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={16} aria-hidden="true" /> ~{st.hours} hours
            </span>
            {st.views > 0 && (
              <span className="flex items-center gap-1">
                <Sparkles size={16} aria-hidden="true" /> lectures watched {formatViews(st.views)} times on YouTube
              </span>
            )}
          </div>

          <h2 className="section-title mt-10">What you’ll learn</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {subject.chapters.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "var(--color-saffron-500)" }} aria-hidden="true" /> {c.title}
              </li>
            ))}
          </ul>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <p className="stat-figure">Free</p>
          <p className="text-sm opacity-75">Full course · no payment, ever</p>
          {acc?.role === "student" && (
            <div className="mt-4">
              <div className="flex justify-between text-sm">
                <span>
                  {doneCount}/{subject.chapters.length} modules complete
                </span>
                <span>{coursePct}%</span>
              </div>
              <div className="progress-track mt-1.5" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coursePct}>
                <div className="progress-fill" style={{ width: `${coursePct}%` }} />
              </div>
            </div>
          )}
          <Link to={startHref} className={`btn-primary mt-5 block w-full text-center ${FOCUS_RING}`}>
            {acc ? (coursePct > 0 ? "Continue course" : "Start course") : "Join free to start"}
          </Link>
          <ul className="mt-5 grid gap-2 text-sm">
            <li className="flex gap-2">
              <PlayCircle size={16} aria-hidden="true" /> Most-watched YouTube lectures, picked per chapter
            </li>
            <li className="flex gap-2">
              <BookOpen size={16} aria-hidden="true" /> Notes, definitions, formulas and solved examples
            </li>
            <li className="flex gap-2">
              <Target size={16} aria-hidden="true" /> Likely exam questions + chapter quiz
            </li>
            <li className="flex gap-2">
              <Sparkles size={16} aria-hidden="true" /> Sarthi voice tutor in Hindi, English, Hinglish
            </li>
          </ul>
        </aside>
      </div>

      <h2 className="section-title mt-12">Course modules</h2>
      <div className="mt-4 grid gap-3">
        {subject.chapters.map((c, i) => {
          const s = statuses[i];
          const isOpen = open === c.id;
          const vids = chapterVideoCount(c.id);
          const btnId = `module-${c.id}-button`;
          const panelId = `module-${c.id}-panel`;
          return (
            <div key={c.id} className="card-flat overflow-hidden">
              <h3>
                <button
                  type="button"
                  id={btnId}
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-saffron-500)]"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : c.id)}
                >
                  <span className="stat-figure !text-2xl w-10 shrink-0 text-center" aria-hidden="true">
                    {String(c.number).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs opacity-60">Module {c.number}</span>
                    <span className="block font-semibold">{c.title}</span>
                    {acc?.role === "student" && s.pct > 0 && (
                      <span className="mt-2 block">
                        <span className="flex justify-between text-xs opacity-75">
                          <span>{s.completed ? "Completed" : "In progress"}</span>
                          <span>{s.pct}%</span>
                        </span>
                        <span className="progress-track mt-1 block" role="progressbar" aria-label={`${c.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pct}>
                          <span className="progress-fill block" style={{ width: `${s.pct}%` }} />
                        </span>
                      </span>
                    )}
                  </span>
                  {s.completed && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-emeraldx-500)" }}>
                      <CheckCircle2 size={16} aria-hidden="true" /> Completed
                    </span>
                  )}
                  <ChevronDown className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} size={18} aria-hidden="true" />
                </button>
              </h3>
              <div id={panelId} role="region" aria-labelledby={btnId} hidden={!isOpen} className="border-t border-[var(--color-ink-line)] p-4 text-sm">
                {isOpen && (
                  <>
                    <ul className="grid gap-1.5">
                      <li>▶ {vids ? `${vids} top YouTube lecture${vids > 1 ? "s" : ""}` : "YouTube lecture"}</li>
                      <li>📘 Notes, definitions & solved examples</li>
                      <li>🎯 Most-likely exam questions</li>
                      <li>✅ Chapter quiz{c.quiz.length ? ` · ${c.quiz.length} questions` : ""}</li>
                    </ul>
                    {c.lectures[0]?.youtubeId && (
                      <p className="mt-3 opacity-75">
                        Top lecture: “{c.lectures[0].title}” · {c.lectures[0].channel}
                        {c.lectures[0].views ? ` · ${formatViews(c.lectures[0].views)} views` : ""}
                      </p>
                    )}
                    {c.lectures[0]?.youtubeId && (
                      <img
                        src={`https://i.ytimg.com/vi/${c.lectures[0].youtubeId}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        className="mt-3 w-full max-w-xs rounded-lg"
                      />
                    )}
                    <Link
                      to={acc ? `/courses/${cls}/${subject.id}/learn?m=${c.id}` : "/login?mode=register&role=student"}
                      className={`btn-primary mt-4 inline-block ${FOCUS_RING}`}
                    >
                      {acc ? "Open module" : "Join free to open"}
                    </Link>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
