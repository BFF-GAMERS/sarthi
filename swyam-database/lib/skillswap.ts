/**
 * SkillSwap data layer.
 *
 * ONE SOURCE OF TRUTH FOR SKILLS. Every part of the app that needs to know
 * what a person can teach, wants to learn, or has been matched with reads
 * through this module — the profile page, the SkillSwap board, the passport,
 * the dashboard and Sarthi all call the same functions.
 *
 * The heavy lifting already lives in Postgres: `find_swap_matches` scores
 * candidates, `accept_swap_request` turns a request into a swap inside one
 * transaction, `build_passport_snapshot` assembles the passport. This file is
 * a typed client over those, not a second implementation of them.
 *
 * Every function returns plain data or throws. Callers that must survive a
 * missing `.env` should check `isSupabaseConfigured` first — the app degrades
 * to its sample catalogue rather than crashing.
 */

import { getSupabase, requireSupabase } from "./supabase";
import type { Database } from "@/types/database";
import { issuerName } from "./issuer";

/* ── Shared vocabulary ───────────────────────────────────────────── */

export type SkillLevel = Database["public"]["Enums"]["skill_level"];
export type LearningFormat = Database["public"]["Enums"]["learning_format"];
export type SwapRequestState = Database["public"]["Enums"]["swap_request_state"];
export type SwapState = Database["public"]["Enums"]["swap_state"];
export type VerificationState = Database["public"]["Enums"]["verification_state"];

export const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];

/**
 * The formats a human trainer can actually deliver.
 *
 * `self_paced` is deliberately not here. It is not a way of being taught by
 * somebody — it is the absence of a trainer, and offering it beside "video
 * call" produced sessions that nobody intended to attend. Learners who want
 * it are sent to the AI mentor at /mentor/$slug instead.
 */
export const HUMAN_FORMATS: LearningFormat[] = ["chat", "video", "in_person", "project"];

export const LEARNING_FORMATS: LearningFormat[] = [
  "chat",
  "video",
  "project",
  "self_paced",
  "in_person",
];

/** Human labels for the format enum, used wherever a format is shown. */
export const FORMAT_LABEL: Record<LearningFormat, string> = {
  chat: "Chat",
  video: "Video call",
  project: "Build together",
  self_paced: "Self-paced",
  in_person: "In person",
};

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

/** Level as a percentage, for the bars the profile page already draws. */
export const LEVEL_PERCENT: Record<SkillLevel, number> = {
  beginner: 30,
  intermediate: 55,
  advanced: 78,
  expert: 95,
};

/**
 * How far a verification has progressed. `self_declared` is the honest
 * default — the UI says "self-declared" rather than implying a check that
 * never happened.
 */
export const VERIFICATION_LABEL: Record<VerificationState, string> = {
  self_declared: "Self-declared",
  evidence_submitted: "Evidence submitted",
  assessed: "Assessed",
  verified: "Verified",
  expert_verified: "Expert verified",
  revoked: "Revoked",
};

/* ── Row shapes ──────────────────────────────────────────────────── */

export interface SkillRef {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
}

/** A skill the signed-in person offers to teach. */
export interface TeachSkill {
  id: string;
  skill: SkillRef;
  level: SkillLevel;
  yearsExperience: number | null;
  blurb: string | null;
  canTeach: boolean;
  teachingFormats: LearningFormat[];
  verificationState: VerificationState;
  endorsementCount: number;
}

/** A skill the signed-in person wants to learn. */
export interface LearnSkill {
  id: string;
  skill: SkillRef;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  /** 1 = highest. The matcher weights this into `goal_fit`. */
  priority: number;
  motivation: string | null;
  preferredFormats: LearningFormat[];
}

/** The score the SQL matcher produced, broken into its parts. */
export interface MatchBreakdown {
  skillFit: number;
  goalFit: number;
  language: number;
  availability: number;
  format: number;
  evidence: number;
  reputation: number;
  max: {
    skillFit: number;
    goalFit: number;
    language: number;
    availability: number;
    format: number;
    evidence: number;
    reputation: number;
  };
}

export interface SwapMatch {
  candidateId: string;
  displayName: string;
  handle: string;
  headline: string | null;
  avatarUrl: string | null;
  region: string | null;
  /** What they would teach you. */
  theyTeach: SkillRef;
  /**
   * What you would teach them, or null.
   *
   * Null is the ordinary case for a new learner: the matcher returns people
   * who teach what you want long before you have anything to offer back. It
   * was typed as always present, so the id went into a uuid filter as the
   * string "null" and the query failed outright.
   */
  youTeach: SkillRef | null;
  score: number;
  /** True when each side already wants what the other offers. */
  isMutual: boolean;
  breakdown: MatchBreakdown | null;
}

