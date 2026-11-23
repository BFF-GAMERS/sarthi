import { getSupabase, requireSupabase } from "./supabase";

/**
 * Reporting, blocking, and the privacy switches.
 *
 * All three tables — `reports`, `blocks`, `moderation_actions` — have existed
 * since the schema was written, with correct row-level security, and not one
 * line of this application had ever touched them. `profile_privacy` is the
 * same story: every account has a row with nine settings in it, and the app
 * never read or wrote a single one.
 *
 * That is not a cosmetic gap on a site that puts strangers into private
 * one-to-one video calls and direct messages, some of them minors. Until now
 * there was no way to report anyone, no way to block anyone, and no way to
 * say "do not let strangers message me" — even though
 * `open_direct_conversation` has always *enforced* that last setting. The
 * server was already checking a switch nobody could reach.
 */

/* ── Reports ──────────────────────────────────────────────────────── */

/** What can be reported. Mirrors the `report_subject` enum exactly. */
export type ReportSubject =
  "profile" | "message" | "post" | "comment" | "course" | "project" | "company" | "session";

/**
 * The reasons, in the order they are offered.
 *
 * Safety first, nuisance last. Somebody in trouble should not have to read
 * past "spam" to find the word for what is happening to them.
 */
export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "sexual", label: "Sexual or inappropriate content" },
  { value: "threat", label: "Threats or violence" },
  { value: "minor_safety", label: "Concerns about a child's safety" },
  { value: "scam", label: "Scam, fraud or a fee being demanded" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "spam", label: "Spam or advertising" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export interface ReportInput {
  subjectKind: ReportSubject;
  subjectId: string;
  /** Who owns the thing being reported, when it is known. Helps a moderator. */
  subjectOwnerId?: string | null;
  reason: ReportReason;
  detail?: string;
}

/**
 * File a report.
 *
 * No `.select()` on the way out. `reports_read_own` would allow it, but a
 * report needs no id handed back to the browser and asking for one is how the
 * contact form silently broke: an insert that also reads is two permissions,
 * and the second one is the one nobody tests.
 */
export async function submitReport(input: ReportInput, reporterId: string): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase.from("reports").insert({
    reporter_id: reporterId,
    subject_kind: input.subjectKind,
    subject_id: input.subjectId,
    subject_owner_id: input.subjectOwnerId ?? null,
    reason: input.reason,
    detail: input.detail?.trim() || null,
  });

  if (error) throw new Error("The report could not be sent. Please try again.");
}

/* ── Blocking ─────────────────────────────────────────────────────── */

export interface BlockedPerson {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  blockedAt: string;
}

/**
 * Block someone.
 *
 * Goes through `block_profile` rather than inserting directly, because a
 * block is two facts, not one: the row, and the removal of any follow in
 * either direction. Leaving the follow behind would keep a blocked person in
 * a follower list and — for a `connections` profile — keep their access to it.
 *
 * Nobody is told they have been blocked. That is deliberate and it is in the
 * function: notifying the blocked party is how blocking gets somebody hurt.
 */
export async function blockProfile(targetId: string, reason?: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("block_profile", {
    p_target: targetId,
    ...(reason?.trim() ? { p_reason: reason.trim() } : {}),
  });
  if (error) throw new Error(error.message);
}

export async function unblockProfile(targetId: string, myId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", myId)
    .eq("blocked_id", targetId);
  if (error) throw new Error(error.message);
}

export async function listBlocked(): Promise<BlockedPerson[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("my_blocks");
  if (error) throw new Error(error.message);
  return ((data as unknown as RawBlocked[] | null) ?? []).map((b) => ({
    id: b.id,
    handle: b.handle,
    name: b.display_name,
    avatarUrl: b.avatar_url,
    blockedAt: b.blocked_at,
  }));
}

interface RawBlocked {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  blocked_at: string;
}

/* ── The nine switches ────────────────────────────────────────────── */

export interface Privacy {
  showRegion: boolean;
  showLanguages: boolean;
  showSkills: boolean;
  showProjects: boolean;
  showCourses: boolean;
  showReviews: boolean;
  showActivity: boolean;
  discoverableByCompanies: boolean;
  allowMessagesFromStrangers: boolean;
}

/** Who can see the profile at all. The `visibility` enum, in plain words. */
export type ProfileVisibility = "public" | "connections" | "private";

export const VISIBILITY_CHOICES: Array<{
  value: ProfileVisibility;
  label: string;
  note: string;
}> = [
  {
    value: "public",
    label: "Public",
    note: "Anyone can open your profile, and anyone can follow you straight away.",
  },
  {
    value: "connections",
    label: "Ask first",
    note: "A follow becomes a request. Only the people you accept can see your profile.",
  },
  {
    value: "private",
    label: "Private",
    note: "Only your name and photo are visible to anyone. Follows still need your approval.",
  },
];

const DEFAULTS: Privacy = {
  showRegion: true,
  showLanguages: true,
  showSkills: true,
  showProjects: true,
  showCourses: true,
  showReviews: true,
  showActivity: true,
  discoverableByCompanies: true,
  allowMessagesFromStrangers: true,
};

