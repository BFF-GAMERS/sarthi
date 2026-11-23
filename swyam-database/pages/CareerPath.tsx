import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Check,
  CircleDashed,
  Loader2,
  Repeat2,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  analyseGap,
  choosePath,
  courseSlugs,
  generatePlan,
  getCareerPath,
  getGoalForPath,
  listPlanItems,
  setPlanItemState,
  type GapSkill,
  type PlanItemState,
} from "../lib/career";
import { Reveal } from "../components/Reveal";
import CareerTestDrive from "../components/learning/CareerTestDrive";
import { driveFor } from "../data/career-test-drive";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";
import { entityId } from "@/evolution/runtime/tracker/track";

/**
 * One career path: how far along you are, and what closes the gap.
 *
 * Every number here comes from `analyse_career_gap`, which has been in the
 * database, granted to `authenticated`, and called by nothing. The readiness
 * percentage is a weighted coverage of the path's skills, discounted where a
 * skill is unproven — computed in Postgres, not here, because a second
 * implementation in TypeScript would drift from the first within a month.
 *
 * The four buckets are the point of the page, and the one that matters most
 * is `claimed`: a skill you typed into your profile counts for less than one
 * an assessment confirmed. Showing those separately is the difference between
 * a progress bar and an honest answer.
 */

const BUCKETS = [
  {
    key: "proven" as const,
    title: "Proven",
    note: "Held at the level this path needs, and backed by evidence.",
    tone: "text-emeraldx-400",
    icon: BadgeCheck,
  },
  {
    key: "claimed" as const,
    title: "Claimed, not proven",
    note: "You have said you can do these. An assessment turns them into proof.",
    tone: "text-marigold-600",
    icon: TriangleAlert,
  },
  {
    key: "partial" as const,
    title: "Part of the way",
    note: "You hold these, but below the level the path asks for.",
    tone: "text-saffron-600",
    icon: CircleDashed,
  },
  {
    key: "missing" as const,
    title: "Not yet started",
    note: "Nothing on your profile covers these.",
    tone: "text-ink-mute",
    icon: CircleDashed,
  },
];

function SkillRow({ s, tx }: { s: GapSkill; tx: (k: string) => string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1.5">
      <span className="font-body text-[14px] text-ink">{s.skill}</span>
      <span className="chip !text-[10px] capitalize">{tx(s.stage)}</span>
      {s.required && (
        <span className="font-body text-[12px] text-ink-mute">
          {tx("needs")} <span className="capitalize">{s.required}</span>
          {s.level ? (
            <>
              {" · "}
              {tx("you have")} <span className="capitalize">{s.level}</span>
            </>
          ) : null}
        </span>
      )}
    </li>
  );
}

