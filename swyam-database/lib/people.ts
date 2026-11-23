import { getSupabase, requireSupabase } from "./supabase";
import { issuerName } from "./issuer";

/**
 * Looking at another member.
 *
 * Until now you could not. There was no route for a person, and no query in
 * this whole library that fetched a profile by handle — `/profile` showed
 * your own and `/mentor/$slug` is a skill, not a human. Which is why the
 * Follow button lived in exactly two places inside Community and the follows
 * table had three rows: following someone had no page to happen on.
 *
 * It is also why 46 rows of `skill_evidence` — the actual proof behind every
 * "Verified" badge on a Skill Passport — have never been shown to anybody.
 */

/* ── The card ─────────────────────────────────────────────────────── */

export type FollowState = "pending" | "accepted";

export interface ProfileCard {
  found: boolean;
  /**
   * False when the profile exists but is closed to you. Deliberately distinct
   * from `found: false` — answering "no such person" for a private account
   * would be a lie, and a lie a stranger can detect by trying a handle they
   * know is real.
   */
  visible: boolean;
  isSelf: boolean;
  id: string;
  handle: string;
  name: string;
  visibility: "public" | "connections" | "private";
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  region: string | null;
  pronouns: string | null;
  websiteUrl: string | null;
  joinedAt: string | null;
  /** Your relationship to them: not following, requested, or following. */
  followState: FollowState | null;
  followsMe: boolean;
  blockedByMe: boolean;
  followers: number;
  following: number;
  showSkills: boolean;
  showActivity: boolean;
}

interface RawCard {
  found: boolean;
  visible?: boolean;
  is_self?: boolean | null;
  id?: string;
  handle?: string;
  display_name?: string;
  visibility?: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  region?: string | null;
  pronouns?: string | null;
  website_url?: string | null;
  created_at?: string | null;
  follow_state?: FollowState | null;
  follows_me?: boolean;
  blocked_by_me?: boolean;
  counts?: { followers?: number; following?: number };
  show_skills?: boolean;
  show_activity?: boolean;
}

const MISSING: ProfileCard = {
  found: false,
  visible: false,
  isSelf: false,
  id: "",
  handle: "",
  name: "",
  visibility: "public",
  headline: null,
  bio: null,
  avatarUrl: null,
  region: null,
  pronouns: null,
  websiteUrl: null,
  joinedAt: null,
  followState: null,
  followsMe: false,
  blockedByMe: false,
  followers: 0,
  following: 0,
  showSkills: true,
  showActivity: true,
};

/**
 * One call answers three questions at once — does this handle exist, may you
 * see it, and what is your relationship to them — because asking them
 * separately means inferring the answer from which request failed.
 */
export async function getProfileCard(handle: string): Promise<ProfileCard> {
  const supabase = getSupabase();
  if (!supabase) return MISSING;

  const { data, error } = await supabase.rpc("profile_card", { p_handle: handle });
  if (error) throw new Error(error.message);

  const raw = data as unknown as RawCard | null;
  if (!raw?.found) return MISSING;

  return {
    found: true,
    visible: raw.visible === true,
    isSelf: raw.is_self === true,
    id: raw.id ?? "",
    handle: raw.handle ?? handle,
    name: raw.display_name ?? handle,
    visibility: (raw.visibility as ProfileCard["visibility"]) ?? "public",
    headline: raw.headline ?? null,
    bio: raw.bio ?? null,
    avatarUrl: raw.avatar_url ?? null,
    region: raw.region ?? null,
    pronouns: raw.pronouns ?? null,
    websiteUrl: raw.website_url ?? null,
    joinedAt: raw.created_at ?? null,
    followState: raw.follow_state ?? null,
    followsMe: raw.follows_me === true,
    blockedByMe: raw.blocked_by_me === true,
    followers: raw.counts?.followers ?? 0,
    following: raw.counts?.following ?? 0,
    showSkills: raw.show_skills !== false,
    showActivity: raw.show_activity !== false,
  };
}

/* ── Following ────────────────────────────────────────────────────── */

export interface PersonRow {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  requestedAt?: string;
}

function toPeople(data: unknown): PersonRow[] {
  const rows = (data ?? []) as Array<{
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    headline: string | null;
    requested_at?: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    name: r.display_name,
    avatarUrl: r.avatar_url,
    headline: r.headline,
    ...(r.requested_at ? { requestedAt: r.requested_at } : {}),
  }));
}

/**
 * Ask to follow.
 *
 * Whether this is a follow or a request is the server's decision, not the
 * button's — it depends on the *target's* visibility setting, and a client
 * that read someone else's setting and then chose to honour it would be
 * enforcing a privacy rule on the honour system. The returned state is what
 * the button then says.
 */
