import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Search,
  Target,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { CourseCard } from "../components/Cards";
import OpportunityCard from "../components/OpportunityCard";
import NextBestAction from "../components/NextBestAction";
import { courses } from "../data/mock";
import { listOpportunities, matchAgainst, type Opportunity } from "../lib/opportunities";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../data/mock";
import { initialsAvatar } from "../lib/avatar";
import SwapDashboardPanel from "../components/SwapDashboardPanel";
import { getMemberMetrics, getProfileDetail, listEnrollments } from "../lib/profile-data";
import { typeLabel, useProfileType, type ProfileType } from "../lib/profile-type";
import { TypePicker } from "../components/RoleDashboard";
import { ApplicantStateControl, OpeningToggle, PostOpeningForm } from "../components/EmployerTools";
import { loadCoach, type CoachPlan } from "../lib/coach";
import { blockId, useWeekProgress, weekSummary, type WeekSummary } from "../lib/coach-progress";
import {
  employerApplicants,
  employerPipeline,
  employerPosts,
  employerSummary,
  listCoursesCreatedBy,
} from "../lib/employer";
import {
  myApplications,
  stateLabel,
  stepIndex,
  TRACKER_STEPS,
  type MyApplication,
} from "../lib/applications";
import { myAlerts } from "../lib/job-alerts";
import DashboardLearning from "../components/DashboardLearning";
import { findMatches, listTeachSkills } from "../lib/skillswap";
import { useTx } from "../lib/i18n";
import MySkillBoard from "../components/MySkillBoard";
import { SloganPlate, BlockPrintRule } from "../components/Ornaments";
import { getGoal, profileChecklist, setGoal, type ProfileProgress } from "../lib/profile-progress";
import {
  instituteActions,
  learnerActions,
  recruiterActions,
  type NextAction,
} from "../lib/next-action";
import { useToast } from "../components/Toast";
import { track, EV, EVOLUTION_CONFIG, useUiState } from "@/evolution";
import type { DomainId, HomeLayout } from "@/evolution";
import { TabsHint, tabKeyNav, useTabPlan } from "@/evolution/react/use-tab-plan";

/**
 * Evolution reorders the learner dashboard's blocks; it never adds or removes one. The leading domain's
 * blocks come first (a stable partition), then everything else in its canonical order.
 */
interface DomainBlock {
  key: string;
  domain: DomainId;
  render: (position: number, open: boolean) => ReactNode;
}
function orderByDomain(blocks: DomainBlock[], lead: DomainId | null): DomainBlock[] {
  if (!lead) return blocks;
  return [...blocks.filter((b) => b.domain === lead), ...blocks.filter((b) => b.domain !== lead)];
}

/**
 * The dashboard.
 *
 * It used to be a wall of cards of equal weight — four metric plates, three
 * suggestions, two courses, two openings, swaps, messages, rewards — which is
 * a page that has made no decision and leaves the reader to make it instead,
 * every single visit.
 *
 * It now answers four questions, in this order and nothing else above the
 * fold: where am I, what is the one thing to do next, how far along am I,
 * what comes after. Each kind of member has one job to be done — study better
 * this week, get internship-ready, get the right job, hire the right person,
 * run a cohort — and a module that does not serve that job lives on its own
 * page, reached from the navigation, not stacked here.
 *
 * One primary button per screen: the Next Best Action card owns it.
 */
export default function Dashboard() {
  const { user, profileId, setRole, ready, availableRoles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // `ready` is the whole point: Supabase restores the session asynchronously,
    // so on a refresh or a direct link `user` is briefly null for a logged-in
    // person. Redirecting on that null threw them out of their own account
    // every time they reloaded the page.
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);
  if (!ready || !user) return null;

  return (
    <div className="container-x max-w-6xl pb-24 pt-32">
      <DashboardBody
        user={user}
        profileId={profileId}
        availableRoles={availableRoles}
        setRole={setRole}
      />
    </div>
  );
}

type User = NonNullable<ReturnType<typeof useAuth>["user"]>;

/**
 * Split out so the profile-type hook runs after the auth guard above has
 * settled. Everything below assumes a signed-in member.
 */
function DashboardBody({
  user,
  profileId,
  availableRoles,
  setRole,
}: {
  user: User;
  profileId: string | null;
  availableRoles: Role[];
  setRole: (r: Role) => void;
}) {
  const profileType = useProfileType(user.email, user.role, profileId);
  const [changing, setChanging] = useState(false);
  const canChange = user.role === "student";

  const recruiter = user.role === "recruiter" && availableRoles.includes("recruiter");
  const institute = user.role === "institute" && availableRoles.includes("institute");
  const learner = !recruiter && !institute;

  return (
    <>
      <Header
        user={user}
        profileId={profileId}
        profileType={profileType}
        availableRoles={availableRoles}
        setRole={setRole}
        canChange={canChange && Boolean(profileType) && !changing}
        onChange={() => setChanging(true)}
      />

      {/*
        The question that decides the dashboard. The navigation itself is no
        longer repeated here: a laptop has it pinned down the left, a phone
        has it across the bottom, and a third copy in the middle of the page
        was the reason this screen opened with two rows of links before it
        said anything.
      */}
      {(!profileType || changing) && (
        <TypePicker
          email={user.email}
          role={user.role}
          profileId={profileId}
          onDone={() => setChanging(false)}
        />
      )}

      {learner && <LearnerDashboard user={user} profileId={profileId} type={profileType} />}
      {recruiter && <RecruiterDashboard profileId={profileId} />}
      {institute && <InstituteDashboard profileId={profileId} />}
    </>
  );
}

