import { getSupabase, requireSupabase } from "./supabase";
import type { Database } from "../types/database";

/**
 * The social half of the platform: following people, and the community feed.
 *
 * Both of these existed as furniture. The Community page kept a hand-written
 * array of posts in React state — publishing appended to it, refreshing threw
 * it away, and nobody else ever saw a word of it. Follow was a boolean in the
 * same component: the button changed colour and meant nothing.
 *
 * Every table used here already existed (`posts`, `comments`, `votes`,
 * `communities`, `community_members`, `follows`), which is what makes this a
 * rewrite of the client rather than a schema change. The rule throughout is
 * that nothing is rendered from a constant: an empty feed shows an empty feed.
 */

export type PostKind = Database["public"]["Enums"]["post_kind"];

export const POST_KINDS: PostKind[] = [
  "discussion",
  "question",
  "resource",
  "showcase",
  "challenge",
];

export const POST_KIND_LABEL: Record<PostKind, string> = {
  discussion: "Discussion",
  question: "Question",
  resource: "Resource",
  showcase: "Showcase",
  challenge: "Challenge",
};

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  memberCount: number;
  postCount: number;
}

export interface FeedAuthor {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  headline: string | null;
  /**
   * What kind of account this is, carried to the screen rather than left in
   * the database. A sample account that looks identical to a real member is
   * the whole problem with sample accounts, and `is_demo` was previously
   * visible only in the admin list.
   */
  isDemo: boolean;
  isAi: boolean;
}

export interface FeedPost {
  id: string;
  kind: PostKind;
  title: string;
  body: string | null;
  tags: string[];
  score: number;
  commentCount: number;
  createdAt: string;
  isPinned: boolean;
  community: { id: string; name: string; slug: string } | null;
  author: FeedAuthor | null;
  /** This member's vote: 1, -1 or 0. Filled in by `listFeed`. */
  myVote: number;
}

export interface FeedComment {
  id: string;
  body: string;
  createdAt: string;
  score: number;
  parentId: string | null;
  author: FeedAuthor | null;
}

/* ── Shapes coming back from PostgREST ───────────────────────────── */

interface ProfileRow {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  headline: string | null;
  is_demo?: boolean;
  is_ai?: boolean;
}

/** PostgREST returns an embedded to-one as an object, or null. */
function toAuthor(row: ProfileRow | null | undefined): FeedAuthor | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    headline: row.headline,
    isDemo: row.is_demo === true,
    isAi: row.is_ai === true,
  };
}

/* ── Communities ─────────────────────────────────────────────────── */

export async function listCommunities(): Promise<Community[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("communities")
    .select("id, slug, name, description, icon, member_count, post_count")
    .eq("is_public", true)
    .order("member_count", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    icon: c.icon,
    memberCount: Number(c.member_count ?? 0),
    postCount: Number(c.post_count ?? 0),
  }));
}

export async function listMyCommunityIds(profileId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.community_id);
}

export async function joinCommunity(communityId: string, profileId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("community_members")
    .upsert(
      { community_id: communityId, profile_id: profileId, role: "member" },
      { onConflict: "community_id,profile_id" },
    );
  if (error) throw new Error(error.message);
}

export async function leaveCommunity(communityId: string, profileId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);
}

/* ── The feed ────────────────────────────────────────────────────── */

export interface FeedOptions {
  communityId?: string;
  kind?: PostKind;
  /** Only posts by people this member follows. */
  followingOnly?: boolean;
  profileId?: string;
  limit?: number;
}

export async function listFeed(options: FeedOptions = {}): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const limit = options.limit ?? 30;

  let authorIds: string[] | null = null;
  if (options.followingOnly && options.profileId) {
    authorIds = await listFollowingIds(options.profileId);
    // Following nobody is a real, empty answer — not a reason to show
    // everybody's posts instead.
    if (authorIds.length === 0) return [];
  }

  let query = supabase
    .from("posts")
    .select(
      "id, kind, title, body, tags, score, comment_count, created_at, is_pinned, " +
        "communities:community_id (id, name, slug), " +
        "profiles:author_id (id, display_name, handle, avatar_url, headline, is_demo, is_ai)",
    )
    .is("hidden_at", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.communityId) query = query.eq("community_id", options.communityId);
  if (options.kind) query = query.eq("kind", options.kind);
  if (authorIds) query = query.in("author_id", authorIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    kind: PostKind;
    title: string;
    body: string | null;
    tags: string[] | null;
    score: number | null;
    comment_count: number | null;
    created_at: string;
    is_pinned: boolean;
    communities: { id: string; name: string; slug: string } | null;
    profiles: ProfileRow | null;
  }>;

  const posts: FeedPost[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    tags: r.tags ?? [],
    score: Number(r.score ?? 0),
    commentCount: Number(r.comment_count ?? 0),
    createdAt: r.created_at,
    isPinned: r.is_pinned,
    community: r.communities,
    author: toAuthor(r.profiles),
    myVote: 0,
  }));

  // One extra round trip rather than one per card: the arrow has to be lit
  // from the first paint or people vote twice.
  if (options.profileId && posts.length > 0) {
    const votes = await myVotes(
      options.profileId,
      "post",
      posts.map((p) => p.id),
    );
    for (const p of posts) p.myVote = votes[p.id] ?? 0;
  }

  return posts;
}

