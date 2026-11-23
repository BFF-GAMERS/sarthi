import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  FileText,
  Loader2,
  Lock,
  Menu,
  PlayCircle,
  Target,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import {
  completeLesson,
  getLearnState,
  getLesson,
  nextLesson,
  packLessonToDetail,
  packToLearnState,
  recordPractice,
  saveNote,
  setBookmark,
  type LearnLesson,
  type LearnModule,
  type LearnState,
  type LessonKind,
} from "../lib/learn";
import AssessmentRunner from "../components/AssessmentRunner";
import ProjectSubmit from "../components/ProjectSubmit";
import CourseCompletion from "../components/CourseCompletion";
import { listCourseAssessments } from "../lib/assessments";
import { useTx } from "../lib/i18n";
import { useOnline, usePack } from "../lib/offline/use-offline";
import { EV } from "@/evolution";
import { trackOnce } from "@/evolution/runtime/tracker/track";

/**
 * The course, as somewhere you actually work.
 *
 * Three columns on a desktop — where you are in the course, the lesson, and
 * what to do with it — collapsing to one on a phone with the contents behind a
 * drawer. The layout follows the question a learner keeps asking: what now?
 * The answer is always in the same place, at the bottom of the lesson.
 *
 * The engine is not specific to this course. Everything it draws comes from
 * `course_learning_state`, so a second course is a row of data rather than
 * another copy of this page.
 *
 * Locking is enforced by the database, not by this component. The padlocks
 * here are a picture of a decision made server-side — which is why a learner
 * cannot reach a locked lesson by editing the URL.
 */

const KIND_ICON: Record<string, typeof FileText> = {
  video: PlayCircle,
  text: FileText,
  practice: Target,
  quiz: ClipboardCheck,
  assignment: Award,
};

