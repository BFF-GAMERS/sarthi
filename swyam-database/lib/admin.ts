/**
 * Administration.
 *
 * Every function here is an ordinary authenticated query. The power comes
 * from the `admin` role on the signed-in account and the `is_admin()` checks
 * inside the row-level security policies — not from anything this file does.
 *
 * That matters: there is no secret to leak and no client-side gate to bypass.
 * Someone who edits the JavaScript to reveal these screens still gets nothing,
 * because the database refuses every query they make.
 */

import { getSupabase, requireSupabase } from "./supabase";

/** Whether the signed-in account actually holds the admin role. */
export async function isAdmin(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}

/* ── Platform overview ───────────────────────────────────────────── */

export interface PlatformMetrics {
  members: number;
  courses: number;
  opportunities: number;
  enrolments: number;
  completions: number;
  certificates: number;
  swapsActive: number;
  swapsCompleted: number;
  applications: number;
  skills: number;
}

const ZERO: PlatformMetrics = {
  members: 0,
  courses: 0,
  opportunities: 0,
  enrolments: 0,
  completions: 0,
  certificates: 0,
  swapsActive: 0,
  swapsCompleted: 0,
  applications: 0,
  skills: 0,
};

export async function platformMetrics(): Promise<PlatformMetrics> {
  const supabase = getSupabase();
  if (!supabase) return ZERO;
  const { data, error } = await supabase.rpc("platform_metrics");
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return ZERO;

  const m = data as Record<string, unknown>;
  const n = (k: string) => {
    const v = m[k];
    const num = typeof v === "string" ? Number(v) : v;
    return typeof num === "number" && Number.isFinite(num) ? num : 0;
  };
  return {
    members: n("members") || n("profiles"),
    courses: n("courses"),
    opportunities: n("opportunities"),
    enrolments: n("enrollments") || n("enrolments"),
    completions: n("completions") || n("courses_completed"),
    certificates: n("certificates"),
    swapsActive: n("swaps_active"),
    swapsCompleted: n("swaps_completed"),
    applications: n("applications"),
    skills: n("skills"),
  };
}

/* ── Members ─────────────────────────────────────────────────────── */

export interface AdminMember {
  id: string;
  handle: string;
  displayName: string;
  headline: string | null;
  region: string | null;
  isDemo: boolean;
  createdAt: string;
  lastActiveAt: string;
  roles: string[];
  visibility: string;
  /** school · college · jobseeker · professional · recruiter · institute, or null if never asked. */
  profileType: string | null;
}

export async function listMembers(search = "", limit = 100): Promise<AdminMember[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let q = supabase
    .from("profiles")
    .select(
      "id, handle, display_name, headline, region, is_demo, created_at, last_active_at, profile_visibility, profile_type",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const term = search.trim();
  if (term) q = q.or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((p) => p.id);
  const roleMap = new Map<string, string[]>();
  if (ids.length) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("profile_id, role")
      .in("profile_id", ids);
    for (const r of roles ?? []) {
      const list = roleMap.get(r.profile_id) ?? [];
      list.push(r.role as string);
      roleMap.set(r.profile_id, list);
    }
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.display_name,
    headline: p.headline,
    region: p.region,
    isDemo: p.is_demo,
    createdAt: p.created_at,
    lastActiveAt: p.last_active_at,
    roles: (roleMap.get(p.id) ?? []).sort(),
    visibility: p.profile_visibility,
    profileType: p.profile_type ?? null,
  }));
}

export async function updateMember(
  id: string,
  patch: {
    displayName?: string;
    headline?: string | null;
    region?: string | null;
    /** Corrects a wrong pick on the member's behalf. Null clears it, so they are asked again. */
    profileType?: string | null;
  },
): Promise<void> {
  const supabase = requireSupabase();
  const row: {
    display_name?: string;
    headline?: string | null;
    region?: string | null;
    profile_type?: string | null;
  } = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.headline !== undefined) row.headline = patch.headline;
  if (patch.region !== undefined) row.region = patch.region;
  if (patch.profileType !== undefined) row.profile_type = patch.profileType;
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from("profiles").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export type AppRole =
  | "student"
  | "professional"
  | "mentor"
  | "course_creator"
  | "career_consultant"
  | "company_member"
  | "moderator"
  | "admin";

