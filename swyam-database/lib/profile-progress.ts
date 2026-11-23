import { getSupabase, requireSupabase } from "./supabase";
import type { MemberMetrics, ProfileDetail } from "./profile-data";
import type { ProfileType } from "./profile-type";

/**
 * How ready this profile is, and what is actually missing from it.
 *
 * "Complete your profile" is a nag. "Two things are missing, and this is what
 * each one changes" is an instruction — so every item here names the thing it
 * unlocks, links to the exact place to do it, and is counted from the
 * member's own record rather than from a stored percentage nobody maintains.
 *
 * Nothing on this site is gated on any of it. A person with an empty profile
 * can still browse, enrol and apply; they simply get worse matches, and the
 * honest thing is to say why.
 */

export interface ProgressItem {
  id: string;
  label: string;
  /** What having it changes. Never "to complete your profile". */
  why: string;
  done: boolean;
  to: string;
  minutes: number;
}

export interface ProfileProgress {
  items: ProgressItem[];
  done: number;
  total: number;
  percent: number;
  /** The first thing still missing, or null when nothing is. */
  next: ProgressItem | null;
}

export interface ProgressInput {
  type: ProfileType | null;
  metrics: MemberMetrics | undefined;
  detail: ProfileDetail | null | undefined;
  goal: string | null;
  /** Whether a coach plan exists on this device. */
  hasPlan: boolean;
}

/**
 * The checklist, which differs by who the member is.
 *
 * A school student is not asked for a headline an employer will read, and a
 * job seeker is not asked for a study plan. Asking everyone for everything is
 * how a profile page becomes a form nobody finishes.
 */
export function profileChecklist(input: ProgressInput): ProfileProgress {
  const { type, metrics, detail, goal, hasPlan } = input;
  const m = metrics;
  const school = type === "school";
  const college = type === "college";
  const working = type === "jobseeker" || type === "professional";

  const items: ProgressItem[] = [];

  items.push({
    id: "type",
    label: "Say which kind of member you are",
    why: "It decides your dashboard, your navigation and which coach you get.",
    done: type !== null,
    to: "/settings",
    minutes: 1,
  });

  if (!school) {
    items.push({
      id: "headline",
      label: "Add a one-line headline",
      why: "It is the first line an employer reads on your passport.",
      done: Boolean(detail?.headline?.trim()),
      to: "/profile",
      minutes: 2,
    });
  }

  items.push({
    id: "region",
    label: "Add your city",
    why: "Courses and openings near you are sorted by it.",
    done: Boolean(detail?.region?.trim()),
    to: "/profile",
    minutes: 1,
  });

  items.push({
    id: "learn",
    label: school ? "Say what you want to learn" : "List the skills you want",
    why: school
      ? "It is what your recommendations are built from."
      : "Matches, courses and roles are all scored against it.",
    done: (m?.skillsWanted ?? 0) > 0,
    to: "/profile",
    minutes: 3,
  });

  if (!school) {
    items.push({
      id: "teach",
      label: "List a skill you can teach",
      why: "It is half of every swap, and it is what a verified skill grows from.",
      done: (m?.skillsOffered ?? 0) > 0,
      to: "/profile",
      minutes: 3,
    });
  }

  items.push({
    id: "goal",
    label: school ? "Set your study goal" : "Set your goal",
    why: "One line. It is what the dashboard and the coach work toward.",
    done: Boolean(goal?.trim()),
    to: "/profile",
    minutes: 1,
  });

  if (school || college) {
    items.push({
      id: "plan",
      label: school ? "Build your study plan" : "Build your career roadmap",
      why: school
        ? "Your marks turn into a week you can actually follow."
        : "Your degree turns into skills, a project and an internship shortlist.",
      done: hasPlan,
      to: "/coach",
      minutes: 6,
    });
  }

  if (working) {
    items.push({
      id: "cv",
      label: "Run your CV through the review",
      why: "It names the things a screener trips on before an employer does.",
      // The review is a tool, not a record: having any skills and a headline
      // is the closest honest proxy for "your CV has something to review".
      done: Boolean(detail?.headline?.trim()) && (m?.skillsOffered ?? 0) > 0,
      to: "/cv",
      minutes: 5,
    });
  }

  const done = items.filter((i) => i.done).length;
  return {
    items,
    done,
    total: items.length,
    percent: items.length === 0 ? 100 : Math.round((done / items.length) * 100),
    next: items.find((i) => !i.done) ?? null,
  };
}

/* ── The goal itself ─────────────────────────────────────────────── */

/**
 * One line the member wrote about what they are here for.
 *
 * Stored in `learning_preferences.goal_statement`, which is where onboarding
 * has always put it. Returns null rather than throwing when there is no row
 * yet, which is the normal state for an account that skipped onboarding.
 */
export async function getGoal(profileId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("learning_preferences")
    .select("goal_statement")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) return null;
  return data?.goal_statement?.trim() || null;
}

export async function setGoal(profileId: string, goal: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("learning_preferences")
    .upsert(
      { profile_id: profileId, goal_statement: goal.trim().slice(0, 200) || null },
      { onConflict: "profile_id" },
    );
  if (error) throw new Error(error.message);
}
