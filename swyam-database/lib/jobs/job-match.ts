/**
 * "Jobs for me" — personalised openings, on request only.
 *
 * Gemini's free tier is small, so nothing here runs on its own: a member presses the button,
 * at most JOB_MATCH_DAILY times a day (default 2, counted here on the server), and only then
 * is the model asked. The answer is kept, so showing it again costs nothing.
 *
 * Two steps, and only the second uses the model:
 *   1. Every real opening (स्वYAM's own, plus the free remote boards) is scored in code against
 *      what this member has shown: skills they teach or want, courses they take and finish,
 *      openings they saved, pages they recently viewed, their city.
 *   2. Gemini picks up to ten of the top twenty and writes one plain line on each; the list is topped up to ten from the code's ranking. It may
 *      only choose from the list it is given; any id it invents is dropped. If the model is
 *      out of quota or down, the code's own top ten are returned with code-written reasons.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ask, keyFor } from "../gemini";
import { remoteBoards } from "./remote-boards";

type Row = Record<string, unknown>;
/** A client signed in as the member: Row Level Security decides what it may read. */
type Db = SupabaseClient;

async function rows(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Row[] | null) ?? [];
}
const ids = (list: unknown[]) => [...new Set(list.filter((v) => v != null).map(String))];

/** How many openings a press shows: the model's choices first, then the code's ranking. */
export const PICKS = 10;

export const DAILY_LIMIT = Math.max(1, Number(process.env["JOB_MATCH_DAILY"] ?? 2) || 2);

export interface Pick {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  kind: "job" | "internship" | "remote";
  /** In-site link for स्वYAM openings, the board's page for remote ones. */
  href: string;
  external: boolean;
  source: string | null;
  why: string;
}

export interface MatchResult {
  picks: Pick[];
  generatedAt: string;
  /** "gemini" when the model chose; "rules" when it could not and code did. */
  by: "gemini" | "rules";
}

interface Candidate extends Omit<Pick, "why"> {
  text: string;
  skills: string[];
  score: number;
  hits: string[];
}

const STOP = new Set(
  "the and for with from your you are this that will have has into who what our job jobs role work team remote senior junior intern internship".split(
    " ",
  ),
);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));

/** India Standard Time day, so the limit resets at midnight for the member. */
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/* ───────────── what this member has shown ───────────── */

interface Signals {
  name: string | null;
  region: string | null;
  headline: string | null;
  teach: string[];
  learn: string[];
  courses: { title: string; progress: number; done: boolean }[];
  saved: Set<string>;
  applied: Set<string>;
  recent: string[];
}

async function signals(sb: Db, uid: string, recent: string[]): Promise<Signals> {
  const [profiles, teachRows, learnRows, enrols, saves, apps] = await Promise.all([
    rows(sb.from("profiles").select("display_name, region, headline").eq("id", uid)),
    rows(sb.from("user_skills").select("skill_id").eq("profile_id", uid)),
    rows(sb.from("wanted_skills").select("skill_id").eq("profile_id", uid)),
    rows(
      sb
        .from("course_enrollments")
        .select("course_id, progress_percent, state")
        .eq("profile_id", uid),
    ),
    rows(sb.from("saves").select("target_id").eq("profile_id", uid)),
    rows(sb.from("applications").select("opportunity_id").eq("profile_id", uid)),
  ]);
  const profile = profiles[0] ?? null;
  const skillIds = ids([...teachRows, ...learnRows].map((r) => r["skill_id"]));
  const skills = skillIds.length
    ? await rows(sb.from("skills").select("id, name").in("id", skillIds))
    : [];
  const skillName = new Map(skills.map((s) => [String(s["id"]), String(s["name"])]));
  const courseIds = ids(enrols.map((e) => e["course_id"]));
  const courses = courseIds.length
    ? await rows(sb.from("courses").select("id, title").in("id", courseIds))
    : [];
  const courseTitle = new Map(courses.map((c) => [String(c["id"]), String(c["title"])]));
  return {
    name: profile ? String(profile["display_name"] ?? "").split(" ")[0] || null : null,
    region: (profile?.["region"] as string | null) ?? null,
    headline: (profile?.["headline"] as string | null) ?? null,
    teach: teachRows.map((r) => skillName.get(String(r["skill_id"]))).filter(Boolean) as string[],
    learn: learnRows.map((r) => skillName.get(String(r["skill_id"]))).filter(Boolean) as string[],
    courses: enrols
      .filter((e) => courseTitle.has(String(e["course_id"])))
      .map((e) => ({
        title: courseTitle.get(String(e["course_id"]))!,
        progress: Number(e["progress_percent"] ?? 0),
        done: e["state"] === "completed" || Number(e["progress_percent"] ?? 0) >= 100,
      })),
    saved: new Set(saves.map((s) => String(s["target_id"]))),
    applied: new Set(apps.map((a) => String(a["opportunity_id"]))),
    recent: recent.slice(0, 15),
  };
}

