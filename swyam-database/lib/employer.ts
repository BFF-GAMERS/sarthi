import { getSupabase } from "./supabase";
import type { Database } from "../types/database";

/**
 * What an employer actually has on this platform.
 *
 * The recruiter dashboard was a mockup that shipped: "6 active job posts",
 * "1,011 total applicants", "9 interviews this week", "11 days average time to
 * hire", and a list of four candidates with invented match scores. Every one
 * of those numbers was a constant in the JSX, identical for every company that
 * signed in — including a company that had posted nothing at all.
 *
 * These read `companies`, `company_members`, `opportunities` and
 * `applications`. A company with no postings gets zeros, which is the correct
 * and useful answer: it tells them to post something.
 */

export type ApplicationState = Database["public"]["Enums"]["application_state"];

export interface EmployerSummary {
  companyId: string | null;
  companyName: string | null;
  openPosts: number;
  applicants: number;
  /** Applications that have not been decided either way. */
  awaitingDecision: number;
}

export interface EmployerPost {
  id: string;
  slug: string;
  title: string;
  kind: string;
  location: string | null;
  openings: number;
  applicationCount: number;
  isPublished: boolean;
  closedAt: string | null;
  createdAt: string;
}

export interface EmployerApplicant {
  id: string;
  state: ApplicationState;
  matchScore: number | null;
  submittedAt: string;
  opportunityTitle: string;
  applicant: {
    id: string;
    name: string;
    handle: string;
    avatarUrl: string | null;
    headline: string | null;
  } | null;
}

/** The company this member administers, if any. */
export async function myCompanyId(profileId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.company_id ?? null;
}

export async function employerSummary(profileId: string): Promise<EmployerSummary> {
  const supabase = getSupabase();
  const empty: EmployerSummary = {
    companyId: null,
    companyName: null,
    openPosts: 0,
    applicants: 0,
    awaitingDecision: 0,
  };
  if (!supabase) return empty;

  const companyId = await myCompanyId(profileId);
  if (!companyId) return empty;

  const [company, posts] = await Promise.all([
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
    supabase
      .from("opportunities")
      .select("id, application_count, is_published, closed_at")
      .eq("company_id", companyId),
  ]);

  const rows = posts.data ?? [];
  const open = rows.filter((r) => r.is_published && !r.closed_at);
  const ids = rows.map((r) => r.id);

  let awaiting = 0;
  if (ids.length > 0) {
    const { count } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .in("opportunity_id", ids)
      .is("decided_at", null);
    awaiting = count ?? 0;
  }

  return {
    companyId,
    companyName: company.data?.name ?? null,
    openPosts: open.length,
    applicants: rows.reduce((n, r) => n + Number(r.application_count ?? 0), 0),
    awaitingDecision: awaiting,
  };
}

export async function employerPosts(companyId: string): Promise<EmployerPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, slug, title, kind, location, openings, application_count, is_published, closed_at, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);

  return (data ?? []).map((o) => ({
    id: o.id,
    slug: o.slug,
    title: o.title,
    kind: String(o.kind),
    location: o.location,
    openings: Number(o.openings ?? 1),
    applicationCount: Number(o.application_count ?? 0),
    isPublished: o.is_published,
    closedAt: o.closed_at,
    createdAt: o.created_at,
  }));
}

export async function employerApplicants(
  companyId: string,
  limit = 8,
): Promise<EmployerApplicant[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: posts } = await supabase
    .from("opportunities")
    .select("id")
    .eq("company_id", companyId);
  const ids = (posts ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, state, match_score, submitted_at, " +
        "opportunities:opportunity_id (title), " +
        "profiles:profile_id (id, display_name, handle, avatar_url, headline)",
    )
    .in("opportunity_id", ids)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      state: ApplicationState;
      match_score: number | null;
      submitted_at: string;
      opportunities: { title: string } | null;
      profiles: {
        id: string;
        display_name: string;
        handle: string;
        avatar_url: string | null;
        headline: string | null;
      } | null;
    }>
  ).map((a) => ({
    id: a.id,
    state: a.state,
    matchScore: a.match_score,
    submittedAt: a.submitted_at,
    opportunityTitle: a.opportunities?.title ?? "Opening",
    applicant: a.profiles
      ? {
          id: a.profiles.id,
          name: a.profiles.display_name,
          handle: a.profiles.handle,
          avatarUrl: a.profiles.avatar_url,
          headline: a.profiles.headline,
        }
      : null,
  }));
}

export interface CreatedCourse {
  id: string;
  slug: string;
  title: string;
  level: string;
  enrollmentCount: number;
  isPublished: boolean;
}

/**
 * Courses this account created.
 *
 * Used by the training-partner dashboard, which previously charted a week of
 * attendance nobody had recorded. `enrollment_count` is maintained by the
 * database, so this is the real number of people who signed up.
 */
export async function listCoursesCreatedBy(profileId: string): Promise<CreatedCourse[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, level, enrollment_count, is_published")
    .eq("creator_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    level: String(c.level),
    enrollmentCount: Number(c.enrollment_count ?? 0),
    isPublished: c.is_published,
  }));
}

/* ── Posting and closing ─────────────────────────────────────────── */

export type WorkMode = Database["public"]["Enums"]["work_mode"];
export type OpportunityKind = Database["public"]["Enums"]["opportunity_kind"];

export interface NewOpening {
  kind: OpportunityKind;
  title: string;
  summary: string;
  description: string;
  /** One line per duty. */
  responsibilities: string;
  eligibility: string;
  workMode: WorkMode;
  location: string;
  region: string;
  openings: number;
  /** ISO date, or empty for "open until filled". */
  deadline: string;
  /** Whole rupees. A job carries a range; an internship a stipend. */
  payMin: number | null;
  payMax: number | null;
  payPeriod: "month" | "year";
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  experience: string;
  benefits: string[];
  responseTime: string;
  /** Approved skill ids from the catalogue. */
  skillIds: string[];
}

