import { getSupabase } from "./supabase";
import type { Database } from "../types/database";

/**
 * Jobs and internships, read from the database.
 *
 * The listing pages used to render `src/data/mock.ts` — a hand-written array
 * that looked convincing and was not connected to anything. Applying to one of
 * those postings wrote a row against an opportunity id that did not exist, and
 * an employer posting a real vacancy could never have it appear. The catalogue
 * a visitor browsed and the catalogue the platform actually held were two
 * different things that happened to look alike.
 *
 * Everything here comes from `opportunities`, joined to the employer and to
 * the skills the role asks for. The mock file stays where it is for the pages
 * that still lean on it, but nothing in this path reads it.
 */

type Kind = Database["public"]["Enums"]["opportunity_kind"];
type WorkMode = Database["public"]["Enums"]["work_mode"];

export interface OpportunityEmployer {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  headquarters: string | null;
  isVerified: boolean;
}

export interface Opportunity {
  id: string;
  slug: string;
  title: string;
  kind: Kind;
  workMode: WorkMode;
  location: string | null;
  region: string | null;
  summary: string | null;
  description: string | null;
  responsibilities: string[];
  eligibility: string | null;
  /** Which period the pay figure covers — see payLine for why this is stored. */
  payPeriod: string;
  /**
   * The employer's own application page, or null.
   *
   * Null means "apply here", which is only truthful when स्वYAM is the
   * employer. For anybody else an application collected in-platform never
   * reaches the company doing the hiring. Only ever set to a URL that has
   * been fetched and confirmed to be a real careers page.
   */
  applyUrl: string | null;
  /**
   * What happened the last time that link was fetched, and when.
   *
   * The checker has been writing these two columns and no screen has ever
   * read them. A jobs site's whole worth is that its listings are real, and
   * "we checked this link on Thursday and it answered" is that claim with a
   * date on it — which is worth more than any badge, because a badge cannot
   * go stale in public.
   *
   * Null on an opening applied to here rather than on an employer's site:
   * there is no outside link to check, which is a different thing from a
   * link that has never been checked.
   */
  applyUrlStatus: number | null;
  applyUrlCheckedAt: string | null;
  /** Extra prose the seed carries: what you learn, how hiring runs, tips. */
  details: {
    niceToHave?: string[];
    whatYouLearn?: string[];
    hiringProcess?: string[];
    interviewTips?: string[];
    /** "No experience needed", "1–3 years" — the employer's own words. */
    experience?: string;
    /** What comes with the role beyond pay, if the employer listed any. */
    benefits?: string[];
    /** How long the employer says they take to reply, if they said. */
    responseTime?: string;
  };
  skills: string[];
  openings: number;
  applicationCount: number;
  /** Whole rupees. Null when the employer did not state a figure. */
  salaryMin: number | null;
  salaryMax: number | null;
  stipend: number | null;
  isPaid: boolean;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  deadline: string | null;
  postedAt: string | null;
  /** When the row last changed. Shown so a reader can judge how fresh it is. */
  updatedAt: string | null;
  employer: OpportunityEmployer | null;
}

/** Rupees, not paise — every caller wants the human number. */
const rupees = (minor: number | null | undefined): number | null =>
  typeof minor === "number" ? Math.round(minor / 100) : null;

/**
 * `responsibilities` is one text column, not an array, because the seed writes
 * it as newline-separated prose. Splitting here keeps every caller from
 * reinventing the same parse and getting the empty-line case wrong.
 */
