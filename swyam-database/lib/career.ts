import { getSupabase, requireSupabase } from "./supabase";

/**
 * Career paths — the most finished thing on this platform that nobody could
 * reach.
 *
 * In the database: eight paths (`career_paths`, all active), forty-one skill
 * requirements mapped to them (`career_path_skills`, each with a required
 * level, a stage and a weight), a function that scores a member against a
 * path and names exactly what they are missing (`analyse_career_gap`), and a
 * function that turns those gaps into an ordered plan of courses and swap
 * partners (`generate_career_plan`). Both granted to `authenticated`.
 *
 * Not one of those five things is referenced anywhere in `src/`. The whole
 * feature was built back-to-front and then never given a page.
 *
 * This module is that page's data layer. It writes no logic the database
 * already has — the readiness score and the ordering are the server's, because
 * a second implementation in TypeScript would drift from it within a month.
 */

/* ── The paths ────────────────────────────────────────────────────── */

export interface CareerPath {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  icon: string | null;
  /** Real job titles this path leads to — what a person searches for. */
  typicalTitles: string[];
  skillCount: number;
}

export async function listCareerPaths(): Promise<CareerPath[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("career_paths")
    .select(
      "id, slug, title, summary, description, icon, typical_titles, career_path_skills(skill_id)",
    )
    .eq("is_active", true)
    .order("title");
  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id,
    slug: String(p.slug),
    title: p.title,
    summary: p.summary,
    description: p.description,
    icon: p.icon,
    typicalTitles: p.typical_titles ?? [],
    skillCount: Array.isArray(p.career_path_skills) ? p.career_path_skills.length : 0,
  }));
}

export async function getCareerPath(slug: string): Promise<CareerPath | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("career_paths")
    .select(
      "id, slug, title, summary, description, icon, typical_titles, career_path_skills(skill_id)",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    slug: String(data.slug),
    title: data.title,
    summary: data.summary,
    description: data.description,
    icon: data.icon,
    typicalTitles: data.typical_titles ?? [],
    skillCount: Array.isArray(data.career_path_skills) ? data.career_path_skills.length : 0,
  };
}

/* ── The gap ──────────────────────────────────────────────────────── */

/** Where a skill sits in the path. The order matters — learn foundation first. */
export type Stage = "foundation" | "core" | "advanced" | string;

export interface GapSkill {
  skillId: string;
  skill: string;
  stage: Stage;
  /** The level the path asks for. Absent on skills already proven. */
  required?: string;
  /** The level they hold. Absent when they do not hold it at all. */
  level?: string;
  nextStep?: string;
}

export interface CareerGap {
  readiness: number;
  /** Held at the required level AND backed by an assessment or verification. */
  proven: GapSkill[];
  /** Held at the required level, but only because they said so. */
  claimed: GapSkill[];
  /** Held, but below the level the path needs. */
  partial: GapSkill[];
  missing: GapSkill[];
}

interface RawGapSkill {
  skill_id: string;
  skill: string;
  stage: string;
  required?: string;
  level?: string;
  next_step?: string;
}

function toGapSkills(rows: unknown): GapSkill[] {
  return ((rows ?? []) as RawGapSkill[]).map((r) => ({
    skillId: r.skill_id,
    skill: r.skill,
    stage: r.stage,
    ...(r.required ? { required: r.required } : {}),
    ...(r.level ? { level: r.level } : {}),
    ...(r.next_step ? { nextStep: r.next_step } : {}),
  }));
}

const STAGE_ORDER: Record<string, number> = { foundation: 0, core: 1, advanced: 2 };

/** Foundation before core before advanced, then alphabetical. */
export function byStage(a: GapSkill, b: GapSkill): number {
  const d = (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9);
  return d !== 0 ? d : a.skill.localeCompare(b.skill);
}

/**
 * The four buckets — proven, claimed, partial, missing — are the server's
 * judgement, not ours. `claimed` versus `proven` is the distinction the whole
 * platform turns on: a skill you typed in is not a skill an employer can rely
 * on, and the difference is an assessment away.
 */