/* ───────────── every real opening, scored ───────────── */

async function candidates(sb: Db, sig: Signals): Promise<Candidate[]> {
  const ours = await rows(
    sb
      .from("opportunities")
      .select(
        "id, kind, slug, title, summary, location, work_mode, company_id, closed_at, application_deadline",
      )
      .eq("is_published", true),
  );
  const open = ours.filter(
    (o) =>
      !o["closed_at"] &&
      (!o["application_deadline"] || Date.parse(String(o["application_deadline"])) >= Date.now()),
  );
  const oppIds = ids(open.map((o) => o["id"]));
  const links = oppIds.length
    ? await rows(
        sb
          .from("opportunity_skills")
          .select("opportunity_id, skill_id")
          .in("opportunity_id", oppIds),
      )
    : [];
  const linkSkillIds = ids(links.map((l) => l["skill_id"]));
  const skillRows = linkSkillIds.length
    ? await rows(sb.from("skills").select("id, name").in("id", linkSkillIds))
    : [];
  const skillName = new Map(skillRows.map((s) => [String(s["id"]), String(s["name"])]));
  const companyIds = ids(open.map((o) => o["company_id"]));
  const companies = companyIds.length
    ? await rows(sb.from("companies").select("id, name").in("id", companyIds))
    : [];
  const companyName = new Map(companies.map((c) => [String(c["id"]), String(c["name"])]));

  const list: Candidate[] = open
    .filter((o) => !sig.applied.has(String(o["id"])))
    .map((o) => {
      const sk = links
        .filter((l) => l["opportunity_id"] === o["id"])
        .map((l) => skillName.get(String(l["skill_id"])))
        .filter(Boolean) as string[];
      const kind = o["kind"] === "internship" ? "internship" : "job";
      return {
        id: String(o["id"]),
        title: String(o["title"]).replace(/\s*[—-]\s*स्वYAM\s*$/, ""),
        company: companyName.get(String(o["company_id"])) ?? null,
        location: (o["location"] as string | null) ?? (o["work_mode"] as string | null) ?? null,
        kind,
        href: `/${kind === "internship" ? "internships" : "jobs"}/${String(o["slug"])}`,
        external: false,
        source: null,
        text: `${String(o["title"])} ${String(o["summary"] ?? "")} ${sk.join(" ")}`,
        skills: sk,
        score: 0,
        hits: [],
      };
    });
  for (const r of await remoteBoards()) {
    list.push({
      id: r.id,
      title: r.title,
      company: r.company,
      location: r.location,
      kind: "remote",
      href: r.url,
      external: true,
      source: r.source,
      text: `${r.title} ${r.category ?? ""}`,
      skills: [],
      score: 0,
      hits: [],
    });
  }

  // Weighted terms: what you can already do counts most, then what you finished or study.
  const terms = new Map<string, { w: number; label: string }>();
  const add = (phrase: string, w: number, label: string) => {
    for (const t of words(phrase)) {
      const cur = terms.get(t);
      if (!cur || cur.w < w) terms.set(t, { w, label });
    }
  };
  sig.teach.forEach((s) => add(s, 4, s));
  sig.courses.forEach((c) => add(c.title, c.done ? 3 : 2, c.title));
  sig.learn.forEach((s) => add(s, 2, s));
  sig.recent.forEach((s) => add(s, 1, s));
  if (sig.headline) add(sig.headline, 1, sig.headline);

  const mySkills = new Set([...sig.teach, ...sig.learn].map((s) => s.toLowerCase()));
  for (const c of list) {
    const text = new Set(words(c.text));
    const hits = new Set<string>();
    for (const [t, { w, label }] of terms)
      if (text.has(t)) {
        c.score += w;
        hits.add(label);
      }
    for (const s of c.skills)
      if (mySkills.has(s.toLowerCase())) {
        c.score += 5;
        hits.add(s);
      }
    if (sig.saved.has(c.id)) c.score += 3;
    if (sig.region && c.location && c.location.toLowerCase().includes(sig.region.toLowerCase()))
      c.score += 2;
    // स्वYAM's own openings are verified; the remote boards are not.
    if (!c.external) c.score += 1;
    c.hits = [...hits].slice(0, 3);
  }
  return list.sort((a, b) => b.score - a.score);
}

/* ───────────── the model's part ───────────── */

function ruleReason(c: Candidate): string {
  if (c.hits.length) return `Matches what you have shown: ${c.hits.join(", ")}.`;
  return c.external ? "A remote role open to people in India." : "An open स्वYAM opening.";
}

