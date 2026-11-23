import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Flag,
  Globe,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  ShieldOff,
  UserRoundX,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { initialsAvatar } from "../lib/avatar";
import {
  getProfileCard,
  listAvailability,
  listFollowers,
  listFollowing,
  getMemberPassport,
  listPublicSkills,
  openConversationWith,
} from "../lib/people";
import { blockProfile, unblockProfile } from "../lib/safety";
import FollowButton from "../components/FollowButton";
import ConnectionRequests from "../components/ConnectionRequests";
import ReportDialog from "../components/ReportDialog";
import { Reveal } from "../components/Reveal";
import { useTx } from "../lib/i18n";

/**
 * One member, as seen by another.
 *
 * This page did not exist. There was no route for a person and no query in
 * `src/lib` that fetched a profile by handle — `/profile` was your own and
 * `/mentor/$slug` is a skill. Which explains a lot: the Follow button lived
 * in two places inside Community because there was nowhere else to put it,
 * the `blocks` and `reports` tables had never been written to because there
 * was no person to block or report, and forty-six rows of `skill_evidence`
 * had never been shown to anybody because there was no page about a person to
 * show them on.
 *
 * The privacy model has three states and this page renders all three:
 * a public profile in full, an "ask first" profile as a card with a request
 * button, and a private one as a name and nothing else. The middle state used
 * to be indistinguishable from the last — `profile_is_visible` only ever
 * checked for 'public', so "connections" meant nobody.
 */

const VERIFIED = new Set(["assessed", "verified", "expert_verified"]);

const EVIDENCE_LABEL: Record<string, string> = {
  assessment: "Passed the assessment",
  course_completion: "Finished the course",
  project: "Submitted a project",
  mentor_endorsement: "Endorsed by a mentor",
  internship: "Internship",
  external_credential: "Outside credential",
  admin_grant: "Confirmed by स्वYAM",
};