export default function CareerPath() {
  const tx = useTx();
  const { slug } = useParams({ from: "/careers/$slug" });
  const { profileId, user } = useAuth();
  const qc = useQueryClient();

  const path = useQuery({ queryKey: ["career-path", slug], queryFn: () => getCareerPath(slug) });
  const pathId = path.data?.id;

  const gap = useQuery({
    queryKey: ["career-gap", profileId, pathId],
    queryFn: () => analyseGap(profileId!, pathId!),
    enabled: Boolean(profileId && pathId),
  });

  const goal = useQuery({
    queryKey: ["career-goal", profileId, pathId],
    queryFn: () => getGoalForPath(profileId!, pathId!),
    enabled: Boolean(profileId && pathId),
  });

  const plan = useQuery({
    queryKey: ["career-plan", goal.data?.id],
    queryFn: () => listPlanItems(goal.data!.id),
    enabled: Boolean(goal.data?.id),
  });

  const slugs = useQuery({
    queryKey: ["plan-course-slugs", goal.data?.id, (plan.data ?? []).length],
    queryFn: () =>
      courseSlugs(
        (plan.data ?? []).filter((i) => i.kind === "course" && i.refId).map((i) => i.refId!),
      ),
    enabled: (plan.data ?? []).some((i) => i.kind === "course" && i.refId),
  });

  const start = useMutation({
    mutationFn: async () => {
      const goalId = await choosePath(profileId!, pathId!);
      await generatePlan(goalId);
      return goalId;
    },
    onSuccess: () => {
      track(
        EV.CAREER_LAUNCHER_OPENED,
        { surface: "path", action: "plan_built" },
        { entityId: entityId("car", slug) },
      );
      void qc.invalidateQueries({ queryKey: ["career-goal", profileId, pathId] });
      void qc.invalidateQueries({ queryKey: ["career-plan"] });
      void qc.invalidateQueries({ queryKey: ["my-goals", profileId] });
    },
  });

  const rebuild = useMutation({
    mutationFn: () => generatePlan(goal.data!.id),
    onSuccess: () => {
      track(
        EV.CAREER_LAUNCHER_OPENED,
        { surface: "path", action: "plan_built" },
        { entityId: entityId("car", slug) },
      );
      void qc.invalidateQueries({ queryKey: ["career-plan", goal.data?.id] });
    },
  });

  const tick = useMutation({
    mutationFn: (v: { id: string; state: PlanItemState }) => setPlanItemState(v.id, v.state),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["career-plan", goal.data?.id] }),
  });

  if (path.isLoading) {
    return (
      <div className="container-x max-w-3xl pb-24 pt-28">
        <p className="font-body text-sm text-ink-mute">{tx("Loading…")}</p>
      </div>
    );
  }

  if (!path.data) {
    return (
      <div className="container-x max-w-3xl pb-24 pt-28 text-center">
        <h1 className="section-title">{tx("No such path")}</h1>
        <Link to="/careers" className="btn-primary mt-7 !py-2.5 !text-xs">
          {tx("All career paths")}
        </Link>
      </div>
    );
  }

  const p = path.data;
  const g = gap.data;
  const readiness = Math.round(g?.readiness ?? 0);

  return (
    <div className="container-x max-w-3xl pb-24 pt-28">
      <Link
        to="/careers"
        className="inline-flex items-center gap-1.5 font-body text-[13px] text-ink-mute transition-colors hover:text-saffron-600"
      >
        <ArrowLeft size={13} aria-hidden /> {tx("All career paths")}
      </Link>

      <Reveal className="mt-4">
        <h1 className="section-title">{p.title}</h1>
        {p.summary && <p className="type-lede mt-4">{p.summary}</p>}
        {p.typicalTitles.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {p.typicalTitles.map((t) => (
              <li key={t} className="chip !text-[11px]">
                {t}
              </li>
            ))}
          </ul>
        )}
        {p.description && (
          <p className="mt-5 font-body text-[15px] leading-relaxed text-ink-soft">
            {p.description}
          </p>
        )}
      </Reveal>

      {/* A short, local-only taste of the job, for paths that have seeded tasks. */}
      {driveFor(p.slug) && (
        <Reveal className="mt-8">
          <CareerTestDrive slug={p.slug} profileId={profileId} />
        </Reveal>
      )}

      {/* Readiness */}
      {profileId && g && (
        <Reveal className="mt-8">
          <section className="panel p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="datum">{tx("How ready you are")}</p>
                <p className="mt-1 font-display text-4xl tabular-nums text-ink">{readiness}%</p>
              </div>
              {!goal.data ? (
                <button
                  onClick={() => start.mutate()}
                  disabled={start.isPending}
                  className="btn-primary !py-2.5 !text-xs disabled:opacity-60"
                >
                  {start.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  <Target size={13} aria-hidden /> {tx("Make this my goal")}
                </button>
              ) : (
                <button
                  onClick={() => rebuild.mutate()}
                  disabled={rebuild.isPending}
                  className="btn-ghost !py-2.5 !text-xs disabled:opacity-60"
                >
                  {rebuild.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  {tx("Rebuild the plan")}
                </button>
              )}
            </div>

            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-paper-deep/70"
              role="img"
              aria-label={`${readiness}% ${tx("ready")}`}
            >
              <div
                className="h-full rounded-full bg-saffron-500 transition-[width] duration-500"
                style={{ width: `${Math.max(readiness, 1)}%` }}
              />
            </div>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-ink-mute">
              {tx(
                "Weighted across the skills this path needs. A skill you have proven counts fully; one you have only claimed counts for less, because an employer cannot check it.",
              )}
            </p>
          </section>
        </Reveal>
      )}

      {/* The four buckets */}
      {profileId && g && (
        <div className="mt-6 space-y-4">
          {BUCKETS.map((b) => {
            const rows = g[b.key];
            if (rows.length === 0) return null;
            const Icon = b.icon;
            return (
              <Reveal key={b.key}>
                <section className="panel p-6">
                  <h2 className="flex items-center gap-2 font-display text-base tracking-tight text-ink">
                    <Icon size={16} className={b.tone} aria-hidden />
                    {tx(b.title)}
                    <span className="font-mono text-[11px] tabular-nums text-ink-mute">
                      {rows.length}
                    </span>
                  </h2>
                  <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-mute">
                    {tx(b.note)}
                  </p>
                  <ul className="mt-3 divide-y divide-ink-line">
                    {rows.map((s) => (
                      <SkillRow key={s.skillId} s={s} tx={tx} />
                    ))}
                  </ul>
                  {b.key === "claimed" && (
                    <Link to="/board" className="btn-ghost mt-4 !py-2 !text-xs">
                      {tx("Take an assessment")}
                    </Link>
                  )}
                </section>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* The plan */}
      {goal.data && (plan.data ?? []).length > 0 && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="font-display text-lg tracking-tight text-ink">{tx("Your plan")}</h2>
            <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-mute">
              {tx(
                "Built from the gaps above, foundation skills first. Courses come from the catalog; swaps come from people here who already teach the skill.",
              )}
            </p>
            <ul className="mt-4 space-y-2">
              {(plan.data ?? []).map((item) => {
                const done = item.state === "done";
                const slugForCourse = item.refId ? slugs.data?.[item.refId] : undefined;
                return (
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                      done ? "border-ink-line bg-paper-dim" : "border-ink-line"
                    }`}
                  >
                    <button
                      onClick={() => tick.mutate({ id: item.id, state: done ? "todo" : "done" })}
                      disabled={tick.isPending}
                      aria-pressed={done}
                      aria-label={done ? tx("Mark as not done") : tx("Mark as done")}
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
                        done
                          ? "border-emeraldx-400 bg-emeraldx-400/15 text-emeraldx-400"
                          : "border-ink-line text-transparent hover:border-saffron-400"
                      }`}
                    >
                      <Check size={12} aria-hidden />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-body text-sm font-medium ${done ? "text-ink-mute line-through" : "text-ink"}`}
                      >
                        {item.title}
                      </p>
                      {item.rationale && (
                        <p className="mt-1 font-body text-[12px] leading-relaxed text-ink-mute">
                          {item.rationale}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.kind === "course" && slugForCourse && (
                          <Link
                            to="/courses/$id"
                            params={{ id: slugForCourse }}
                            className="inline-flex items-center gap-1.5 font-body text-[12px] text-saffron-700 underline-offset-2 hover:underline"
                          >
                            <BookOpen size={12} aria-hidden /> {tx("Open the course")}
                          </Link>
                        )}
                        {item.kind === "skill" && (
                          <Link
                            to="/skillswap"
                            className="inline-flex items-center gap-1.5 font-body text-[12px] text-saffron-700 underline-offset-2 hover:underline"
                          >
                            <Repeat2 size={12} aria-hidden /> {tx("Find a swap partner")}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </Reveal>
      )}

      {goal.data && (plan.data ?? []).length === 0 && !plan.isLoading && (
        <Reveal className="mt-6">
          <p className="panel p-6 font-body text-[13px] leading-relaxed text-ink-soft">
            {tx(
              "There is nothing to add to your plan — either you already hold everything this path asks for, or no course or swap partner covers the gaps yet.",
            )}
          </p>
        </Reveal>
      )}

      {!user && (
        <Reveal className="mt-8">
          <p className="panel p-6 text-center font-body text-[13px] leading-relaxed text-ink-soft">
            <Link to="/auth" search={{ mode: "login" }} className="link-sweep text-saffron-600">
              {tx("Sign in")}
            </Link>{" "}
            {tx(
              "to see how far along this path you already are, and get the plan that closes the gap.",
            )}
          </p>
        </Reveal>
      )}
    </div>
  );
}
