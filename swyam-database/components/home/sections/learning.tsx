import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Play } from "lucide-react";
import { CourseCard } from "@/components/Cards";
import { useAuth } from "@/context/AuthContext";
import type { Course } from "@/data/mock";
import { listEnrollments } from "@/lib/profile-data";
import { listMyCertificates } from "@/lib/certificate";
import { listSkillAssessments } from "@/lib/assessments";
import { matchAgainst } from "@/lib/opportunities";
import { useTx } from "@/lib/i18n";
import HrefLink from "../HrefLink";
import {
  coursesForNames,
  openingsOf,
  popularCourses,
  useMySkillNames,
  useOpenings,
  useRecentViews,
  viewedSkillNames,
} from "../data";
import { limitOf, type SectionProps } from "../types";
import { CourseRow, Empty, Progress, SectionShell, Skeleton, signInHref } from "./shared";

function useEnrolments() {
  const { profileId } = useAuth();
  return useQuery({
    queryKey: ["enrollments", profileId],
    queryFn: () => listEnrollments(profileId!),
    enabled: Boolean(profileId),
  });
}

/** Cards in the roomier densities, plain rows in compact. The title, fee and link always render. */
function CourseGrid({
  list,
  variant,
}: {
  list: ReadonlyArray<Course>;
  variant: SectionProps["variant"];
}) {
  if (variant === "compact")
    return (
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
        {list.map((c) => (
          <CourseRow key={c.id} c={c} />
        ))}
      </div>
    );
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((c) => (
        <li key={c.id} className="min-w-0">
          <CourseCard course={c} />
        </li>
      ))}
    </ul>
  );
}

/** Hidden when there is nothing real to continue, so the universal page stays as it was. */
export function ContinueLearning(p: SectionProps) {
  const tx = useTx();
  const enrolments = useEnrolments();
  const views = useRecentViews();

  const inProgress = (enrolments.data ?? [])
    .filter((e) => e.state !== "cancelled" && e.progressPercent < 100)
    .sort((a, b) => b.progressPercent - a.progressPercent)[0];
  const viewed = views.find((v) => v.kind === "course");

  if (p.signedIn && inProgress)
    return (
      <SectionShell
        p={p}
        kicker={tx("Where you stopped")}
        title={tx("Continue learning")}
        seeAll={{ href: "/my-learning", label: tx("My learning") }}
      >
        <div className="card p-5">
          <p className="font-display text-xl leading-tight tracking-tight text-ink">
            {inProgress.title}
          </p>
          <div className="mt-4">
            <Progress percent={inProgress.progressPercent} label={tx("Course progress")} />
          </div>
          <Link to="/learn/$slug" params={{ slug: inProgress.slug }} className="btn-primary mt-5">
            <Play size={16} aria-hidden /> {tx("Continue")} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </SectionShell>
    );

  if (!p.signedIn && viewed)
    return (
      <SectionShell
        p={p}
        kicker={tx("Based on what you viewed")}
        title={tx("Pick up where you looked")}
        seeAll={{ href: "/courses", label: tx("All courses") }}
      >
        <div className="card p-5">
          <p className="font-display text-xl leading-tight tracking-tight text-ink">
            {viewed.title}
          </p>
          <p className="mt-1 font-body text-[13px] text-ink-mute">{viewed.sub}</p>
          <HrefLink href={viewed.href} className="btn-primary mt-5">
            {tx("Open the course")} <ArrowRight size={16} aria-hidden />
          </HrefLink>
        </div>
      </SectionShell>
    );

  return null;
}