export async function getPrivacy(profileId: string): Promise<Privacy> {
  const supabase = getSupabase();
  if (!supabase) return DEFAULTS;

  const { data, error } = await supabase
    .from("profile_privacy")
    .select(
      "show_region, show_languages, show_skills, show_projects, show_courses, show_reviews, show_activity, discoverable_by_companies, allow_messages_from_strangers",
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // A missing row means the account predates the trigger that creates one.
  // The column defaults are all `true`, so that is what absence means.
  if (!data) return DEFAULTS;

  return {
    showRegion: data.show_region,
    showLanguages: data.show_languages,
    showSkills: data.show_skills,
    showProjects: data.show_projects,
    showCourses: data.show_courses,
    showReviews: data.show_reviews,
    showActivity: data.show_activity,
    discoverableByCompanies: data.discoverable_by_companies,
    allowMessagesFromStrangers: data.allow_messages_from_strangers,
  };
}

/**
 * Upsert rather than update, for the same reason `getPrivacy` has defaults: an
 * account created before `handle_new_user` inserted the privacy row would
 * otherwise update zero rows and report success, and the switch would spring
 * back on the next load with no error to explain it.
 */
export async function updatePrivacy(profileId: string, patch: Partial<Privacy>): Promise<void> {
  const supabase = requireSupabase();

  const row: Record<string, boolean | string> = { profile_id: profileId };
  if (patch.showRegion !== undefined) row["show_region"] = patch.showRegion;
  if (patch.showLanguages !== undefined) row["show_languages"] = patch.showLanguages;
  if (patch.showSkills !== undefined) row["show_skills"] = patch.showSkills;
  if (patch.showProjects !== undefined) row["show_projects"] = patch.showProjects;
  if (patch.showCourses !== undefined) row["show_courses"] = patch.showCourses;
  if (patch.showReviews !== undefined) row["show_reviews"] = patch.showReviews;
  if (patch.showActivity !== undefined) row["show_activity"] = patch.showActivity;
  if (patch.discoverableByCompanies !== undefined) {
    row["discoverable_by_companies"] = patch.discoverableByCompanies;
  }
  if (patch.allowMessagesFromStrangers !== undefined) {
    row["allow_messages_from_strangers"] = patch.allowMessagesFromStrangers;
  }

  const { error } = await supabase
    .from("profile_privacy")
    .upsert(row as never, { onConflict: "profile_id" });
  if (error) throw new Error(error.message);
}

export async function getVisibility(profileId: string): Promise<ProfileVisibility> {
  const supabase = getSupabase();
  if (!supabase) return "public";
  const { data, error } = await supabase
    .from("profiles")
    .select("profile_visibility")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.profile_visibility ?? "public") as ProfileVisibility;
}

export async function setVisibility(
  profileId: string,
  visibility: ProfileVisibility,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ profile_visibility: visibility })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

/* ── The moderation queue ───────────────────────────────── */

export type ReportState = "open" | "reviewing" | "actioned" | "dismissed";

export interface AdminReport {
  id: string;
  subjectKind: ReportSubject;
  subjectId: string;
  reason: string;
  detail: string | null;
  state: ReportState;
  resolution: string | null;
  createdAt: string;
  handledAt: string | null;
  reporter: { name: string; handle: string } | null;
  subjectOwner: { name: string; handle: string } | null;
}

type Named = { display_name?: string; handle?: string } | null;

function one<T>(v: unknown): T | null {
  return (Array.isArray(v) ? (v[0] ?? null) : (v as T)) as T | null;
}

/**
 * Every report, newest first.
 *
 * `reports_read_own` is `reporter_id = auth.uid() OR is_admin()`, so this
 * returns one person's own reports to them and all of them to an
 * administrator. No extra check here: the policy is the check, and a second
 * one in TypeScript would only be a place for the two to disagree.
 */
export async function listReports(state?: ReportState): Promise<AdminReport[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from("reports")
    .select(
      "id, subject_kind, subject_id, reason, detail, state, resolution, created_at, handled_at, reporter:reporter_id ( display_name, handle ), owner:subject_owner_id ( display_name, handle )",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (state) query = query.eq("state", state);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const rep = one<Named>((r as { reporter: unknown }).reporter);
    const own = one<Named>((r as { owner: unknown }).owner);
    return {
      id: r.id,
      subjectKind: r.subject_kind as ReportSubject,
      subjectId: r.subject_id,
      reason: r.reason,
      detail: r.detail,
      state: r.state as ReportState,
      resolution: r.resolution,
      createdAt: r.created_at,
      handledAt: r.handled_at,
      reporter: rep ? { name: rep.display_name ?? "Member", handle: rep.handle ?? "" } : null,
      subjectOwner: own ? { name: own.display_name ?? "Member", handle: own.handle ?? "" } : null,
    };
  });
}

/**
 * Close a report, with a note saying what was done.
 *
 * `handled_by` and `handled_at` are stamped here rather than by a trigger so
 * the record says which administrator decided — a moderation log whose
 * decisions are anonymous is not a log.
 */
export async function resolveReport(
  id: string,
  state: ReportState,
  resolution: string,
  adminId: string,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("reports")
    .update({
      state,
      resolution: resolution.trim() || null,
      handled_by: adminId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
