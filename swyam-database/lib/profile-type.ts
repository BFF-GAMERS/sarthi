/**
 * Who the member is, more precisely than the account role can say.
 *
 * The account carries one of three roles — student, recruiter, institute —
 * and that is the right grain for what the database lets you *do*. It is the
 * wrong grain for what the product should *show*: a Class 9 student and a
 * working professional both hold the "student" role, and a dashboard that
 * serves either one well serves the other badly. The first sees job listings
 * and salary charts they are years away from; the second sees a study
 * timetable they do not need.
 *
 * So this layer refines the role into six profile types, and everything
 * role-specific — the dashboard, the navigation, which coach is offered —
 * reads the type rather than the role.
 *
 * Where it lives. The answer is a column, `profiles.profile_type`, so that
 * an administrator can correct a wrong pick from the admin screen and the
 * member sees the change on every device. Until `db/020_profile_type.sql`
 * has been run the column does not exist, so every write is mirrored to
 * localStorage and every read starts from it: the page renders instantly
 * from the local copy, then a fetch brings it into line with the database.
 * A database that refuses (column missing, signed out) leaves the local
 * copy in charge, and nothing breaks.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { Role } from "../data/mock";
import type { NavItemId } from "../evolution/types";
import { getSupabase } from "./supabase";

export type ProfileType =
  "school" | "college" | "jobseeker" | "professional" | "recruiter" | "institute";

export interface ProfileTypeInfo {
  id: ProfileType;
  label: string;
  /** One line, in the member's own terms, of what the site does for them. */
  purpose: string;
  /** The account role this type sits under. */
  role: Role;
}

export const PROFILE_TYPES: readonly ProfileTypeInfo[] = [
  {
    id: "school",
    label: "School student",
    purpose: "Classes 6–12. Understand your marks, plan your study, explore careers.",
    role: "student",
  },
  {
    id: "college",
    label: "College student",
    purpose: "Degree, diploma or polytechnic. Build a roadmap from your course to your first job.",
    role: "student",
  },
  {
    id: "jobseeker",
    label: "Job seeker",
    purpose: "Find openings that match your skills, fix your CV, close the gaps.",
    role: "student",
  },
  {
    id: "professional",
    label: "Working professional",
    purpose: "Upskill, prove it, move up or move across.",
    role: "student",
  },
  {
    id: "recruiter",
    label: "Recruiter",
    purpose: "Post openings and find candidates with verified skills.",
    role: "recruiter",
  },
  {
    id: "institute",
    label: "Institute or trainer",
    purpose: "Publish courses, run cohorts, track outcomes.",
    role: "institute",
  },
];

export const profileTypeInfo = (id: ProfileType): ProfileTypeInfo =>
  PROFILE_TYPES.find((p) => p.id === id) ?? PROFILE_TYPES[2]!;

/** The types a member with this account role may pick from. */
export const typesForRole = (role: Role): ProfileTypeInfo[] =>
  PROFILE_TYPES.filter((p) => p.role === role);

/* ── Storage ─────────────────────────────────────────────────────── */

const KEY = "swayam-profile-type";
const listeners = new Set<() => void>();
const bump = () => listeners.forEach((l) => l());

function readAll(): Record<string, ProfileType> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, ProfileType>;
  } catch {
    return {};
  }
}

/** The stored type for an account, or null if they have not chosen yet. */
export function getProfileType(email: string): ProfileType | null {
  return readAll()[email.toLowerCase()] ?? null;
}

const VALID = new Set<string>(PROFILE_TYPES.map((p) => p.id));
const isType = (v: unknown): v is ProfileType => typeof v === "string" && VALID.has(v);

function writeLocal(email: string, type: ProfileType | null): void {
  if (typeof localStorage === "undefined") return;
  const all = readAll();
  if (type) all[email.toLowerCase()] = type;
  else delete all[email.toLowerCase()];
  localStorage.setItem(KEY, JSON.stringify(all));
  bump();
}

/**
 * Record the member's choice.
 *
 * Local first, so the dashboard changes on the same frame; then the
 * database, so it follows them to the next device and an administrator can
 * see and correct it. A database write that fails — the column not there
 * yet, a network hiccup — is not an error the member needs: the local copy
 * already holds the answer, and the next successful write catches up.
 */
export function setProfileType(email: string, type: ProfileType, profileId?: string | null): void {
  writeLocal(email, type);
  const supabase = getSupabase();
  if (!supabase || !profileId) return;
  void supabase
    .from("profiles")
    .update({ profile_type: type })
    .eq("id", profileId)
    .then(({ error }) => {
      if (error) console.warn("profile_type not saved to the database:", error.message);
    });
}