export async function createPost(input: {
  communityId: string;
  title: string;
  body?: string;
  kind?: PostKind;
  tags?: string[];
  skillId?: string | null;
}): Promise<string> {
  const supabase = requireSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const authorId = auth.user?.id;
  if (!authorId) throw new Error("Sign in to post.");

  const { data, error } = await supabase
    .from("posts")
    .insert({
      community_id: input.communityId,
      author_id: authorId,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      kind: input.kind ?? "discussion",
      tags: input.tags ?? [],
      skill_id: input.skillId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Ask Sarthi to answer a question that was just posted.
 *
 * Fire and forget on purpose. The post is already saved before this runs, so
 * a slow model or an exhausted quota must never make posting look like it
 * failed. The server decides whether to answer at all — it skips showcases,
 * skips its own posts, and refuses to answer the same question twice — and it
 * writes the reply itself, because a reply whose text came from the browser
 * would let anybody put words in Sarthi's mouth.
 */
export type SarthiOutcome = "posted" | "private" | "skipped" | "unavailable";

export interface SarthiReply {
  outcome: SarthiOutcome;
  /** Present when the answer was produced but could not be posted publicly. */
  answer?: string;
}

export async function requestSarthiReply(postId: string): Promise<SarthiReply> {
  try {
    const res = await fetch("/api/community-reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    /*
     * Three outcomes, not two.
     *
     * This returned a bare boolean, so "Sarthi chose not to answer a
     * showcase" and "Sarthi cannot answer anything because the account is
     * not configured" were the same value — false — and the page treated
     * both as normal silence. The result was a question sitting at zero
     * replies with nothing anywhere saying why, which is indistinguishable
     * from the feature not existing.
     */
    if (res.status === 503) return { outcome: "unavailable" };
    if (!res.ok) return { outcome: "skipped" };
    const out = (await res.json()) as { ok?: boolean; answer?: string };
    if (out.ok === true) return { outcome: "posted" };
    /* An answer with nowhere public to go. The page shows it to the asker. */
    if (out.answer) return { outcome: "private", answer: out.answer };
    return { outcome: "skipped" };
  } catch {
    return { outcome: "unavailable" };
  }
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);
}

/* ── Comments ────────────────────────────────────────────────────── */

export async function listComments(postId: string): Promise<FeedComment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, body, created_at, score, parent_id, " +
        "profiles:author_id (id, display_name, handle, avatar_url, headline, is_demo, is_ai)",
    )
    .eq("post_id", postId)
    .is("hidden_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      body: string;
      created_at: string;
      score: number | null;
      parent_id: string | null;
      profiles: ProfileRow | null;
    }>
  ).map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.created_at,
    score: Number(c.score ?? 0),
    parentId: c.parent_id,
    author: toAuthor(c.profiles),
  }));
}

export async function addComment(
  postId: string,
  body: string,
  parentId?: string | null,
): Promise<void> {
  const supabase = requireSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const authorId = auth.user?.id;
  if (!authorId) throw new Error("Sign in to reply.");

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: authorId,
    body: body.trim(),
    parent_id: parentId ?? null,
  });
  if (error) throw new Error(error.message);
}

/* ── Votes ───────────────────────────────────────────────────────── */

type VoteTarget = Database["public"]["Enums"]["vote_target"];

export async function myVotes(
  profileId: string,
  kind: VoteTarget,
  targetIds: string[],
): Promise<Record<string, number>> {
  const supabase = getSupabase();
  if (!supabase || targetIds.length === 0) return {};

  const { data, error } = await supabase
    .from("votes")
    .select("target_id, value")
    .eq("profile_id", profileId)
    .eq("target_kind", kind)
    .in("target_id", targetIds);
  if (error) throw new Error(error.message);

  const map: Record<string, number> = {};
  for (const v of data ?? []) map[v.target_id] = Number(v.value ?? 0);
  return map;
}

/**
 * Cast, change or take back a vote.
 *
 * Voting the same way twice is a retraction, which is what every site with a
 * vote arrow does and what people expect from a button that stays lit.
 */
export async function vote(
  profileId: string,
  kind: VoteTarget,
  targetId: string,
  value: 1 | -1,
  current: number,
): Promise<number> {
  const supabase = requireSupabase();

  if (current === value) {
    const { error } = await supabase
      .from("votes")
      .delete()
      .eq("profile_id", profileId)
      .eq("target_kind", kind)
      .eq("target_id", targetId);
    if (error) throw new Error(error.message);
    return 0;
  }

  const { error } = await supabase
    .from("votes")
    .upsert(
      { profile_id: profileId, target_kind: kind, target_id: targetId, value },
      { onConflict: "profile_id,target_kind,target_id" },
    );
  if (error) throw new Error(error.message);
  return value;
}

/* ── Following ───────────────────────────────────────────────────── */

export async function listFollowingIds(profileId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    // Accepted only. A pending request is not a follow, and the feed's
    // "Following" mode reads this list — an unaccepted request must not
    // become a way to read somebody's posts.
    .eq("state", "accepted")
    .eq("follower_id", profileId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.following_id);
}

export interface PersonCard extends FeedAuthor {
  region: string | null;
}

/** People to follow: real profiles, minus this member and anyone already followed. */
export async function suggestedPeople(profileId: string, limit = 6): Promise<PersonCard[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const already = await listFollowingIds(profileId);
  const exclude = [...already, profileId];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_url, headline, region, is_demo, is_ai")
    .not("id", "in", `(${exclude.join(",")})`)
    .order("last_active_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    handle: p.handle,
    avatarUrl: p.avatar_url,
    headline: p.headline,
    region: p.region,
    isDemo: p.is_demo === true,
    isAi: p.is_ai === true,
  }));
}

/**
 * Live feed updates.
 *
 * Posts and comments both move the feed, so one channel watches both rather
 * than making every page open two.
 */
export function watchFeed(onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel("community-feed")
    .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
