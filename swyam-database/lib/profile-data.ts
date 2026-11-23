/**
 * The signed-in member's own record.
 *
 * Everything the profile and dashboard show about a person comes from here,
 * so the two pages can never disagree — and so neither has to invent a
 * placeholder. Where a member genuinely has nothing yet the query returns an
 * empty list and the page says so, which is the honest answer.
 */

import { getSupabase, requireSupabase } from "./supabase";
import { languageFor } from "./languages";
import { issuerName } from "./issuer";

/* ── Headline numbers ────────────────────────────────────────────── */

export interface MemberMetrics {
  skillsOffered: number;
  skillsWanted: number;
  skillsVerified: number;
  coursesActive: number;
  coursesCompleted: number;
  certificates: number;
  swapsActive: number;
  swapsCompleted: number;
  sessionsUpcoming: number;
  applications: number;
  projects: number;
  passportViews: number;
  xp: number;
  level: number;
  unreadNotifications: number;
}

const ZERO: MemberMetrics = {
  skillsOffered: 0,
  skillsWanted: 0,
  skillsVerified: 0,
  coursesActive: 0,
  coursesCompleted: 0,
  certificates: 0,
  swapsActive: 0,
  swapsCompleted: 0,
  sessionsUpcoming: 0,
  applications: 0,
  projects: 0,
  passportViews: 0,
  xp: 0,
  level: 1,
  unreadNotifications: 0,
};

/**
 * Counts for the signed-in member.
 *
 * `member_metrics` refuses to answer for anyone but the caller (or an admin)
 * and returns null in that case, which becomes zeroes here rather than a
 * crash — the page still renders, just with nothing to report.
 */
export async function getMemberMetrics(profileId: string): Promise<MemberMetrics> {
  const supabase = getSupabase();
  if (!supabase) return ZERO;

  const { data, error } = await supabase.rpc("member_metrics", { p_profile: profileId });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return ZERO;

  const m = data as Record<string, unknown>;
  const n = (k: string, fallback = 0) => {
    const v = m[k];
    const num = typeof v === "string" ? Number(v) : v;
    return typeof num === "number" && Number.isFinite(num) ? num : fallback;
  };

  return {
    skillsOffered: n("skills_offered"),
    skillsWanted: n("skills_wanted"),
    skillsVerified: n("skills_verified"),
    coursesActive: n("courses_active"),
    coursesCompleted: n("courses_completed"),
    certificates: n("certificates"),
    swapsActive: n("swaps_active"),
    swapsCompleted: n("swaps_completed"),
    sessionsUpcoming: n("sessions_upcoming"),
    applications: n("applications"),
    projects: n("projects"),
    passportViews: n("passport_views"),
    xp: n("xp"),
    level: n("level", 1),
    unreadNotifications: n("unread_notifications"),
  };
}

/* ── The profile record itself ───────────────────────────────────── */

export interface ProfileDetail {
  id: string;
  handle: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  region: string | null;
  websiteUrl: string | null;
  pronouns: string | null;
  timezone: string;
}

export async function getProfileDetail(profileId: string): Promise<ProfileDetail | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, headline, bio, avatar_url, region, website_url, pronouns, timezone",
    )
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    handle: data.handle,
    displayName: data.display_name,
    headline: data.headline,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    region: data.region,
    websiteUrl: data.website_url,
    pronouns: data.pronouns,
    timezone: data.timezone,
  };
}

export interface ProfilePatch {
  /** The username. Unique, and checked against the same rule the column has. */
  handle?: string;
  displayName?: string;
  headline?: string | null;
  bio?: string | null;
  region?: string | null;
  websiteUrl?: string | null;
  avatarUrl?: string | null;
}

export async function updateProfileDetail(profileId: string, patch: ProfilePatch): Promise<void> {
  const supabase = requireSupabase();
  const row: {
    handle?: string;
    display_name?: string;
    headline?: string | null;
    bio?: string | null;
    region?: string | null;
    website_url?: string | null;
    avatar_url?: string | null;
  } = {};
  if (patch.handle !== undefined) row.handle = patch.handle;
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.headline !== undefined) row.headline = patch.headline;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.region !== undefined) row.region = patch.region;
  if (patch.websiteUrl !== undefined) row.website_url = patch.websiteUrl;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("profiles").update(row).eq("id", profileId);
  if (error) {
    // Two of these are ordinary things a person does, not faults. Postgres
    // reports them as constraint violations, and the raw text of one of those
    // ("duplicate key value violates unique constraint profiles_handle_key")
    // tells a member nothing they can act on.
    if (error.code === "23505") throw new Error("That username is already taken.");
    if (error.code === "23514") {
      throw new Error(
        "Username must be 3–30 characters: lowercase letters, numbers and underscores.",
      );
    }
    throw new Error(error.message);
  }
}

/* ── Badges ──────────────────────────────────────────────────────── */

