import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowBigDown,
  ArrowBigUp,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import PillTabs from "../components/PillTabs";
import { TabsHint, useTabPlan } from "@/evolution/react/use-tab-plan";
import FollowButton from "../components/FollowButton";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { initialsAvatar } from "../lib/avatar";
import AccountBadge from "../components/AccountBadge";
import {
  addComment,
  createPost,
  joinCommunity,
  leaveCommunity,
  listComments,
  listCommunities,
  listFeed,
  listMyCommunityIds,
  suggestedPeople,
  vote,
  watchFeed,
  POST_KINDS,
  POST_KIND_LABEL,
  type FeedPost,
  type PostKind,
  deletePost,
  requestSarthiReply,
} from "../lib/social";
import { useToast } from "../components/Toast";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";
import { entityId } from "@/evolution/runtime/tracker/track";
import { getMemberMetrics, getProfileDetail } from "../lib/profile-data";

/**
 * The community feed.
 *
 * What was here before was a hand-written array of five posts kept in React
 * state. Writing a post pushed onto that array; reloading the page threw it
 * away; nobody else could ever see it. Likes, saves and follows were the same
 * shape of nothing — booleans in a record, reset on every visit.
 *
 * This reads and writes the real `posts`, `comments`, `votes` and
 * `communities` tables, updates live as other people post, and shows an empty
 * feed when the feed is empty rather than filling it with invented activity.
 */