async function geminiPicks(sig: Signals, top: Candidate[], locale: string): Promise<Pick[] | null> {
  const system = `You match one learner on स्वYAM, an Indian skilling and jobs site, to openings.
Choose up to 10 openings from the list ONLY (all of them if there are fewer), best first, and give each a one-sentence reason in
plain words that names something specific about this learner (a skill, a course, a city).
Never invent an opening, an employer, a salary or a skill the learner does not have.
Write the reasons in the language with code "${locale}" (use simple words).
Answer as JSON: {"picks":[{"id":"<id from the list>","why":"<one sentence>"}]}`;
  const learner = {
    can_do: sig.teach,
    wants_to_learn: sig.learn,
    courses: sig.courses.map(
      (c) => `${c.title} (${Math.round(c.progress)}%${c.done ? ", finished" : ""})`,
    ),
    recently_viewed: sig.recent,
    city: sig.region,
    headline: sig.headline,
  };
  const openings = top.map((c) => ({
    id: c.id,
    title: c.title,
    company: c.company,
    where: c.location,
    type: c.kind,
    skills: c.skills,
  }));
  try {
    const raw = await ask(
      [
        {
          role: "user",
          content: `Learner: ${JSON.stringify(learner)}\n\nOpenings: ${JSON.stringify(openings)}`,
        },
      ],
      {
        system,
        json: true,
        temperature: 0.2,
        maxTokens: 1200,
        apiKey: keyFor("jobs"),
        timeoutMs: 15_000,
        deadlineMs: 18_000,
      },
    );
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as {
      picks?: { id?: unknown; why?: unknown }[];
    };
    const byId = new Map(top.map((c) => [c.id, c]));
    const picks: Pick[] = [];
    for (const p of parsed.picks ?? []) {
      const c = byId.get(String(p.id));
      if (!c || picks.some((x) => x.id === c.id)) continue; // invented or repeated: dropped
      const why =
        String(p.why ?? "")
          .trim()
          .slice(0, 240) || ruleReason(c);
      picks.push(toPick(c, why));
      if (picks.length === PICKS) break;
    }
    return picks.length ? picks : null;
  } catch {
    return null;
  }
}

/** The model's picks, then the code's next best (with code-written reasons) up to PICKS. */
function topUp(chosen: Pick[], ranked: Candidate[]): Pick[] {
  const out = [...chosen];
  for (const c of ranked) {
    if (out.length >= PICKS) break;
    if (out.some((p) => p.id === c.id)) continue;
    out.push(toPick(c, ruleReason(c)));
  }
  return out;
}

const toPick = (c: Candidate, why: string): Pick => ({
  id: c.id,
  title: c.title,
  company: c.company,
  location: c.location,
  kind: c.kind,
  href: c.href,
  external: c.external,
  source: c.source,
  why,
});

/* ───────────── the daily allowance ───────────── */

/*
 * Kept in public.job_match_usage (db/029_job_match_usage.sql). A member can read their own row
 * but never write it; job_match_record() is the only way in, and it only ever counts up. The
 * count is checked here before the model is asked and recorded once a result exists, so a
 * failed attempt costs nothing and nobody can give themselves more presses.
 */
const todayIst = today;

export async function status(
  sb: Db,
  uid: string,
): Promise<{ remaining: number; limit: number; last: MatchResult | null }> {
  const [u] = await rows(
    sb.from("job_match_usage").select("day, count, result").eq("profile_id", uid),
  );
  const used = u && String(u["day"]) === todayIst() ? Number(u["count"] ?? 0) : 0;
  return {
    remaining: Math.max(0, DAILY_LIMIT - used),
    limit: DAILY_LIMIT,
    last: (u?.["result"] as MatchResult | null | undefined) ?? null,
  };
}

export async function findJobsFor(
  sb: Db,
  uid: string,
  recent: string[],
  locale: string,
): Promise<
  | { ok: true; result: MatchResult; remaining: number }
  | { ok: false; remaining: 0; last: MatchResult | null }
> {
  const before = await status(sb, uid);
  if (before.remaining <= 0) return { ok: false, remaining: 0, last: before.last };
  const sig = await signals(sb, uid, recent);
  const ranked = await candidates(sb, sig);
  const top = ranked.slice(0, 20);
  const fromModel = top.length ? await geminiPicks(sig, top, locale) : null;
  const result: MatchResult = {
    picks: topUp(fromModel ?? [], ranked),
    generatedAt: new Date().toISOString(),
    by: fromModel ? "gemini" : "rules",
  };
  const { data, error } = await sb.rpc("job_match_record", { p_result: result });
  if (error) throw new Error(error.message);
  const used = Number(data ?? DAILY_LIMIT);
  return { ok: true, result, remaining: Math.max(0, DAILY_LIMIT - used) };
}