/**
 * What the database says, if it can say anything.
 *
 * Null means "no answer stored"; undefined means "could not ask" — column
 * missing, not signed in — and the caller should leave the local copy alone.
 */
export async function fetchProfileType(profileId: string): Promise<ProfileType | null | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from("profiles")
    .select("profile_type")
    .eq("id", profileId)
    .maybeSingle();
  if (error) return undefined;
  const v = data?.profile_type;
  return isType(v) ? v : null;
}

/**
 * Resolve a type for any account, choosing nothing on their behalf.
 *
 * Recruiter and institute roles map one-to-one, so they are never asked.
 * A student-role account with no stored choice returns null, and the
 * dashboard asks — it does not guess "job seeker" and show a 14-year-old
 * salary charts.
 */
export function resolveProfileType(email: string, role: Role): ProfileType | null {
  if (role === "recruiter") return "recruiter";
  if (role === "institute") return "institute";
  return getProfileType(email);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  if (typeof window !== "undefined") window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", l);
  };
};

/**
 * Live view of the member's type; re-renders when it changes.
 *
 * Reads the local copy synchronously, then once per sign-in asks the
 * database and adopts its answer if it differs — which is how a correction
 * made on the admin screen reaches the member's own dashboard.
 */
export function useProfileType(
  email: string | undefined,
  role: Role | undefined,
  profileId?: string | null,
): ProfileType | null {
  const snap = () => (email && role ? resolveProfileType(email, role) : null);
  const local = useSyncExternalStore(subscribe, snap, () => null);

  useEffect(() => {
    if (!email || !profileId || role !== "student") return;
    let live = true;
    void fetchProfileType(profileId).then((remote) => {
      if (!live || remote === undefined) return;
      if (remote !== getProfileType(email)) writeLocal(email, remote);
    });
    return () => {
      live = false;
    };
  }, [email, profileId, role]);

  return local;
}

/* ── Navigation ──────────────────────────────────────────────────── */

/**
 * Each type's own navigation, as registry ids (plan §4.4, D5).
 *
 * The labels, routes, icons and purpose lines come from the central registry,
 * so every surface names a destination the same way. This list is only a
 * filter and an ordering over those ids; it is never passed to the evolution
 * engine. Every id resolves to a page that exists.
 */
export const NAV_BY_TYPE: Record<ProfileType, NavItemId[]> = {
  school: ["DASHBOARD", "COACH", "CAREER_LAUNCHER", "COURSES"],
  college: [
    "DASHBOARD",
    "COACH",
    "SKILL_DIRECTORY",
    "SKILL_BUILDER",
    "COURSES",
    "INTERNSHIPS",
    "APPLICATIONS",
    "CV",
  ],
  jobseeker: ["DASHBOARD", "JOBS", "APPLICATIONS", "CV", "PASSPORT", "COURSES"],
  professional: ["DASHBOARD", "JOBS", "APPLICATIONS", "CV", "PASSPORT", "COURSES"],
  // Cohorts, assessments and outcomes are not sections yet, so they are not
  // links yet. A link that goes nowhere is worse than no link.
  recruiter: ["DASHBOARD", "OPPORTUNITIES", "SEARCH", "MESSAGES", "PROFILE"],
  institute: ["DASHBOARD", "COURSES", "EVENTS", "COMMUNITY", "MESSAGES"],
};

/**
 * D5: recruiters and institutes keep their stable, profile-type navigation on
 * the phone's bottom bar. Everyone else follows the evolution engine.
 */
export function hasStableNav(type: ProfileType | null): type is "recruiter" | "institute" {
  return type === "recruiter" || type === "institute";
}

/** Bottom bar for a stable-nav type: Home plus its first four distinct destinations. */
export function stableBottomFor(type: "recruiter" | "institute"): NavItemId[] {
  return ["HOME", ...NAV_BY_TYPE[type].filter((id) => id !== "HOME").slice(0, 4)];
}

/** The one-line label used in the dashboard header. */
export function typeLabel(type: ProfileType | null): string {
  return type ? profileTypeInfo(type).label : PROFILE_TYPES[2]!.label;
}

/** Which coach, if any, this type is offered. */
export function coachFor(type: ProfileType | null): "school" | "college" | "career" | null {
  if (type === "school") return "school";
  if (type === "college") return "college";
  if (type === "jobseeker" || type === "professional") return "career";
  return null;
}
