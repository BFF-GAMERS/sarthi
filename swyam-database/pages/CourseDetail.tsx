import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Clock,
  IndianRupee,
  BarChart3,
  BadgeCheck,
  Share2,
  CheckCircle2,
  Award,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import { Reveal, ScaleImage, Stagger, StaggerItem } from "../components/Reveal";
import { StarRating, BookmarkButton } from "../components/Cards";
import { EnrollButton, AddToCartButton } from "../components/ActionButtons";
import { Curriculum } from "../components/Curriculum";
import OfflinePackButton from "../components/offline/OfflinePackButton";
import CourseAssessment from "../components/CourseAssessment";
import CourseDemand from "../components/CourseDemand";
import { courses, orgById } from "../data/mock";
import { useAuth } from "../context/AuthContext";
import { useTx } from "../lib/i18n";
import CourseFacts, { CourseFaqs, feeLine, modeLabel, startLine } from "../components/CourseFacts";
import { getCourseOutline } from "../lib/course-content";
import { LastUpdated } from "../components/Trust";
import Media from "../components/Media";
import { useStickyBar } from "../lib/sticky-bar";

export default function CourseDetail() {
  const tx = useTx();
  // The enrol bar is fixed on a phone; the assistant pill sits above it.
  useStickyBar();
  const { id } = useParams({ from: "/courses/$id" });
  const course = courses.find((c) => c.id === id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shared, setShared] = useState(false);

  if (!course) {
    return (
      <div className="container-x pt-40 text-center text-ink-mute">
        Course not found.{" "}
        <Link to="/courses" className="text-saffron-500">
          {tx("Back to courses")}
        </Link>
      </div>
    );
  }
  const org = orgById(course.orgId);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="pb-36 lg:pb-24">
      {/* Masthead — type on paper, photo as a stamped plate beside it */}
      <section className="border-b border-ink-line">
        <div className="container-x relative grid grid-cols-1 items-center gap-10 pb-14 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:pt-40">
          <Reveal>
            <div className="flex items-center gap-3">
              <p className="kicker">{course.category}</p>
            </div>
            <h1 className="section-title mt-5">{course.title}</h1>
            <Link
              to="/orgs/$id"
              params={{ id: org.id }}
              className="mt-5 inline-flex items-center gap-2.5 font-body text-[15px] font-semibold text-ink-soft transition-colors hover:text-saffron-600"
            >
              <img
                loading="lazy"
                decoding="async"
                src={org.logo}
                alt=""
                className="h-8 w-8 rounded-lg border border-ink-line object-cover"
              />{" "}
              {org.name}
            </Link>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-ink-line pt-5">
              <StarRating value={course.rating} count={course.reviewCount} />
              {/* Hidden at zero: "0 enrolled" is a reason not to enrol, and it
                  is only zero because nobody has yet, not because nobody will. */}
              {course.enrolled > 0 && (
                <span className="font-body text-xs uppercase tracking-wider text-ink-mute">
                  {course.enrolled.toLocaleString("en-IN")} enrolled
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                <span className="chip">{modeLabel(course, tx)}</span>
                <span className="chip">{course.difficulty}</span>
                <span
                  className={`chip ${course.free ? "!bg-emeraldx-400/10 !text-emeraldx-500" : ""}`}
                >
                  {course.free ? tx("Free") : tx("Paid")}
                </span>
              </div>
              <LastUpdated iso={course.updatedAt} />
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="card relative p-2 shadow-[var(--shadow-float)]">
              {/* The page's one big picture: eager, because it is the thing
                  somebody came to look at, and it holds its own space. */}
              <Media
                src={course.hero}
                ratio="16 / 9"
                priority
                className="rounded-[calc(var(--radius-card)-0.5rem)]"
              />
              <p className="flex justify-between px-3 py-3 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
                <span>{course.city}</span>
                <span>{course.duration}</span>
              </p>
              {course.free && <span className="sticker absolute left-5 top-5">{tx("No fee")}</span>}
            </div>
          </Reveal>
        </div>
      </section>

      <div className="container-x mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          {/* A heading with nothing under it is a shelf with nothing on it:
              every section below is drawn only when it has content. */}
          {course.overview?.trim() && (
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-ink">{tx("Overview")}</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">{course.overview}</p>
            </Reveal>
          )}

          {(course.outcomes?.length ?? 0) > 0 && (
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-ink">
                {tx("What you'll learn")}
              </h2>
              <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li
                    key={o}
                    className="flex items-start gap-2.5 rounded-2xl bg-paper-dim p-4 text-sm leading-relaxed text-ink-soft"
                  >
                    <CheckCircle2
                      size={17}
                      className="mt-0.5 shrink-0 text-emeraldx-400"
                      aria-hidden
                    />
                    {o}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <CurriculumSection
            courseSlug={course.id}
            courseTitle={course.title}
            fallback={course.curriculum ?? []}
          />

          {/* Renders nothing unless this course has a published assessment. */}
          <Reveal>
            <CourseAssessment courseSlug={course.id} />
          </Reveal>

          {/* The openings that ask for what this teaches — after the syllabus,
              because the question "is this worth it" only means something once
              you know what "it" is. Draws nothing when none of them match. */}
          <Reveal>
            <CourseDemand course={course} />
          </Reveal>

          {(course.projects?.length ?? 0) > 0 && (
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-ink">
                {tx("Hands-on projects")}
              </h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {course.projects.map((p) => (
                  <div key={p} className="card p-5">
                    <Briefcase size={20} className="text-saffron-500" aria-hidden />
                    <p className="mt-3 font-medium text-ink">{p}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {/* Only real extra pictures: a one-photo gallery is the hero again, and an online
              course has no campus to show. */}
          {course.mode !== "Online" &&
            (course.gallery?.filter((g) => g && g !== course.hero).length ?? 0) > 0 && (
              <Reveal>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  {tx("Campus & labs")}
                </h2>
                <Stagger className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {course.gallery.filter(Boolean).map((g, i) => (
                    <StaggerItem key={i} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                      <ScaleImage
                        src={g}
                        alt={`${course.title} gallery image ${i + 1}`}
                        className="h-full min-h-36 rounded-2xl"
                      />
                    </StaggerItem>
                  ))}
                </Stagger>
              </Reveal>
            )}

          {course.trainer?.name && (
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-ink">{tx("Your trainer")}</h2>
              <div className="card mt-5 flex items-center gap-5 p-6">
                <img
                  loading="lazy"
                  decoding="async"
                  src={course.trainer.avatar}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover"
                />
                <div>
                  <p className="font-display text-lg font-medium text-ink">{course.trainer.name}</p>
                  <p className="mt-1 text-ink-mute">{course.trainer.bio}</p>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal>
            <CourseFaqs course={course} org={org} />
          </Reveal>

          {/* The full table is for the person comparing fine print, so it waits to be asked for. */}
          <Reveal>
            <details className="course-more">
              <summary className="cursor-pointer font-display text-2xl font-semibold text-ink">
                {tx("All course details")}
              </summary>
              <div className="mt-5">
                <CourseFacts course={course} org={org} />
              </div>
            </details>
          </Reveal>

          {/* An empty "Learner reviews" heading is a shelf with nothing on it. */}
          {course.reviews.length > 0 && (
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-ink">
                {tx("Learner reviews")}
              </h2>
              <div className="mt-5 space-y-4">
                {course.reviews.map((r) => (
                  <div key={r.author} className="card p-5">
                    <div className="flex items-center gap-3">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={r.avatar}
                        alt=""
                        className="h-10 w-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium text-ink">{r.author}</p>
                        <StarRating value={r.rating} />
                      </div>
                    </div>
                    <p className="mt-3 leading-relaxed text-ink-soft">"{r.text}"</p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        {/* Sticky enrollment card */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Reveal delay={0.15}>
            <div className="card p-6">
              <p className="font-display text-3xl font-semibold text-ink">
                {course.fees.startsWith("Free") ? (
                  <span className="text-emeraldx-400">{tx("Free")}</span>
                ) : (
                  course.fees
                )}
              </p>
              {course.scholarship && !course.fees.startsWith("Free") && (
                <p className="mt-1 text-sm text-emeraldx-400">{tx("Scholarships available")}</p>
              )}
              <dl className="mt-5 space-y-3 border-t border-ink-line pt-5 text-sm">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-saffron-500" aria-hidden />
                  <dt className="text-ink-mute">{tx("Duration")}</dt>
                  <dd className="ml-auto font-medium text-ink">{course.duration}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <BarChart3 size={16} className="text-saffron-500" aria-hidden />
                  <dt className="text-ink-mute">{tx("Level")}</dt>
                  <dd className="ml-auto font-medium text-ink">{course.difficulty}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <GraduationCap size={16} className="text-saffron-500" aria-hidden />
                  <dt className="text-ink-mute">{tx("Mode")}</dt>
                  <dd className="ml-auto font-medium text-ink">{modeLabel(course, tx)}</dd>
                </div>
              </dl>
              <div className="mt-5 rounded-2xl bg-saffron-50 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-saffron-700">
                  <Award size={16} aria-hidden /> {tx("Certification")}
                </p>
                <p className="mt-1.5 leading-relaxed text-ink-soft">{course.certification}</p>
              </div>
              <EnrollButton courseSlug={course.id} />
              <div className="mt-3 flex flex-wrap gap-2">
                <AddToCartButton courseSlug={course.id} className="flex-1" />
                <BookmarkButton
                  label="Bookmark"
                  kind="course"
                  slug={course.id}
                  title={course.title}
                />
                <button onClick={share} className="btn-ghost flex-1 !py-2 text-sm">
                  <Share2 size={15} aria-hidden /> {shared ? "Link copied!" : "Share"}
                </button>
              </div>
              {/* In the card, not the fixed phone bar: the bar stays Enrol-only. */}
              <OfflinePackButton
                courseSlug={course.id}
                courseTitle={course.title}
                className="mt-3"
              />
            </div>
          </Reveal>
        </aside>
      </div>

      {/*
        The sticky panel on a phone: fee, start, Enrol.

        On a laptop the enrolment card sits beside the content and is always
        in view. On a phone it is the last thing on a long page, so the
        decision the whole page exists for was a scroll of two thousand
        pixels away. This keeps it one thumb away. The right padding leaves
        room for the assistant launcher, which is fixed at the same corner.
      */}
      <div className="fixed inset-x-0 bottom-[var(--bottom-bar,0px)] z-[44] border-t border-ink-line bg-paper-light/95 p-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight text-ink">
              {feeLine(course, tx)}
            </p>
            <p className="truncate font-body text-[11.5px] text-ink-mute">
              {startLine(course, tx)}
            </p>
          </div>
          <div className="shrink-0">
            <EnrollButton courseSlug={course.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The syllabus, with its heading, or nothing at all: a course with no lessons
 * recorded and no printed curriculum would otherwise show a bare "Curriculum"
 * heading. Shares its query with <Curriculum />, so this costs no extra fetch.
 */
function CurriculumSection({
  courseSlug,
  courseTitle,
  fallback,
}: {
  courseSlug: string;
  courseTitle: string;
  fallback: { module: string; topics: string[] }[];
}) {
  const tx = useTx();
  const { profileId } = useAuth();
  const outline = useQuery({
    queryKey: ["course-outline", courseSlug, profileId],
    queryFn: () => getCourseOutline(courseSlug, profileId),
  });
  const modules = outline.data?.modules.length ?? 0;
  if (!outline.isLoading && modules === 0 && fallback.length === 0) return null;
  return (
    <Reveal>
      <h2 className="font-display text-2xl font-semibold text-ink">{tx("Curriculum")}</h2>
      <Curriculum courseSlug={courseSlug} courseTitle={courseTitle} fallback={fallback} />
    </Reveal>
  );
}