/** "Frontend Intern" → "frontend-intern-k3x9". Unique enough; the column is unique. */
function slugFor(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const tail = Math.random().toString(36).slice(2, 6);
  return `${base || "opening"}-${tail}`;
}

/**
 * Publish an opening for the company this member belongs to.
 *
 * Published straight away: an employer who has filled in a form wants it
 * listed, and the `opportunities_manage` policy already limits this to
 * members of the company. `apply_url` stays null, which means applications
 * are collected here and land on this company's dashboard — the honest
 * setting for an employer who actually uses the dashboard.
 */
export async function postOpening(
  companyId: string,
  profileId: string,
  o: NewOpening,
): Promise<{ id: string; slug: string }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected.");

  const toMinor = (n: number | null) => (n && n > 0 ? Math.round(n) * 100 : null);
  const internship = o.kind === "internship";

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      company_id: companyId,
      posted_by: profileId,
      kind: o.kind,
      slug: slugFor(o.title),
      title: o.title.trim(),
      summary: o.summary.trim() || null,
      description: o.description.trim() || null,
      responsibilities: o.responsibilities.trim() || null,
      eligibility: o.eligibility.trim() || null,
      work_mode: o.workMode,
      location: o.location.trim() || (o.workMode === "remote" ? "Remote" : null),
      region: o.region.trim() || null,
      openings: Math.max(1, Math.round(o.openings || 1)),
      application_deadline: o.deadline || null,
      stipend_minor: internship ? toMinor(o.payMin) : null,
      salary_min_minor: internship ? null : toMinor(o.payMin),
      salary_max_minor: internship ? null : toMinor(o.payMax ?? o.payMin),
      is_paid: Boolean(o.payMin && o.payMin > 0),
      duration_weeks: internship ? o.durationWeeks : null,
      hours_per_week: o.hoursPerWeek,
      is_published: true,
      published_at: new Date().toISOString(),
      apply_url: null,
      details: {
        payPeriod: o.payPeriod,
        ...(o.experience.trim() ? { experience: o.experience.trim() } : {}),
        ...(o.benefits.length ? { benefits: o.benefits } : {}),
        ...(o.responseTime.trim() ? { responseTime: o.responseTime.trim() } : {}),
      },
    })
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);

  if (o.skillIds.length > 0) {
    const { error: skillError } = await supabase
      .from("opportunity_skills")
      .insert(o.skillIds.map((skill_id) => ({ opportunity_id: data.id, skill_id })));
    // The opening exists; a failed skill row is not a reason to pretend it does not.
    if (skillError) console.warn("opportunity_skills:", skillError.message);
  }

  return { id: data.id, slug: data.slug };
}

/** Take an opening off the list. Applications already made are kept. */
export async function closeOpening(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected.");
  const { error } = await supabase
    .from("opportunities")
    .update({ closed_at: new Date().toISOString(), is_published: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Put a closed opening back on the list. */
export async function reopenOpening(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected.");
  const { error } = await supabase
    .from("opportunities")
    .update({ closed_at: null, is_published: true, published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── The pipeline ────────────────────────────────────────────────── */

export interface Pipeline {
  /** Counts by application state, for this company's openings. */
  byState: Record<ApplicationState, number>;
  total: number;
  /** Applications received in the last seven days. */
  newThisWeek: number;
  /** Openings, split the way an employer thinks about them. */
  drafts: number;
  published: number;
  closed: number;
}

const EMPTY_PIPELINE: Pipeline = {
  byState: {
    draft: 0,
    submitted: 0,
    under_review: 0,
    shortlisted: 0,
    interviewing: 0,
    offered: 0,
    hired: 0,
    rejected: 0,
    withdrawn: 0,
  },
  total: 0,
  newThisWeek: 0,
  drafts: 0,
  published: 0,
  closed: 0,
};

/**
 * Where every application to this company currently stands.
 *
 * The recruiter dashboard drew a funnel from four numbers that were constants
 * in the JSX. This counts the rows: one select over the company's openings,
 * one over their applications, and the arithmetic in JavaScript because the
 * numbers involved are small and a view would be a migration for no gain.
 */
export async function employerPipeline(companyId: string): Promise<Pipeline> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY_PIPELINE;

  const { data: posts, error: postError } = await supabase
    .from("opportunities")
    .select("id, is_published, closed_at")
    .eq("company_id", companyId);
  if (postError) throw new Error(postError.message);

  const rows = posts ?? [];
  const ids = rows.map((p) => p.id);
  const shape: Pipeline = {
    ...EMPTY_PIPELINE,
    byState: { ...EMPTY_PIPELINE.byState },
    drafts: rows.filter((p) => !p.is_published && !p.closed_at).length,
    published: rows.filter((p) => p.is_published && !p.closed_at).length,
    closed: rows.filter((p) => p.closed_at).length,
  };
  if (ids.length === 0) return shape;

  const { data, error } = await supabase
    .from("applications")
    .select("state, submitted_at")
    .in("opportunity_id", ids);
  if (error) throw new Error(error.message);

  const weekAgo = Date.now() - 7 * 86_400_000;
  for (const a of data ?? []) {
    const state = a.state as ApplicationState;
    shape.byState[state] = (shape.byState[state] ?? 0) + 1;
    shape.total += 1;
    if (new Date(a.submitted_at).getTime() >= weekAgo) shape.newThisWeek += 1;
  }
  return shape;
}