const lines = (value: string | null | undefined): string[] =>
  (value ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

const SELECT = `
  id, slug, title, kind, work_mode, location, region, summary, description,
  responsibilities, eligibility, details, openings, application_count,
  salary_min_minor, salary_max_minor, stipend_minor, is_paid,
  duration_weeks, hours_per_week, application_deadline, published_at, updated_at,
  apply_url, apply_url_status, apply_url_checked_at,
  companies:company_id ( id, slug, name, logo_url, industry, headquarters, is_verified ),
  opportunity_skills ( skills ( name ) )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toOpportunity(row: any): Opportunity {
  const company = row.companies ?? null;
  const details = (row.details ?? {}) as Opportunity["details"];

  return {
    id: row.id,
    slug: row.slug,
    // The employer line already names स्वYAM; repeated in a title it only adds noise.
    title: row.title.replace(/\s*[—-]\s*स्वYAM\s*$/u, ""),
    applyUrl: row.apply_url ?? null,
    applyUrlStatus: row.apply_url_status ?? null,
    applyUrlCheckedAt: row.apply_url_checked_at ?? null,
    kind: row.kind,
    workMode: row.work_mode,
    location: row.location,
    region: row.region,
    summary: row.summary,
    description: row.description,
    responsibilities: lines(row.responsibilities),
    eligibility: row.eligibility,
    details: {
      niceToHave: details.niceToHave ?? [],
      whatYouLearn: details.whatYouLearn ?? [],
      hiringProcess: details.hiringProcess ?? [],
      interviewTips: details.interviewTips ?? [],
      experience: typeof details.experience === "string" ? details.experience : undefined,
      benefits: Array.isArray(details.benefits)
        ? details.benefits.filter((b): b is string => typeof b === "string")
        : undefined,
      responseTime: typeof details.responseTime === "string" ? details.responseTime : undefined,
    },
    payPeriod: (details as { payPeriod?: string }).payPeriod ?? "month",
    skills: (row.opportunity_skills ?? [])
      .map((s: any) => s?.skills?.name)
      .filter((n: unknown): n is string => typeof n === "string"),
    openings: row.openings ?? 1,
    applicationCount: row.application_count ?? 0,
    salaryMin: rupees(row.salary_min_minor),
    salaryMax: rupees(row.salary_max_minor),
    stipend: rupees(row.stipend_minor),
    isPaid: row.is_paid ?? true,
    durationWeeks: row.duration_weeks,
    hoursPerWeek: row.hours_per_week,
    deadline: row.application_deadline,
    postedAt: row.published_at,
    updatedAt: row.updated_at ?? null,
    employer: company
      ? {
          id: company.id,
          slug: company.slug,
          name: company.name,
          logoUrl: company.logo_url,
          industry: company.industry,
          headquarters: company.headquarters,
          isVerified: company.is_verified ?? false,
        }
      : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Every published opening of one kind, newest first.
 *
 * Closed postings are excluded here rather than in the page, so a role that
 * has been filled cannot reappear because one caller forgot the filter.
 */
export async function listOpportunities(kind?: Kind): Promise<Opportunity[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from("opportunities")
    .select(SELECT)
    .eq("is_published", true)
    .is("closed_at", null)
    .order("published_at", { ascending: false });

  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toOpportunity);
}

export async function getOpportunity(slug: string): Promise<Opportunity | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("opportunities")
    .select(SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toOpportunity(data) : null;
}

/**
 * Pay as one line, or null when the employer did not say.
 *
 * The period is read from the row, not assumed from the kind. `salary_min_minor`
 * holds three different units across this table — a shift rate for the
 * warehouse work, a monthly wage for the tuition teaching, an annual package
 * for the developer roles — and the schema has no column that distinguishes
 * them. Assuming "per year" for every job is how the tuition post came to
 * advertise a twelfth of its real wage, on the exact figure somebody decides
 * by. The period now lives in `details.payPeriod`; "month" is the fallback
 * because it is what most of these rows are and it under-states rather than
 * over-states an annual package.
 */
const PERIOD_LABEL: Record<string, string> = {
  year: "/year",
  month: "/month",
  shift: " per shift",
  event: " per event",
  project: " per project",
};

export function payLine(o: Opportunity): string | null {
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const per = PERIOD_LABEL[o.payPeriod] ?? "/month";

  if (o.kind === "internship") {
    if (!o.stipend) return o.isPaid ? null : "Unpaid";
    return `${inr(o.stipend)}${per}`;
  }
  if (o.salaryMin && o.salaryMax) return `${inr(o.salaryMin)} – ${inr(o.salaryMax)}${per}`;
  if (o.salaryMin) return `From ${inr(o.salaryMin)}${per}`;
  return null;
}

/**
 * How close this member is to what the role asks for.
 *
 * Deliberately transparent rather than a single opaque number: a learner who
 * is short of a role should be able to see which skill to go and get, because
 * that is the only part of this they can act on. `have` and `missing` are the
 * output that matters; the percentage is a way to sort.
 */
export interface MatchResult {
  score: number;
  have: string[];
  missing: string[];
}

export function matchAgainst(o: Opportunity, mySkills: string[]): MatchResult {
  const mine = new Set(mySkills.map((s) => s.trim().toLowerCase()));
  const want = o.skills;
  if (want.length === 0) return { score: 0, have: [], missing: [] };

  const have = want.filter((s) => mine.has(s.toLowerCase()));
  const missing = want.filter((s) => !mine.has(s.toLowerCase()));
  return {
    score: Math.round((have.length / want.length) * 100),
    have,
    missing,
  };
}

/**
 * The live openings, cached for five minutes.
 *
 * For the places that answer many questions a minute — Sarthi, the skill
 * matcher, the sitemap — and must answer from the real list rather than a
 * sample, but need not ask the database on every single call.
 */
let cache: { at: number; rows: Opportunity[] } | null = null;
export async function cachedOpenings(maxAgeMs = 5 * 60_000): Promise<Opportunity[]> {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.rows;
  try {
    const rows = await listOpportunities();
    cache = { at: Date.now(), rows };
    return rows;
  } catch {
    return cache?.rows ?? [];
  }
}

/**
 * The employer's industry, when there is one to show.
 *
 * `companies.industry` is being used as a type flag in this data — nearly
 * every row says "company" or "institute" — so printing it next to the name
 * produced "Zomato · company", which is noise wearing the clothes of a fact.
 * Anything that is only the type is dropped.
 */
export function industryOf(employer: OpportunityEmployer | null | undefined): string | null {
  const v = employer?.industry?.trim();
  if (!v) return null;
  return ["company", "institute", "employer", "organisation", "organization"].includes(
    v.toLowerCase(),
  )
    ? null
    : v;
}

/** Days left to apply, or null when no deadline was set. */
export function daysLeft(o: Opportunity): number | null {
  if (!o.deadline) return null;
  const ms = new Date(o.deadline).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