/* ── Header ──────────────────────────────────────────────────────── */

/**
 * Greeting, goal, and the view switch. Nothing else.
 *
 * The goal is a real column — `learning_preferences.goal_statement`, which
 * onboarding has always written — and it is editable in place, because a goal
 * you cannot change is a goal you stop reading.
 */
function Header({
  user,
  profileId,
  profileType,
  availableRoles,
  setRole,
  canChange,
  onChange,
}: {
  user: User;
  profileId: string | null;
  profileType: ProfileType | null;
  availableRoles: Role[];
  setRole: (r: Role) => void;
  canChange: boolean;
  onChange: () => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const rolePlan = useTabPlan("dashboard", availableRoles);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const goal = useQuery({
    queryKey: ["goal", profileId],
    queryFn: () => getGoal(profileId!),
    enabled: Boolean(profileId),
  });

  const save = useMutation({
    mutationFn: () => setGoal(profileId!, draft),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["goal", profileId] });
      toast({ title: "Goal saved", body: "Your dashboard works toward it." });
    },
    onError: (e: Error) => toast({ tone: "bad", title: "Could not save that", body: e.message }),
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";

  return (
    <Reveal>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <SloganPlate tone="saffron">{tx(typeLabel(profileType))}</SloganPlate>
            {canChange && (
              <button
                type="button"
                onClick={onChange}
                className="font-body text-[12px] text-ink-mute underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                {tx("Not you? Change")}
              </button>
            )}
          </div>

          <h1 className="section-title mt-4">
            {tx(greeting)} {user.name.split(" ")[0]}
          </h1>

          {/* The goal, in the member's own words. */}
          <div className="mt-3">
            {editing ? (
              <form
                className="flex max-w-lg flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <label htmlFor="goal" className="sr-only">
                  {tx("Your goal")}
                </label>
                <input
                  id="goal"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 120))}
                  placeholder={tx("e.g. Become a solar technician by June")}
                  className="input !w-auto min-w-[16rem] flex-1 !py-2 !text-[13px]"
                />
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="btn-ghost !py-2 !text-xs"
                >
                  {save.isPending ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : (
                    <Check size={13} aria-hidden />
                  )}
                  {tx("Save")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="font-body text-[12px] text-ink-mute underline"
                >
                  {tx("Cancel")}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(goal.data ?? "");
                  setEditing(true);
                }}
                className="group inline-flex max-w-full items-center gap-2 text-left"
              >
                <Target size={14} className="shrink-0 text-saffron-500" aria-hidden />
                <span className="truncate font-body text-[14px] text-ink-soft group-hover:text-ink">
                  {goal.data ? (
                    <>
                      {tx("Your goal")}: <span className="font-medium text-ink">{goal.data}</span>
                    </>
                  ) : (
                    tx("Set a goal — one line about what you are here for")
                  )}
                </span>
                <Pencil
                  size={12}
                  className="shrink-0 text-ink-mute opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
                <span className="sr-only">{tx("Edit your goal")}</span>
              </button>
            )}
          </div>

          <BlockPrintRule className="mt-5" />
        </div>

        {/* Only the dashboards this account actually holds. */}
        {availableRoles.length > 1 && (
          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
            <div
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper-dim p-1"
              role="tablist"
              aria-label={tx("Switch dashboard view")}
            >
              {rolePlan.order.map((r) => (
                <button
                  key={r}
                  role="tab"
                  aria-selected={user.role === r}
                  tabIndex={user.role === r ? 0 : -1}
                  onKeyDown={(e) =>
                    tabKeyNav(e, rolePlan.order, (id) => {
                      rolePlan.onSelect(id);
                      setRole(id);
                    })
                  }
                  onClick={() => {
                    rolePlan.onSelect(r);
                    setRole(r);
                  }}
                  className={`rounded-full px-4 py-2 font-body text-[13px] font-semibold capitalize transition ${
                    user.role === r
                      ? "bg-paper-light text-ink shadow-[var(--shadow-soft)]"
                      : "text-ink-mute hover:text-ink"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {rolePlan.arranged && <TabsHint />}
          </div>
        )}
      </div>
    </Reveal>
  );
}

/* ── Shared furniture ────────────────────────────────────────────── */

/** A section heading with an optional "see all" on the right. */
function SectionHead({
  title,
  id,
  link,
}: {
  title: string;
  id?: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-line pb-2.5">
      <h2 id={id} className="scroll-mt-28 font-display text-[1.15rem] tracking-tight text-ink">
        {title}
      </h2>
      {link && (
        <Link
          to={link.to}
          onClick={() =>
            track(EV.DASHBOARD_SECTION_CLICKED, {
              section: link.to.replace(/^\//, "").split(/[#?]/)[0] || "home",
            })
          }
          className="font-body text-[12px] font-medium text-saffron-600 hover:underline"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}

/**
 * A module on the dashboard.
 *
 * Deliberately not a card. Every panel used to be a bordered, padded box, so
 * the page was a stack of eight rectangles of identical weight — the exact
 * thing the redesign was meant to remove, rebuilt one level down. A heading,
 * a hairline and air is enough to separate two ideas; the box is reserved
 * for the two things that are genuinely one object: the next action, and the
 * readiness meter.
 */
function Module({ children, tour }: { children: React.ReactNode; tour?: string }) {
  return <section data-tour={tour}>{children}</section>;
}

/**
 * Priority three: real, but not worth the fold.
 *
 * A details element rather than another card, so everything below the work
 * area is a short list of headings instead of a second wall of panels.
 */
function More({
  title,
  children,
  count,
  section,
  position,
  layout,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  count?: number;
  /** When given, opening or closing the block counts as a dashboard section click. */
  section?: string;
  position?: number;
  layout?: HomeLayout;
  /** Evolution opens the leading domain's block (tier 2 and up); everything else stays one tap away. */
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen || undefined} className="group rounded-2xl border border-ink-line">
      <summary
        onClick={
          section
            ? () => track(EV.DASHBOARD_SECTION_CLICKED, { section, position, layout })
            : undefined
        }
        className="flex cursor-pointer list-none items-center gap-2 p-4 font-display text-[15px] tracking-tight text-ink marker:hidden"
      >
        <ChevronDown
          size={16}
          aria-hidden
          className="shrink-0 text-ink-mute transition-transform group-open:rotate-180"
        />
        {title}
        {typeof count === "number" && count > 0 && (
          <span className="font-mono text-[11px] tabular-nums text-ink-mute">· {count}</span>
        )}
      </summary>
      <div className="border-t border-ink-line p-4">{children}</div>
    </details>
  );
}

/** An empty state that names the next action rather than the absence. */
function Empty({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-line p-5 text-center">
      <p className="font-body text-[14px] font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm font-body text-[13px] leading-relaxed text-ink-mute">
        {body}
      </p>
      {cta && (
        <Link to={cta.to} className="btn-ghost mt-4 !py-2.5 !text-xs">
          {cta.label} <ArrowRight size={13} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/* ── Learner ─────────────────────────────────────────────────────── */

function LearnerDashboard({
  user,
  profileId,
  type,
}: {
  user: User;
  profileId: string | null;
  type: ProfileType | null;
}) {
  const tx = useTx();
  const ui = useUiState();
  // The leading domain from tier 1 (as on Home); its More block opens by default from tier 2.
  const lead: DomainId | null = ui.tier >= 1 ? EVOLUTION_CONFIG.states[ui.state].domain : null;
  const enabled = Boolean(profileId);
  const school = type === "school";
  const college = type === "college";
  const working = type === "jobseeker" || type === "professional";

  const record = loadCoach(user.email);
  const plan = record?.plan ?? null;
  const ticked = useWeekProgress();

  const metrics = useQuery({
    queryKey: ["member-metrics", profileId],
    queryFn: () => getMemberMetrics(profileId!),
    enabled,
  });
  const detail = useQuery({
    queryKey: ["profile-detail", profileId],
    queryFn: () => getProfileDetail(profileId!),
    enabled,
  });
  const goal = useQuery({
    queryKey: ["goal", profileId],
    queryFn: () => getGoal(profileId!),
    enabled,
  });
  const enrolments = useQuery({
    queryKey: ["enrollments", profileId],
    queryFn: () => listEnrollments(profileId!),
    enabled,
  });
  const matches = useQuery({
    queryKey: ["swap-matches", profileId],
    queryFn: () => findMatches(profileId!, 5),
    enabled: enabled && !school,
  });
  const applications = useQuery({
    queryKey: ["my-applications", profileId],
    queryFn: () => myApplications(profileId!),
    enabled: enabled && !school,
  });
  const alerts = useQuery({
    queryKey: ["job-alerts", profileId],
    queryFn: () => myAlerts(profileId!),
    enabled: enabled && working,
  });
  const openings = useQuery({
    queryKey: ["opportunities", "all"],
    queryFn: () => listOpportunities(),
    enabled: !school,
  });
  const mySkills = useQuery({
    queryKey: ["my-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled: enabled && !school,
  });

  const totalBlocks = plan?.weeklyPlan.reduce((n, d) => n + d.blocks.length, 0) ?? 0;
  const week = weekSummary(totalBlocks);

  const progress = profileChecklist({
    type,
    metrics: metrics.data,
    detail: detail.data,
    goal: goal.data ?? null,
    hasPlan: Boolean(plan),
  });

  const skillNames = useMemo(() => (mySkills.data ?? []).map((s) => s.skill.name), [mySkills.data]);

  const actions: NextAction[] = learnerActions({
    type,
    metrics: metrics.data,
    progress,
    enrolments: enrolments.data ?? [],
    plan,
    week: { done: week.done, total: week.total },
    applications: applications.data ?? [],
    openings: (openings.data ?? []).length,
    alerts: alerts.data?.alerts.length ?? 0,
    matches: (matches.data ?? []).length,
    unread: metrics.data?.unreadNotifications ?? 0,
  });

  const loading = metrics.isLoading || enrolments.isLoading;

  // Work area: the plan panel stays first; the rest follow the leading domain, then the canonical order.
  const workBlocks = orderByDomain(
    [
      ...(working
        ? [
            {
              key: "applications",
              domain: "CAREER" as const,
              render: () => (
                <ApplicationPanel
                  applications={applications.data ?? []}
                  loading={applications.isLoading}
                />
              ),
            },
          ]
        : []),
      ...(working || college
        ? [
            {
              key: "best-match",
              domain: "CAREER" as const,
              render: () => (
                <BestMatch
                  openings={
                    college
                      ? (openings.data ?? []).filter((o) => o.kind === "internship")
                      : (openings.data ?? [])
                  }
                  skills={skillNames}
                  loading={openings.isLoading}
                  heading={college ? tx("An internship to aim at") : undefined}
                />
              ),
            },
          ]
        : []),
      {
        key: "learning",
        domain: "LEARNING" as const,
        render: () => (
          <Reveal>
            <section>
              <SectionHead
                title={tx("Your learning")}
                link={{ to: "/my-learning", label: tx("See all") }}
              />
              <div className="mt-4">
                <DashboardLearning profileId={profileId} />
              </div>
            </section>
          </Reveal>
        ),
      },
    ],
    lead,
  );

  // Priority three: same rule. From tier 2 the first block of the leading domain opens by default.
  const moreBlocks = orderByDomain(
    [
      ...(!school && profileId
        ? [
            {
              key: "swap",
              domain: "SKILL_EXCHANGE" as const,
              render: (position: number, open: boolean) => (
                <More
                  title={tx("SkillSwap — requests and matches")}
                  section="skillswap"
                  position={position}
                  layout={ui.layout}
                  defaultOpen={open}
                >
                  <SwapDashboardPanel profileId={profileId} />
                </More>
              ),
            },
          ]
        : []),
      {
        key: "skills",
        domain: "LEARNING" as const,
        render: (position: number, open: boolean) => (
          <More
            title={tx("Your skills and assessments")}
            section="skills"
            position={position}
            layout={ui.layout}
            defaultOpen={open}
          >
            <MySkillBoard profileId={profileId} />
          </More>
        ),
      },
      {
        key: "gap-courses",
        domain: "LEARNING" as const,
        render: (position: number, open: boolean) => (
          <More
            title={school ? tx("Free courses to start with") : tx("Courses to close the gap")}
            section="courses"
            position={position}
            layout={ui.layout}
            defaultOpen={open}
          >
            <div className="card-grid grid grid-cols-1 gap-5 sm:grid-cols-2">
              {courses
                .filter((c) => c.free && (school ? c.difficulty === "Beginner" : true))
                .slice(0, 2)
                .map((c, i) => (
                  <div
                    key={c.id}
                    className="contents"
                    onClickCapture={(e) => {
                      if ((e.target as Element).closest("a")) {
                        track(EV.RECOMMENDATION_CLICKED, {
                          surface: "dashboard-courses",
                          rank: i + 1,
                          via: "static",
                        });
                      }
                    }}
                  >
                    <CourseCard course={c} />
                  </div>
                ))}
            </div>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-ink-mute">
              {tx(
                "Free courses from the catalog — picked by price, not by you. The coach's recommendations are the personalized ones.",
              )}
            </p>
          </More>
        ),
      },
    ],
    lead,
  );
  const openAt = ui.tier >= 2 && lead ? moreBlocks.findIndex((b) => b.domain === lead) : -1;

  return (
    <>
      <NextBestAction actions={actions} loading={loading} />

      {/* ── The work area: one job to be done, per kind of member ── */}
      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="stack-lg min-w-0">
          {(school || college) && <PlanPanel plan={plan} ticked={ticked} week={week} />}

          {workBlocks.map((b, i) => (
            <Fragment key={b.key}>{b.render(i + 1, false)}</Fragment>
          ))}
        </div>

        {/* Right rail: one thing, and never the only home of anything. */}
        <div className="min-w-0 space-y-6">
          <ProfilePanel progress={progress} />
        </div>
      </div>

      {/* ── Priority three ── */}
      <div className="mt-12 space-y-3">
        {moreBlocks.map((b, i) => (
          <Fragment key={b.key}>{b.render(i + 1, i === openAt)}</Fragment>
        ))}
      </div>
    </>
  );
}

/**
 * This week, as the plan laid it out — and as it has actually gone.
 *
 * The ticks are the point. A plan you cannot mark is a printout, and a
 * dashboard has nothing true to say about a week nobody recorded.
 */
function PlanPanel({
  plan,
  ticked,
  week,
}: {
  plan: CoachPlan | null;
  ticked: string[];
  week: WeekSummary;
}) {
  const tx = useTx();

  if (!plan) {
    return (
      <Reveal>
        <Module tour="plan">
          <SectionHead title={tx("This week")} />
          <div className="mt-4">
            <Empty
              title={tx("No study plan yet")}
              body={tx(
                "Enter your marks — or photograph your marksheet — and the coach lays out a week you can follow, subject by subject.",
              )}
              cta={{ to: "/coach", label: tx("Build my plan") }}
            />
          </div>
        </Module>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <Module tour="plan">
        <SectionHead
          title={tx("This week")}
          link={{ to: "/coach#plan", label: tx("Open the plan") }}
        />

        {/* One strip, not a chart: the days, and what is done in each. */}
        <ol className="mt-4 grid grid-cols-7 gap-1.5">
          {plan.weeklyPlan.slice(0, 7).map((d) => {
            const total = d.blocks.length;
            const done = d.blocks.filter((_, i) => ticked.includes(blockId(d.day, i))).length;
            const full = total > 0 && done === total;
            return (
              <li key={d.day} className="min-w-0 text-center">
                <span
                  className={`grid h-10 place-items-center rounded-xl border font-mono text-[11px] tabular-nums ${
                    full
                      ? "border-transparent bg-saffron-500 text-on-accent"
                      : done > 0
                        ? "border-saffron-300 text-saffron-600"
                        : "border-ink-line text-ink-mute"
                  }`}
                  title={`${d.day}: ${done}/${total}`}
                >
                  {full ? <Check size={14} aria-hidden /> : `${done}/${total}`}
                </span>
                <span className="mt-1 block truncate font-body text-[10.5px] text-ink-mute">
                  {d.day.slice(0, 3)}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 font-body text-[13.5px] leading-relaxed text-ink-soft">
          {week.total === 0
            ? tx("This plan has no blocks in it yet.")
            : week.done === 0
              ? tx("Nothing ticked off this week yet. The first block is the hard one.")
              : week.done >= week.total
                ? tx("Every block done. You kept a promise to yourself this week.")
                : `${week.done} ${tx("of")} ${week.total} ${tx("blocks done this week.")}`}
        </p>

        {plan.snapshot.summary && (
          <p className="mt-3 border-l-2 border-saffron-300 pl-3 font-body text-[13px] leading-relaxed text-ink-mute">
            {plan.snapshot.summary}
          </p>
        )}

        {plan.focusAreas.length > 0 && (
          <div className="mt-5">
            <p className="datum">{tx("Focus next")}</p>
            <ul className="mt-2 space-y-1.5">
              {plan.focusAreas.slice(0, 3).map((f) => (
                <li key={f.subject} className="font-body text-[13px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">{f.subject}</span> — {f.firstStep}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Module>
    </Reveal>
  );
}

/** Where every application stands, counted by stage. */
function ApplicationPanel({
  applications,
  loading,
}: {
  applications: MyApplication[];
  loading: boolean;
}) {
  const tx = useTx();
  const live = applications.filter((a) => a.state !== "withdrawn");

  return (
    <Reveal>
      <Module tour="applications">
        <SectionHead
          title={tx("Your applications")}
          link={{ to: "/applications", label: tx("Open the tracker") }}
        />

        {loading ? (
          <div className="mt-4 h-16 animate-pulse rounded-xl bg-paper-deep" aria-busy="true" />
        ) : live.length === 0 ? (
          <div className="mt-4">
            <Empty
              title={tx("Nothing applied for yet")}
              body={tx(
                "When you apply on स्वYAM, every step the employer takes is dated here — viewed, shortlisted, interview, decision.",
              )}
              cta={{ to: "/jobs", label: tx("See what is open") }}
            />
          </div>
        ) : (
          <>
            <ol className="mt-4 grid grid-cols-5 gap-1.5">
              {TRACKER_STEPS.map((step, i) => {
                const n = live.filter((a) => stepIndex(a.state) >= i).length;
                return (
                  <li key={step.id} className="min-w-0 text-center">
                    <span
                      className={`grid h-10 place-items-center rounded-xl border font-mono text-[13px] font-semibold tabular-nums ${
                        n > 0
                          ? "border-saffron-300 text-saffron-600"
                          : "border-ink-line text-ink-mute"
                      }`}
                    >
                      {n}
                    </span>
                    <span className="mt-1 block truncate font-body text-[10.5px] text-ink-mute">
                      {tx(step.label)}
                    </span>
                  </li>
                );
              })}
            </ol>

            <ul className="mt-5 space-y-2">
              {live.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <Link
                    to="/applications"
                    className="flex items-center gap-3 rounded-2xl border border-ink-line p-3 transition-colors hover:border-saffron-200"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-body text-[13.5px] font-medium text-ink">
                        {a.opportunity?.title ?? tx("Opening no longer listed")}
                      </span>
                      <span className="block truncate font-body text-[12px] text-ink-mute">
                        {a.opportunity?.employer?.name ?? ""}
                      </span>
                    </span>
                    <span className="chip shrink-0 !text-[10px]">{tx(stateLabel(a.state))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Module>
    </Reveal>
  );
}

/**
 * One opening — the best-matched one — with the reason it is here.
 *
 * Not a grid of jobs: the dashboard's job is to point at the next move, and
 * "here are twelve roles" is the jobs page, one tap away.
 */
function BestMatch({
  openings,
  skills,
  loading,
  heading,
}: {
  openings: Opportunity[];
  skills: string[];
  loading: boolean;
  heading?: string;
}) {
  const tx = useTx();
  const scored = openings
    .map((o) => ({ o, match: skills.length ? matchAgainst(o, skills) : null }))
    .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
  const best = scored[0];

  return (
    <Reveal>
      <section data-tour="match">
        <SectionHead
          title={heading ?? tx("Closest match for you")}
          link={{ to: "/jobs", label: tx("See all openings") }}
        />
        {loading ? (
          <div className="mt-4 h-40 animate-pulse rounded-2xl bg-paper-deep" aria-busy="true" />
        ) : !best ? (
          <div className="mt-4">
            <Empty
              title={tx("Nothing is open right now")}
              body={tx(
                "स्वYAM is new and employers are still joining. Set an alert and you will hear the day something fits.",
              )}
              cta={{ to: "/jobs", label: tx("Set a job alert") }}
            />
          </div>
        ) : (
          <>
            <div
              className="mt-4"
              onClickCapture={(e) => {
                if ((e.target as Element).closest("a")) {
                  track(EV.RECOMMENDATION_CLICKED, {
                    surface: "dashboard-match",
                    rank: 1,
                    via: "static",
                  });
                }
              }}
            >
              <OpportunityCard opportunity={best.o} match={best.match} />
            </div>
            {/* "Why am I seeing this?" — answered on the card, not in a tooltip. */}
            <p className="mt-2 font-body text-[12px] leading-relaxed text-ink-mute">
              <span className="font-semibold text-ink-soft">{tx("Why this one")}: </span>
              {best.match && best.match.score > 0
                ? `${tx("it asks for")} ${best.match.have.slice(0, 2).join(", ")}${
                    best.match.missing.length
                      ? `, ${tx("and you are short of")} ${best.match.missing.slice(0, 2).join(", ")}`
                      : ""
                  }.`
                : skills.length === 0
                  ? tx(
                      "it is the newest opening. Add your skills and this becomes a real match rather than a date.",
                    )
                  : tx(
                      "it is the newest opening; none of its listed skills overlap with yours yet.",
                    )}
            </p>
          </>
        )}
      </section>
    </Reveal>
  );
}

/** Profile readiness — and, once there is nothing left, one quiet line. */
function ProfilePanel({ progress }: { progress: ProfileProgress }) {
  const tx = useTx();
  if (progress.done === progress.total) {
    return (
      <Reveal>
        <section className="card p-5">
          <p className="inline-flex items-center gap-2 font-body text-[13.5px] font-medium text-emeraldx-400">
            <Check size={15} aria-hidden /> {tx("Your profile is complete")}
          </p>
          <p className="mt-1 font-body text-[12.5px] leading-relaxed text-ink-mute">
            {tx("Everything the matching runs on is filled in.")}
          </p>
        </section>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <section data-tour="profile" className="card p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base tracking-tight text-ink">
            {tx("Profile readiness")}
          </h2>
          <span className="font-mono text-[13px] tabular-nums text-ink">{progress.percent}%</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-deep"
          role="progressbar"
          aria-valuenow={progress.done}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-label={tx("Profile readiness")}
        >
          <span
            className="block h-full rounded-full bg-saffron-500 transition-[width] duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-2 font-body text-[12.5px] text-ink-mute">
          {progress.total - progress.done} {tx("left — each one changes something")}
        </p>
        <ul className="mt-3 space-y-2">
          {progress.items
            .filter((i) => !i.done)
            .slice(0, 3)
            .map((i) => (
              <li key={i.id}>
                <Link
                  to={i.to}
                  className="group block rounded-xl border border-ink-line p-2.5 transition-colors hover:border-saffron-200"
                >
                  <span className="block font-body text-[13px] font-medium text-ink group-hover:text-saffron-600">
                    {tx(i.label)}
                  </span>
                  <span className="mt-0.5 block font-body text-[11.5px] leading-relaxed text-ink-mute">
                    {tx(i.why)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </Reveal>
  );
}

/* ── Recruiter ───────────────────────────────────────────────────── */

function RecruiterDashboard({ profileId }: { profileId: string | null }) {
  const tx = useTx();
  const enabled = Boolean(profileId);

  const summary = useQuery({
    queryKey: ["employer-summary", profileId],
    queryFn: () => employerSummary(profileId!),
    enabled,
  });
  const companyId = summary.data?.companyId ?? null;

  const posts = useQuery({
    queryKey: ["employer-posts", companyId],
    queryFn: () => employerPosts(companyId!),
    enabled: Boolean(companyId),
  });
  const applicants = useQuery({
    queryKey: ["employer-applicants", companyId],
    queryFn: () => employerApplicants(companyId!),
    enabled: Boolean(companyId),
  });
  const pipeline = useQuery({
    queryKey: ["employer-pipeline", companyId],
    queryFn: () => employerPipeline(companyId!),
    enabled: Boolean(companyId),
  });

  const actions = recruiterActions({
    summary: summary.data,
    posts: posts.data ?? [],
    applicants: applicants.data ?? [],
  });

  if (summary.isLoading) return <NextBestAction actions={[]} loading />;

  if (!companyId) {
    return (
      <div className="card mt-8 p-8 text-center">
        <Building2 size={24} className="mx-auto text-ink-mute" aria-hidden />
        <h2 className="mt-4 font-display text-xl tracking-tight text-ink">
          {tx("No employer account linked")}
        </h2>
        <p className="mx-auto mt-2 max-w-md font-body text-sm leading-relaxed text-ink-soft">
          {tx(
            "This account is not a member of any company yet, so there is nothing to show. Once you are added to one, your postings and applicants appear here.",
          )}
        </p>
        <Link to="/contact" className="btn-primary mt-5 !py-2.5 !text-xs">
          {tx("Talk to us")}
        </Link>
      </div>
    );
  }

  const p = pipeline.data;
  const stages = p
    ? [
        { label: tx("Draft"), n: p.drafts },
        { label: tx("Live"), n: p.published },
        { label: tx("Applied"), n: p.byState.submitted },
        { label: tx("Shortlisted"), n: p.byState.shortlisted },
        { label: tx("Interview"), n: p.byState.interviewing },
        { label: tx("Hired"), n: p.byState.hired },
      ]
    : [];

  return (
    <>
      <NextBestAction actions={actions} heading={tx("Your next move")} />

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="stack-lg min-w-0">
          <Reveal>
            <Module tour="pipeline">
              <SectionHead
                title={tx("Hiring pipeline")}
                link={{ to: "/dashboard#candidates", label: tx("Open candidates") }}
              />
              {pipeline.isLoading ? (
                <div
                  className="mt-4 h-16 animate-pulse rounded-xl bg-paper-deep"
                  aria-busy="true"
                />
              ) : (
                <>
                  <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {stages.map((s) => (
                      <li key={s.label} className="min-w-0 text-center">
                        <span
                          className={`grid h-11 place-items-center rounded-xl border font-mono text-[14px] font-semibold tabular-nums ${
                            s.n > 0
                              ? "border-saffron-300 text-saffron-600"
                              : "border-ink-line text-ink-mute"
                          }`}
                        >
                          {s.n}
                        </span>
                        <span className="mt-1 block truncate font-body text-[10.5px] text-ink-mute">
                          {s.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 font-body text-[13.5px] text-ink-soft">
                    {p && p.newThisWeek > 0
                      ? `${p.newThisWeek} ${
                          p.newThisWeek === 1
                            ? tx("application arrived this week.")
                            : tx("applications arrived this week.")
                        }`
                      : tx("No applications this week.")}
                  </p>
                </>
              )}
            </Module>
          </Reveal>

          <Reveal>
            <Module tour="candidates">
              <SectionHead id="candidates" title={tx("Candidates")} />
              {applicants.isLoading ? (
                <div
                  className="mt-4 h-24 animate-pulse rounded-xl bg-paper-deep"
                  aria-busy="true"
                />
              ) : (applicants.data ?? []).length === 0 ? (
                <div className="mt-4">
                  <Empty
                    title={tx("Nobody has applied yet")}
                    body={tx(
                      "Applications land here with each candidate's Skill Passport. You can also search passports directly rather than waiting.",
                    )}
                    cta={{ to: "/search", label: tx("Search candidates") }}
                  />
                </div>
              ) : (
                <ul className="mt-5 space-y-3">
                  {(applicants.data ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-line p-3.5"
                    >
                      <img
                        loading="lazy"
                        decoding="async"
                        src={a.applicant?.avatarUrl || initialsAvatar(a.applicant?.name ?? "?")}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body text-sm font-medium text-ink">
                          {a.applicant?.handle ? (
                            <Link
                              to="/u/$handle"
                              params={{ handle: a.applicant.handle }}
                              className="hover:text-saffron-600"
                            >
                              {a.applicant.name}
                            </Link>
                          ) : (
                            (a.applicant?.name ?? tx("Applicant"))
                          )}
                        </p>
                        <p className="truncate font-body text-xs text-ink-mute">
                          {a.opportunityTitle} · {tx("applied")}{" "}
                          {new Date(a.submittedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      {a.matchScore !== null && (
                        <span
                          className="shrink-0 font-display text-sm tabular-nums text-saffron-500"
                          title={tx("Skill match")}
                        >
                          {Math.round(a.matchScore)}
                        </span>
                      )}
                      <ApplicantStateControl applicationId={a.id} state={a.state} />
                    </li>
                  ))}
                </ul>
              )}
            </Module>
          </Reveal>
        </div>

        <div className="space-y-6">
          <Reveal delay={0.1}>
            <section className="card p-5">
              <h2 className="font-display text-base tracking-tight text-ink">
                {tx("Find people directly")}
              </h2>
              <p className="mt-2 font-body text-[13px] leading-relaxed text-ink-soft">
                {tx(
                  "Every member has a skill passport with verified skills and the work behind them. Search it instead of waiting to be applied to.",
                )}
              </p>
              <Link to="/search" className="btn-ghost mt-4 w-full justify-center !py-2.5 !text-xs">
                <Search size={13} aria-hidden /> {tx("Search candidates")}
              </Link>
            </section>
          </Reveal>
        </div>
      </div>

      <div className="mt-10 space-y-3">
        <More title={tx("Your postings")} count={(posts.data ?? []).length}>
          {(posts.data ?? []).length === 0 ? (
            <Empty
              title={tx("Nothing posted yet")}
              body={tx("An opening is the only way an applicant can reach you.")}
            />
          ) : (
            <ul className="space-y-2.5">
              {(posts.data ?? []).map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-ink-line p-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm font-medium text-ink">
                      {o.title}
                    </span>
                    <span className="block font-body text-xs text-ink-mute">
                      {o.kind}
                      {o.location ? ` · ${o.location}` : ""} · {o.openings}{" "}
                      {o.openings === 1 ? tx("opening") : tx("openings")}
                    </span>
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-ink">
                    {o.applicationCount} {tx("applied")}
                  </span>
                  {o.closedAt ? (
                    <span className="chip !text-[10px]">{tx("Closed")}</span>
                  ) : (
                    !o.isPublished && <span className="chip !text-[10px]">{tx("Draft")}</span>
                  )}
                  <OpeningToggle id={o.id} closed={Boolean(o.closedAt)} />
                </li>
              ))}
            </ul>
          )}
        </More>

        <div id="post" className="scroll-mt-28">
          <More title={tx("Post an opening")}>
            <PostOpeningForm companyId={companyId} />
          </More>
        </div>
      </div>
    </>
  );
}

/* ── Institute ───────────────────────────────────────────────────── */

function InstituteDashboard({ profileId }: { profileId: string | null }) {
  const tx = useTx();

  const mine = useQuery({
    queryKey: ["institute-courses", profileId],
    queryFn: () => listCoursesCreatedBy(profileId!),
    enabled: Boolean(profileId),
  });

  const rows = mine.data ?? [];
  const learners = rows.reduce((n, c) => n + c.enrollmentCount, 0);
  const published = rows.filter((c) => c.isPublished);
  const actions = instituteActions({ courses: rows });

  return (
    <>
      <NextBestAction actions={actions} loading={mine.isLoading} heading={tx("Your next move")} />

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="stack-lg min-w-0">
          <Reveal>
            <Module tour="courses">
              <SectionHead
                id="courses"
                title={tx("Your courses")}
                link={{ to: "/courses", label: tx("See the catalog") }}
              />
              {mine.isLoading ? (
                <div
                  className="mt-4 h-24 animate-pulse rounded-xl bg-paper-deep"
                  aria-busy="true"
                />
              ) : rows.length === 0 ? (
                <div className="mt-4">
                  <Empty
                    title={tx("No courses yet")}
                    body={tx(
                      "Learners, enrollments and certificates all start from a published course. We will set the first one up with you.",
                    )}
                    cta={{ to: "/contact", label: tx("Talk to us about publishing") }}
                  />
                </div>
              ) : (
                <ul className="mt-5 space-y-2.5">
                  {rows.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-ink-line p-3.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-sm font-medium text-ink">
                          {c.title}
                        </span>
                        <span className="block font-body text-xs text-ink-mute">{c.level}</span>
                      </span>
                      <span className="font-mono text-[12px] tabular-nums text-ink">
                        {c.enrollmentCount} {tx("enrolled")}
                      </span>
                      {!c.isPublished && <span className="chip !text-[10px]">{tx("Draft")}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Module>
          </Reveal>
        </div>

        <div className="space-y-6">
          <Reveal delay={0.1}>
            <section className="card p-5">
              <h2 className="font-display text-base tracking-tight text-ink">
                {tx("Where you stand")}
              </h2>
              <dl className="mt-3 space-y-2.5">
                {[
                  { label: tx("Published"), value: published.length },
                  { label: tx("In draft"), value: rows.length - published.length },
                  { label: tx("Learners enrolled"), value: learners },
                ].map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between gap-3">
                    <dt className="font-body text-[13px] text-ink-mute">{s.label}</dt>
                    <dd className="font-mono text-[15px] tabular-nums text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 font-body text-[11.5px] leading-relaxed text-ink-mute">
                {tx(
                  "Counted by the database as enrollments happen. Completion is what turns into a certificate.",
                )}
              </p>
            </section>
          </Reveal>
        </div>
      </div>
    </>
  );
}