export async function requestFollow(targetId: string): Promise<FollowState> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("request_follow", { p_target: targetId });
  if (error) {
    // The RPC raises this for a block in either direction. Saying "you are
    // blocked" would tell somebody they have been blocked, which is the one
    // thing blocking must never do.
    if (/unavailable/i.test(error.message)) {
      throw new Error("This person is not accepting followers right now.");
    }
    throw new Error(error.message);
  }
  return (data as FollowState) ?? "accepted";
}

export async function unfollow(targetId: string, myId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", myId)
    .eq("following_id", targetId);
  if (error) throw new Error(error.message);
}

/** Accept or refuse. Refusing deletes the row, so they may ask again later. */
export async function respondToFollow(followerId: string, accept: boolean): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("respond_to_follow", {
    p_follower: followerId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

export async function listFollowers(profileId: string): Promise<PersonRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("follow_list", {
    p_profile: profileId,
    p_kind: "followers",
  });
  if (error) throw new Error(error.message);
  return toPeople(data);
}

export async function listFollowing(profileId: string): Promise<PersonRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("follow_list", {
    p_profile: profileId,
    p_kind: "following",
  });
  if (error) throw new Error(error.message);
  return toPeople(data);
}

/** Requests waiting on you. Takes no argument — the server uses auth.uid(). */
export async function pendingFollowRequests(): Promise<PersonRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("pending_follow_requests");
  if (error) throw new Error(error.message);
  return toPeople(data);
}

/* ── Finding a person ─────────────────────────────────────────────── */

export interface PersonHit {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  region: string | null;
  isDemo: boolean;
  isAi: boolean;
}

/**
 * Search for an account by name, handle or headline.
 *
 * The site could find a course, a job, an institute and a community post,
 * and could not find a person — which on a product whose whole premise is
 * that you learn from somebody and get hired by somebody is a strange hole.
 * You could reach a profile only by being handed its link.
 *
 * Two characters is the floor. One letter matches most of the table and
 * teaches the reader nothing, and a query that broad on every keystroke is
 * work the database should not be asked to do.
 */