export default function Learn() {
  const tx = useTx();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { slug } = useParams({ from: "/learn/$slug" });
  const { user, profileId, ready } = useAuth();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;

  const [lessonId, setLessonId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [examOpen, setExamOpen] = useState(false);

  // A downloaded copy of this course, if the device has one. Text only: the
  // contents list and lesson bodies, never video, notes or progress.
  const online = useOnline();
  const { pack, loading: packLoading } = usePack(slug);
  // Offline with a download on this device: do not ask the network anything.
  const skipNetwork = !online && (packLoading || Boolean(pack));

  const state = useQuery({
    queryKey: ["learn-state", slug, profileId],
    queryFn: () => getLearnState(slug),
    enabled: ready && !skipNetwork,
  });

  // Serve from the pack when the connection is gone, or when asking for the
  // course failed and a copy is right here. Online behaviour is unchanged.
  const fromPack = Boolean(pack) && (!online || state.isError);
  const packState = useMemo(() => (pack ? packToLearnState(pack) : null), [pack]);

  useEffect(() => {
    // Offline, wait for the device to say whether it holds a copy before sending anyone to sign in.
    if (ready && !user && !fromPack && !(packLoading && !online))
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate, fromPack, packLoading, online]);

  const s = fromPack ? packState : (state.data ?? null);

  // Land on the first unfinished lesson rather than at the very beginning.
  useEffect(() => {
    if (!s || lessonId) return;
    const next = nextLesson(s);
    if (next) setLessonId(next.lesson.id);
  }, [s, lessonId]);

  const lesson = useQuery({
    queryKey: ["lesson", lessonId, profileId],
    queryFn: () => getLesson(lessonId!, profileId),
    enabled: Boolean(lessonId) && !fromPack,
  });
  const lessonData = useMemo(
    () =>
      fromPack && pack && lessonId ? packLessonToDetail(pack, lessonId) : (lesson.data ?? null),
    [fromPack, pack, lessonId, lesson.data],
  );

  /** The lesson's place in the course, for navigation and for the lock check. */
  const position = useMemo(() => {
    if (!s || !lessonId) return null;
    const flat: Array<{ module: LearnModule; lesson: LearnLesson }> = [];
    for (const m of s.modules) for (const l of m.lessons) flat.push({ module: m, lesson: l });
    const at = flat.findIndex((f) => f.lesson.id === lessonId);
    if (at === -1) return null;
    return { flat, at, current: flat[at]! };
  }, [s, lessonId]);

  const done = useMutation({
    mutationFn: (complete: boolean) => completeLesson(s!.enrollmentId!, lessonId!, complete),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["learn-state", slug] });
      void qc.invalidateQueries({ queryKey: ["enrollments", profileId] });
    },
  });

  if ((!ready && !fromPack) || state.isLoading || (skipNetwork && packLoading)) {
    return (
      <div className="container-x flex min-h-[60vh] items-center justify-center pt-28">
        <Loader2 size={22} className="animate-spin text-ink-mute" aria-hidden />
      </div>
    );
  }

  if (!s) {
    return (
      <div className="container-x max-w-xl pb-24 pt-32 text-center">
        <h1 className="section-title">{tx("Course not found")}</h1>
        <p className="mt-3 font-body text-sm text-ink-soft">
          {tx("It may have been unpublished, or the link may be wrong.")}
        </p>
        <Link to="/courses" className="btn-primary mt-6">
          {tx("Browse courses")}
        </Link>
      </div>
    );
  }

  if (!s.enrolled) {
    return (
      <div className="container-x max-w-xl pb-24 pt-32 text-center">
        <h1 className="section-title">{s.title}</h1>
        <p className="mt-3 font-body text-sm text-ink-soft">
          {tx("You are not enrolled in this course yet.")}
        </p>
        <Link to="/courses/$id" params={{ id: slug }} className="btn-primary mt-6">
          {tx("Go to the course page")}
        </Link>
      </div>
    );
  }

  const locked = position ? !position.current.module.unlocked : false;

  return (
    <div className="pt-20">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="sticky top-16 z-30 border-b border-ink-line bg-paper/95 backdrop-blur">
        <div className="container-x flex items-center gap-3 py-3">
          <button
            onClick={() => setDrawer(true)}
            className="btn-ghost !px-3 !py-3 lg:hidden"
            aria-label={tx("Course contents")}
          >
            <Menu size={16} aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm tracking-tight text-ink">{s.title}</p>
            <p className="font-body text-[11px] text-ink-mute">
              {position
                ? `${tx("Module")} ${position.current.module.position} ${tx("of")} ${s.modules.length} · ${tx("Lesson")} ${position.current.lesson.position} ${tx("of")} ${position.current.module.lessons.length}`
                : `${s.lessonsDone}/${s.lessonsTotal} ${tx("lessons")}`}
            </p>
          </div>

          {fromPack && (
            <span className="offline-badge shrink-0">
              <CloudOff size={12} aria-hidden /> {tx("Offline copy")}
            </span>
          )}

          <div className={`${fromPack ? "hidden" : "hidden sm:block"} w-48 shrink-0`}>
            <div className="flex items-center justify-between font-mono text-[11px] text-ink-mute">
              <span>{tx("Progress")}</span>
              <span className="tabular-nums text-ink">{s.percent}%</span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-deep/70"
              role="progressbar"
              aria-valuenow={s.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={tx("Course progress")}
            >
              <motion.span
                className="block h-full rounded-full bg-saffron-500"
                initial={false}
                animate={{ width: `${s.percent}%` }}
                transition={{ duration: still ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <Link
            to="/courses/$id"
            params={{ id: slug }}
            className="btn-ghost shrink-0 !px-3 !py-2 !text-xs"
          >
            <ArrowLeft size={14} aria-hidden />
            <span className="hidden sm:inline">{tx("Course")}</span>
          </Link>
        </div>
      </div>

      <div className="container-x grid grid-cols-1 gap-8 pb-24 pt-8 lg:grid-cols-[19rem_1fr]">
        {/* ── Contents (desktop) ──────────────────────────────── */}
        <aside className="hidden lg:block">
          <Contents state={s} currentId={lessonId} onPick={(id) => setLessonId(id)} tx={tx} />
        </aside>

        {/* ── Lesson ──────────────────────────────────────────── */}
        <main>
          {fromPack && (
            <p
              role="status"
              className="mb-6 flex items-start gap-2 rounded-2xl border border-saffron-300 bg-paper-light p-3 font-body text-[13px] leading-relaxed text-ink-soft"
            >
              <CloudOff size={15} className="mt-0.5 shrink-0 text-saffron-600" aria-hidden />
              <span>
                {tx(
                  "You are reading the copy saved on this device. Videos, notes, progress and assessments need a connection.",
                )}
              </span>
            </p>
          )}
          {locked ? (
            <div className="card p-8 text-center">
              <Lock size={22} className="mx-auto text-ink-mute" aria-hidden />
              <h2 className="mt-3 font-display text-xl text-ink">{tx("Locked")}</h2>
              <p className="mt-2 font-body text-sm text-ink-soft">
                {tx("Finish the module before this one to open it.")}
              </p>
            </div>
          ) : lesson.isLoading ? (
            <p className="flex items-center gap-2 font-body text-sm text-ink-mute">
              <Loader2 size={15} className="animate-spin" aria-hidden /> {tx("Loading…")}
            </p>
          ) : !lessonData ? (
            <p className="font-body text-sm text-ink-mute">
              {tx("This lesson could not be loaded.")}
            </p>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.article
                key={lessonData.id}
                initial={still ? false : { opacity: 0, y: 10 }}
                animate={{ y: 0 }}
                transition={{ duration: still ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <LessonView
                  detail={lessonData}
                  profileId={profileId}
                  enrollmentId={s.enrollmentId}
                  onExam={() => setExamOpen(true)}
                  tx={tx}
                />

                {/* ── Footer navigation ──────────────────────── */}
                <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-ink-line pt-6">
                  <button
                    onClick={() => {
                      const prev = position && position.flat[position.at - 1];
                      if (prev) setLessonId(prev.lesson.id);
                    }}
                    disabled={!position || position.at === 0}
                    className="btn-ghost !py-2.5 !text-xs disabled:opacity-40"
                  >
                    <ChevronLeft size={15} aria-hidden /> {tx("Previous")}
                  </button>

                  <button
                    onClick={() => done.mutate(!position?.current.lesson.completed)}
                    disabled={done.isPending || fromPack}
                    className={`!py-2.5 !text-xs disabled:opacity-60 ${
                      position?.current.lesson.completed ? "btn-ghost" : "btn-primary"
                    }`}
                  >
                    {done.isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
                    {position?.current.lesson.completed ? (
                      <>
                        <Check size={14} aria-hidden /> {tx("Completed")}
                      </>
                    ) : (
                      tx("Mark complete")
                    )}
                  </button>

                  {fromPack && <NeedsConnection tx={tx} />}

                  <span className="flex-1" />

                  <button
                    onClick={() => {
                      const nxt = position && position.flat[position.at + 1];
                      if (!nxt) return;
                      if (!nxt.module.unlocked) return;
                      setLessonId(nxt.lesson.id);
                    }}
                    disabled={
                      !position ||
                      position.at >= position.flat.length - 1 ||
                      !position.flat[position.at + 1]?.module.unlocked
                    }
                    title={
                      position && !position.flat[position.at + 1]?.module.unlocked
                        ? tx("Finish this module first")
                        : undefined
                    }
                    className="btn-primary !py-2.5 !text-xs disabled:opacity-40"
                  >
                    {tx("Next")} <ChevronRight size={15} aria-hidden />
                  </button>
                </div>
              </motion.article>
            </AnimatePresence>
          )}
          {!fromPack && (
            <CourseCompletion
              courseSlug={slug}
              profileId={profileId}
              onOpenLesson={(kind) => {
                // Jump to the blocking lesson rather than describing where it is.
                for (const mod of s.modules) {
                  const target = mod.lessons.find((x) => x.kind === kind);
                  if (target && mod.unlocked) {
                    setLessonId(target.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                  }
                }
              }}
            />
          )}
        </main>
      </div>

      {/* ── Contents drawer (mobile) ──────────────────────────── */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              aria-hidden
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm overflow-y-auto border-r border-ink-line bg-paper p-4 lg:hidden"
              initial={still ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={still ? undefined : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              role="dialog"
              aria-label={tx("Course contents")}
              data-lenis-prevent
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="datum">{tx("Contents")}</p>
                <button
                  onClick={() => setDrawer(false)}
                  className="rounded-xl p-2 text-ink-mute hover:bg-paper-dim"
                  aria-label={tx("Close")}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              <Contents
                state={s}
                currentId={lessonId}
                onPick={(id) => {
                  setLessonId(id);
                  setDrawer(false);
                }}
                tx={tx}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── The module or final assessment ────────────────────── */}
      {examOpen && !fromPack && lessonData?.assessmentId && (
        <ExamGate
          assessmentId={lessonData.assessmentId}
          courseSlug={slug}
          onClose={() => {
            setExamOpen(false);
            void qc.invalidateQueries({ queryKey: ["learn-state", slug] });
          }}
        />
      )}
    </div>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────── */

function Contents({
  state,
  currentId,
  onPick,
  tx,
}: {
  state: LearnState;
  currentId: string | null;
  onPick: (id: string) => void;
  tx: (s: string) => string;
}) {
  return (
    <nav className="space-y-4" aria-label={tx("Course contents")}>
      {state.modules.map((m) => (
        <div key={m.id}>
          <div className="flex items-center gap-2">
            {m.complete ? (
              <Check size={14} className="shrink-0 text-emeraldx-400" aria-hidden />
            ) : m.unlocked ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500" aria-hidden />
            ) : (
              <Lock size={13} className="shrink-0 text-ink-mute" aria-hidden />
            )}
            <p
              className={`font-display text-[12px] tracking-tight ${
                m.unlocked ? "text-ink" : "text-ink-mute"
              }`}
            >
              {tx("Module")} {m.position} · {m.title}
            </p>
          </div>

          {m.unlocked ? (
            <ul className="ml-[7px] mt-1.5 space-y-0.5 border-l border-ink-line pl-3">
              {m.lessons.map((l) => {
                const Icon = KIND_ICON[l.kind] ?? FileText;
                const active = l.id === currentId;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => onPick(l.id)}
                      aria-current={active}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        active ? "bg-saffron-500/12 text-ink" : "text-ink-soft hover:bg-paper-dim"
                      }`}
                    >
                      {l.completed ? (
                        <Check size={12} className="shrink-0 text-emeraldx-400" aria-hidden />
                      ) : (
                        <Icon size={12} className="shrink-0 text-ink-mute" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate font-body text-[12.5px]">
                        {l.title}
                      </span>
                      {l.bookmarked && (
                        <Bookmark size={11} className="shrink-0 text-saffron-500" aria-hidden />
                      )}
                      {l.durationMinutes ? (
                        <span className="shrink-0 font-mono text-[10px] text-ink-mute">
                          {l.durationMinutes}m
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ml-[7px] mt-1 border-l border-ink-line pl-3 font-body text-[11px] text-ink-mute">
              {tx("Complete the previous module to unlock.")}
            </p>
          )}
        </div>
      ))}
    </nav>
  );
}

/* ── Lesson body ──────────────────────────────────────────────────── */

function LessonView({
  detail,
  profileId,
  enrollmentId,
  onExam,
  tx,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getLesson>>>;
  profileId: string | null;
  enrollmentId: string | null;
  onExam: () => void;
  tx: (s: string) => string;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(detail.note);
  const [saved, setSaved] = useState(false);
  const [marked, setMarked] = useState(detail.bookmarked);

  useEffect(() => {
    setNote(detail.note);
    setMarked(detail.bookmarked);
    setSaved(false);
  }, [detail.id, detail.note, detail.bookmarked]);

  const storeNote = useMutation({
    mutationFn: () => saveNote(profileId!, detail.id, note),
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    },
  });

  // A downloaded copy is read-only: nothing the learner does here is queued.
  const offlineCopy = Boolean(detail.offlineCopy);

  const star = useMutation({
    mutationFn: (on: boolean) => setBookmark(profileId!, detail.id, on),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["learn-state"] }),
  });

  // Nothing to read, watch, answer or submit. Checked against every block
  // this component can render, so it cannot disagree with what is on screen.
  const isEmpty =
    !detail.objective &&
    detail.body.length === 0 &&
    detail.concepts.length === 0 &&
    !detail.example &&
    detail.checklist.length === 0 &&
    detail.resources.length === 0 &&
    !(detail.kind === "video" && (detail.videoId || offlineCopy)) &&
    !detail.transcript &&
    detail.practice.length === 0 &&
    detail.code.length === 0 &&
    detail.kind !== "quiz" &&
    detail.kind !== "assignment";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
            {tx(detail.kind)}
            {detail.durationMinutes ? ` · ${detail.durationMinutes} min` : ""}
          </p>
          <h1 className="mt-2 font-display text-2xl tracking-tight text-ink sm:text-3xl">
            {detail.title}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            onClick={() => {
              const next = !marked;
              setMarked(next);
              star.mutate(next);
            }}
            disabled={offlineCopy}
            aria-pressed={marked}
            className="btn-ghost !px-3 !py-2 !text-xs disabled:opacity-60"
          >
            <Bookmark
              size={14}
              className={marked ? "fill-saffron-500 text-saffron-500" : ""}
              aria-hidden
            />
            {marked ? tx("Bookmarked") : tx("Bookmark")}
          </button>
          {offlineCopy && <NeedsConnection tx={tx} />}
        </div>
      </div>

      {detail.objective && (
        <p className="mt-5 border-l-[3px] border-saffron-500 pl-4 font-editorial text-lg text-ink-soft">
          {detail.objective}
        </p>
      )}

      {detail.kind === "video" &&
        (offlineCopy ? (
          <p className="mt-6 flex items-start gap-2 rounded-2xl border border-ink-line bg-paper-light p-5 font-body text-sm text-ink-mute">
            <CloudOff size={16} className="mt-0.5 shrink-0" aria-hidden />
            {tx("Video available online only. The written material is below.")}
          </p>
        ) : (
          <VideoLesson videoId={detail.videoId} title={detail.title} tx={tx} />
        ))}

      {offlineCopy && detail.transcript && (
        <div className="mt-6">
          <p className="datum">{tx("Transcript")}</p>
          <p className="mt-2 whitespace-pre-line font-body text-[14px] leading-relaxed text-ink-soft">
            {detail.transcript}
          </p>
        </div>
      )}

      {detail.body.length > 0 && (
        <div className="mt-6 space-y-4">
          {detail.body.map((p, i) => (
            <p key={i} className="font-body text-[15px] leading-relaxed text-ink-soft">
              {p}
            </p>
          ))}
        </div>
      )}

      {detail.code.length > 0 && (
        <div className="mt-6 space-y-5">
          {detail.code.map((c, i) => (
            <figure
              key={i}
              className="overflow-hidden rounded-2xl border border-ink-line bg-paper-light"
            >
              {c.title && (
                <figcaption className="border-b border-ink-line px-4 py-2 font-body text-[13px] font-semibold text-ink-soft">
                  {c.title}
                </figcaption>
              )}
              {/* Code is never translated: tx() would turn print() into something that does not run. */}
              <pre
                translate="no"
                className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-ink"
              >
                <code>{c.source}</code>
              </pre>
              {c.output && (
                <div className="border-t border-ink-line px-4 py-3">
                  <p className="datum">{tx("Output")}</p>
                  <pre
                    translate="no"
                    className="mt-1 overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-mute"
                  >
                    {c.output}
                  </pre>
                </div>
              )}
            </figure>
          ))}
        </div>
      )}

      {detail.concepts.length > 0 && (
        <div className="mt-7">
          <p className="datum">{tx("Key concepts")}</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {detail.concepts.map((c) => (
              <li key={c} className="chip !text-[11px]">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.example && (
        <div className="mt-7 rounded-2xl border border-ink-line bg-paper-light p-5">
          <p className="datum">{tx("In practice")}</p>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-ink-soft">
            {detail.example}
          </p>
        </div>
      )}

      {detail.checklist.length > 0 && (
        <div className="mt-7">
          <p className="datum">{tx("Before you submit")}</p>
          <ul className="mt-2.5 space-y-1.5">
            {detail.checklist.map((c) => (
              <li key={c} className="flex items-start gap-2 font-body text-[14px] text-ink-soft">
                <Check size={14} className="mt-0.5 shrink-0 text-emeraldx-400" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        Questions show wherever a lesson has them.

        This used to also require kind === "practice", and 212 lessons across
        the platform carry authored questions with some other kind — so their
        questions have never once been rendered. A lesson that ends with two
        questions is a lesson that checks you understood it; that is true of a
        text lesson as much as of a practice one, and the kind of the lesson is
        not a reason to withhold them.
      */}
      {detail.practice.length > 0 && (
        <>
          <Practice
            questions={detail.practice}
            lessonId={detail.id}
            profileId={offlineCopy ? null : profileId}
            tx={tx}
          />
          {offlineCopy && (
            <p className="mt-2 flex flex-wrap items-center gap-2 font-body text-[12px] text-ink-mute">
              <NeedsConnection tx={tx} />{" "}
              {tx("You can check answers here, but your result is not saved.")}
            </p>
          )}
        </>
      )}

      {detail.kind === "assignment" && offlineCopy && (
        <div className="mt-7 rounded-2xl border border-ink-line bg-paper-light p-5">
          <p className="font-body text-sm text-ink-soft">
            {tx("Submitting your project")}: <NeedsConnection tx={tx} />
          </p>
        </div>
      )}
      {detail.kind === "assignment" && enrollmentId && !offlineCopy && (
        <ProjectSubmit enrollmentId={enrollmentId} lessonId={detail.id} />
      )}

      {detail.kind === "quiz" && (
        <div className="mt-7 rounded-2xl border border-saffron-200 bg-saffron-50 p-6 text-center">
          <ClipboardCheck size={20} className="mx-auto text-saffron-600" aria-hidden />
          <p className="mt-3 font-body text-sm text-ink-soft">
            {tx("This assessment is marked by the server. Passing it opens the next module.")}
          </p>
          <button
            onClick={onExam}
            disabled={offlineCopy}
            className="btn-primary mt-4 disabled:opacity-60"
          >
            {tx("Open the assessment")}
          </button>
          {offlineCopy && (
            <p className="mt-2">
              <NeedsConnection tx={tx} />
            </p>
          )}
        </div>
      )}

      {/*
        A lesson with nothing in it says so.

        Every block above is behind a truthiness check, so a lesson row whose
        `content` is `{}` used to render the title, a Bookmark button and an
        empty notes box — and nothing else. 276 of the 644 lessons in the
        database are in exactly that state, almost all of them in the free
        trade and exam-prep courses that this platform's learners actually
        pick. A blank page reads as "my phone failed", so they reload, and
        burn data, and try the next lesson, and it is blank too.

        Saying it plainly costs one paragraph and is the truth.
      */}
      {isEmpty && (
        <div className="mt-7 rounded-2xl border border-ink-line bg-paper-dim p-6">
          <p className="font-body text-sm font-medium text-ink">
            {tx("This lesson has not been written yet.")}
          </p>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-ink-soft">
            {tx(
              "The outline for this course is in place but the material is still being written. Nothing is missing from your end — there is nothing here to load.",
            )}
          </p>
          <Link to="/courses" className="btn-ghost mt-4 !py-2 !text-xs">
            {tx("Browse courses that are ready")}
          </Link>
        </div>
      )}

      {detail.resources.length > 0 && (
        <div className="mt-7">
          <p className="datum">{tx("Resources")}</p>
          <ul className="mt-2.5 space-y-1.5">
            {detail.resources.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-[14px] text-saffron-700 underline-offset-2 hover:underline"
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Notes ─────────────────────────────────────────────── */}
      <div className="mt-8">
        <p className="datum">{tx("Your notes")}</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          disabled={offlineCopy}
          placeholder={offlineCopy ? tx("Notes need a connection") : tx("Add your notes here…")}
          aria-label={tx("Your notes for this lesson")}
          className="input mt-2 !text-[14px]"
        />
        <button
          onClick={() => storeNote.mutate()}
          disabled={storeNote.isPending || !profileId || offlineCopy}
          className="btn-ghost mt-2 !py-2 !text-xs disabled:opacity-60"
        >
          {storeNote.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {saved ? tx("Saved") : tx("Save notes")}
        </button>
        {offlineCopy && (
          <p className="mt-1">
            <NeedsConnection tx={tx} />
          </p>
        )}
      </div>
    </>
  );
}

/* ── Offline ──────────────────────────────────────────────────────── */

/** The one phrase for anything that writes: said in words, with an icon. */
function NeedsConnection({ tx }: { tx: (s: string) => string }) {
  return (
    <span className="inline-flex items-center gap-1 font-body text-[11.5px] text-ink-mute">
      <CloudOff size={12} aria-hidden /> {tx("Needs a connection")}
    </span>
  );
}

/* ── Video ────────────────────────────────────────────────────────── */

function VideoLesson({
  videoId,
  title,
  tx,
}: {
  videoId: string | null;
  title: string;
  tx: (s: string) => string;
}) {
  if (!videoId) {
    return (
      <p className="mt-6 rounded-2xl border border-ink-line bg-paper-light p-5 font-body text-sm text-ink-mute">
        {tx("No video is attached to this lesson yet — the written material below covers it.")}
      </p>
    );
  }

  return (
    <div className="mt-6">
      {/*
        A plain iframe rather than the IFrame API. Nothing here needs playback
        events, and the API costs a script download on a connection where that
        matters. `aspect-video` keeps it responsive without a wrapper hack.
      */}
      <div className="aspect-video overflow-hidden rounded-2xl border border-ink-line bg-ink">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      </div>
      <p className="mt-2 font-body text-[11px] text-ink-mute">
        {tx("If the player does not load, watch it on")}{" "}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-saffron-700 underline-offset-2 hover:underline"
        >
          YouTube
        </a>
        .
      </p>
    </div>
  );
}

/* ── Practice ─────────────────────────────────────────────────────── */

function Practice({
  questions,
  lessonId,
  profileId,
  tx,
}: {
  questions: Array<{ q: string; options: string[]; answer: number; why: string }>;
  lessonId: string;
  profileId: string | null;
  tx: (s: string) => string;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const correct = questions.filter((q, i) => checked[i] && picked[i] === q.answer).length;
  const answered = Object.keys(checked).length;

  useEffect(() => {
    setPicked({});
    setChecked({});
  }, [lessonId]);

  // Recorded once the whole set has been attempted — evidence that the
  // practice happened, not a grade. Practice is never gated on.
  useEffect(() => {
    if (answered === questions.length && questions.length > 0 && profileId) {
      trackOnce(`practice:lesson:${lessonId}`, EV.PRACTICE_COMPLETED, { surface: "lesson" });
      void recordPractice(profileId, lessonId, correct, questions.length).catch(() => undefined);
    }
  }, [answered, correct, questions.length, lessonId, profileId]);

  return (
    <div className="mt-7 space-y-4">
      <div className="flex items-center justify-between">
        <p className="datum">{tx("Practice")}</p>
        <p className="font-mono text-[11px] tabular-nums text-ink-mute">
          {answered}/{questions.length}
        </p>
      </div>

      {questions.map((q, i) => {
        const shown = checked[i];
        const right = picked[i] === q.answer;
        return (
          <div key={i} className="rounded-2xl border border-ink-line bg-paper-light p-5">
            <p className="whitespace-pre-line font-body text-[15px] font-medium text-ink">{q.q}</p>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label={q.q}>
              {q.options.map((opt, oi) => {
                const isPick = picked[i] === oi;
                const isAnswer = shown && oi === q.answer;
                return (
                  <button
                    key={oi}
                    role="radio"
                    aria-checked={isPick}
                    disabled={shown}
                    onClick={() => setPicked((p) => ({ ...p, [i]: oi }))}
                    className={`flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left font-body text-[14px] transition-colors ${
                      isAnswer
                        ? "border-emeraldx-400 bg-emeraldx-400/10 text-ink"
                        : shown && isPick
                          ? "border-saffron-500 bg-saffron-50 text-ink"
                          : isPick
                            ? "border-saffron-500 bg-saffron-50 text-ink"
                            : "border-ink-line text-ink-soft hover:border-saffron-200"
                    } ${shown ? "cursor-default" : ""}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                        isPick || isAnswer ? "border-saffron-500 bg-saffron-500" : "border-ink-line"
                      }`}
                    >
                      {(isPick || isAnswer) && <Check size={9} className="text-white" />}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {shown ? (
              <div className="mt-3 flex items-start gap-2">
                <p
                  className={`font-body text-[13px] leading-relaxed ${
                    right ? "text-emeraldx-400" : "text-saffron-700"
                  }`}
                >
                  <span className="font-semibold">{right ? tx("Correct.") : tx("Not quite.")}</span>{" "}
                  <span className="text-ink-soft">{q.why}</span>
                </p>
              </div>
            ) : (
              <button
                onClick={() => setChecked((c) => ({ ...c, [i]: true }))}
                disabled={picked[i] === undefined}
                className="btn-ghost mt-3 !py-2 !text-xs disabled:opacity-40"
              >
                {tx("Check answer")}
              </button>
            )}

            {shown && (
              <button
                onClick={() => {
                  setChecked((c) => {
                    const next = { ...c };
                    delete next[i];
                    return next;
                  });
                  setPicked((p) => {
                    const next = { ...p };
                    delete next[i];
                    return next;
                  });
                }}
                className="btn-ghost mt-2 !py-1.5 !text-[11px]"
              >
                {tx("Try again")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Assessment ───────────────────────────────────────────────────── */

/**
 * The exam, opened from a quiz lesson.
 *
 * It reuses the platform's assessment runner rather than growing a second
 * quiz engine: same server-side marking, same attempt limits, same evidence
 * written on a pass.
 */
function ExamGate({
  assessmentId,
  courseSlug,
  onClose,
}: {
  assessmentId: string;
  courseSlug: string;
  onClose: () => void;
}) {
  const list = useQuery({
    queryKey: ["course-assessments-all", courseSlug],
    queryFn: () => listCourseAssessments(courseSlug, { includeModules: true }),
  });

  const assessment = (list.data ?? []).find((a) => a.id === assessmentId);
  if (!assessment) return null;

  return <AssessmentRunner assessment={assessment} onClose={onClose} />;
}
