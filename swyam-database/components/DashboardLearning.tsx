import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Award, Bookmark, Bot, CheckCircle2, GraduationCap, Play } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { listEnrollments, type Enrollment } from "../lib/profile-data";
import { listBookmarks } from "../lib/learn";
import { listMyCertificates } from "../lib/certificate";
import { myMentorPlans } from "../lib/mentor";
import { ResumeLine } from "./Curriculum";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";

const clicked = (section: string, position?: number) =>
  track(EV.DASHBOARD_SECTION_CLICKED, { section, position });

/**
 * My Learning, living on the dashboard.
 *
 * It was a separate page reachable only from a menu, so the dashboard counted
 * "3 courses" and then made you leave it to find out which three. Counting is
 * not the same as being able to get back to something. Everything the learner
 * has started is here — courses, self-paced mentor plans, certificates and
 * starred lessons — and every row resumes where they stopped.
 *
 * The standalone /my-learning page still exists and renders the same data;
 * this is not a copy of the logic, it is the same queries rendered in the
 * shape a dashboard column needs.
 */
export default function DashboardLearning({ profileId }: { profileId: string | null }) {
  const tx = useTx();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;
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

  // Self-paced plans are held on this device, so they are read directly rather
  // than through a query — there is no server call to cache.
  const plans = myMentorPlans();

  const rows = (enrolments.data ?? [])
    .filter((e) => e.state !== "cancelled")
    .sort((a, b) => {
      const done = (e: Enrollment) => (e.state === "completed" ? 1 : 0);
      return done(a) - done(b) || b.progressPercent - a.progressPercent;
    });

  const nothing = rows.length === 0 && plans.length === 0;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
          <GraduationCap size={18} className="text-saffron-500" aria-hidden />
          {tx("My learning")}
        </h2>
        <Link
          to="/my-learning"
          onClick={() => clicked("learning")}
          className="font-body text-[12px] text-saffron-600 hover:underline"
        >
          {tx("Full page")}
        </Link>
      </div>

      {nothing ? (
        <div className="mt-5 rounded-2xl border border-dashed border-ink-line p-6 text-center">
          <p className="font-body text-sm text-ink-soft">{tx("Nothing started yet.")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/courses" className="btn-primary !py-2 !text-xs">
              {tx("Browse courses")}
            </Link>
            <Link to="/skills" className="btn-ghost !py-2 !text-xs">
              {tx("Pick a skill")}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((l, i) => {
            const done = l.state === "completed";
            return (
              <li key={l.id}>
                <Link
                  to="/learn/$slug"
                  params={{ slug: l.slug }}
                  onClick={() => clicked("learning", i + 1)}
                  className="group block rounded-2xl border border-ink-line p-4 transition-colors hover:border-saffron-200"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[14px] font-medium text-ink transition-colors group-hover:text-saffron-600">
                        {l.title}
                      </p>
                      <p className="mt-0.5 font-body text-[11px] text-ink-mute">
                        {l.lessonsCompleted}{" "}
                        {l.lessonsCompleted === 1 ? tx("lesson") : tx("lessons")} {tx("done")}
                        {done && l.completedAt
                          ? ` · ${tx("finished")} ${new Date(l.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                          : ""}
                      </p>
                      {!done && <ResumeLine courseSlug={l.slug} />}
                    </div>
                    {done ? (
                      <span className="chip shrink-0 !bg-emeraldx-400 !text-paper-light !text-[10px]">
                        <CheckCircle2 size={11} aria-hidden /> {tx("Complete")}
                      </span>
                    ) : (
                      <span className="shrink-0 font-display text-sm tabular-nums text-saffron-500">
                        {Math.round(l.progressPercent)}%
                      </span>
                    )}
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-ink/8"
                    role="progressbar"
                    aria-valuenow={Math.round(l.progressPercent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${l.title} ${tx("progress")}`}
                  >
                    <motion.div
                      className={`h-full rounded-full ${done ? "bg-emeraldx-400" : "bg-saffron-500"}`}
                      initial={still ? false : { width: 0 }}
                      animate={{ width: `${l.progressPercent}%` }}
                      transition={{ duration: still ? 0 : 0.8, delay: still ? 0 : i * 0.06 }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}

          {/* Self-paced plans sit alongside courses, because to the learner
              they are the same thing: something they started. */}
          {plans.map(({ slug, plan, done }) => {
            const total = plan.modules.length || 1;
            const pct = Math.round((done / total) * 100);
            return (
              <li key={`mentor-${slug}`}>
                <Link
                  to="/mentor/$slug"
                  params={{ slug }}
                  onClick={() => clicked("learning")}
                  className="group block rounded-2xl border border-ink-line p-4 transition-colors hover:border-saffron-200"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-body text-[14px] font-medium text-ink transition-colors group-hover:text-saffron-600">
                        <Bot size={14} className="shrink-0 text-saffron-500" aria-hidden />
                        {plan.skill}
                      </p>
                      <p className="mt-0.5 font-body text-[11px] text-ink-mute">
                        {tx("Self-paced")} · {done}/{plan.modules.length} {tx("modules")}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-sm tabular-nums text-saffron-500">
                      {pct}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-ink/8"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${plan.skill} ${tx("progress")}`}
                  >
                    <motion.div
                      className="h-full rounded-full bg-saffron-500"
                      initial={still ? false : { width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: still ? 0 : 0.8 }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* What they have to show for it. Hidden entirely when there is none —
          an empty certificate shelf is not encouraging, it is just empty. */}
      {(certificates.data ?? []).length > 0 && (
        <div className="mt-5 border-t border-ink-line pt-4">
          <p className="datum">{tx("Certificates")}</p>
          <ul className="mt-2 space-y-1.5">
            {(certificates.data ?? []).slice(0, 3).map((c) => (
              <li key={c.serial}>
                <Link
                  to="/verify/$serial"
                  params={{ serial: c.serial }}
                  onClick={() => clicked("certificates")}
                  className="flex items-center gap-2 font-body text-[13px] text-ink-soft transition-colors hover:text-saffron-600"
                >
                  <Award size={13} className="shrink-0 text-saffron-500" aria-hidden />
                  <span className="truncate">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(bookmarks.data ?? []).length > 0 && (
        <div className="mt-5 border-t border-ink-line pt-4">
          <p className="datum">
            {tx("Starred lessons")} · {(bookmarks.data ?? []).length}
          </p>
          <ul className="mt-2 space-y-1.5">
            {(bookmarks.data ?? []).slice(0, 3).map((b) => (
              <li
                key={b.lessonId}
                className="flex items-center gap-2 font-body text-[13px] text-ink-soft"
              >
                <Bookmark size={13} className="shrink-0 text-ink-mute" aria-hidden />
                <span className="truncate">{b.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.some((r) => r.state !== "completed") && (
        <Link
          to="/my-learning"
          onClick={() => clicked("learning")}
          className="btn-ghost mt-5 w-full justify-center !py-2.5 !text-xs"
        >
          <Play size={13} aria-hidden /> {tx("See everything")} <ArrowRight size={13} aria-hidden />
        </Link>
      )}
    </section>
  );
}
