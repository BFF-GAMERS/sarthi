import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Award, Bookmark, GraduationCap } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { listEnrollments, type Enrollment } from "../lib/profile-data";
import { listBookmarks } from "../lib/learn";
import { listMyCertificates } from "../lib/certificate";
import { courses } from "../data/mock";
import { useTx } from "../lib/i18n";
import { describeProgressPercent, useDetail } from "../lib/a11y";
import { SloganPlate } from "../components/Ornaments";
import MySkillBoard from "../components/MySkillBoard";
import MistakeNotebook from "../components/learning/MistakeNotebook";
import OfflineStorageList from "../components/offline/OfflineStorageList";

/**
 * Everything the learner has started, in one place.
 *
 * The dashboard already counted enrolments; counting is not the same as being
 * able to get back to them. This is the page that answers "where was I" — each
 * course with its real progress and a link that resumes at the first
 * unfinished lesson, plus the certificates already earned and every lesson
 * that has been starred.
 */
export default function MyLearning() {
  const tx = useTx();
  const navigate = useNavigate();
  const { user, profileId, ready } = useAuth();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const enabled = Boolean(profileId);

  const enrolments = useQuery({
    queryKey: ["enrollments", profileId],
    queryFn: () => listEnrollments(profileId!),
    enabled,
  });
  const certificates = useQuery({
    queryKey: ["certificates", profileId],
    queryFn: () => listMyCertificates(profileId!),
    enabled,
  });
  const bookmarks = useQuery({
    queryKey: ["bookmarks", profileId],
    queryFn: () => listBookmarks(profileId!),
    enabled,
  });

  const rows = (enrolments.data ?? []).filter((e) => e.state !== "cancelled");

  return (
    <div className="container-x max-w-5xl pb-24 pt-28">
      <Reveal>
        <SloganPlate tone="marigold">{tx("My learning")}</SloganPlate>
        <h1 className="mt-3 section-title">{tx("Where you left off")}</h1>
      </Reveal>

      {/* ── Courses ─────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <GraduationCap size={22} className="mx-auto text-ink-mute" aria-hidden />
          <p className="mt-3 font-body text-sm text-ink-soft">
            {tx("You have not started a course yet.")}
          </p>
          <Link to="/courses" className="btn-primary mt-5">
            {tx("Browse courses")}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((e, i) => (
            <motion.li
              key={e.id}
              initial={still ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : i * 0.04 }}
            >
              <CourseRow enrolment={e} tx={tx} />
            </motion.li>
          ))}
        </ul>
      )}

      {/* ── Certificates ────────────────────────────────────── */}
      {(certificates.data ?? []).length > 0 && (
        <Reveal className="mt-12">
          <p className="datum">{tx("Certificates")}</p>
          <ul className="mt-3 space-y-2">
            {(certificates.data ?? []).map((c) => (
              <li key={c.serial} className="card flex flex-wrap items-center gap-3 p-4">
                <Award size={18} className="shrink-0 text-emeraldx-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[14px] font-medium text-ink">{c.title}</p>
                  <p className="font-mono text-[11px] text-ink-mute">{c.serial}</p>
                </div>
                <Link
                  to="/verify/$serial"
                  params={{ serial: c.serial }}
                  className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]"
                >
                  {tx("View")}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {/* ── Bookmarks ───────────────────────────────────────── */}
      {(bookmarks.data ?? []).length > 0 && (
        <Reveal className="mt-12">
          <p className="datum">{tx("My bookmarks")}</p>
          <ul className="mt-3 space-y-2">
            {(bookmarks.data ?? []).map((b) => (
              <li key={b.lessonId} className="card flex flex-wrap items-center gap-3 p-4">
                <Bookmark
                  size={16}
                  className="shrink-0 fill-saffron-500 text-saffron-500"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[14px] text-ink">{b.title}</p>
                  <p className="truncate font-body text-[11px] text-ink-mute">{b.moduleTitle}</p>
                </div>
                {b.courseSlug && (
                  <Link
                    to="/learn/$slug"
                    params={{ slug: b.courseSlug }}
                    className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]"
                  >
                    {tx("Open")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {/* ── Downloads for offline study ─────────────────────── */}
      <Reveal className="mt-12">
        <OfflineStorageList />
      </Reveal>

      {/* ── Practice ────────────────────────────────────────── */}
      {/* The target of the Practice navigation item and of Home's "Prove it now":
          the skills you teach or are learning, with every assessment that can
          prove them. It is real content, so the anchor always lands somewhere. */}
      <Reveal className="mt-12">
        <section id="practice" aria-labelledby="practice-title" className="scroll-mt-28">
          <p className="datum">{tx("Practice")}</p>
          <h2
            id="practice-title"
            className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink"
          >
            {tx("Prove what you can do")}
          </h2>
          <p className="mt-2 max-w-xl font-body text-[13.5px] leading-relaxed text-ink-soft">
            {tx(
              "Add a skill, and any assessment for it will appear here. Pass it and it is recorded on your passport.",
            )}
          </p>
          <div className="mt-5">
            <MySkillBoard profileId={profileId} />
          </div>
          <Link to="/coach" className="btn-ghost mt-5">
            {tx("Practice with the AI coach")} <ArrowRight size={14} aria-hidden />
          </Link>
        </section>
      </Reveal>

      {/* ── Notebook ────────────────────────────────────────── */}
      {/* Assessment questions that did not land, kept on this device for a calm second look. */}
      <Reveal className="mt-12">
        <MistakeNotebook profileId={profileId} />
      </Reveal>
    </div>
  );
}

function CourseRow({ enrolment, tx }: { enrolment: Enrollment; tx: (s: string) => string }) {
  // `slug` is the catalogue id, which is what both the course page and the
  // learning route are keyed on.
  const course = courses.find((c) => c.id === enrolment.slug);
  const detail = useDetail();
  const percent = Math.round(enrolment.progressPercent ?? 0);
  const done = enrolment.state === "completed" || percent >= 100;

  return (
    <div className="card flex flex-wrap items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <p className="font-body text-[15px] font-medium text-ink">
          {enrolment.title || course?.title || enrolment.slug}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep/70"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={tx("Course progress")}
          >
            <span
              className={`block h-full rounded-full transition-[width] duration-500 ${
                done ? "bg-emeraldx-400" : "bg-saffron-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-mute">
            {done ? tx("Completed") : `${percent}%`}
          </span>
          {/* "62%" beside a coloured bar says nothing when it is read aloud.
              Only for members who asked for the longer descriptions. */}
          {detail && (
            <span className="sr-only">
              {describeProgressPercent(enrolment.lessonsCompleted, percent, enrolment.title)}
            </span>
          )}
        </div>
      </div>

      <Link
        to="/learn/$slug"
        params={{ slug: enrolment.slug }}
        className="btn-primary shrink-0 !py-2.5 !text-xs"
      >
        {done ? tx("Review") : percent > 0 ? tx("Continue learning") : tx("Start learning")}
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}