export interface SwapRequest {
  id: string;
  requesterId: string;
  recipientId: string;
  /** The other party, whichever side of the request you are on. */
  counterpart: {
    id: string;
    displayName: string;
    handle: string;
    avatarUrl: string | null;
    headline: string | null;
  };
  /** Null when a learner asked without offering anything back. */
  offeredSkill: SkillRef | null;
  requestedSkill: SkillRef;
  message: string | null;
  proposedFormat: LearningFormat;
  state: SwapRequestState;
  matchScore: number | null;
  responseNote: string | null;
  createdAt: string;
  expiresAt: string;
  /** "incoming" when someone asked you; "outgoing" when you asked them. */
  direction: "incoming" | "outgoing";
}

export interface ActiveSwap {
  id: string;
  partner: {
    id: string;
    displayName: string;
    handle: string;
    avatarUrl: string | null;
  };
  /** The skill you teach in this swap. */
  youTeach: SkillRef;
  /** The skill they teach you. */
  theyTeach: SkillRef;
  state: SwapState;
  format: LearningFormat;
  sessionsPlanned: number;
  sessionsCompleted: number;
  startedAt: string;
}

/* ── Selects ─────────────────────────────────────────────────────── */

/**
 * Skill columns plus the category name, in one round trip.
 *
 * PostgREST returns an embedded row as an object, but its generated types
 * widen it to `object | object[]` in some shapes, so every read goes through
 * `toSkillRef` rather than being indexed inline.
 */
const SKILL_SELECT = "id, name, slug, category_id, skill_categories ( name )";

type RawSkill = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  skill_categories: { name: string } | { name: string }[] | null;
};

function toSkillRef(raw: RawSkill | null | undefined): SkillRef {
  const cat = Array.isArray(raw?.skill_categories)
    ? raw?.skill_categories[0]
    : raw?.skill_categories;
  return {
    id: raw?.id ?? "",
    name: raw?.name ?? "Unknown skill",
    slug: raw?.slug ?? "",
    categoryId: raw?.category_id ?? "",
    categoryName: cat?.name ?? "General",
  };
}

type RawProfile = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  headline: string | null;
  region?: string | null;
};

function firstProfile(raw: RawProfile | RawProfile[] | null | undefined): RawProfile | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/* ── The skill catalogue ─────────────────────────────────────────── */

/**
 * Every approved skill, for the pickers on the profile page.
 *
 * Returns `[]` rather than throwing when Supabase is unconfigured, so a
 * checkout with no `.env` renders an empty picker instead of an error page.
 */
export async function listSkills(): Promise<SkillRef[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("skills")
    .select(SKILL_SELECT)
    .eq("is_approved", true)
    .order("usage_count", { ascending: false })
    .order("name");

  if (error) throw new Error(error.message);
  return (data as RawSkill[] | null)?.map(toSkillRef) ?? [];
}

/**
 * Add a skill nobody has listed yet.
 *
 * The catalogue can never be complete — someone will always teach something
 * it has not heard of — so a search that finds nothing offers to add the term
 * instead of ending in a shrug. The database does the deduplicating: the same
 * skill typed with different spacing, case or as an existing alias comes back
 * as the row that already exists, so two people who type the same thing end
 * up matchable rather than each holding a private copy.
 *
 * `created` says whether this call is what brought it into being, which is
 * the difference between "Added" and "Already here" in the interface.
 */
export async function suggestSkill(name: string): Promise<{ skill: SkillRef; created: boolean }> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc("suggest_skill", { p_name: name });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as
    { id: string; slug: string; name: string; created: boolean } | undefined;
  if (!row) throw new Error("That skill could not be added.");

  // The RPC returns the identity only; the category comes from a read back
  // through the same shape every other skill uses.
  const { data: full } = await supabase
    .from("skills")
    .select(SKILL_SELECT)
    .eq("id", row.id)
    .maybeSingle();

  const skill: SkillRef = full
    ? toSkillRef(full as RawSkill)
    : { id: row.id, name: row.name, slug: row.slug, categoryId: "", categoryName: "Other" };

  return { skill, created: row.created === true };
}

/* ── I CAN TEACH ─────────────────────────────────────────────────── */

export async function listTeachSkills(profileId: string): Promise<TeachSkill[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("user_skills")
    .select(
      `id, level, years_experience, blurb, can_teach, teaching_formats,
       verification_state, endorsement_count, skills ( ${SKILL_SELECT} )`,
    )
    .eq("profile_id", profileId)
    .order("created_at");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      level: SkillLevel;
      years_experience: number | null;
      blurb: string | null;
      can_teach: boolean;
      teaching_formats: LearningFormat[];
      verification_state: VerificationState;
      endorsement_count: number;
      skills: RawSkill | RawSkill[] | null;
    };
    return {
      id: r.id,
      skill: toSkillRef(Array.isArray(r.skills) ? r.skills[0] : r.skills),
      level: r.level,
      yearsExperience: r.years_experience,
      blurb: r.blurb,
      canTeach: r.can_teach,
      teachingFormats: r.teaching_formats ?? [],
      verificationState: r.verification_state,
      endorsementCount: r.endorsement_count,
    };
  });
}

