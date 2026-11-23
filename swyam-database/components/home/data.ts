/**
 * Shared reads for the Home sections. Every key is one an existing page already
 * uses, so React Query serves the cache and nothing is fetched twice.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEvolutionSnapshot } from "@/evolution/react/hooks";
import {
  listOpportunities,
  matchAgainst,
  type MatchResult,
  type Opportunity,
} from "@/lib/opportunities";
import { allSkills, coursesForSkill } from "@/lib/skill-courses";
import {
  SAMPLE_MIN_INTERNSHIPS,
  SAMPLE_MIN_JOBS,
  courses,
  sampleOpenings,
  type Course,
} from "@/data/mock";
import type { HomeLayout } from "@/evolution/types";
import { listTeachSkills, listLearnSkills } from "@/lib/skillswap";
import { useAuth } from "@/context/AuthContext";
import { resolveEntity, type EntityView } from "./resolve";
import { buildIntentLane, type IntentLane } from "./sections/intent-model";

/**
 * Live openings, topped up with the labelled samples only while the live catalogue is thinner than
 * the demo needs. Live rows always win a slug clash, and the samples vanish by themselves once the
 * database holds enough real ones.
 */
export function withSamples(live: Opportunity[]): Opportunity[] {
  const jobs = live.filter((o) => o.kind === "job").length;
  const internships = live.filter((o) => o.kind === "internship").length;
  if (jobs >= SAMPLE_MIN_JOBS && internships >= SAMPLE_MIN_INTERNSHIPS) return live;
  const have = new Set(live.map((o) => o.slug.toLowerCase()));
  return [...live, ...sampleOpenings.filter((o) => !have.has(o.slug.toLowerCase()))];
}

/** One request for every opening; the Jobs strip, counts, Recently Viewed and the hero all read it. */
export function useOpenings() {
  return useQuery({
    queryKey: ["opportunities", "all"],
    queryFn: () => listOpportunities(),
    select: withSamples,
  });
}

const NONE: Opportunity[] = [];
export const openingsOf = (data: Opportunity[] | undefined): Opportunity[] => data ?? NONE;

/** The local behaviour log's recent entities, resolved against the real catalogue. */
export function useRecentViews(): EntityView[] {
  const recent = useEvolutionSnapshot().profile.recent;
  const openings = useOpenings();
  return useMemo(() => {
    const seen = new Set<string>();
    const out: EntityView[] = [];
    for (const r of recent) {
      const v = resolveEntity(r.entityId, openingsOf(openings.data));
      if (!v || seen.has(r.entityId)) continue;
      seen.add(r.entityId);
      out.push(v);
    }
    return out;
  }, [recent, openings.data]);
}

/** Skill names the member says they can teach or want to learn (members only). */
export function useMySkillNames() {
  const { profileId } = useAuth();
  const enabled = Boolean(profileId);
  const teach = useQuery({
    queryKey: ["teach-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled,
  });
  const learn = useQuery({
    queryKey: ["learn-skills", profileId],
    queryFn: () => listLearnSkills(profileId!),
    enabled,
  });
  return {
    teach: teach.data ?? [],
    learn: learn.data ?? [],
    names: (teach.data ?? []).map((t) => t.skill.name),
    loading: enabled && (teach.isLoading || learn.isLoading),
  };
}

/** Skills implied by what a visitor looked at: viewed skill tracks and the skills of viewed openings. */
export function viewedSkillNames(views: ReadonlyArray<EntityView>): string[] {
  const out = new Set<string>();
  for (const v of views) {
    if (v.kind === "skill") out.add(v.skill.title);
    if (v.kind === "job" || v.kind === "internship") for (const s of v.opening.skills) out.add(s);
  }
  return [...out];
}

/** Best match first; ties keep the list's own order (newest first). Without skills, order is untouched. */
export function rankOpenings(
  list: ReadonlyArray<Opportunity>,
  skills: ReadonlyArray<string>,
): Array<{ o: Opportunity; match: MatchResult | null }> {
  const scored = list.map((o, i) => ({
    o,
    i,
    match: skills.length ? matchAgainst(o, [...skills]) : null,
  }));
  if (skills.length)
    scored.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0) || a.i - b.i);
  return scored.map(({ o, match }) => ({ o, match }));
}

/** Real courses that teach any of these skills; [] when none do (the caller says so). */
export function coursesForNames(names: ReadonlyArray<string>, limit: number): Course[] {
  const wanted = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return [];
  const out = new Map<string, Course>();
  for (const { skill } of allSkills()) {
    const t = skill.title.toLowerCase();
    if (!wanted.some((w) => w === t || t.includes(w) || w.includes(t))) continue;
    for (const c of coursesForSkill(skill, 3)) out.set(c.id, c);
  }
  return [...out.values()].slice(0, limit);
}

/** Honest fallback when there is no signal: the most-enrolled real courses, labelled as such. */
export function popularCourses(limit: number): Course[] {
  return [...courses].sort((a, b) => b.enrolled - a.enrolled).slice(0, limit);
}

/**
 * The Intent Lane for this visitor: tags that recur across what they opened, turned into Learn, Prove
 * and Apply steps. Computed on this device from slugs already in the behaviour log.
 */
export function useIntentLane(signedIn: boolean, layout: HomeLayout): IntentLane {
  const views = useRecentViews();
  const openings = useOpenings();
  const mine = useMySkillNames();
  // The skill list is a fresh array every render; its content is what matters.
  const nameKey = signedIn ? mine.names.join("\u0000") : "";
  return useMemo(
    () =>
      buildIntentLane({
        views,
        openings: openingsOf(openings.data),
        layout,
        signedIn,
        mySkills: nameKey ? nameKey.split("\u0000") : [],
      }),
    [views, openings.data, layout, signedIn, nameKey],
  );
}
