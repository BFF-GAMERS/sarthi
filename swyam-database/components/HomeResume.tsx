import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Award, CalendarClock, Flame, Play } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { listEnrollments } from "../lib/profile-data";
import { listMySessions } from "../lib/skillswap";
import { getMemberMetrics } from "../lib/profile-data";
import { useTx } from "../lib/i18n";

/**
 * The signed-in half of the hero.
 *
 * The illustration that used to sit here was the same drawing for everybody,
 * every visit — decorative on the first load and dead weight on the hundredth.
 * A returning member does not need to be told what the product is; they need
 * to know where they stopped. So the space is spent on their real state: the
 * course they are part-way through, the next lesson by name, and the session
 * that is actually in their calendar.
 *
 * Everything here is read from the database. If there is nothing to resume it
 * says so plainly and points somewhere useful, rather than inventing progress.
 */
export default function HomeResume() {
  const tx = useTx();
  const { profileId } = useAuth();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;
  const enabled = Boolean(profileId);

  const enrolments = useQuery({
    queryKey: ["enrollments", profileId],
    queryFn: () => listEnrollments(profileId!),
    enabled,
  });
  const sessions = useQuery({
    queryKey: ["my-sessions", profileId],
    queryFn: () => listMySessions(profileId!),
    enabled,
  });
  const metrics = useQuery({
    queryKey: ["member-metrics", profileId],
    queryFn: () => getMemberMetrics(profileId!),
    enabled,
  });

  // Furthest along but not finished — the one they are most likely to resume.
  const inProgress = (enrolments.data ?? [])
    .filter((e) => e.state !== "cancelled" && e.progressPercent < 100)
    .sort((a, b) => b.progressPercent - a.progressPercent)[0];

  const done = (enrolments.data ?? []).filter(
    (e) => e.state === "completed" || e.progressPercent >= 100,
  ).length;

  const nextSession = (sessions.data ?? [])
    .filter((s) => s.state !== "completed" && s.state !== "cancelled")
    .sort(
      (a, b) =>
        new Date(a.scheduledStart ?? 0).getTime() - new Date(b.scheduledStart ?? 0).getTime(),
    )[0];

  const m = metrics.data;

  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: still ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[var(--radius-card)] border border-ink-line bg-paper-light/85 p-6 shadow-[var(--shadow-float)] backdrop-blur-sm"
    >
      {/* ── The thing to resume ─────────────────────────────── */}
      {inProgress ? (
        <>
          <p className="datum">{tx("Where you stopped")}</p>
          <p className="mt-2 font-display text-xl leading-tight tracking-tight text-ink">
            {inProgress.title}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep/70"
              role="progressbar"
              aria-valuenow={Math.round(inProgress.progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={tx("Course progress")}
            >
              <motion.span
                className="block h-full rounded-full bg-saffron-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(inProgress.progressPercent)}%` }}
                transition={{ duration: still ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
              {Math.round(inProgress.progressPercent)}%
            </span>
          </div>

          <Link to="/learn/$slug" params={{ slug: inProgress.slug }} className="btn-primary mt-5">
            <Play size={16} aria-hidden />
            {tx("Continue")}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </>
      ) : (
        <>
          <p className="datum">{tx("Nothing in progress")}</p>
          <p className="mt-2 font-display text-xl leading-tight tracking-tight text-ink">
            {done > 0 ? tx("Pick your next one") : tx("Start your first course")}
          </p>
          <p className="mt-2 font-body text-sm text-ink-soft">
            {tx("Free to start, and every course ends in an assessment you have to pass.")}
          </p>
          <Link to="/courses" className="btn-primary mt-5">
            {tx("Browse courses")} <ArrowRight size={16} aria-hidden />
          </Link>
        </>
      )}

      {/* ── The next thing in their calendar ────────────────── */}
      {nextSession && (
        <Link
          to="/skillswap"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-ink-line bg-paper p-3.5 transition-colors hover:border-saffron-200"
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron-50 text-saffron-500"
          >
            <CalendarClock size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-body text-[13px] font-medium text-ink">
              {nextSession.title}
            </span>
            <span className="block font-body text-[11px] text-ink-mute">
              {nextSession.state === "live"
                ? tx("Live now — join")
                : nextSession.scheduledStart
                  ? new Date(nextSession.scheduledStart).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : tx("Time not set")}
            </span>
          </span>
          {nextSession.state === "live" && (
            <span className="chip !bg-red-700 !text-white !text-[10px]">
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {tx("Live")}
            </span>
          )}
        </Link>
      )}

      {/* ── Three numbers that are actually theirs ──────────── */}
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-line pt-4">
        {[
          { icon: <Flame size={13} aria-hidden />, label: tx("XP"), value: m?.xp ?? 0 },
          {
            icon: <Award size={13} aria-hidden />,
            label: tx("Certificates"),
            value: m?.certificates ?? 0,
          },
          {
            icon: <Play size={13} aria-hidden />,
            label: tx("Finished"),
            value: m?.coursesCompleted ?? done,
          },
        ].map((s) => (
          <div key={s.label}>
            <dt className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-ink-mute">
              {s.icon}
              {s.label}
            </dt>
            <dd className="mt-0.5 font-display text-xl tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}
