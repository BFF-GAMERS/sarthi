import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import OpportunityCard from "@/components/OpportunityCard";
import { useAuth } from "@/context/AuthContext";
import { listOpportunities } from "@/lib/opportunities";
import { myApplications, stateLabel } from "@/lib/applications";
import { listCareerPaths } from "@/lib/career";
import { useTx } from "@/lib/i18n";
import { track } from "@/evolution/runtime/tracker/track";
import { EV } from "@/evolution/config/ids";
import HrefLink from "../HrefLink";
import { openingsOf, rankOpenings, useMySkillNames, useOpenings, useRecentViews } from "../data";
import { limitOf, type SectionProps } from "../types";
import { rankByViews, viewedKeys, type Because } from "./intent-model";
import { Empty, OpeningList, SectionShell, Skeleton, signInHref } from "./shared";

/**
 * Openings the visitor has not already seen. A signed-in member with skills gets them ranked by those
 * skills, with a real percentage. Everyone else gets them ordered by what they opened, each saying
 * "Because you viewed X" and carrying no bar: a visitor's own views are not a profile to score against.
 */
export function RecommendedJobs(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const openings = useOpenings();
  const mine = useMySkillNames();
  const views = useRecentViews();
  const seen = useMemo(() => viewedKeys(views), [views]);
  const fromProfile = p.signedIn && mine.names.length > 0;
  const rows = useMemo(() => {
    const list = openingsOf(openings.data);
    if (fromProfile)
      return rankOpenings(
        list.filter((o) => !seen.has(o.slug.toLowerCase())),
        mine.names,
      )
        .slice(0, limit)
        .map((r) => ({ o: r.o, match: r.match, because: null as Because | null }));
    return rankByViews(list, views)
      .slice(0, limit)
      .map((r) => ({ o: r.o, match: null, because: r.because }));
  }, [openings.data, fromProfile, mine.names, views, seen, limit]);
  const basis = fromProfile
    ? tx("Matched to the skills on your profile. Roles you already opened are left out.")
    : views.length > 0
      ? tx("Ordered by what you opened. Roles you already viewed are left out.")
      : tx(
          "The newest openings. Sign in and add skills, or open a few roles, and this follows you.",
        );

  return (
    <SectionShell
      p={p}
      kicker={tx("For you")}
      title={tx("Recommended jobs")}
      seeAll={{ href: "/jobs", label: tx("All jobs") }}
    >
      {openings.isLoading ? (
        <Skeleton h="h-40" />
      ) : rows.length === 0 ? (
        <Empty
          title={tx("Nothing new is open right now")}
          body={tx(
            "New roles appear here as employers post them. Set an alert and you will hear the day something fits.",
          )}
          cta={{ href: "/jobs", label: tx("Set a job alert") }}
        />
      ) : p.variant === "compact" ? (
        <OpeningList list={rows.map((r) => r.o)} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ o, match, because }) => (
            <li key={o.id} className="min-w-0">
              <OpportunityCard opportunity={o} match={match} because={because} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 font-body text-[12px] leading-relaxed text-ink-mute">{basis}</p>
    </SectionShell>
  );
}

export function Internships(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const list = useQuery({
    queryKey: ["opportunities", "internship"],
    queryFn: () => listOpportunities("internship"),
  });
  const rows = (list.data ?? []).slice(0, limit);
  return (
    <SectionShell
      p={p}
      kicker={tx("Learn on the job")}
      title={tx("Internships")}
      seeAll={{ href: "/internships", label: tx("All internships") }}
    >
      {list.isLoading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty
          title={tx("No internships are live")}
          body={tx(
            "Employers post apprenticeships here as they open. Check back, or browse the jobs.",
          )}
          cta={{ href: "/jobs", label: tx("See open jobs") }}
        />
      ) : (
        <OpeningList list={rows} />
      )}
    </SectionShell>
  );
}

/** What was applied for on Swayam. An external click is never shown as "Applied". */
export function Applications(p: SectionProps) {
  const tx = useTx();
  const { profileId } = useAuth();
  const limit = limitOf(p);
  const apps = useQuery({
    queryKey: ["my-applications", profileId],
    queryFn: () => myApplications(profileId!),
    enabled: Boolean(profileId),
  });
  const live = (apps.data ?? []).filter((a) => a.state !== "withdrawn").slice(0, limit);
  return (
    <SectionShell
      p={p}
      kicker={tx("Your pipeline")}
      title={tx("Applications")}
      seeAll={{
        href: p.signedIn ? "/applications" : signInHref("/applications"),
        label: tx("Open the tracker"),
      }}
    >
      {!p.signedIn ? (
        <Empty
          title={tx("Sign in to track applications")}
          body={tx(
            "When you apply on Swayam, every step the employer takes is dated here. Jobs that open on an employer's own site are tracked by them, not here.",
          )}
          cta={{ href: signInHref("/applications"), label: tx("Sign in") }}
        />
      ) : apps.isLoading ? (
        <Skeleton h="h-24" />
      ) : live.length === 0 ? (
        <Empty
          title={tx("Nothing applied for yet")}
          body={tx("Applications you make on Swayam are listed here with their latest step.")}
          cta={{ href: "/jobs", label: tx("See what is open") }}
        />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
          {live.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 border-b border-ink-line px-4 py-3.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[1.05rem] font-semibold text-ink">
                  {a.opportunity?.title ?? tx("An opening that has closed")}
                </p>
                <p className="truncate font-body text-[12.5px] text-ink-mute">
                  {a.opportunity?.employer?.name ?? ""}
                </p>
              </div>
              <span className="chip shrink-0">{stateLabel(a.state)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export function CareerLauncher(p: SectionProps) {
  const tx = useTx();
  const views = useRecentViews();
  const paths = useQuery({ queryKey: ["career-paths"], queryFn: listCareerPaths });
  const lastJob = views.find((v) => v.kind === "job" || v.kind === "internship");
  const cv = lastJob ? `/cv?for=${encodeURIComponent(lastJob.id)}` : "/cv";
  const open = (surface: "cv" | "coach" | "path") => () =>
    track(EV.CAREER_LAUNCHER_OPENED, { surface, action: "open" });
  const shown = (paths.data ?? []).slice(0, p.variant === "compact" ? 2 : 3);
  return (
    <SectionShell
      p={p}
      kicker={tx("Career Launcher")}
      title={tx("From a goal to a first job")}
      seeAll={{ href: "/careers", label: tx("All careers") }}
    >
      {paths.isLoading ? (
        <Skeleton />
      ) : shown.length > 0 ? (
        <ul className="grid gap-3">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                to="/careers/$slug"
                params={{ slug: c.slug }}
                onClick={open("path")}
                className="card block p-4"
              >
                <p className="font-display text-[1.05rem] font-semibold leading-tight text-ink">
                  {c.title}
                </p>
                {c.summary && p.variant !== "compact" && (
                  <p className="mt-1 line-clamp-2 font-body text-[13px] text-ink-soft">
                    {c.summary}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <HrefLink href={cv} onClick={open("cv")} className="btn-ghost !px-4 !py-2 !text-[13px]">
          {lastJob ? tx("Review my CV for the role I viewed") : tx("Review my CV")}
        </HrefLink>
        <HrefLink
          href="/coach#path"
          onClick={open("coach")}
          className="btn-ghost !px-4 !py-2 !text-[13px]"
        >
          {tx("Build my learning path")}
        </HrefLink>
      </div>
    </SectionShell>
  );
}