export interface TeachSkillInput {
  skillId: string;
  level: SkillLevel;
  yearsExperience?: number | null;
  blurb?: string | null;
  teachingFormats?: LearningFormat[];
}

export async function addTeachSkill(profileId: string, input: TeachSkillInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("user_skills").insert({
    profile_id: profileId,
    skill_id: input.skillId,
    level: input.level,
    years_experience: input.yearsExperience ?? null,
    blurb: input.blurb ?? null,
    can_teach: true,
    teaching_formats: input.teachingFormats ?? ["chat", "video"],
  });
  if (error) throw new Error(friendlyDuplicate(error.message, "You already teach that skill."));
}

export async function updateTeachSkill(
  id: string,
  patch: Partial<Pick<TeachSkill, "level" | "yearsExperience" | "blurb" | "canTeach">> & {
    teachingFormats?: LearningFormat[];
  },
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("user_skills")
    .update({
      ...(patch.level !== undefined ? { level: patch.level } : {}),
      ...(patch.yearsExperience !== undefined ? { years_experience: patch.yearsExperience } : {}),
      ...(patch.blurb !== undefined ? { blurb: patch.blurb } : {}),
      ...(patch.canTeach !== undefined ? { can_teach: patch.canTeach } : {}),
      ...(patch.teachingFormats !== undefined ? { teaching_formats: patch.teachingFormats } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeTeachSkill(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("user_skills").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── I WANT TO LEARN ─────────────────────────────────────────────── */

export async function listLearnSkills(profileId: string): Promise<LearnSkill[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("wanted_skills")
    .select(
      `id, current_level, target_level, priority, motivation, preferred_formats,
       skills ( ${SKILL_SELECT} )`,
    )
    .eq("profile_id", profileId)
    .order("priority")
    .order("created_at");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      current_level: SkillLevel;
      target_level: SkillLevel;
      priority: number;
      motivation: string | null;
      preferred_formats: LearningFormat[];
      skills: RawSkill | RawSkill[] | null;
    };
    return {
      id: r.id,
      skill: toSkillRef(Array.isArray(r.skills) ? r.skills[0] : r.skills),
      currentLevel: r.current_level,
      targetLevel: r.target_level,
      priority: r.priority,
      motivation: r.motivation,
      preferredFormats: r.preferred_formats ?? [],
    };
  });
}

export interface LearnSkillInput {
  skillId: string;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  priority?: number;
  motivation?: string | null;
  preferredFormats?: LearningFormat[];
}

export async function addLearnSkill(profileId: string, input: LearnSkillInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("wanted_skills").insert({
    profile_id: profileId,
    skill_id: input.skillId,
    current_level: input.currentLevel,
    target_level: input.targetLevel,
    priority: input.priority ?? 2,
    motivation: input.motivation ?? null,
    preferred_formats: input.preferredFormats ?? ["chat", "video"],
  });
  if (error)
    throw new Error(friendlyDuplicate(error.message, "That skill is already on your learn list."));
}

export async function updateLearnSkill(
  id: string,
  patch: Partial<Pick<LearnSkill, "currentLevel" | "targetLevel" | "priority" | "motivation">> & {
    preferredFormats?: LearningFormat[];
  },
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("wanted_skills")
    .update({
      ...(patch.currentLevel !== undefined ? { current_level: patch.currentLevel } : {}),
      ...(patch.targetLevel !== undefined ? { target_level: patch.targetLevel } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.motivation !== undefined ? { motivation: patch.motivation } : {}),
      ...(patch.preferredFormats !== undefined
        ? { preferred_formats: patch.preferredFormats }
        : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeLearnSkill(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("wanted_skills").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Matching ────────────────────────────────────────────────────── */

function toBreakdown(raw: unknown): MatchBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, number> & { max?: Record<string, number> };
  const max = b.max ?? {};
  const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : fallback);
  return {
    skillFit: num(b["skill_fit"]),
    goalFit: num(b["goal_fit"]),
    language: num(b["language"]),
    availability: num(b["availability"]),
    format: num(b["format"]),
    evidence: num(b["evidence"]),
    reputation: num(b["reputation"]),
    max: {
      skillFit: num(max["skill_fit"], 40),
      goalFit: num(max["goal_fit"], 20),
      language: num(max["language"], 15),
      availability: num(max["availability"], 10),
      format: num(max["format"], 5),
      evidence: num(max["evidence"], 5),
      reputation: num(max["reputation"], 5),
    },
  };
}

/**
 * Ranked swap partners for a profile.
 *
 * The scoring lives in the `find_swap_matches` SQL function; this call joins
 * the ids it returns back to the profile and skill rows the cards need. The
 * RPC returns one row per (candidate, they-teach, you-teach) triple, so two
 * people who could trade in more than one direction appear more than once —
 * which is the intent: each pairing is its own proposal.
 */
export async function findMatches(profileId: string, limit = 20): Promise<SwapMatch[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("find_swap_matches", {
    p_profile: profileId,
    p_limit: limit,
    p_min_score: 20,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    candidate_id: string;
    they_teach_id: string;
    /** Null for a one-way match: they teach something I want, I teach them nothing. */
    you_teach_id: string | null;
    score: number;
    is_mutual: boolean;
    breakdown: unknown;
  }>;
  if (rows.length === 0) return [];

  // Two lookups rather than one per row: the RPC hands back bare ids.
  const profileIds = [...new Set(rows.map((r) => r.candidate_id))];
  // `you_teach_id` is null on a one-way match, which is the default for every
  // new learner. Passing it through reached PostgREST as the literal string
  // "null" inside in.(...), and the query died with
  // `invalid input syntax for type uuid: "null"` — surfaced raw in My Swaps.
  const skillIds = [
    ...new Set(rows.flatMap((r) => [r.they_teach_id, r.you_teach_id]).filter(Boolean)),
  ] as string[];

  const [{ data: profiles, error: pErr }, { data: skills, error: sErr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url, headline, region")
      .in("id", profileIds),
    supabase.from("skills").select(SKILL_SELECT).in("id", skillIds),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (sErr) throw new Error(sErr.message);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p as unknown as RawProfile] as const),
  );
  const skillById = new Map(
    ((skills as RawSkill[] | null) ?? []).map((s) => [s.id, toSkillRef(s)] as const),
  );
  const unknownSkill: SkillRef = {
    id: "",
    name: "Unknown skill",
    slug: "",
    categoryId: "",
    categoryName: "General",
  };

  return rows.map((r) => {
    const p = profileById.get(r.candidate_id);
    return {
      candidateId: r.candidate_id,
      displayName: p?.display_name ?? "A member",
      handle: p?.handle ?? "",
      headline: p?.headline ?? null,
      avatarUrl: p?.avatar_url ?? null,
      region: p?.region ?? null,
      theyTeach: skillById.get(r.they_teach_id) ?? unknownSkill,
      youTeach: r.you_teach_id ? (skillById.get(r.you_teach_id) ?? unknownSkill) : null,
      score: Math.round(Number(r.score)),
      isMutual: r.is_mutual,
      breakdown: toBreakdown(r.breakdown),
    };
  });
}

/* ── Requests ────────────────────────────────────────────────────── */

const REQUEST_SELECT = `
  id, requester_id, recipient_id, message, proposed_format, state,
  match_score, response_note, created_at, expires_at,
  offered:skills!swap_requests_offered_skill_id_fkey ( ${SKILL_SELECT} ),
  requested:skills!swap_requests_requested_skill_id_fkey ( ${SKILL_SELECT} ),
  requester:profiles!swap_requests_requester_id_fkey ( id, display_name, handle, avatar_url, headline ),
  recipient:profiles!swap_requests_recipient_id_fkey ( id, display_name, handle, avatar_url, headline )
`;

type RawRequest = {
  id: string;
  requester_id: string;
  recipient_id: string;
  message: string | null;
  proposed_format: LearningFormat;
  state: SwapRequestState;
  match_score: number | null;
  response_note: string | null;
  created_at: string;
  expires_at: string;
  offered: RawSkill | RawSkill[] | null;
  requested: RawSkill | RawSkill[] | null;
  requester: RawProfile | RawProfile[] | null;
  recipient: RawProfile | RawProfile[] | null;
};

function toRequest(raw: RawRequest, viewerId: string): SwapRequest {
  const direction = raw.requester_id === viewerId ? "outgoing" : "incoming";
  const other = firstProfile(direction === "outgoing" ? raw.recipient : raw.requester);
  return {
    id: raw.id,
    requesterId: raw.requester_id,
    recipientId: raw.recipient_id,
    counterpart: {
      id: other?.id ?? "",
      displayName: other?.display_name ?? "A member",
      handle: other?.handle ?? "",
      avatarUrl: other?.avatar_url ?? null,
      headline: other?.headline ?? null,
    },
    // Null when a learner asked without offering anything: the embedded row
    // is absent, which is different from a skill we failed to resolve.
    offeredSkill: raw.offered
      ? toSkillRef(Array.isArray(raw.offered) ? raw.offered[0] : raw.offered)
      : null,
    requestedSkill: toSkillRef(Array.isArray(raw.requested) ? raw.requested[0] : raw.requested),
    message: raw.message,
    proposedFormat: raw.proposed_format,
    state: raw.state,
    matchScore: raw.match_score === null ? null : Math.round(Number(raw.match_score)),
    responseNote: raw.response_note,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    direction,
  };
}

/** Every request the viewer is party to, newest first, both directions. */
export async function listRequests(profileId: string): Promise<SwapRequest[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("swap_requests")
    .select(REQUEST_SELECT)
    .or(`requester_id.eq.${profileId},recipient_id.eq.${profileId}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawRequest[]).map((r) => toRequest(r, profileId));
}

export interface SendRequestInput {
  recipientId: string;
  /** The skill you are offering to teach them. */
  /**
   * Null when there is nothing to trade back yet. The column dropped its NOT
   * NULL for exactly this case; the type had not caught up.
   */
  offeredSkillId: string | null;
  /** The skill you are asking them to teach you. */
  requestedSkillId: string;
  message?: string | null;
  proposedFormat?: LearningFormat;
  matchScore?: number | null;
}

export async function sendSwapRequest(profileId: string, input: SendRequestInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("swap_requests").insert({
    requester_id: profileId,
    recipient_id: input.recipientId,
    offered_skill_id: input.offeredSkillId,
    requested_skill_id: input.requestedSkillId,
    message: input.message ?? null,
    proposed_format: input.proposedFormat ?? "video",
    match_score: input.matchScore ?? null,
  });
  if (error)
    throw new Error(
      friendlyDuplicate(error.message, "You already have an open request for that swap."),
    );
}

/**
 * Accept a request.
 *
 * Delegates to `accept_swap_request`, which flips the request, creates the
 * `skill_swaps` row and notifies the requester in a single transaction — doing
 * those three writes from the client would risk leaving a half-accepted swap.
 */
export async function acceptSwapRequest(requestId: string, note?: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("accept_swap_request", {
    p_request: requestId,
    p_note: note ?? undefined,
  });
  if (error) throw new Error(error.message);
}

export async function declineSwapRequest(requestId: string, note?: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("swap_requests")
    .update({
      state: "declined",
      response_note: note ?? null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
}

export async function withdrawSwapRequest(requestId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("swap_requests")
    .update({ state: "withdrawn", responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
}

/* ── Active swaps ────────────────────────────────────────────────── */

/**
 * Swaps the viewer is in.
 *
 * The table stores the pair as `participant_a`/`participant_b` with a skill
 * column for each side, so which column is "yours" depends on which slot you
 * occupy. That is resolved here rather than in every component.
 */
export async function listSwaps(profileId: string): Promise<ActiveSwap[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("skill_swaps")
    .select(
      `id, participant_a, participant_b, state, format, sessions_planned,
       sessions_completed, started_at,
       skill_a:skills!skill_swaps_skill_a_teaches_fkey ( ${SKILL_SELECT} ),
       skill_b:skills!skill_swaps_skill_b_teaches_fkey ( ${SKILL_SELECT} ),
       profile_a:profiles!skill_swaps_participant_a_fkey ( id, display_name, handle, avatar_url, headline ),
       profile_b:profiles!skill_swaps_participant_b_fkey ( id, display_name, handle, avatar_url, headline )`,
    )
    .or(`participant_a.eq.${profileId},participant_b.eq.${profileId}`)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      participant_a: string;
      participant_b: string;
      state: SwapState;
      format: LearningFormat;
      sessions_planned: number;
      sessions_completed: number;
      started_at: string;
      skill_a: RawSkill | RawSkill[] | null;
      skill_b: RawSkill | RawSkill[] | null;
      profile_a: RawProfile | RawProfile[] | null;
      profile_b: RawProfile | RawProfile[] | null;
    }>
  ).map((row) => {
    const viewerIsA = row.participant_a === profileId;
    const partnerRaw = firstProfile(viewerIsA ? row.profile_b : row.profile_a);
    const mine = viewerIsA ? row.skill_a : row.skill_b;
    const theirs = viewerIsA ? row.skill_b : row.skill_a;
    return {
      id: row.id,
      partner: {
        id: partnerRaw?.id ?? "",
        displayName: partnerRaw?.display_name ?? "A member",
        handle: partnerRaw?.handle ?? "",
        avatarUrl: partnerRaw?.avatar_url ?? null,
      },
      youTeach: toSkillRef(Array.isArray(mine) ? mine[0] : mine),
      theyTeach: toSkillRef(Array.isArray(theirs) ? theirs[0] : theirs),
      state: row.state,
      format: row.format,
      sessionsPlanned: row.sessions_planned,
      sessionsCompleted: row.sessions_completed,
      startedAt: row.started_at,
    };
  });
}

/* ── Messaging bridge ────────────────────────────────────────────── */

/**
 * Id of the direct conversation with someone, creating it if needed.
 *
 * Used by the swap cards' "Message" action so a swap partner lands in the
 * existing Messages page rather than a second, SkillSwap-only inbox.
 */
export async function openConversationWith(otherProfileId: string): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("open_direct_conversation", {
    p_other: otherProfileId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

/* ── Skill Passport ──────────────────────────────────────────────── */

export interface PassportSkill {
  name: string;
  category: string;
  level: SkillLevel;
  verification: VerificationState;
  /** Verification score out of 100, as computed by the database. */
  score: number | null;
  years: number | null;
  evidenceCount: number;
}

export interface PassportSnapshot {
  profile: {
    displayName: string;
    handle: string;
    headline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    region: string | null;
  } | null;
  /** Skills the person teaches, with how far each has been verified. */
  skills: PassportSkill[];
  /** Learning goals. Not part of the snapshot, so read from wanted_skills. */
  learning: LearnSkill[];
  courses: Array<{ title: string; progress: number; completedAt: string | null }>;
  certificates: Array<{
    title: string;
    issuer: string | null;
    serial: string | null;
    issuedAt: string | null;
    revoked: boolean;
  }>;
  badges: Array<{ name: string; icon: string | null; description: string | null }>;
  stats: {
    xp: number;
    level: number;
    badgeCount: number;
    swapsCompleted: number;
    sessionsCompleted: number;
    reviews: number;
    /** Average rating out of 5, or null when nobody has reviewed yet. */
    rating: number | null;
    /** Reliability percentage. */
    reliability: number;
  };
  shareSlug: string | null;
  isPublic: boolean;
}

/**
 * The passport.
 *
 * `build_passport_snapshot` does the assembly server-side and returns one JSON
 * blob; its exact key names are the contract this function adapts. Three
 * things it deliberately leaves out are fetched alongside it: the learning
 * goals, the named badge list (the snapshot carries only a count) and the
 * share settings, which live on `skill_passports`.
 */
export async function getPassport(profileId: string): Promise<PassportSnapshot | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [{ data, error }, learning, badges, passportRow] = await Promise.all([
    supabase.rpc("build_passport_snapshot", { p_profile: profileId }),
    listLearnSkills(profileId).catch(() => [] as LearnSkill[]),
    supabase
      .from("user_badges")
      .select("badges ( name, icon, description )")
      .eq("profile_id", profileId)
      .then(({ data: rows }) =>
        (rows ?? []).map((r) => {
          const b = (r as { badges: unknown }).badges;
          const badge = (Array.isArray(b) ? b[0] : b) as {
            name?: string;
            icon?: string | null;
            description?: string | null;
          } | null;
          return {
            name: badge?.name ?? "Badge",
            icon: badge?.icon ?? null,
            description: badge?.description ?? null,
          };
        }),
      ),
    supabase
      .from("skill_passports")
      .select("share_slug, is_public")
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data: row }) => row),
  ]);

  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  // Postgres numerics arrive as strings over PostgREST, so coerce rather than
  // type-testing for `number`.
  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : fallback;
  };
  const maybeNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };

  const profileRaw = obj(raw["profile"]);
  const rewards = obj(raw["rewards"]);
  const reputation = obj(raw["reputation"]);

  return {
    profile: str(profileRaw["display_name"])
      ? {
          displayName: str(profileRaw["display_name"]) ?? "Member",
          handle: str(profileRaw["handle"]) ?? "",
          headline: str(profileRaw["headline"]),
          bio: str(profileRaw["bio"]),
          avatarUrl: str(profileRaw["avatar_url"]),
          region: str(profileRaw["region"]),
        }
      : null,
    skills: arr(raw["skills"]).map((s) => ({
      name: str(s["skill"]) ?? "Skill",
      category: str(s["category"]) ?? "General",
      level: (str(s["level"]) ?? "beginner") as SkillLevel,
      verification: (str(s["verification"]) ?? "self_declared") as VerificationState,
      score: maybeNum(s["score"]),
      years: maybeNum(s["years"]),
      evidenceCount: num(s["evidence_count"]),
    })),
    learning,
    courses: arr(raw["courses"]).map((c) => ({
      title: str(c["title"]) ?? "Course",
      progress: num(c["progress"]),
      completedAt: str(c["completed_at"]),
    })),
    certificates: arr(raw["certificates"]).map((c) => ({
      title: str(c["title"]) ?? "Certificate",
      issuer: issuerName(str(c["issuer"])),
      serial: str(c["serial"]),
      issuedAt: str(c["issued_at"]),
      revoked: c["revoked"] === true,
    })),
    badges,
    stats: {
      xp: num(rewards["xp"]),
      level: num(rewards["level"]),
      badgeCount: num(rewards["badges"]),
      swapsCompleted: num(reputation["swaps_completed"]),
      sessionsCompleted: num(reputation["sessions_completed"]),
      reviews: num(reputation["reviews"]),
      rating: maybeNum(reputation["rating"]),
      reliability: num(reputation["reliability"]),
    },
    shareSlug: passportRow?.share_slug ?? null,
    isPublic: passportRow?.is_public === true,
  };
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/**
 * Turn Postgres' unique-violation text into something a person can act on.
 * Anything else is passed through untouched — inventing friendly copy for an
 * error we haven't recognised only hides the real cause.
 */
function friendlyDuplicate(message: string, friendly: string): string {
  return /duplicate key|already exists|unique constraint/i.test(message) ? friendly : message;
}

/* ── Finding a trainer ───────────────────────────────────────────── */

/**
 * The two ways to learn, and what separates them.
 *
 * Basic is free and always will be: a peer or community trainer, chat, the
 * community's own resources. Advanced is paid because it buys somebody's
 * scheduled time — a verified professor or working professional, one to one,
 * on video, looking at your actual project.
 *
 * Kept here rather than in the page because the plan decides which trainers
 * are eligible, so the matcher and the interface have to agree on it.
 */
export type SwapPlan = "basic" | "advanced";

export interface PlanSpec {
  id: SwapPlan;
  name: string;
  price: string;
  blurb: string;
  includes: string[];
  /** Advanced requires a trainer who is expert-verified in the skill. */
  requiresMaster: boolean;
  /**
   * What you end up holding. Both plans issue one; they are deliberately
   * different documents, because they are different claims.
   */
  certificate: {
    name: string;
    what: string;
    /** True when it carries a public serial that anyone can check. */
    verifiable: boolean;
  };
}

export const SWAP_PLANS: PlanSpec[] = [
  {
    id: "basic",
    name: "Basic",
    price: "Free",
    blurb: "Learn from a certified peer or community trainer.",
    includes: [
      "Peer or community trainer",
      "Chat-based learning",
      "Community resources",
      "Basic courses",
      "Basic skill assessment",
      "Certificate of completion",
    ],
    certificate: {
      name: "Certificate of completion",
      what: "Your trainer confirms you finished the training. It appears on your Skill Passport and shows who taught you.",
      verifiable: false,
    },
    requiresMaster: false,
  },
  {
    id: "advanced",
    name: "Advanced",
    price: "Paid",
    blurb: "One to one with a verified professor or industry professional.",
    includes: [
      "Verified college professor",
      "Industry professional",
      "1-to-1 mentorship",
      "Live video sessions",
      "Project guidance",
      "Advanced assessment",
      "Verified certificate",
    ],
    certificate: {
      name: "Verified certificate",
      what: "Issued after a graded assessment supervised by a verified professional. It carries a serial anyone can check, and it counts toward being certified to teach the skill yourself.",
      verifiable: true,
    },
    requiresMaster: true,
  },
];

/** A certified trainer, ranked for one learner and one skill. */
export interface TrainerMatch {
  trainerId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  headline: string | null;
  skillId: string;
  skillName: string;
  score: number;
  /** Expert-verified in this skill — the Advanced tier requires it. */
  isMaster: boolean;
  /** They also want something you can teach: a free swap is possible. */
  isMutual: boolean;
  trainingsCompleted: number;
  reliability: number;
  sharesLanguage: boolean;
}

/**
 * Who can teach me this.
 *
 * A different question from `findMatches`, which looks for a mirror trade.
 * This one is one-way: the learner may have nothing to offer, and the ranking
 * is about the trainer's record rather than the fit between two wish-lists.
 */
export async function findTrainers(
  profileId: string,
  skillId: string | null,
  plan: SwapPlan = "basic",
  limit = 20,
): Promise<TrainerMatch[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("find_trainers", {
    p_profile: profileId,
    p_skill: skillId ?? undefined,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    trainer_id: string;
    skill_id: string;
    score: number;
    is_master: boolean;
    is_mutual: boolean;
    breakdown: Record<string, unknown> | null;
  }>;
  if (rows.length === 0) return [];

  // The function ranks; the names and skills come from the tables the row
  // ids point at, so nothing here duplicates profile data.
  const [profiles, skills] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url, headline")
      .in("id", [...new Set(rows.map((r) => r.trainer_id))]),
    supabase
      .from("skills")
      .select("id, name")
      .in("id", [...new Set(rows.map((r) => r.skill_id))]),
  ]);

  const byProfile = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const bySkill = new Map((skills.data ?? []).map((sk) => [sk.id, sk.name]));

  return (
    rows
      // Advanced buys a master's time; offering it a merely-verified trainer
      // would be selling something different from what the plan describes.
      .filter((r) => (plan === "advanced" ? r.is_master : true))
      .map((r) => {
        const p = byProfile.get(r.trainer_id);
        const b = r.breakdown ?? {};
        return {
          trainerId: r.trainer_id,
          displayName: p?.display_name ?? "Trainer",
          handle: p?.handle ?? null,
          avatarUrl: p?.avatar_url ?? null,
          headline: p?.headline ?? null,
          skillId: r.skill_id,
          skillName: bySkill.get(r.skill_id) ?? "Skill",
          score: Number(r.score ?? 0),
          isMaster: r.is_master,
          isMutual: r.is_mutual,
          trainingsCompleted: Number(b["trainings_completed"] ?? 0),
          reliability: Number(b["reliability"] ?? 0),
          sharesLanguage: b["shares_language"] === true,
        };
      })
  );
}

/**
 * Ask a certified trainer to teach you.
 *
 * `offeredSkillId` is optional now: a beginner with nothing to trade is the
 * normal case in the certified model, and the database allows the column to
 * be null for exactly that reason.
 */
export async function requestTraining(
  profileId: string,
  input: {
    trainerId: string;
    skillId: string;
    offeredSkillId?: string | null;
    format: LearningFormat;
    message?: string;
  },
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("swap_requests").insert({
    requester_id: profileId,
    recipient_id: input.trainerId,
    requested_skill_id: input.skillId,
    offered_skill_id: input.offeredSkillId ?? null,
    proposed_format: input.format,
    message: input.message ?? null,
    expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
  });
  // The gate lives in validate_swap_request(), so an uncertified trainer is
  // refused here rather than silently accepted.
  if (error) {
    // One open request per trainer per skill, enforced by a partial unique
    // index. Without this the raw "duplicate key value violates unique
    // constraint" reached the screen, which tells somebody nothing about what
    // they did or what to do next.
    if (/swap_requests_one_pending|duplicate key/i.test(error.message)) {
      throw new Error("You have already asked this trainer for this skill. Wait for their reply.");
    }
    throw new Error(error.message);
  }
}

/* ── Sessions ────────────────────────────────────────────────────── */

/**
 * The sessions this person is party to, either side of the table.
 *
 * `hosting` is what a trainer has to turn up and run; `attending` is what a
 * learner is waiting for. The same row, read from two directions, which is
 * why the two dashboards can share one query.
 */
export interface SwapSession {
  id: string;
  swapId: string | null;
  title: string;
  skill: string;
  /** True when the signed-in person is the trainer for this session. */
  hosting: boolean;
  counterpartId: string;
  counterpartName: string;
  state: string;
  scheduledStart: string | null;
  durationMinutes: number;
  /** The video room. Derived from the swap, so both sides compute the same one. */
  roomId: string | null;
  /**
   * How this session actually happens — chosen when the request was sent.
   *
   * A "chat" session is not a video call, and offering a Jitsi link for one is
   * simply the wrong action. The column was always there; nothing read it.
   */
  format: LearningFormat;
}

export async function listMySessions(profileId: string): Promise<SwapSession[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, swap_id, title, state, scheduled_start, duration_minutes, room_id, format, host_id, guest_id, skills ( name ), host:profiles!sessions_host_id_fkey ( id, display_name ), guest:profiles!sessions_guest_id_fkey ( id, display_name )",
    )
    .or(`host_id.eq.${profileId},guest_id.eq.${profileId}`)
    .order("scheduled_start");
  if (error) throw new Error(error.message);

  const one = <T>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null;

  return (data ?? []).map((row) => {
    const hosting = row.host_id === profileId;
    const other = one<{ id: string; display_name: string }>(
      hosting ? (row as { guest: unknown }).guest : (row as { host: unknown }).host,
    );
    const sk = one<{ name: string }>((row as { skills: unknown }).skills);
    return {
      id: row.id,
      swapId: row.swap_id,
      title: row.title,
      skill: sk?.name ?? "Skill",
      hosting,
      counterpartId: other?.id ?? "",
      counterpartName: other?.display_name ?? "Member",
      state: row.state,
      scheduledStart: row.scheduled_start,
      durationMinutes: row.duration_minutes,
      roomId: row.room_id,
      format: (row.format ?? "video") as LearningFormat,
    };
  });
}

/** Move a session along: scheduled -> live -> completed. */
export async function setSessionState(
  sessionId: string,
  state: "live" | "completed" | "cancelled",
): Promise<void> {
  const supabase = requireSupabase();

  /*
   * Completing goes through the function, not the table.
   *
   * Writing `state = 'completed'` straight to the row looks equivalent and is
   * not: `complete_session()` also increments the swap's session count,
   * closes the swap when the last session lands, and lets the points and
   * reputation triggers fire off that. The direct update skipped every one of
   * those, so a training could be finished in the UI and the learner would be
   * awarded nothing, with the swap stuck open forever.
   */
  if (state === "completed") {
    const { error } = await supabase.rpc("complete_session", { p_session: sessionId });
    if (error) throw new Error(error.message);
    return;
  }

  const patch: { state: typeof state; started_at?: string; ended_at?: string } = { state };
  if (state === "live") patch.started_at = new Date().toISOString();

  const { error } = await supabase.from("sessions").update(patch).eq("id", sessionId);
  if (error) throw new Error(error.message);
}

/**
 * Agree a time for a session.
 *
 * Either side can move it. There is one `scheduled_start` on the row, so both
 * people are looking at the same instant — each browser renders it in its own
 * timezone, which is what stops "3pm" meaning two different things.
 */
export async function rescheduleSession(
  sessionId: string,
  startsAt: Date,
  durationMinutes?: number,
): Promise<void> {
  const supabase = requireSupabase();

  if (startsAt.getTime() < Date.now() - 60_000) {
    throw new Error("Pick a time in the future.");
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      scheduled_start: startsAt.toISOString(),
      ...(durationMinutes ? { duration_minutes: durationMinutes } : {}),
      state: "scheduled",
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

/**
 * Watch every session this person is party to, live.
 *
 * Without this the two sides drift: the trainer presses Start, and the learner
 * sits looking at a "Scheduled" row until they think to reload. `sessions` is
 * published to realtime with FULL replica identity, so the change arrives as a
 * whole row and the list can simply re-fetch.
 *
 * The subscription is deliberately unfiltered — a filter on host_id would miss
 * the sessions where this person is the guest, and Postgres changes only carry
 * one filter. The callback is cheap; correctness matters more here.
 */
export function watchMySessions(onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel("my-sessions")
    .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