export interface EarnedBadge {
  name: string;
  icon: string | null;
  description: string | null;
  tier: string | null;
  awardedAt: string;
}

export async function listBadges(profileId: string): Promise<EarnedBadge[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("user_badges")
    .select("awarded_at, badges ( name, icon, description, tier )")
    .eq("profile_id", profileId)
    .order("awarded_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = (row as { badges: unknown }).badges;
    const b = (Array.isArray(raw) ? raw[0] : raw) as {
      name?: string;
      icon?: string | null;
      description?: string | null;
      tier?: string | null;
    } | null;
    return {
      name: b?.name ?? "Badge",
      icon: b?.icon ?? null,
      description: b?.description ?? null,
      tier: b?.tier ?? null,
      awardedAt: (row as { awarded_at: string }).awarded_at,
    };
  });
}

/* ── Certificates ────────────────────────────────────────────────── */

export interface EarnedCertificate {
  id: string;
  title: string;
  issuer: string | null;
  serial: string | null;
  score: number | null;
  issuedAt: string | null;
  revoked: boolean;
}

export async function listCertificates(profileId: string): Promise<EarnedCertificate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("certificates")
    .select("id, title, issuer, serial, score, issued_at, revoked_at")
    .eq("profile_id", profileId)
    .order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    issuer: issuerName(c.issuer),
    serial: c.serial,
    score: c.score === null ? null : Number(c.score),
    issuedAt: c.issued_at,
    revoked: c.revoked_at !== null,
  }));
}

/* ── Enrolled courses ────────────────────────────────────────────── */

export interface Enrollment {
  id: string;
  courseId: string;
  /** The catalogue id, so a listing can link straight to the course page. */
  slug: string;
  title: string;
  state: string;
  progressPercent: number;
  lessonsCompleted: number;
  completedAt: string | null;
}

export async function listEnrollments(profileId: string): Promise<Enrollment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("course_enrollments")
    .select(
      "id, course_id, state, progress_percent, lessons_completed, completed_at, courses ( slug, title )",
    )
    .eq("profile_id", profileId)
    .order("last_activity_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = (row as { courses: unknown }).courses;
    const c = (Array.isArray(raw) ? raw[0] : raw) as { slug?: string; title?: string } | null;
    return {
      id: row.id,
      courseId: row.course_id,
      slug: c?.slug ?? "",
      title: c?.title ?? "Course",
      state: row.state,
      progressPercent: Number(row.progress_percent ?? 0),
      lessonsCompleted: row.lessons_completed ?? 0,
      completedAt: row.completed_at,
    };
  });
}

/* ── Activity ────────────────────────────────────────────────────── */

export interface ActivityEntry {
  /** Ledger rows use a bigint identity column, so this is numeric. */
  id: number;
  /** Human sentence describing what happened. */
  text: string;
  /** XP change, when the entry came from the points ledger. */
  delta: number | null;
  createdAt: string;
}

/**
 * What this member has actually done, newest first.
 *
 * Drawn from the points ledger — the one table that records every scoring
 * event — rather than a hand-written story.
 */
export async function listActivity(profileId: string, limit = 8): Promise<ActivityEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("points_ledger")
    .select("id, delta, reason, entity, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    text: humanReason(r.reason, r.entity),
    delta: r.delta ?? null,
    createdAt: r.created_at,
  }));
}

/** Turn a ledger reason slug into a sentence. */
function humanReason(reason: string | null, entity: string | null): string {
  const map: Record<string, string> = {
    swap_completed: "Completed a skill swap",
    session_completed: "Finished a session",
    course_completed: "Completed a course",
    lesson_completed: "Finished a lesson",
    assessment_passed: "Passed an assessment",
    certificate_issued: "Earned a certificate",
    badge_awarded: "Unlocked a badge",
    profile_completed: "Completed the profile",
    skill_added: "Added a skill",
    endorsement_received: "Received an endorsement",
    review_received: "Received a review",
    signup: "Joined स्वYAM",
  };
  if (reason && map[reason]) return map[reason]!;
  if (reason) {
    // Fall back to the slug itself, made readable, rather than dropping it.
    const words = reason.replace(/[._-]+/g, " ").trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return entity ? `Activity on ${entity}` : "Activity";
}

/* ── Languages ───────────────────────────────────────────────────── */

export interface SpokenLanguage {
  code: string;
  native: string;
  label: string;
  proficiency: string;
}

export async function listUserLanguages(profileId: string): Promise<SpokenLanguage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("user_languages")
    .select("language_code, proficiency")
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const lang = languageFor(r.language_code);
    return {
      code: r.language_code,
      native: lang.native,
      label: lang.label,
      proficiency: r.proficiency,
    };
  });
}

