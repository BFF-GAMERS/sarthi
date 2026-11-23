import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { events } from "@/data/topics";
import { listFeed, listCommunities, suggestedPeople } from "@/lib/social";
import { useTx } from "@/lib/i18n";
import HrefLink from "../HrefLink";
import { useRecentViews } from "../data";
import { limitOf, type SectionProps } from "../types";
import { Empty, SectionShell, Skeleton, signInHref } from "./shared";

/** Real posts only (a public read); never the mock `posts` array. */
export function Community(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const feed = useQuery({
    queryKey: ["feed", "home"],
    queryFn: () => listFeed({ limit: 8 }),
  });
  const rows = (feed.data ?? []).slice(0, limit);
  return (
    <SectionShell
      p={p}
      kicker={tx("Learners helping learners")}
      title={tx("Community")}
      seeAll={{ href: "/community", label: tx("Open the community") }}
    >
      {feed.isLoading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty
          title={tx("No posts yet")}
          body={tx("Be the first to ask a question or share what you built.")}
          cta={{ href: "/community", label: tx("Start the conversation") }}
        />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
          {rows.map((post) => (
            <li key={post.id} className="border-b border-ink-line last:border-b-0">
              <Link to="/community" className="block px-4 py-3.5 transition-colors hover:bg-paper">
                <span className="block truncate font-display text-[1.02rem] font-semibold text-ink">
                  {post.title}
                </span>
                <span className="mt-0.5 flex items-center gap-2 font-body text-[12.5px] text-ink-mute">
                  {post.community?.name && <span className="truncate">{post.community.name}</span>}
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare size={12} aria-hidden /> {post.commentCount}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export function Communities(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const list = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  const rows = (list.data ?? []).slice(0, limit);
  return (
    <SectionShell
      p={p}
      kicker={tx("Find your people")}
      title={tx("Communities")}
      seeAll={{ href: "/community", label: tx("All communities") }}
    >
      {list.isLoading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty
          title={tx("No communities yet")}
          body={tx("Communities appear here as they are created.")}
          cta={{ href: "/community", label: tx("Open the community") }}
        />
      ) : (
        <ul className="grid gap-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to="/community" className="card block p-4">
                <span className="block font-display text-[1.05rem] font-semibold leading-tight text-ink">
                  {c.name}
                </span>
                <span className="mt-1 block font-body text-[12.5px] text-ink-mute">
                  {c.memberCount} {tx("members")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

/** Real profiles only, and only for a member: there is no honest list to show a stranger. */
export function PeopleToFollow(p: SectionProps) {
  const tx = useTx();
  const { profileId } = useAuth();
  const limit = limitOf(p);
  const people = useQuery({
    queryKey: ["suggested-people", profileId],
    queryFn: () => suggestedPeople(profileId!),
    enabled: Boolean(profileId),
  });
  const rows = (people.data ?? []).slice(0, limit);
  return (
    <SectionShell
      p={p}
      kicker={tx("Learn from others")}
      title={tx("People to follow")}
      seeAll={{ href: p.signedIn ? "/community" : signInHref("/community"), label: tx("See more") }}
    >
      {!p.signedIn ? (
        <Empty
          title={tx("Sign in to see people to follow")}
          body={tx(
            "Suggestions come from real members who share your interests, so they need an account to be worked out.",
          )}
          cta={{ href: signInHref("/community"), label: tx("Sign in") }}
        />
      ) : people.isLoading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty
          title={tx("No suggestions right now")}
          body={tx("Follow a few people from the community and more will appear here.")}
          cta={{ href: "/community", label: tx("Open the community") }}
        />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
          {rows.map((u) => (
            <li key={u.id} className="border-b border-ink-line last:border-b-0">
              <HrefLink
                href={`/u/${u.handle}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper"
              >
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron-50 font-display text-[14px] font-semibold text-saffron-600"
                >
                  {u.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[1.02rem] font-semibold text-ink">
                    {u.name}
                  </span>
                  {u.headline && (
                    <span className="block truncate font-body text-[12.5px] text-ink-mute">
                      {u.headline}
                    </span>
                  )}
                </span>
              </HrefLink>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export function Events(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  return (
    <SectionShell
      p={p}
      kicker={tx("Meet in person or online")}
      title={tx("Events")}
      seeAll={{ href: "/events", label: tx("All events") }}
    >
      <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
        {events.slice(0, limit).map((e) => (
          <li key={e.id} className="border-b border-ink-line last:border-b-0">
            <Link to="/events" className="block px-4 py-3.5 transition-colors hover:bg-paper">
              <span className="block truncate font-display text-[1.02rem] font-semibold text-ink">
                {e.title}
              </span>
              <span className="block truncate font-body text-[12.5px] text-ink-mute">
                {e.date} · {e.online ? tx("Online") : e.city}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/** Whatever the behaviour log says was viewed, resolved against the catalogue; hidden when nothing resolves. */
export function RecentlyViewed(p: SectionProps) {
  const tx = useTx();
  const limit = limitOf(p);
  const views = useRecentViews().slice(0, limit);
  if (views.length === 0) return null;
  return (
    <SectionShell p={p} kicker={tx("On this device")} title={tx("Recently viewed")}>
      <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
        {views.map((v) => (
          <li key={v.href} className="border-b border-ink-line last:border-b-0">
            <HrefLink href={v.href} className="block px-4 py-3.5 transition-colors hover:bg-paper">
              <span className="block truncate font-display text-[1.02rem] font-semibold text-ink">
                {v.title}
              </span>
              {v.sub && (
                <span className="block truncate font-body text-[12.5px] text-ink-mute">
                  {v.sub}
                </span>
              )}
            </HrefLink>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
