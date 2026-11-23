/**
 * Client side of the AI mentor.
 *
 * Progress lives in `localStorage` rather than in a table. That is a deliberate
 * limit, not an oversight: a self-paced plan is generated for one person on
 * one device and has no trainer, no cohort and no certificate hanging off it,
 * so there is nothing here another person or another session needs to read.
 * When a `mentor_plans` table exists, only the four functions at the bottom of
 * this file have to change — nothing in the page does.
 */

export interface MentorStep {
  title: string;
  detail: string;
}

export interface MentorModule {
  title: string;
  why: string;
  minutes: number;
  steps: MentorStep[];
  practice: string;
  checks: string[];
}

export interface MentorPlan {
  skill: string;
  level: string;
  summary: string;
  modules: MentorModule[];
  /** False when the built-in fallback plan was used. */
  generated: boolean;
}

export async function fetchPlan(input: {
  skill: string;
  level?: string;
  language?: string;
  goal?: string;
}): Promise<MentorPlan> {
  const res = await fetch("/api/mentor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "plan", ...input }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Could not build a plan.");
  return (await res.json()) as MentorPlan;
}

export async function askGuide(input: {
  skill: string;
  question: string;
  module?: string;
  step?: string;
  language?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const res = await fetch("/api/mentor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "guide", ...input }),
  });
  if (!res.ok) throw new Error((await res.text()) || "The guide could not answer.");
  const body = (await res.json()) as { answer?: string };
  return body.answer ?? "";
}

/* ── Saved plans and progress ────────────────────────────────────── */

const PLAN_KEY = "swayam-mentor-plans";
const DONE_KEY = "swayam-mentor-progress";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private mode or full quota — the plan still works for this session. */
  }
}

/** The plan is cached so a reload does not spend another generation. */
export function savedPlan(slug: string): MentorPlan | null {
  return read<Record<string, MentorPlan>>(PLAN_KEY, {})[slug] ?? null;
}

export function savePlan(slug: string, plan: MentorPlan): void {
  const all = read<Record<string, MentorPlan>>(PLAN_KEY, {});
  all[slug] = plan;
  write(PLAN_KEY, all);
}

export function forgetPlan(slug: string): void {
  const all = read<Record<string, MentorPlan>>(PLAN_KEY, {});
  delete all[slug];
  write(PLAN_KEY, all);

  const done = read<Record<string, number[]>>(DONE_KEY, {});
  delete done[slug];
  write(DONE_KEY, done);
}

export function completedModules(slug: string): number[] {
  return read<Record<string, number[]>>(DONE_KEY, {})[slug] ?? [];
}

export function setModuleDone(slug: string, index: number, done: boolean): number[] {
  const all = read<Record<string, number[]>>(DONE_KEY, {});
  const current = new Set(all[slug] ?? []);
  if (done) current.add(index);
  else current.delete(index);
  const next = [...current].sort((a, b) => a - b);
  all[slug] = next;
  write(DONE_KEY, all);
  return next;
}

/** Every skill this member has a mentor plan for — used by the dashboard. */
export function myMentorPlans(): Array<{ slug: string; plan: MentorPlan; done: number }> {
  const plans = read<Record<string, MentorPlan>>(PLAN_KEY, {});
  const done = read<Record<string, number[]>>(DONE_KEY, {});
  return Object.entries(plans).map(([slug, plan]) => ({
    slug,
    plan,
    done: (done[slug] ?? []).length,
  }));
}