type Scope = "all" | "following";
const SCOPES: readonly Scope[] = ["all", "following"];

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Community() {
  const tx = useTx();
  const qc = useQueryClient();
  const { user, profileId } = useAuth();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;

  const scopePlan = useTabPlan("community", SCOPES);
  const [pickedScope, setPickedScope] = useState<Scope | null>(null);
  const scope: Scope = pickedScope ?? scopePlan.defaultId;
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const communities = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  // Picking a group is opening a community; the entity is the group's public slug.
  const pickCommunity = (id: string | null) => {
    if (id) {
      const slug = (communities.data ?? []).find((c) => c.id === id)?.slug;
      track(EV.COMMUNITY_OPENED, {}, { entityId: entityId("com", slug) });
    }
    setCommunityId(id);
  };

  const feed = useQuery({
    queryKey: ["feed", scope, communityId, profileId],
    queryFn: () =>
      listFeed({
        communityId: communityId ?? undefined,
        followingOnly: scope === "following",
        profileId: profileId ?? undefined,
      }),
  });

  const mine = useQuery({
    queryKey: ["my-communities", profileId],
    queryFn: () => listMyCommunityIds(profileId!),
    enabled: Boolean(profileId),
  });

  const people = useQuery({
    queryKey: ["suggested-people", profileId],
    queryFn: () => suggestedPeople(profileId!, 5),
    enabled: Boolean(profileId),
  });

  // Somebody else's post should appear without a reload — that is the whole
  // difference between a feed and a page.
  useEffect(() => {
    return watchFeed(() => void qc.invalidateQueries({ queryKey: ["feed"] }));
  }, [qc]);

  const posts = feed.data ?? [];
  const myCommunities = useMemo(() => new Set(mine.data ?? []), [mine.data]);

  return (
    <div className="container-x max-w-[76rem] pb-24 pt-24">
      {/* The title exists for screen readers and the document outline. On
          screen it would only tell a reader what they already knew by
          arriving, and cost them the first post to say it. */}
      <h1 className="absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]">
        {tx("Community")}
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        {/* ── Who you are ─────────────────────────────────────── */}
        <aside aria-label="Your profile" className="hidden lg:block">
          <div className="sticky top-28">
            <IdentityRail />
          </div>
        </aside>

        {/* ── Feed column ─────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Posting is the point of the page, so it sits at the top of it
              and costs one click. Collapsed it is a line; expanded it is
              the full composer. */}
          {profileId && !composing && (
            <div className="card liquid mb-5 flex items-center gap-3 p-3">
              <img
                src={user?.avatar || initialsAvatar(user?.name ?? "")}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
              <button
                onClick={() => setComposing(true)}
                className="min-w-0 flex-1 rounded-[var(--radius-pill)] border border-ink-line px-4 py-2.5 text-left font-body text-[13px] text-ink-mute transition-colors hover:border-saffron-500/60 hover:text-ink-soft"
              >
                {tx("Ask a question, or show what you built")}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <PillTabs
              tabs={scopePlan.order.map((id) => ({
                id,
                label: id === "all" ? tx("Everything") : tx("People you follow"),
              }))}
              selected={scope}
              onSelect={(s) => {
                setPickedScope(s as Scope);
                scopePlan.onSelect(s as Scope);
              }}
              layoutGroup="community-scope"
              ariaLabel={tx("Filter the feed")}
            />
            {scopePlan.arranged && <TabsHint />}
          </div>

          {communityId && (
            <button
              onClick={() => setCommunityId(null)}
              className="mt-4 font-body text-[12px] text-ink-mute underline underline-offset-4 hover:text-saffron-600"
            >
              {tx("Clear this group filter")}
            </button>
          )}

          <AnimatePresence>
            {composing && profileId && (
              <motion.div
                initial={still ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={still ? undefined : { opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Composer
                  communities={communities.data ?? []}
                  defaultCommunityId={communityId}
                  onDone={() => {
                    setComposing(false);
                    void qc.invalidateQueries({ queryKey: ["feed"] });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {feed.isLoading ? (
            <p className="mt-10 font-body text-sm text-ink-mute">{tx("Loading the feed…")}</p>
          ) : feed.isError ? (
            <p className="mt-10 font-body text-sm text-danger">{(feed.error as Error).message}</p>
          ) : posts.length === 0 ? (
            <div className="card mt-6 p-10 text-center">
              <Users size={24} className="mx-auto text-ink-mute" aria-hidden />
              <p className="mt-4 font-display text-lg tracking-tight text-ink">
                {scope === "following" ? tx("Nothing from your circle yet") : tx("No posts yet")}
              </p>
              <p className="mx-auto mt-2 max-w-sm font-body text-sm text-ink-soft">
                {scope === "following"
                  ? tx("Follow a few people and their questions and work will show up here.")
                  : tx("Be the first. A half-finished project and a real question both count.")}
              </p>
              {profileId && scope === "all" && (
                <button onClick={() => setComposing(true)} className="btn-primary mt-6 !py-2.5">
                  <Plus size={15} aria-hidden /> {tx("Write the first post")}
                </button>
              )}
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {posts.map((p, i) => (
                <motion.li
                  key={p.id}
                  initial={still ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: still ? 0 : 0.3,
                    delay: still ? 0 : Math.min(i, 8) * 0.03,
                  }}
                >
                  <PostCard post={p} onFilterCommunity={pickCommunity} />
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Rail ────────────────────────────────────────────── */}
        {/*
          Not sticky.

          It was `lg:sticky lg:top-28`, and the list of groups is 724px tall
          in a 698px viewport. A sticky column taller than the window pins at
          the top and never moves, so its last few rows sit below the fold
          permanently — you cannot scroll to them, because the thing that
          would scroll them is stuck. It also reads as though the page is
          frozen and only the middle column is moving, which is the opposite
          of what is happening.

          Sticky is for a column that fits: the profile card above is 205px
          and stays. A list that grows with the number of groups is not that,
          so it scrolls with the page like everything else.
        */}
        <aside aria-label="Groups" className="space-y-5">
          <section className="card liquid p-5">
            <p className="datum">{tx("Groups")}</p>
            {communities.isLoading ? (
              <p className="mt-3 font-body text-[13px] text-ink-mute">{tx("Loading…")}</p>
            ) : (communities.data ?? []).length === 0 ? (
              <p className="mt-3 font-body text-[13px] text-ink-mute">
                {tx("No groups have been created yet.")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {(communities.data ?? []).map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <button
                      onClick={() => pickCommunity(c.id === communityId ? null : c.id)}
                      className={`min-w-0 flex-1 text-left font-body text-[13px] transition-colors ${
                        c.id === communityId
                          ? "font-semibold text-saffron-600"
                          : "text-ink-soft hover:text-saffron-600"
                      }`}
                    >
                      <span className="block truncate">{c.name}</span>
                      <span className="block font-mono text-[10px] text-ink-mute">
                        {c.memberCount} {c.memberCount === 1 ? tx("member") : tx("members")}
                      </span>
                    </button>
                    {profileId && (
                      <JoinButton
                        communityId={c.id}
                        joined={myCommunities.has(c.id)}
                        profileId={profileId}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {profileId ? (
            <section className="card liquid p-5">
              <p className="datum">{tx("People to follow")}</p>
              {people.isLoading ? (
                <p className="mt-3 font-body text-[13px] text-ink-mute">{tx("Loading…")}</p>
              ) : (people.data ?? []).length === 0 ? (
                <p className="mt-3 font-body text-[13px] text-ink-mute">
                  {tx("Nobody new to suggest right now.")}
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {(people.data ?? []).map((p) => (
                    <li key={p.id} className="flex items-center gap-2.5">
                      <img
                        src={p.avatarUrl || initialsAvatar(p.name)}
                        alt=""
                        loading="lazy"
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <Link
                        to="/u/$handle"
                        params={{ handle: p.handle }}
                        className="min-w-0 flex-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-body text-[13px] font-medium text-ink">
                            {p.name}
                          </span>
                          <AccountBadge isDemo={p.isDemo} isAi={p.isAi} />
                        </span>
                        <span className="block truncate font-body text-[11px] text-ink-mute">
                          {p.headline || `@${p.handle}`}
                        </span>
                      </Link>
                      <FollowButton targetId={p.id} handle={p.handle} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section className="card liquid p-5">
              <p className="font-body text-[13px] text-ink-soft">
                {tx("Sign in to post, reply and follow people.")}
              </p>
              <Link
                to="/auth"
                search={{ mode: "login" }}
                className="btn-primary mt-4 w-full justify-center !py-2.5 !text-xs"
              >
                {tx("Sign in")}
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Identity rail ───────────────────────────────────────────────── */

/**
 * Who you are, beside what everyone else is doing.
 *
 * A feed with no sense of the reader in it is just a list. The point of this
 * column is not decoration: it is the one place on the page that answers
 * "what have I actually done here", which is the question that makes someone
 * feel entitled to answer a stranger's question.
 *
 * Everything in it is real — the counts come from the same tables the
 * passport reads. Signed out, it says what signing in would get you and
 * nothing more.
 */
function IdentityRail() {
  const tx = useTx();
  const { user, profileId } = useAuth();

  const detail = useQuery({
    queryKey: ["profile-detail", profileId],
    queryFn: () => getProfileDetail(profileId!),
    enabled: Boolean(profileId),
  });

  const metrics = useQuery({
    queryKey: ["member-metrics", profileId],
    queryFn: () => getMemberMetrics(profileId!),
    enabled: Boolean(profileId),
  });

  if (!profileId || !user) {
    return (
      <section className="card liquid p-5">
        <p className="font-display text-lg leading-tight tracking-tight text-ink">
          {tx("Answering is how most people here got good.")}
        </p>
        <p className="mt-2 font-body text-[13px] text-ink-soft">
          {tx("Ask a question, show what you built, or answer somebody one step behind you.")}
        </p>
        <Link
          to="/auth"
          search={{ mode: "signup", next: "/community" }}
          className="btn-primary mt-4 !py-2 !text-xs"
        >
          {tx("Ask your first question")}
        </Link>
      </section>
    );
  }

  const m = metrics.data;
  const handle = detail.data?.handle;

  return (
    <section className="card liquid overflow-hidden">
      {/* A band of the register's own colour, so the card has a top rather
          than just an edge. */}
      <div className="h-14 bg-gradient-to-r from-saffron-500/30 via-saffron-500/10 to-peacock/20" />

      <div className="-mt-7 px-5 pb-5">
        <img
          src={user.avatar || initialsAvatar(user.name)}
          alt=""
          className="h-14 w-14 rounded-full border-2 border-paper-light object-cover"
        />
        <p className="mt-2.5 truncate font-display text-[15px] font-semibold tracking-tight text-ink">
          {user.name}
        </p>
        {handle && <p className="truncate font-mono text-[11px] text-ink-mute">@{handle}</p>}
        {detail.data?.headline && (
          <p className="mt-1.5 font-body text-[12px] leading-snug text-ink-soft">
            {detail.data.headline}
          </p>
        )}

        {m && (
          <dl className="mt-4 space-y-1.5 border-t border-ink-line pt-3.5">
            {[
              { k: tx("XP"), v: m.xp },
              { k: tx("Certificates"), v: m.certificates },
              { k: tx("Skills verified"), v: m.skillsVerified },
            ].map((row) => (
              <div key={row.k} className="flex items-baseline justify-between gap-2">
                <dt className="font-body text-[12px] text-ink-mute">{row.k}</dt>
                <dd className="font-mono text-[13px] font-semibold tabular-nums text-ink">
                  {row.v}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-4 space-y-1 border-t border-ink-line pt-3.5">
          <Link
            to="/passport"
            className="block font-body text-[12px] font-medium text-ink-soft transition-colors hover:text-saffron-600"
          >
            {tx("Your Skill Passport")}
          </Link>
          <Link
            to="/my-learning"
            className="block font-body text-[12px] font-medium text-ink-soft transition-colors hover:text-saffron-600"
          >
            {tx("Your courses")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Composer ────────────────────────────────────────────────────── */

function Composer({
  communities,
  defaultCommunityId,
  onDone,
}: {
  communities: { id: string; name: string }[];
  defaultCommunityId: string | null;
  onDone: () => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<PostKind>("discussion");
  const [where, setWhere] = useState(defaultCommunityId ?? communities[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  /* Not an error — the post went up. See the Sarthi branch in onSuccess. */
  const [notice, setNotice] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: () => createPost({ communityId: where, title, body, kind }),
    onSuccess: (postId) => {
      track(EV.COMMUNITY_POST_CREATED, {}, { entityId: entityId("pst", postId) });
      setTitle("");
      setBody("");
      onDone();
      /*
       * A question posted into an empty room and answered by nobody is how a
       * community dies. Sarthi answers within a few seconds, and the refetch
       * brings the reply in.
       *
       * Not awaited: the post is already saved, and making the poster wait on
       * a model call would turn a working action into one that feels broken.
       * The server declines politely when it should — a showcase does not want
       * a bot, and a question already answered does not get a second one.
       */
      if (postId) {
        void requestSarthiReply(postId).then(({ outcome }) => {
          if (outcome === "posted") {
            void qc.invalidateQueries({ queryKey: ["feed"] });
          } else if (outcome === "unavailable") {
            /*
             * Said once, to the person who just posted, and only when the
             * assistant is switched off rather than merely declining. The
             * post is up either way — this is about not leaving somebody
             * waiting for an answer that was never coming.
             */
            setNotice("Posted. Sarthi is not answering right now, but members can still reply.");
          }
        });
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  if (communities.length === 0) {
    return (
      <div className="card mt-4 p-5">
        <p className="font-body text-[13px] text-ink-mute">
          {tx("There are no groups to post into yet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="card mt-4 p-5">
      <label className="block">
        <span className="datum">{tx("What is this about?")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tx("One line — the thing you actually want to say")}
          className="input mt-1.5"
          maxLength={160}
        />
      </label>

      <label className="mt-3 block">
        <span className="datum">{tx("Detail")}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={tx("Optional. What you tried, what happened, what you are stuck on.")}
          className="input mt-1.5 resize-none !text-[13px]"
        />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="datum">{tx("Group")}</span>
          <select
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            className="input mt-1.5 !py-2 !text-[13px]"
          >
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="datum">{tx("Kind")}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PostKind)}
            className="input mt-1.5 !py-2 !text-[13px]"
          >
            {POST_KINDS.map((k) => (
              <option key={k} value={k}>
                {POST_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 font-body text-[12px] text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 font-body text-[12px] text-ink-mute">
          {tx(notice)}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => publish.mutate()}
          disabled={!title.trim() || !where || publish.isPending}
          className="btn-primary !py-2.5 !text-xs disabled:opacity-50"
        >
          {publish.isPending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Send size={14} aria-hidden />
          )}
          {tx("Post")}
        </button>
        <button onClick={onDone} className="btn-ghost !py-2.5 !text-xs">
          {tx("Cancel")}
        </button>
      </div>
    </div>
  );
}

/*
 * Take your own post down.
 *
 * `deletePost` has been in social.ts all along, and nothing ever called it:
 * you could write into the community and then never remove what you wrote.
 * For a platform whose members are asked to post about being out of work,
 * that is not a missing nicety — a person must be able to withdraw something
 * they regret saying in public.
 *
 * Two taps rather than a browser confirm(): the native dialog cannot be
 * styled, reads badly on a phone, and is the one control on the page that
 * does not look like this product.
 */
function DeletePostButton({ postId }: { postId: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const [asking, setAsking] = useState(false);

  const remove = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] });
      toast({ tone: "ok", title: tx("Post deleted") });
    },
    onError: (err: Error) =>
      toast({ tone: "bad", title: tx("Could not delete it"), body: err.message }),
  });

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="shrink-0 rounded-[var(--radius-control)] px-2.5 py-1.5 font-body text-[12px] font-semibold text-ink-mute transition-colors hover:bg-paper-dim hover:text-danger"
      >
        {tx("Delete")}
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => remove.mutate()}
        className="rounded-[var(--radius-control)] border border-danger px-2.5 py-1.5 font-body text-[12px] font-semibold text-danger disabled:opacity-60"
      >
        {remove.isPending ? tx("Deleting…") : tx("Delete for good")}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="rounded-[var(--radius-control)] px-2 py-1.5 font-body text-[12px] text-ink-mute hover:text-ink"
      >
        {tx("Keep")}
      </button>
    </div>
  );
}

/* ── One post ────────────────────────────────────────────────────── */

function PostCard({
  post,
  onFilterCommunity,
}: {
  post: FeedPost;
  onFilterCommunity: (id: string) => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const { profileId } = useAuth();
  const [open, setOpen] = useState(false);
  const [myVote, setMyVote] = useState(post.myVote);
  const [score, setScore] = useState(post.score);

  const cast = useMutation({
    mutationFn: (value: 1 | -1) => vote(profileId!, "post", post.id, value, myVote),
    onSuccess: (now) => {
      // `score` is maintained by a trigger; moving it here as well keeps the
      // number under the arrow from lagging a round trip behind the arrow.
      setScore((s) => s - myVote + now);
      setMyVote(now);
    },
  });

  return (
    <article className="card p-5">
      <div className="flex items-start gap-3">
        <img
          src={post.author?.avatarUrl || initialsAvatar(post.author?.name ?? "?")}
          alt=""
          loading="lazy"
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {post.author?.handle ? (
              <Link
                to="/u/$handle"
                params={{ handle: post.author.handle }}
                className="font-body text-[14px] font-semibold text-ink hover:text-saffron-600"
              >
                {post.author.name}
              </Link>
            ) : (
              <span className="font-body text-[14px] font-semibold text-ink">
                {post.author?.name ?? tx("Someone")}
              </span>
            )}
            {post.author && <AccountBadge isDemo={post.author.isDemo} isAi={post.author.isAi} />}
            {post.author?.handle && (
              <span className="font-mono text-[11px] text-ink-mute">@{post.author.handle}</span>
            )}
            <span className="font-body text-[11px] text-ink-mute">· {ago(post.createdAt)}</span>
          </div>
          {post.author?.headline && (
            <p className="truncate font-body text-[11px] text-ink-mute">{post.author.headline}</p>
          )}
        </div>
        {/*
            One slot, whichever action is yours to take.

            It used to hold Follow unconditionally — including on your own
            posts, which offered to follow yourself and would have been
            refused by the server if you tried. On your own post the useful
            action is the one that was never built: taking it down.
        */}
        {post.author &&
          (post.author.id === profileId ? (
            <DeletePostButton postId={post.id} />
          ) : (
            <FollowButton targetId={post.author.id} handle={post.author.handle} />
          ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="chip !text-[10px]">{POST_KIND_LABEL[post.kind]}</span>
        {post.community && (
          <button
            onClick={() => onFilterCommunity(post.community!.id)}
            className="chip !text-[10px] transition-colors hover:!text-saffron-600"
          >
            {post.community.name}
          </button>
        )}
        {post.tags.map((t) => (
          <span key={t} className="font-mono text-[10px] text-ink-mute">
            #{t}
          </span>
        ))}
      </div>

      <h2 className="mt-2.5 font-display text-lg leading-tight tracking-tight text-ink">
        {post.title}
      </h2>
      {post.body && (
        <p className="mt-2 whitespace-pre-wrap font-body text-[14px] leading-relaxed text-ink-soft">
          {post.body}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 border-t border-ink-line pt-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => cast.mutate(1)}
            disabled={!profileId || cast.isPending}
            aria-label={tx("Useful")}
            aria-pressed={myVote === 1}
            className={`rounded-lg p-1 transition-colors disabled:opacity-40 ${
              myVote === 1 ? "text-saffron-600" : "text-ink-mute hover:text-saffron-600"
            }`}
          >
            <ArrowBigUp size={18} aria-hidden fill={myVote === 1 ? "currentColor" : "none"} />
          </button>
          <span className="min-w-4 text-center font-mono text-[12px] tabular-nums text-ink">
            {score}
          </span>
          <button
            onClick={() => cast.mutate(-1)}
            disabled={!profileId || cast.isPending}
            aria-label={tx("Not useful")}
            aria-pressed={myVote === -1}
            className={`rounded-lg p-1 transition-colors disabled:opacity-40 ${
              myVote === -1 ? "text-ink" : "text-ink-mute hover:text-ink"
            }`}
          >
            <ArrowBigDown size={18} aria-hidden fill={myVote === -1 ? "currentColor" : "none"} />
          </button>
        </div>

        <button
          onClick={() => {
            setOpen((v) => !v);
            if (!open) {
              track(EV.COMMUNITY_POST_VIEWED, {}, { entityId: entityId("pst", post.id) });
              void qc.invalidateQueries({ queryKey: ["comments", post.id] });
            }
          }}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 font-body text-[12px] text-ink-mute transition-colors hover:text-saffron-600"
        >
          <MessageCircle size={15} aria-hidden />
          {post.commentCount} {post.commentCount === 1 ? tx("reply") : tx("replies")}
        </button>
      </div>

      {open && <Thread postId={post.id} />}
    </article>
  );
}

/* ── Replies ─────────────────────────────────────────────────────── */

function Thread({ postId }: { postId: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const { profileId } = useAuth();
  const [draft, setDraft] = useState("");

  const thread = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => listComments(postId),
  });

  /*
   * Sarthi answers a thread nobody has answered.
   *
   * Asked here rather than only at the moment of posting, so a question that
   * has been sitting unanswered gets an answer the first time somebody opens
   * it — including the person who asked it yesterday. The server refuses to
   * answer the same post twice and skips showcases, so this cannot stack up
   * or barge into somewhere it is not wanted.
   */
  const quiet = !thread.isLoading && (thread.data ?? []).length === 0;
  const sarthi = useQuery({
    queryKey: ["sarthi-reply", postId],
    queryFn: () => requestSarthiReply(postId),
    enabled: quiet,
    staleTime: Infinity,
    retry: false,
  });
  useEffect(() => {
    if (sarthi.data?.outcome === "posted") {
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
    }
  }, [sarthi.data?.outcome, postId, qc]);

  const reply = useMutation({
    mutationFn: () => addComment(postId, draft),
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
      void qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  return (
    <div className="mt-4 border-t border-ink-line pt-4">
      {thread.isLoading ? (
        <p className="font-body text-[12px] text-ink-mute">{tx("Loading replies…")}</p>
      ) : (thread.data ?? []).length === 0 ? (
        sarthi.isFetching ? (
          <p className="font-body text-[12px] text-ink-mute">{tx("Sarthi is reading this…")}</p>
        ) : sarthi.data?.answer ? (
          /*
             Sarthi answered, but has no account to post from, so this is
             shown to the reader rather than written into the thread. Saying
             so is the whole point: an answer presented as a public reply
             that nobody else can see would be a small, corrosive lie.
          */
          <div className="rounded-[var(--radius-control)] border border-ink-line bg-paper-dim/60 p-3">
            <p className="flex items-center gap-2">
              <Sparkles size={13} className="text-saffron-500" aria-hidden />
              <span className="font-body text-[12px] font-semibold text-ink">{tx("Sarthi")}</span>
              <span className="chip !py-0 !text-[10px]">{tx("Only you can see this")}</span>
            </p>
            <p className="mt-1.5 whitespace-pre-wrap font-body text-[13px] leading-relaxed text-ink-soft">
              {sarthi.data.answer}
            </p>
          </div>
        ) : (
          <p className="font-body text-[12px] text-ink-mute">
            {tx("No replies yet. Yours would be the first.")}
          </p>
        )
      ) : (
        <ul className="space-y-3">
          {(thread.data ?? []).map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <img
                src={c.author?.avatarUrl || initialsAvatar(c.author?.name ?? "?")}
                alt=""
                loading="lazy"
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1 rounded-2xl bg-ink/[0.04] px-3 py-2">
                <p className="flex items-baseline gap-2">
                  <span className="font-body text-[12px] font-semibold text-ink">
                    {c.author?.name ?? tx("Someone")}
                  </span>
                  <AccountBadge isDemo={c.author?.isDemo} isAi={c.author?.isAi} />
                  <span className="font-body text-[10px] text-ink-mute">{ago(c.createdAt)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap font-body text-[13px] leading-relaxed text-ink-soft">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {profileId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) reply.mutate();
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tx("Write a reply…")}
            aria-label={tx("Write a reply")}
            className="input !py-2 !text-[13px]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || reply.isPending}
            className="btn-primary shrink-0 !px-3 !py-2 !text-xs disabled:opacity-50"
          >
            {reply.isPending ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <Send size={13} aria-hidden />
            )}
          </button>
        </form>
      )}
    </div>
  );
}

/* ── Join / leave a group ────────────────────────────────────────── */

function JoinButton({
  communityId,
  joined,
  profileId,
}: {
  communityId: string;
  joined: boolean;
  profileId: string;
}) {
  const tx = useTx();
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: () =>
      joined ? leaveCommunity(communityId, profileId) : joinCommunity(communityId, profileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-communities", profileId] });
      void qc.invalidateQueries({ queryKey: ["communities"] });
    },
  });

  return (
    <button
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending}
      className="shrink-0 font-body text-[11px] font-medium text-ink-mute transition-colors hover:text-saffron-600 disabled:opacity-50"
    >
      {joined ? tx("Leave") : tx("Join")}
    </button>
  );
}