export async function searchPeople(term: string, limit = 12): Promise<PersonHit[]> {
  const supabase = getSupabase();
  /*
   * People write the handle the way they see it written. Leading @ is how it
   * is printed everywhere on this site, so typing it back is the obvious
   * move and must not mean "nothing found".
   */
  const q = term.trim().replace(/^@+/, "");
  if (!supabase || q.length < 2) return [];

  /*
   * PostgREST takes `or` as a comma-separated list of filters, so a comma or
   * a bracket inside the pattern ends the filter early and the rest is read
   * as another condition — a malformed query at best. The wildcards go too:
   * a person typing % should be searching for a percent sign, not asking for
   * every row in the table.
   */
  const safe = q.replace(/[,()%*\\]/g, " ").trim();
  if (!safe) return [];
  const like = `%${safe}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_url, headline, region, is_demo, is_ai")
    .or(`display_name.ilike.${like},handle.ilike.${like},headline.ilike.${like}`)
    .order("last_active_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id,
    handle: p.handle,
    name: p.display_name,
    avatarUrl: p.avatar_url,
    headline: p.headline,
    region: p.region,
    isDemo: p.is_demo === true,
    isAi: p.is_ai === true,
  }));
}

/* ── Their passport, as much of it as you are allowed ─────────────── */

export interface PublicCertificate {
  serial: string;
  title: string;
  issuer: string;
  issuedAt: string;
  score: number | null;
}

export interface MemberPassport {
  /** Their published passport page, when they have one and it is public. */
  shareSlug: string | null;
  headline: string | null;
  summary: string | null;
  /**
   * Null is not an empty list.
   *
   * Null means we could not read them — the policy refused, or nobody is
   * signed in. An empty array means we read them and there are none. The
   * difference matters on screen: "no certificates yet" is a statement about
   * a person, and making it when the truth is "you are not allowed to know"
   * is a lie the reader cannot detect.
   */
  certificates: PublicCertificate[] | null;
}

const NO_PASSPORT: MemberPassport = {
  shareSlug: null,
  headline: null,
  summary: null,
  certificates: null,
};

/**
 * The credentials behind a member's skills, for somebody else's eyes.
 *
 * Deliberately forgiving. Both reads sit behind row-level security written
 * for the owner's own screens, and neither is the point of this page: if
 * either refuses, the profile still renders, with one fewer section.
 */
export async function getMemberPassport(profileId: string): Promise<MemberPassport> {
  const supabase = getSupabase();
  if (!supabase) return NO_PASSPORT;

  const [share, certs] = await Promise.all([
    supabase
      .from("skill_passports")
      .select("share_slug, is_public, show_certificates, headline, summary, published_at")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("certificates")
      .select("serial, title, issuer, issued_at, score, revoked_at")
      .eq("profile_id", profileId)
      .is("revoked_at", null)
      .order("issued_at", { ascending: false })
      .limit(6),
  ]);

  const s = share.error ? null : share.data;
  /* A passport that was never published is not a link you may hand out. */
  const published = Boolean(s?.is_public && s?.published_at && s?.share_slug);

  /*
   * Their switch, not ours. Somebody who turned certificates off on their own
   * passport has said they do not want them listed; a different page showing
   * the same rows is a loophole, not a feature. When there is no passport row
   * at all they have never expressed a preference, so the policy decides.
   */
  const allowed = !s || s.show_certificates !== false;

  return {
    shareSlug: published ? (s?.share_slug ?? null) : null,
    headline: published ? (s?.headline ?? null) : null,
    summary: published ? (s?.summary ?? null) : null,
    certificates:
      certs.error || !allowed
        ? null
        : (certs.data ?? []).map((c) => ({
            serial: c.serial,
            title: c.title,
            issuer: issuerName(c.issuer),
            issuedAt: c.issued_at,
            score: c.score === null ? null : Number(c.score),
          })),
  };
}

/* ── What they can do, and the proof ──────────────────────────────── */

export interface PublicSkill {
  id: string;
  name: string;
  level: string;
  canTeach: boolean;
  verification: string;
  endorsements: number;
  blurb: string | null;
  /** The rows behind the badge. Empty is normal and means "self-declared". */
  evidence: Array<{ kind: string; state: string; at: string }>;
}

/**
 * Skills, each with the evidence that backs it.
 *
 * `skill_evidence` holds 46 real rows — assessments passed, courses finished,
 * a mentor endorsement — and no page has ever shown one. "Verified" with no
 * visible reason is a claim; "verified, because they passed the assessment on
 * 12 March" is a credential. The whole point of the Skill Passport is the
 * second thing.
 *
 * Its `evidence_read` policy is `profile_is_visible(profile_id)`, so a closed
 * profile returns nothing here without any check of ours.
 */
export async function listPublicSkills(profileId: string): Promise<PublicSkill[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const [skills, evidence] = await Promise.all([
    supabase
      .from("user_skills")
      .select(
        "skill_id, level, can_teach, verification_state, endorsement_count, blurb, skills ( id, name )",
      )
      .eq("profile_id", profileId)
      .order("endorsement_count", { ascending: false }),
    supabase
      .from("skill_evidence")
      .select("skill_id, kind, state, created_at")
      .eq("profile_id", profileId)
      .eq("state", "accepted"),
  ]);

  if (skills.error) throw new Error(skills.error.message);
  // Evidence is an enrichment, not the record. If its policy refuses, show
  // the skills anyway rather than an error page.
  const proof = new Map<string, PublicSkill["evidence"]>();
  for (const e of evidence.data ?? []) {
    const list = proof.get(e.skill_id) ?? [];
    list.push({ kind: e.kind, state: e.state, at: e.created_at });
    proof.set(e.skill_id, list);
  }

  return (skills.data ?? []).map((r) => {
    const skill = Array.isArray(r.skills) ? r.skills[0] : r.skills;
    return {
      id: r.skill_id,
      name: skill?.name ?? "Skill",
      level: r.level,
      canTeach: r.can_teach,
      verification: r.verification_state,
      endorsements: r.endorsement_count,
      blurb: r.blurb,
      evidence: proof.get(r.skill_id) ?? [],
    };
  });
}

/* ── When they are free ───────────────────────────────────────────── */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface FreeSlot {
  weekday: number;
  day: string;
  from: string;
  to: string;
}

function clock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * Thirteen availability rows across five people have sat in this database
 * unread by anything. Two members arranging a SkillSwap session had no way to
 * see when the other was free — while the answer was already stored.
 */
export async function listAvailability(profileId: string): Promise<FreeSlot[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("availability_slots")
    .select("weekday, start_minute, end_minute")
    .eq("profile_id", profileId)
    .order("weekday")
    .order("start_minute");
  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    weekday: s.weekday,
    day: DAYS[s.weekday] ?? "",
    from: clock(s.start_minute),
    to: clock(s.end_minute),
  }));
}

/* ── Opening a conversation ───────────────────────────────────────── */

/**
 * `open_direct_conversation` refuses on a block, and refuses when the other
 * person has turned off messages from strangers and you are not swapping with
 * them. Both of those are real rules that have been enforced all along — the
 * switch simply had no UI until now. The messages here are what those two
 * refusals should sound like to a person.
 */
export async function openConversationWith(otherId: string): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("open_direct_conversation", { p_other: otherId });
  if (error) {
    if (/only accepts messages/i.test(error.message)) {
      throw new Error(
        "They only take messages from people they are swapping with. Send a swap request first.",
      );
    }
    if (/unavailable/i.test(error.message)) {
      throw new Error("You cannot message this person.");
    }
    throw new Error(error.message);
  }
  return data as unknown as string;
}