export default function MemberProfile() {
  const tx = useTx();
  const { handle } = useParams({ from: "/u/$handle" });
  const { profileId, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"none" | "followers" | "following">("none");
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [openError, setOpenError] = useState("");

  const card = useQuery({
    queryKey: ["profile-card", handle, profileId],
    queryFn: () => getProfileCard(handle),
  });

  const person = card.data;
  const visible = person?.visible === true;

  const skills = useQuery({
    queryKey: ["public-skills", person?.id],
    queryFn: () => listPublicSkills(person!.id),
    enabled: Boolean(person?.id) && visible && person?.showSkills !== false,
  });

  const free = useQuery({
    queryKey: ["availability", person?.id],
    queryFn: () => listAvailability(person!.id),
    enabled: Boolean(person?.id) && visible,
  });

  const people = useQuery({
    queryKey: ["follow-list", person?.id, tab],
    queryFn: () => (tab === "followers" ? listFollowers(person!.id) : listFollowing(person!.id)),
    enabled: Boolean(person?.id) && tab !== "none",
  });

  /* Certificates and a published passport, if their settings and the
     policies allow it. Failing quietly is the point — see getMemberPassport. */
  const passport = useQuery({
    queryKey: ["member-passport", person?.id],
    queryFn: () => getMemberPassport(person!.id),
    enabled: Boolean(person?.id) && visible,
  });

  const showPassport =
    visible && ((passport.data?.certificates ?? []).length > 0 || !!passport.data?.shareSlug);

  const block = useMutation({
    mutationFn: () =>
      person!.blockedByMe ? unblockProfile(person!.id, profileId!) : blockProfile(person!.id),
    onSuccess: () => {
      setConfirmBlock(false);
      void qc.invalidateQueries({ queryKey: ["profile-card"] });
    },
  });

  const message = useMutation({
    mutationFn: () => openConversationWith(person!.id),
    onSuccess: (conversationId) =>
      navigate({ to: "/messages/$id", params: { id: conversationId } }),
    onError: (e: Error) => setOpenError(e.message),
  });

  if (card.isLoading) {
    return (
      <div className="container-x max-w-3xl pb-24 pt-28">
        {/*
           A heading even while it loads.

           This returned a bare "Loading…" and nothing else, so for as long as
           the profile took to arrive the page had no h1 at all — somebody
           using a screen reader landed with nothing to orient by, and it is
           the slowest page on the site to fill. The handle is in the URL, so
           there is always something true to say before the name arrives.
        */}
        <h1 className="section-title">@{handle}</h1>
        <p className="mt-3 font-body text-sm text-ink-mute" role="status">
          {tx("Loading…")}
        </p>
      </div>
    );
  }

  if (!person?.found) {
    return (
      <div className="container-x max-w-3xl pb-24 pt-28 text-center">
        <h1 className="section-title">{tx("No such member")}</h1>
        <p className="type-lede mt-4">
          {tx("There is nobody here with the username")}{" "}
          <span className="font-mono">@{handle}</span>.
        </p>
        <Link to="/community" className="btn-primary mt-7 !py-2.5 !text-xs">
          {tx("Back to the community")}
        </Link>
      </div>
    );
  }

  const avatar = person.avatarUrl || initialsAvatar(person.name);

  return (
    <div className="container-x max-w-3xl pb-24 pt-28">
      {reporting && (
        <ReportDialog
          subjectKind="profile"
          subjectId={person.id}
          subjectOwnerId={person.id}
          subjectLabel={person.name}
          onClose={() => setReporting(false)}
        />
      )}

      <Reveal>
        <section className="panel p-6 sm:p-8">
          <div className="flex flex-wrap items-start gap-5">
            <img
              src={avatar}
              alt=""
              className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-ink-line"
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl tracking-tight text-ink">{person.name}</h1>
              <p className="mt-1 font-mono text-[13px] text-ink-mute">@{person.handle}</p>
              {visible && person.headline && (
                <p className="mt-2 font-body text-[15px] leading-relaxed text-ink-soft">
                  {person.headline}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <button
                  onClick={() => setTab(tab === "followers" ? "none" : "followers")}
                  className="font-body text-[13px] text-ink-soft transition-colors hover:text-saffron-600"
                >
                  <span className="font-semibold tabular-nums text-ink">{person.followers}</span>{" "}
                  {tx("followers")}
                </button>
                <button
                  onClick={() => setTab(tab === "following" ? "none" : "following")}
                  className="font-body text-[13px] text-ink-soft transition-colors hover:text-saffron-600"
                >
                  <span className="font-semibold tabular-nums text-ink">{person.following}</span>{" "}
                  {tx("following")}
                </button>
                {person.followsMe && !person.isSelf && (
                  <span className="chip !text-[10px]">{tx("Follows you")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {!person.isSelf && (
            <div className="mt-6 flex flex-wrap items-start gap-2">
              {!person.blockedByMe && (
                <>
                  <FollowButton targetId={person.id} initialState={person.followState} size="md" />
                  <button
                    onClick={() => message.mutate()}
                    disabled={message.isPending}
                    className="btn-ghost !px-4 !py-2 !text-xs disabled:opacity-60"
                  >
                    {message.isPending ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : (
                      <MessageSquare size={13} aria-hidden />
                    )}
                    {tx("Message")}
                  </button>
                </>
              )}
              <button onClick={() => setReporting(true)} className="btn-ghost !px-4 !py-2 !text-xs">
                <Flag size={13} aria-hidden /> {tx("Report")}
              </button>
              <button
                onClick={() => (person.blockedByMe ? block.mutate() : setConfirmBlock(true))}
                disabled={block.isPending}
                className="btn-ghost !px-4 !py-2 !text-xs disabled:opacity-60"
              >
                {person.blockedByMe ? (
                  <>
                    <ShieldOff size={13} aria-hidden /> {tx("Unblock")}
                  </>
                ) : (
                  <>
                    <UserRoundX size={13} aria-hidden /> {tx("Block")}
                  </>
                )}
              </button>
            </div>
          )}

          {person.isSelf && (
            <div className="mt-6">
              <Link to="/settings" className="btn-ghost !px-4 !py-2 !text-xs">
                {tx("Edit your profile")}
              </Link>
            </div>
          )}

          {openError && (
            <p role="alert" className="mt-3 font-body text-[13px] text-saffron-700">
              {openError}
            </p>
          )}

          {confirmBlock && (
            <div className="mt-4 rounded-2xl border border-ink-line bg-paper-dim p-4">
              <p className="font-body text-[14px] text-ink">
                {tx("Block")} {person.name}?
              </p>
              <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-mute">
                {tx(
                  "They will not be able to message you, follow you or see your profile. Any follow between you is removed. They are not told.",
                )}
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirmBlock(false)} className="btn-ghost !py-2 !text-xs">
                  {tx("Cancel")}
                </button>
                <button
                  onClick={() => block.mutate()}
                  disabled={block.isPending}
                  className="btn-primary !py-2 !text-xs disabled:opacity-60"
                >
                  {block.isPending && <Loader2 size={12} className="animate-spin" aria-hidden />}
                  {tx("Block them")}
                </button>
              </div>
            </div>
          )}

          {person.blockedByMe && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-paper-dim px-4 py-2.5 font-body text-[13px] text-ink-soft">
              <ShieldOff size={14} aria-hidden />
              {tx("You have blocked this person. They cannot reach you.")}
            </p>
          )}
        </section>
      </Reveal>

      {/* Followers / following */}
      {tab !== "none" && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tab === "followers" ? tx("Followers") : tx("Following")}
              </h2>
              <button
                onClick={() => setTab("none")}
                aria-label={tx("Close")}
                className="rounded-xl p-1.5 text-ink-mute hover:bg-paper-deep/70 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            {people.isLoading ? (
              <p className="mt-4 font-body text-sm text-ink-mute">{tx("Loading…")}</p>
            ) : (people.data ?? []).length === 0 ? (
              <p className="mt-4 font-body text-sm text-ink-mute">
                {tab === "followers" ? tx("Nobody yet.") : tx("Not following anyone yet.")}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-ink-line">
                {(people.data ?? []).map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/u/$handle"
                      params={{ handle: p.handle }}
                      onClick={() => setTab("none")}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-paper-dim"
                    >
                      <img
                        src={p.avatarUrl || initialsAvatar(p.name)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm font-medium text-ink">
                          {p.name}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-ink-mute">
                          @{p.handle}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      )}

      {/*
        Requests waiting on you.

        This was written twice — once here and once on /profile — and the two
        copies had already drifted: this one disabled every row's buttons
        while any one of them resolved, so a list of five felt broken on the
        first click. One component now, rendered on both of the pages that
        are you looking at yourself.
      */}
      {person.isSelf && (
        <Reveal className="mt-6">
          <ConnectionRequests />
        </Reveal>
      )}

      {/* The closed door, said plainly */}
      {!visible && (
        <Reveal className="mt-6">
          <section className="panel p-6 text-center">
            <Lock size={20} className="mx-auto text-ink-mute" aria-hidden />
            <p className="mt-3 font-body text-sm font-medium text-ink">
              {person.visibility === "private"
                ? tx("This profile is private.")
                : tx("This profile is open to their connections.")}
            </p>
            <p className="mx-auto mt-2 max-w-sm font-body text-[13px] leading-relaxed text-ink-mute">
              {person.visibility === "private"
                ? tx("Only their name is public. Nothing else is shown to anyone.")
                : person.followState === "pending"
                  ? tx("Your request is waiting. You will see their profile once they accept.")
                  : tx("Ask to follow, and they can let you in.")}
            </p>
          </section>
        </Reveal>
      )}

      {/*
        Skills are gated to signed-in readers by `user_skills_read`, which is
        scoped to the `authenticated` role. An empty section would read as
        "this person has no skills" when it means "you are not signed in".
      */}
      {visible && person.showSkills && !user && (skills.data ?? []).length === 0 && (
        <Reveal className="mt-6">
          <section className="panel p-6 text-center">
            <p className="font-body text-sm font-medium text-ink">
              {tx("Their skills are visible to members.")}
            </p>
            <p className="mx-auto mt-2 max-w-sm font-body text-[13px] leading-relaxed text-ink-mute">
              {tx(
                "Skill lists are not shown to signed-out visitors, so nobody can collect them in bulk.",
              )}
            </p>
            <Link to="/auth" search={{ mode: "login" }} className="btn-ghost mt-4 !py-2 !text-xs">
              {tx("Sign in")}
            </Link>
          </section>
        </Reveal>
      )}

      {/* Skills, with the proof behind them */}
      {visible && person.showSkills && (skills.data ?? []).length > 0 && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="font-display text-lg tracking-tight text-ink">{tx("Skills")}</h2>
            <p className="mt-1.5 font-body text-[13px] text-ink-mute">
              {tx("A verified skill shows what verified it.")}
            </p>
            <ul className="mt-4 space-y-3">
              {(skills.data ?? []).map((s) => (
                <li key={s.id} className="rounded-2xl border border-ink-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-sm font-medium text-ink">{s.name}</p>
                    {VERIFIED.has(s.verification) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emeraldx-400/12 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-emeraldx-400">
                        <BadgeCheck size={11} aria-hidden /> {tx("Verified")}
                      </span>
                    )}
                    <span className="chip !text-[10px] capitalize">{s.level}</span>
                    {s.canTeach && <span className="chip !text-[10px]">{tx("Teaches this")}</span>}
                  </div>
                  {s.blurb && (
                    <p className="mt-2 font-body text-[13px] leading-relaxed text-ink-soft">
                      {s.blurb}
                    </p>
                  )}
                  {s.evidence.length > 0 && (
                    <ul className="mt-2.5 flex flex-wrap gap-1.5">
                      {s.evidence.map((e, i) => (
                        <li
                          key={`${e.kind}-${i}`}
                          className="inline-flex items-center gap-1 rounded-full bg-paper-dim px-2.5 py-1 font-body text-[11px] text-ink-soft"
                        >
                          <BadgeCheck size={11} className="text-emeraldx-400" aria-hidden />
                          {tx(EVIDENCE_LABEL[e.kind] ?? e.kind)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {/*
        Their passport.

        A profile listed what somebody says they can do and stopped there.
        The evidence — assessed certificates, each with a serial anybody can
        check — lived on /passport, which only its owner could open, and on a
        share link they had to send you. So the one page a recruiter lands on
        was the one page that could not show proof.

        Three states, and they are different on purpose. Certificates we were
        allowed to read; no certificates but a published passport to open; or
        nothing, in which case this section does not exist. An empty panel
        headed "Skill passport" would read as "this person has proved
        nothing", which is a claim we have not earned.
      */}
      {showPassport && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
              <BadgeCheck size={17} className="text-saffron-500" aria-hidden />
              {tx("Skill passport")}
            </h2>
            {passport.data?.headline && (
              <p className="mt-1.5 font-body text-[13.5px] text-ink-soft">
                {passport.data.headline}
              </p>
            )}

            {(passport.data?.certificates ?? []).length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {(passport.data?.certificates ?? []).map((c) => (
                  <li
                    key={c.serial}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-control)] border border-ink-line p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-[14px] font-semibold text-ink">
                        {c.title}
                      </p>
                      <p className="truncate font-body text-[12px] text-ink-mute">
                        {c.issuer}
                        {c.issuedAt
                          ? ` · ${new Date(c.issuedAt).toLocaleDateString(undefined, {
                              month: "short",
                              year: "numeric",
                            })}`
                          : ""}
                        {c.score === null ? "" : ` · ${c.score}%`}
                      </p>
                    </div>
                    {/* The serial is the whole point: it is what makes this
                        a claim somebody else can check rather than one they
                        have to take on trust. */}
                    <Link
                      to="/verify/$serial"
                      params={{ serial: c.serial }}
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-saffron-700 underline-offset-2 hover:underline"
                    >
                      {c.serial}
                      <BadgeCheck size={12} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 font-body text-[13px] leading-relaxed text-ink-mute">
                {tx("Their certificates are on their passport page.")}
              </p>
            )}

            {passport.data?.shareSlug && (
              <Link
                to="/passport/$slug"
                params={{ slug: passport.data.shareSlug }}
                className="btn-ghost mt-4 !py-2 !text-xs"
              >
                {tx("Open their skill passport")}
              </Link>
            )}
          </section>
        </Reveal>
      )}

      {/* When they are free — thirteen rows nothing has ever read */}
      {visible && (free.data ?? []).length > 0 && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
              <CalendarClock size={17} className="text-saffron-500" aria-hidden />
              {tx("Usually free")}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {(free.data ?? []).map((s, i) => (
                <li key={`${s.weekday}-${i}`} className="chip !text-[11px]">
                  {tx(s.day)} · {s.from}–{s.to}
                </li>
              ))}
            </ul>
            <p className="mt-3 font-body text-[12px] text-ink-mute">
              {tx("Their own times, in their timezone. Useful when you propose a session.")}
            </p>
          </section>
        </Reveal>
      )}

      {/* About */}
      {visible && (person.bio || person.region || person.websiteUrl) && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="font-display text-lg tracking-tight text-ink">{tx("About")}</h2>
            {person.bio && (
              <p className="mt-3 font-body text-[14px] leading-relaxed text-ink-soft">
                {person.bio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {person.region && (
                <span className="inline-flex items-center gap-1.5 font-body text-[13px] text-ink-mute">
                  <MapPin size={13} aria-hidden /> {person.region}
                </span>
              )}
              {person.websiteUrl && (
                <a
                  href={person.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 font-body text-[13px] text-saffron-700 underline-offset-2 hover:underline"
                >
                  <Globe size={13} aria-hidden /> {tx("Website")}
                </a>
              )}
            </div>
          </section>
        </Reveal>
      )}

      {!user && (
        <p className="mt-8 text-center font-body text-[13px] text-ink-mute">
          <Link to="/auth" search={{ mode: "login" }} className="link-sweep text-saffron-600">
            {tx("Sign in")}
          </Link>{" "}
          {tx("to follow or message them.")}
        </p>
      )}
    </div>
  );
}