export function MyCourses(p: SectionProps) {
  const tx = useTx();
  const { profileId } = useAuth();
  const limit = limitOf(p);
  const enrolments = useEnrolments();
  const certs = useQuery({
    queryKey: ["certificates", profileId],
    queryFn: () => listMyCertificates(profileId!),
    enabled: Boolean(profileId),
  });
  const views = useRecentViews();
  const rows = (enrolments.data ?? []).filter((e) => e.state !== "cancelled").slice(0, limit);
  const local = views.filter((v) => v.kind === "course").slice(0, limit);

  return (
    <SectionShell
      p={p}
      kicker={tx("Your courses")}
      title={tx("My courses")}
      seeAll={{
        href: p.signedIn ? "/my-learning" : signInHref("/my-learning"),
        label: tx("My learning"),
      }}
    >
      {p.signedIn ? (
        enrolments.isLoading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <Empty
            title={tx("You have not started a course yet")}
            body={tx("Free to start, and every course ends in an assessment you have to pass.")}
            cta={{ href: "/courses", label: tx("Browse courses") }}
          />
        ) : (
          <>
            <ul className="grid gap-3">
              {rows.map((e) => (
                <li key={e.id} className="card p-4">
                  <Link to="/learn/$slug" params={{ slug: e.slug }} className="block">
                    <p className="truncate font-display text-[1.05rem] font-semibold text-ink">
                      {e.title}
                    </p>
                  </Link>
                  <div className="mt-2">
                    <Progress percent={e.progressPercent} label={tx("Course progress")} />
                  </div>
                </li>
              ))}
            </ul>
            {(certs.data ?? []).length > 0 && (
              <p className="mt-3 font-body text-[12.5px] text-ink-mute">
                {(certs.data ?? []).length} {tx("certificates earned")}
              </p>
            )}
          </>
        )
      ) : local.length > 0 ? (
        <>
          <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
            {local.map((v) => (
              <li key={v.href} className="border-b border-ink-line last:border-b-0">
                <HrefLink
                  href={v.href}
                  className="block px-4 py-3.5 transition-colors hover:bg-paper"
                >
                  <span className="block truncate font-display text-[1.05rem] font-semibold text-ink">
                    {v.title}
                  </span>
                  <span className="block font-body text-[12.5px] text-ink-mute">{v.sub}</span>
                </HrefLink>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-body text-[12.5px] text-ink-mute">
            {tx("Courses you viewed on this device.")}{" "}
            <HrefLink href={signInHref("/my-learning")} className="font-semibold text-saffron-600">
              {tx("Sign in to keep your progress")}
            </HrefLink>
          </p>
        </>
      ) : (
        <Empty
          title={tx("Sign in to keep your courses")}
          body={tx(
            "Courses you start, your progress and your certificates live here once you have an account.",
          )}
          cta={{ href: signInHref("/my-learning"), label: tx("Sign in") }}
        />
      )}
    </SectionShell>
  );
}

export function Practice(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const mine = useMySkillNames();
  const views = useRecentViews();
  const ids = useMemo(
    () => [...mine.teach.map((t) => t.skill.id), ...mine.learn.map((l) => l.skill.id)],
    [mine.teach, mine.learn],
  );
  const assessments = useQuery({
    queryKey: ["skill-assessments", ids],
    queryFn: () => listSkillAssessments(ids),
    enabled: p.signedIn && ids.length > 0,
  });
  const list = Object.values(assessments.data ?? {}).slice(0, limit);
  const skill = views.find((v) => v.kind === "skill");

  return (
    <SectionShell
      p={p}
      kicker={tx("Prove it")}
      title={tx("Practice")}
      seeAll={{
        href: p.signedIn ? "/my-learning#practice" : "/skills",
        label: tx("Open practice"),
      }}
    >
      {p.signedIn && list.length > 0 ? (
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
          {list.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 border-b border-ink-line px-4 py-3.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[1.05rem] font-semibold text-ink">
                  {a.title}
                </p>
                <p className="font-body text-[12.5px] text-ink-mute">
                  {a.questionCount} {tx("questions")} · {tx("pass at")} {a.passScore}%
                </p>
              </div>
              <HrefLink
                href="/my-learning#practice"
                className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[12px]"
              >
                {tx("Prove it now")}
              </HrefLink>
            </li>
          ))}
        </ul>
      ) : p.signedIn ? (
        <Empty
          title={tx("Practice with the AI mentor")}
          body={tx(
            "Add a skill you teach or want to learn and any assessment for it appears here. Until then the AI mentor writes practice for you.",
          )}
          cta={{ href: "/skills", label: tx("Pick a skill") }}
        />
      ) : (
        <Empty
          title={skill ? `${tx("Practice")} ${skill.title}` : tx("Practice with the AI mentor")}
          body={tx(
            "The AI mentor writes the modules and guides you while you work. No account needed to look around.",
          )}
          cta={{
            href: skill ? `/mentor/${skill.id}` : "/skills",
            label: skill ? tx("Open the mentor") : tx("Pick a skill"),
          }}
        />
      )}
    </SectionShell>
  );
}