export async function analyseGap(profileId: string, pathId: string): Promise<CareerGap | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("analyse_career_gap", {
    p_profile: profileId,
    p_path: pathId,
  });
  if (error) throw new Error(error.message);

  const raw = data as unknown as {
    readiness?: number;
    proven?: unknown;
    claimed?: unknown;
    partial?: unknown;
    missing?: unknown;
  } | null;
  if (!raw) return null;

  return {
    readiness: Number(raw.readiness ?? 0),
    proven: toGapSkills(raw.proven).sort(byStage),
    claimed: toGapSkills(raw.claimed).sort(byStage),
    partial: toGapSkills(raw.partial).sort(byStage),
    missing: toGapSkills(raw.missing).sort(byStage),
  };
}

/* ── The goal, and the plan it generates ──────────────────────────── */

export interface CareerGoal {
  id: string;
  pathId: string | null;
  state: string;
  targetDate: string | null;
  motivation: string | null;
}

export async function getGoalForPath(
  profileId: string,
  pathId: string,
): Promise<CareerGoal | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("career_goals")
    .select("id, path_id, state, target_date, motivation")
    .eq("profile_id", profileId)
    .eq("path_id", pathId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    pathId: data.path_id,
    state: data.state,
    targetDate: data.target_date,
    motivation: data.motivation,
  };
}

/** Every path this member has set their sights on, newest first. */
export async function listMyGoals(
  profileId: string,
): Promise<Array<CareerGoal & { slug: string; title: string }>> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("career_goals")
    .select("id, path_id, state, target_date, motivation, career_paths ( slug, title )")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((g) => {
    const path = Array.isArray(g.career_paths) ? g.career_paths[0] : g.career_paths;
    return {
      id: g.id,
      pathId: g.path_id,
      state: g.state,
      targetDate: g.target_date,
      motivation: g.motivation,
      slug: String(path?.slug ?? ""),
      title: path?.title ?? "Career path",
    };
  });
}

/**
 * Choose this path, then let the database write the plan.
 *
 * Two steps rather than one because `generate_career_plan` takes a goal id: the
 * goal is the durable thing a member owns and can abandon, the plan is derived
 * from it and can be rebuilt whenever their skills change.
 */
export async function choosePath(profileId: string, pathId: string): Promise<string> {
  const supabase = requireSupabase();

  const existing = await getGoalForPath(profileId, pathId);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("career_goals")
    .insert({ profile_id: profileId, path_id: pathId, state: "active" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Rebuild the plan from the current gap. Returns how many items it wrote. */
export async function generatePlan(goalId: string): Promise<number> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("generate_career_plan", { p_goal: goalId });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export type PlanItemKind =
  "skill" | "course" | "assessment" | "project" | "internship" | "job" | "session";
export type PlanItemState = "todo" | "in_progress" | "done" | "skipped";

export interface PlanItem {
  id: string;
  position: number;
  kind: PlanItemKind;
  refId: string | null;
  skillId: string | null;
  title: string;
  rationale: string | null;
  state: PlanItemState;
}

export async function listPlanItems(goalId: string): Promise<PlanItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("career_plan_items")
    .select("id, position, kind, ref_id, skill_id, title, rationale, state")
    .eq("goal_id", goalId)
    .order("position");
  if (error) throw new Error(error.message);

  return (data ?? []).map((i) => ({
    id: i.id,
    position: i.position,
    kind: i.kind as PlanItemKind,
    refId: i.ref_id,
    skillId: i.skill_id,
    title: i.title,
    rationale: i.rationale,
    state: i.state as PlanItemState,
  }));
}

export async function setPlanItemState(itemId: string, state: PlanItemState): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("career_plan_items")
    .update({
      state,
      // Recorded so "done" survives a plan rebuild as a fact with a date on
      // it, rather than as a checkbox that resets.
      completed_at: state === "done" ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

/**
 * The course slugs behind the plan's `course` items.
 *
 * `career_plan_items.ref_id` is a course id, and every link in the plan needs
 * a slug. Fetched in one query rather than one per row.
 */
export async function courseSlugs(ids: string[]): Promise<Record<string, string>> {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return {};

  const { data, error } = await supabase.from("courses").select("id, slug").in("id", ids);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const c of data ?? []) out[c.id] = String(c.slug);
  return out;
}