export async function setUserLanguages(profileId: string, codes: string[]): Promise<void> {
  const supabase = requireSupabase();
  // Replace the set wholesale: the picker always submits the full selection.
  const { error: delErr } = await supabase
    .from("user_languages")
    .delete()
    .eq("profile_id", profileId);
  if (delErr) throw new Error(delErr.message);
  if (codes.length === 0) return;

  const { error } = await supabase
    .from("user_languages")
    .insert(codes.map((code) => ({ profile_id: profileId, language_code: code })));
  if (error) throw new Error(error.message);
}

/* ── Saved items ─────────────────────────────────────────────────── */

/**
 * What a save can point at. Mirrors the `saves_target_kind_check` constraint
 * exactly — "opportunity" is not one of them; a job and an internship are
 * saved as themselves.
 */
export type SaveKind = "post" | "comment" | "course" | "project" | "internship" | "job" | "profile";

export interface SavedItem {
  kind: SaveKind;
  /** A row id, not a slug: `saves.target_id` is a uuid. */
  targetId: string;
  /** The catalogue id, so the item can be linked to. Null if it is gone. */
  slug: string | null;
  /** Resolved name, so the list reads as items rather than identifiers. */
  title: string;
  meta: string;
  createdAt: string;
}

/**
 * Everything the member has saved, named.
 *
 * `target_id` is polymorphic — it points at whichever table the kind names —
 * so a single join is impossible. The ids are grouped by kind and resolved in
 * one query each, which keeps it to three round trips regardless of how much
 * is saved.
 */
export async function listSaves(profileId: string): Promise<SavedItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("saves")
    .select("target_kind, target_id, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    kind: r.target_kind as SaveKind,
    targetId: r.target_id,
    createdAt: r.created_at,
  }));
  if (rows.length === 0) return [];

  const courseIds = rows.filter((r) => r.kind === "course").map((r) => r.targetId);
  const oppIds = rows
    .filter((r) => r.kind === "job" || r.kind === "internship")
    .map((r) => r.targetId);

  const [courseRes, oppRes] = await Promise.all([
    courseIds.length
      ? supabase.from("courses").select("id, slug, title, duration_minutes").in("id", courseIds)
      : Promise.resolve({ data: [] as never[] }),
    oppIds.length
      ? supabase.from("opportunities").select("id, slug, title, location").in("id", oppIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const named = new Map<string, { slug: string; title: string; meta: string }>();
  for (const c of (courseRes.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    duration_minutes: number | null;
  }>) {
    const hours = c.duration_minutes ? Math.round(c.duration_minutes / 60) : 0;
    named.set(c.id, {
      slug: c.slug,
      title: c.title,
      meta: hours ? `${hours} hours` : "Course",
    });
  }
  for (const o of (oppRes.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    location: string | null;
  }>) {
    named.set(o.id, { slug: o.slug, title: o.title, meta: o.location ?? "" });
  }

  return rows.map((r) => {
    const hit = named.get(r.targetId);
    return {
      ...r,
      slug: hit?.slug ?? null,
      // A saved row whose target has since been removed still lists, named by
      // its kind, rather than disappearing without explanation.
      title: hit?.title ?? "Saved item",
      meta: hit?.meta ?? "",
    };
  });
}

/**
 * Add or remove a save.
 *
 * `targetId` must be the row's uuid. The catalogue pages know items by slug,
 * so callers resolve first — passing a slug here fails at the database, not
 * silently.
 *
 * Returns the state the item is now in, so the button can show it without a
 * refetch.
 */
export async function toggleSave(
  profileId: string,
  kind: SaveKind,
  targetId: string,
  saved: boolean,
): Promise<boolean> {
  const supabase = requireSupabase();
  if (saved) {
    const { error } = await supabase
      .from("saves")
      .delete()
      .eq("profile_id", profileId)
      .eq("target_kind", kind)
      .eq("target_id", targetId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase
    .from("saves")
    .insert({ profile_id: profileId, target_kind: kind, target_id: targetId });
  if (error) throw new Error(error.message);
  return true;
}

/* ── Notifications ───────────────────────────────────────────────── */

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
}

export async function listNotifications(profileId: string, limit = 50): Promise<Notification[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    createdAt: n.created_at,
    read: n.read_at !== null,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(profileId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/**
 * Live notifications for one member.
 *
 * The bell used to be a number fetched once when the page mounted. Anything
 * that happened afterwards — a swap request, an accepted session, a message —
 * sat in the database until the member happened to reload, which is why they
 * "arrive slowly" or appear not to arrive at all.
 *
 * The filter is applied server-side so a member is never sent rows addressed
 * to somebody else. Callers should still keep a modest `refetchInterval` as a
 * backstop: realtime only delivers for tables in the `supabase_realtime`
 * publication, and a silent unpublished table would otherwise look exactly
 * like a working one that has nothing to say.
 */
export function watchMyNotifications(profileId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`notifications:${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `profile_id=eq.${profileId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