/** Courses for the gaps in the roles the member is closest to; visitors: the roles they viewed. */
export function RelevantCourses(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const openings = useOpenings();
  const mine = useMySkillNames();
  const views = useRecentViews();

  const { list, basis } = useMemo(() => {
    const own = p.signedIn ? mine.names : [];
    const viewed = viewedSkillNames(views);
    const base = own.length ? own : viewed;
    const all = openingsOf(openings.data);
    // The skills those roles ask for that this person does not list yet.
    const wanted = new Set<string>();
    if (base.length) {
      all
        .map((o) => ({ o, m: matchAgainst(o, base) }))
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 3)
        .forEach(({ m }) => m.missing.forEach((s) => wanted.add(s)));
    }
    const found = coursesForNames([...wanted], limit);
    if (found.length)
      return {
        list: found,
        basis: own.length
          ? tx("For the gaps in your closest roles")
          : tx("Based on what you viewed"),
      };
    return {
      list: popularCourses(limit),
      basis: tx("Popular on Swayam. Open a job and this becomes specific to it."),
    };
  }, [p.signedIn, mine.names, views, openings.data, limit, tx]);

  return (
    <SectionShell
      p={p}
      kicker={tx("Close the gap")}
      title={tx("Courses for these roles")}
      seeAll={{ href: "/courses", label: tx("All courses") }}
    >
      <CourseGrid list={list} variant={p.variant} />
      <p className="mt-3 font-body text-[12px] text-ink-mute">{basis}</p>
    </SectionShell>
  );
}

export function RecommendedCourses(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const mine = useMySkillNames();
  const views = useRecentViews();

  const { list, basis } = useMemo(() => {
    const learn = p.signedIn ? [...mine.learn.map((l) => l.skill.name), ...mine.names] : [];
    const viewed = viewedSkillNames(views);
    const names = learn.length ? learn : viewed;
    const found = coursesForNames(names, limit);
    if (found.length)
      return {
        list: found,
        basis: learn.length ? tx("For the skills on your profile") : tx("Based on what you viewed"),
      };
    return {
      list: popularCourses(limit),
      basis: tx("Popular on Swayam. Add or view a skill and this narrows to it."),
    };
  }, [p.signedIn, mine.learn, mine.names, views, limit, tx]);

  return (
    <SectionShell
      p={p}
      kicker={tx("Picked for you")}
      title={tx("Recommended courses")}
      seeAll={{ href: "/courses", label: tx("All courses") }}
    >
      <CourseGrid list={list} variant={p.variant} />
      <p className="mt-3 font-body text-[12px] text-ink-mute">{basis}</p>
    </SectionShell>
  );
}

export function SkillBuilder(p: SectionProps) {
  const tx = useTx();
  const mine = useMySkillNames();
  const routes = [
    {
      href: "/board",
      title: tx("Skill board"),
      body: tx("Who teaches what, and which courses cover it."),
    },
    {
      href: "/skills",
      title: tx("Skills library"),
      body: tx("Every track, with the time to job-ready."),
    },
    ...(p.signedIn
      ? [
          {
            href: "/skillswap",
            title: tx("Your skills"),
            body: `${mine.teach.length} ${tx("you teach")} · ${mine.learn.length} ${tx("you are learning")}`,
          },
        ]
      : []),
  ];
  return (
    <SectionShell
      p={p}
      kicker={tx("Skill Builder")}
      title={tx("Build a skill, step by step")}
      seeAll={{ href: "/board", label: tx("Open the board") }}
    >
      <ul className="grid gap-3">
        {routes.slice(0, p.variant === "compact" ? 2 : 3).map((r) => (
          <li key={r.href}>
            <HrefLink href={r.href} className="card block p-4">
              <span className="block font-display text-[1.05rem] font-semibold leading-tight text-ink">
                {r.title}
              </span>
              <span className="mt-1 block font-body text-[13px] text-ink-soft">{r.body}</span>
            </HrefLink>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