export const ALL_ROLES: AppRole[] = [
  "student",
  "professional",
  "mentor",
  "course_creator",
  "career_consultant",
  "company_member",
  "moderator",
  "admin",
];

/**
 * The roles offered as one-click chips.
 *
 * `admin` is deliberately absent. It was the eighth chip in a row of eight
 * identical ones, which made handing over the entire platform — every member,
 * every course, every certificate — the same gesture as tagging somebody a
 * mentor, and a misclick away. It gets its own control and its own
 * confirmation instead; see `setAdmin`.
 */
export const ASSIGNABLE_ROLES: AppRole[] = ALL_ROLES.filter((r) => r !== "admin");

/**
 * Grant or remove the admin role.
 *
 * Separate from `grantRole` so the privileged case has one obvious call site.
 * Removing the last admin is refused by a database trigger rather than here,
 * because the page is not the only route to the table; this just turns that
 * refusal into a sentence somebody can act on.
 */
export async function setAdmin(profileId: string, make: boolean): Promise<void> {
  const supabase = requireSupabase();

  if (make) {
    const { error } = await supabase
      .from("user_roles")
      .insert({ profile_id: profileId, role: "admin" })
      .select();
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("profile_id", profileId)
    .eq("role", "admin");
  if (error) {
    if (/last admin/i.test(error.message)) {
      throw new Error("This is the last admin account. Grant admin to somebody else first.");
    }
    throw new Error(error.message);
  }
}

/** How many accounts currently hold admin. Shown so the count is never a guess. */
export async function countAdmins(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("user_roles")
    .select("profile_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function grantRole(profileId: string, role: AppRole): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("user_roles")
    .insert({ profile_id: profileId, role })
    .select();
  // Already held is not a failure worth surfacing.
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export async function revokeRole(profileId: string, role: AppRole): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("profile_id", profileId)
    .eq("role", role);
  if (error) throw new Error(error.message);
}

/* ── Courses ─────────────────────────────────────────────────────── */

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  level: string;
  isPublished: boolean;
  isFree: boolean;
  priceMinor: number;
  enrolmentCount: number;
  ratingAvg: number | null;
}

export async function listCourses(search = "", limit = 200): Promise<AdminCourse[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let q = supabase
    .from("courses")
    .select(
      "id, slug, title, level, is_published, is_free, price_minor, enrollment_count, rating_avg",
    )
    .order("title")
    .limit(limit);

  const term = search.trim();
  if (term) q = q.ilike("title", `%${term}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    level: c.level,
    isPublished: c.is_published,
    isFree: c.is_free ?? c.price_minor === 0,
    priceMinor: c.price_minor ?? 0,
    enrolmentCount: c.enrollment_count ?? 0,
    ratingAvg: c.rating_avg === null ? null : Number(c.rating_avg),
  }));
}

export async function updateCourse(
  id: string,
  patch: { title?: string; isPublished?: boolean; priceMinor?: number },
): Promise<void> {
  const supabase = requireSupabase();
  const row: {
    title?: string;
    is_published?: boolean;
    price_minor?: number;
  } = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.isPublished !== undefined) row.is_published = patch.isPublished;
  if (patch.priceMinor !== undefined) row.price_minor = patch.priceMinor;
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from("courses").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Take a course off the catalogue.
 *
 * Unpublishing rather than deleting, because enrolments, certificates and
 * points all reference it — a hard delete would either cascade away someone's
 * completed course or fail on a foreign key. Withdrawal is the honest action.
 */
export async function unpublishCourse(id: string): Promise<void> {
  await updateCourse(id, { isPublished: false });
}

/* ── Enrolments ──────────────────────────────────────────────────── */

export interface AdminEnrolment {
  id: string;
  profileId: string;
  memberName: string;
  courseTitle: string;
  state: string;
  progressPercent: number;
  enrolledAt: string;
  completedAt: string | null;
}

export async function listEnrolments(limit = 100): Promise<AdminEnrolment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("course_enrollments")
    .select(
      "id, profile_id, state, progress_percent, enrolled_at, completed_at, courses ( title ), profiles ( display_name )",
    )
    .order("enrolled_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      profile_id: string;
      state: string;
      progress_percent: number | null;
      enrolled_at: string;
      completed_at: string | null;
      courses: { title?: string } | { title?: string }[] | null;
      profiles: { display_name?: string } | { display_name?: string }[] | null;
    };
    return {
      id: row.id,
      profileId: row.profile_id,
      memberName: one(row.profiles)?.display_name ?? "Member",
      courseTitle: one(row.courses)?.title ?? "Course",
      state: row.state,
      progressPercent: Number(row.progress_percent ?? 0),
      enrolledAt: row.enrolled_at,
      completedAt: row.completed_at,
    };
  });
}

/**
 * Move an enrolment's state by hand.
 *
 * Marking one complete runs the same path a learner's own final lesson would:
 * progress to 100, a completion timestamp, and the certificate issued by the
 * database rather than written here.
 */
export async function setEnrolmentState(
  id: string,
  state: "active" | "completed" | "cancelled",
): Promise<{ certificateSerial: string | null }> {
  const supabase = requireSupabase();

  const patch: {
    state: "active" | "completed" | "cancelled";
    progress_percent?: number;
    completed_at?: string | null;
  } = { state };
  if (state === "completed") {
    patch.progress_percent = 100;
    patch.completed_at = new Date().toISOString();
  } else if (state === "active") {
    patch.completed_at = null;
  }

  const { error } = await supabase.from("course_enrollments").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  if (state !== "completed") return { certificateSerial: null };

  const { data, error: certError } = await supabase.rpc("issue_course_certificate", {
    p_enrollment: id,
  });
  // A course with no certificate configured is a normal outcome, not a fault.
  if (certError) return { certificateSerial: null };

  const row = (Array.isArray(data) ? data[0] : data) as { serial?: string } | null;
  return { certificateSerial: row?.serial ?? null };
}

/* ── Certificates ────────────────────────────────────────────────── */

export interface AdminCertificate {
  id: string;
  serial: string;
  title: string;
  recipientName: string;
  issuedAt: string;
  revoked: boolean;
}

export async function listCertificates(limit = 100): Promise<AdminCertificate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("certificates")
    .select("id, serial, title, recipient_name, issued_at, revoked_at")
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    serial: c.serial,
    title: c.title,
    recipientName: c.recipient_name,
    issuedAt: c.issued_at,
    revoked: c.revoked_at !== null,
  }));
}

/** Revoke or reinstate. Kept reversible — revocation is often a mistake. */
export async function setCertificateRevoked(
  id: string,
  revoked: boolean,
  reason?: string,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("certificates")
    .update({
      revoked_at: revoked ? new Date().toISOString() : null,
      revoked_reason: revoked ? (reason ?? "Revoked by an administrator") : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Contact messages ────────────────────────────────────────────── */

/**
 * The contact form's inbox.
 *
 * `contact_messages` was created with `handled_at`, `handled_by` and an
 * admin-only select policy — a table built for a screen that was never
 * written. Until now every enquiry was saved and read by nobody, while the
 * page told the sender it had been "filed for the team".
 */
export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  reason: string;
  subject: string;
  message: string;
  sourcePath: string | null;
  createdAt: string;
  handled: boolean;
}

/* ── Coach feedback ───────────────────────────────────────────────── */

export interface CoachFeedbackRow {
  id: string;
  kind: string;
  helpful: boolean;
  note: string | null;
  memberName: string;
  createdAt: string;
}

/**
 * Every "Was this helpful?" answer under a coach plan, newest first.
 *
 * `available` is false until db/023 has been run; the tab then says so
 * instead of showing an error for a table that is merely not there yet.
 */
export async function listCoachFeedback(
  limit = 200,
): Promise<{ rows: CoachFeedbackRow[]; available: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { rows: [], available: false };
  const { data, error } = await supabase
    .from("coach_feedback")
    .select("id, kind, helpful, note, created_at, profiles:profile_id ( display_name )")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /does not exist|find the table/i.test(error.message)
    ) {
      return { rows: [], available: false };
    }
    throw new Error(error.message);
  }
  return {
    available: true,
    rows: (
      (data ?? []) as unknown as Array<{
        id: string;
        kind: string;
        helpful: boolean;
        note: string | null;
        created_at: string;
        profiles: { display_name: string } | null;
      }>
    ).map((r) => ({
      id: r.id,
      kind: r.kind,
      helpful: r.helpful,
      note: r.note,
      memberName: r.profiles?.display_name ?? "Member",
      createdAt: r.created_at,
    })),
  };
}

export async function listContactMessages(limit = 100): Promise<AdminContactMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, name, email, phone, reason, subject, message, source_path, created_at, handled_at")
    // Unhandled first, then newest — the queue is the point of the screen.
    .order("handled_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    reason: m.reason,
    subject: m.subject,
    message: m.message,
    sourcePath: m.source_path,
    createdAt: m.created_at,
    handled: m.handled_at !== null,
  }));
}

/** Reversible: marking something answered by mistake must not lose it. */
export async function setContactHandled(
  id: string,
  handled: boolean,
  profileId: string,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("contact_messages")
    .update({
      handled_at: handled ? new Date().toISOString() : null,
      handled_by: handled ? profileId : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Trainers ────────────────────────────────────────────────────── */

/**
 * Certifying the founding cohort.
 *
 * The certified-trainer model refuses a swap unless the teacher is verified in
 * that skill, which on day one is nobody — so the first trainers are granted
 * by hand here. The database records it as `admin_grant` evidence rather than
 * quietly flipping a column, so the passport can always say how a skill was
 * earned.
 */
export interface CertifyResult {
  ok: boolean;
  name?: string;
  state?: string;
  role?: string;
  reason?: string;
}

export async function certifyTrainer(
  profileId: string,
  skillId: string,
  master = false,
  note?: string,
): Promise<CertifyResult> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("admin_certify_skill", {
    p_profile: profileId,
    p_skill: skillId,
    p_master: master,
    ...(note ? { p_note: note } : {}),
  });
  if (error) return { ok: false, reason: error.message };

  const r = (data ?? {}) as Record<string, unknown>;
  return {
    ok: r["ok"] === true,
    name: r["name"] ? String(r["name"]) : undefined,
    state: r["state"] ? String(r["state"]) : undefined,
    role: r["role"] ? String(r["role"]) : undefined,
  };
}

export async function revokeCertification(profileId: string, skillId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("admin_revoke_skill", {
    p_profile: profileId,
    p_skill: skillId,
  });
  if (error) throw new Error(error.message);
}

/** Everyone currently licensed to teach something, with what and at what level. */
export interface CertifiedTrainer {
  profileId: string;
  name: string;
  handle: string | null;
  skillId: string;
  skill: string;
  master: boolean;
  trainings: number;
}

export async function listCertifiedTrainers(): Promise<CertifiedTrainer[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("user_skills")
    .select(
      "profile_id, skill_id, verification_state, profiles ( display_name, handle ), skills ( name )",
    )
    .in("verification_state", ["verified", "expert_verified"]);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const one = <T>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v as T)) as T;
    const p = one<{ display_name?: string; handle?: string }>(
      (row as { profiles: unknown }).profiles,
    );
    const sk = one<{ name?: string }>((row as { skills: unknown }).skills);
    return {
      profileId: row.profile_id,
      name: p?.display_name ?? "Member",
      handle: p?.handle ?? null,
      skillId: row.skill_id,
      skill: sk?.name ?? "Skill",
      master: row.verification_state === "expert_verified",
      trainings: 0,
    };
  });
}
