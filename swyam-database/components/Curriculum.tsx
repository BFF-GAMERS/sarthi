import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { Award, Check, ChevronDown, Circle, Clock, Loader2, PlayCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { EV } from "@/evolution";
import { entityId, trackOnce } from "@/evolution/runtime/tracker/track";
import { getCourseOutline, nextLesson, setLessonComplete } from "../lib/course-content";
import { issueCertificate } from "../lib/certificate";
import { requestMail } from "../lib/mail-client";
import { describeProgress, useDetail } from "../lib/a11y";
import { useTx } from "../lib/i18n";

/**
 * The inside of a course.
 *
 * For a visitor this is the syllabus — modules, lessons, how long each takes.
 * For someone enrolled it is the course itself: every lesson is a checkbox,
 * ticking one moves the bar and earns a hundred points, and the last tick
 * mints the certificate.
 *
 * `fallback` is the prose curriculum from the catalogue, shown only if a
 * course has no lessons recorded yet, so the page is never blank.
 */
export function Curriculum({
  courseSlug,
  courseTitle,
  fallback,
}: {
  courseSlug: string;
  courseTitle: string;
  fallback: { module: string; topics: string[] }[];
}) {
  const tx = useTx();
  const { user, profileId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState<number>(0);
  const [note, setNote] = useState<string | null>(null);
  const detail = useDetail();

  const outline = useQuery({
    queryKey: ["course-outline", courseSlug, profileId],
    queryFn: () => getCourseOutline(courseSlug, profileId),
  });

  const data = outline.data;
  const enrolled = data?.enrolled ?? false;

  // Open the module the learner is actually in, once the data lands.
  useEffect(() => {
    if (!data || !data.enrolled) return;
    const next = nextLesson(data);
    if (!next) return;
    const i = data.modules.findIndex((m) => m.lessons.some((l) => l.id === next.id));
    if (i >= 0) setOpen(i);
  }, [data]);

  const toggle = useMutation({
    mutationFn: async (v: { lessonId: string; complete: boolean }) => {
      if (!data?.enrollmentId) throw new Error("You are not enrolled on this course.");
      await setLessonComplete(data.enrollmentId, v.lessonId, v.complete);

      // Was that the last one? Finishing is the whole reason anyone starts.
      const done = data.completedLessons + (v.complete ? 1 : -1);
      if (v.complete && data.totalLessons > 0 && done >= data.totalLessons && profileId) {
        try {
          const cert = await issueCertificate(profileId, courseSlug);
          if (user?.email) {
            void requestMail({
              kind: "certificate",
              to: user.email,
              name: user.name,
              courseTitle,
              serial: cert.serial,
            });
          }
          return "certificate" as const;
        } catch {
          // The enrolment is complete either way; the passport can re-issue.
          return "completed" as const;
        }
      }
      return "progress" as const;
    },
    onSuccess: (result, variables) => {
      if (result !== "progress") {
        trackOnce(
          `done:${courseSlug}`,
          EV.COURSE_COMPLETED,
          {},
          { entityId: entityId("crs", courseSlug) },
        );
      }
      void qc.invalidateQueries({ queryKey: ["course-outline", courseSlug, profileId] });
      void qc.invalidateQueries({ queryKey: ["enrollments", profileId] });
      void qc.invalidateQueries({ queryKey: ["enrollment", profileId, courseSlug] });
      void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
      void qc.invalidateQueries({ queryKey: ["wallet", profileId] });
      void qc.invalidateQueries({ queryKey: ["certificates", profileId] });
      if (result === "certificate") {
        setNote("Course complete — your certificate is in your passport.");
      } else if (result === "progress" && variables.complete) {
        setNote("+100 points");
      } else {
        setNote(null);
      }
      window.setTimeout(() => setNote(null), 4000);
    },
  });

  /* ── No lessons recorded: fall back to the printed syllabus ─────── */
  if (!outline.isLoading && (data?.modules.length ?? 0) === 0) {
    return (
      <Accordion
        open={open}
        setOpen={setOpen}
        items={fallback.map((m) => ({
          title: m.module,
          meta: `${m.topics.length} topics`,
          rows: m.topics.map((t) => ({ key: t, node: <PlainRow title={t} /> })),
        }))}
      />
    );
  }

  const pct = Math.round(data?.progressPercent ?? 0);

  return (
    <div>
      {outline.isLoading ? (
        <div
          className="mt-4 space-y-3"
          aria-busy="true"
          aria-label={tx("Loading the syllabus\u2026")}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="h-4 w-1/2 rounded bg-paper-dim" />
              <div className="mt-3 h-3 w-3/4 rounded bg-paper-dim" />
              <div className="mt-2 h-3 w-2/3 rounded bg-paper-dim" />
            </div>
          ))}
        </div>
      ) : enrolled ? (
        <div className="mt-4 rounded-2xl border border-ink-line bg-paper-light p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-body text-sm text-ink">
              <strong className="font-semibold">
                {data!.completedLessons} of {data!.totalLessons}
              </strong>{" "}
              lessons done
            </p>
            <span className="font-mono text-sm font-semibold text-saffron-500 tabular-nums">
              {pct}%
            </span>
          </div>
          <div
            className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-paper-dim"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${courseTitle} progress`}
          >
            <motion.div
              className="h-full rounded-full bg-saffron-500"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {detail && (
            <p className="sr-only">
              {describeProgress(data!.completedLessons, data!.totalLessons, courseTitle)}
            </p>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-[12px] text-ink-mute">
            <span>{tx("Tick a lesson as you finish it \u2014 each one is worth 100 points.")}</span>
            {pct >= 100 && (
              <Link to="/passport" className="link-sweep font-medium text-saffron-500">
                <Award size={12} className="mr-1 inline" aria-hidden />
                {tx("See your certificate")}
              </Link>
            )}
          </p>
          {note && (
            <p
              role="status"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emeraldx-400/15 px-3 py-1 font-body text-[12px] font-medium text-emeraldx-400"
            >
              <Check size={12} aria-hidden /> {note}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 font-body text-sm text-ink-mute">
          {data!.modules.length} {data!.modules.length === 1 ? tx("module") : tx("modules")}
          {data!.totalLessons > 0 && (
            <>
              {", "}
              {tx("starting with")} {data!.totalLessons}{" "}
              {data!.totalLessons === 1 ? tx("free preview lesson") : tx("free preview lessons")}
            </>
          )}
          {". "}
          <button
            onClick={() => void navigate({ to: profileId ? "/courses" : "/auth" })}
            className="link-sweep font-medium text-saffron-500"
          >
            {tx("Enroll")}
          </button>{" "}
          {tx("to unlock the rest and earn the certificate.")}
        </p>
      )}

      <Accordion
        open={open}
        setOpen={setOpen}
        items={(data?.modules ?? []).map((m) => {
          const done = m.lessons.filter((l) => l.completed).length;
          return {
            title: m.title,
            // Outside an enrolment the row count is whatever RLS lets through,
            // so "0 lessons" would mean "locked", not "empty". Say locked.
            meta: enrolled
              ? `${done}/${m.lessons.length} done`
              : m.lessons.length > 0
                ? `${m.lessons.length} free lesson${m.lessons.length === 1 ? "" : "s"}`
                : tx("Enroll to unlock"),
            complete: enrolled && m.lessons.length > 0 && done === m.lessons.length,
            rows: m.lessons.map((l) => ({
              key: l.id,
              node: enrolled ? (
                <button
                  onClick={() => toggle.mutate({ lessonId: l.id, complete: !l.completed })}
                  disabled={toggle.isPending}
                  aria-pressed={l.completed}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-paper-dim disabled:opacity-60"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                      l.completed
                        ? "border-emeraldx-400 bg-emeraldx-400 text-paper-light"
                        : "border-ink-line text-transparent group-hover:border-saffron-500"
                    }`}
                    aria-hidden
                  >
                    {toggle.isPending && toggle.variables?.lessonId === l.id ? (
                      <Loader2 size={12} className="animate-spin text-ink-mute" />
                    ) : (
                      <Check size={12} />
                    )}
                  </span>
                  <span
                    className={`flex-1 font-body text-sm ${
                      l.completed ? "text-ink-mute line-through" : "text-ink-soft"
                    }`}
                  >
                    {l.title}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-mute tabular-nums">
                    {l.durationMinutes}m
                  </span>
                </button>
              ) : (
                <PlainRow title={l.title} minutes={l.durationMinutes} />
              ),
            })),
          };
        })}
      />
    </div>
  );
}

function PlainRow({ title, minutes }: { title: string; minutes?: number }) {
  return (
    <div className="flex w-full items-center gap-3 px-2 py-2">
      <Circle size={8} className="shrink-0 fill-saffron-500 text-saffron-500" aria-hidden />
      <span className="flex-1 font-body text-sm text-ink-soft">{title}</span>
      {minutes !== undefined && (
        <span className="shrink-0 font-mono text-[11px] text-ink-mute tabular-nums">
          <Clock size={10} className="mr-1 inline" aria-hidden />
          {minutes}m
        </span>
      )}
    </div>
  );
}

interface AccordionItem {
  title: string;
  meta: string;
  complete?: boolean;
  rows: { key: string; node: ReactNode }[];
}

function Accordion({
  items,
  open,
  setOpen,
}: {
  items: AccordionItem[];
  open: number;
  setOpen: (i: number) => void;
}) {
  return (
    <div className="mt-5 space-y-3">
      {items.map((m, i) => (
        <div key={m.title} className="glass overflow-hidden rounded-2xl">
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            aria-expanded={open === i}
          >
            <span className="flex min-w-0 items-center gap-3 font-medium text-ink">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-[11px] ${
                  m.complete
                    ? "bg-emeraldx-400 text-paper-light"
                    : "bg-saffron-100 text-saffron-500"
                }`}
                aria-hidden
              >
                {m.complete ? <Check size={12} /> : i + 1}
              </span>
              <span className="truncate">{m.title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2.5">
              <span className="font-mono text-[11px] text-ink-mute tabular-nums">{m.meta}</span>
              <ChevronDown
                size={18}
                className={`text-ink-mute transition-transform ${open === i ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>
          <motion.div
            initial={false}
            animate={{ height: open === i ? "auto" : 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 px-3 pb-4">
              {m.rows.map((r) => (
                <div key={r.key}>{r.node}</div>
              ))}
            </div>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

/** "Next: <lesson>", for the dashboard's list of enrolled courses. */
export function ResumeLine({ courseSlug }: { courseSlug: string }) {
  const { profileId } = useAuth();
  const outline = useQuery({
    queryKey: ["course-outline", courseSlug, profileId],
    queryFn: () => getCourseOutline(courseSlug, profileId),
    enabled: Boolean(profileId),
  });
  const next = outline.data ? nextLesson(outline.data) : null;
  if (!next) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 font-body text-[12px] text-ink-mute">
      <PlayCircle size={13} className="shrink-0 text-saffron-500" aria-hidden />
      Next: {next.title}
    </span>
  );
}
