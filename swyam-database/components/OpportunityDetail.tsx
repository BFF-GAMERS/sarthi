import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Share2,
  Users,
} from "lucide-react";
import { Reveal } from "./Reveal";
import ListingDecoded from "./ListingDecoded";
import { daysLeft, getOpportunity, industryOf, matchAgainst, payLine } from "../lib/opportunities";
import { listTeachSkills } from "../lib/skillswap";
import { applyToOpportunity, getApplication } from "../lib/catalogue";
import { useAuth } from "../context/AuthContext";
import { EV } from "@/evolution";
import { entityId, trackOnce } from "@/evolution/runtime/tracker/track";
import { BookmarkButton } from "./Cards";
import { useTx } from "../lib/i18n";
import { LastUpdated, VerifiedBadge } from "./Trust";
import { useToast } from "./Toast";
import { getProfileDetail } from "../lib/profile-data";
import { useStickyBar } from "../lib/sticky-bar";
import {
  clearDraft,
  loadDraft,
  rememberIntent,
  saveDraft,
  shouldResume,
} from "../lib/pending-intent";

/**
 * One opening in full, and the place somebody actually applies.
 *
 * Shared by jobs and internships. The old pair each looked their posting up in
 * `data/mock.ts`, so a real vacancy — one an employer had posted, one the
 * listing pages now show — produced "Job not found". The two halves of the
 * product disagreed about what existed.
 *
 * The apply box is deliberately more than a button. An application that goes
 * out with an empty note and an unread CV is the one that gets filtered, and
 * the person never learns why, so the cover note is here with the role's own
 * responsibilities beside it, and the CV review is one press away with this
 * posting already loaded.
 */
/** "today", "yesterday", "4 days ago" — a date a reader can weigh. */
function checkedAgo(iso: string, tx: (s: string) => string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return tx("recently");
  if (days === 0) return tx("today");
  if (days === 1) return tx("yesterday");
  if (days < 30) return `${days} ${tx("days ago")}`;
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function OpportunityDetail({ kind }: { kind: "job" | "internship" }) {
  const tx = useTx();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, profileId } = useAuth();
  const { id: slug } = useParams({ strict: false }) as { id: string };

  // The note survives the sign-in wall and an accidental back button; it is
  // the only part of an application somebody actually writes.
  const [note, setNote] = useState(() => loadDraft(slug));
  const [shared, setShared] = useState(false);
  const [resumed, setResumed] = useState(false);
  const toast = useToast();
  // This page carries a sticky action bar on a phone; say so, so the
  // assistant's pill sits above it rather than on top of it.
  useStickyBar();
  const applyRef = useRef<HTMLDivElement | null>(null);

  const q = useQuery({
    queryKey: ["opportunity", slug],
    queryFn: () => getOpportunity(slug),
  });
  const o = q.data;

  const mine = useQuery({
    queryKey: ["my-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled: Boolean(profileId),
  });

  const application = useQuery({
    queryKey: ["application", profileId, slug],
    queryFn: () => getApplication(profileId!, slug),
    enabled: Boolean(profileId),
  });

  // What an employer will and will not see. Not a gate — a person can apply
  // with an empty profile — but they should know before, not after.
  const me = useQuery({
    queryKey: ["profile-detail", profileId],
    queryFn: () => getProfileDetail(profileId!),
    enabled: Boolean(profileId),
  });

  useEffect(() => {
    saveDraft(slug, note);
  }, [slug, note]);

  useEffect(() => {
    if (!user || resumed) return;
    if (!shouldResume("apply", slug)) return;
    setResumed(true);
    // Their own words are already in the box; put it in front of them.
    window.setTimeout(() => {
      applyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      applyRef.current?.querySelector("textarea")?.focus();
    }, 300);
  }, [user, slug, resumed]);

  const apply = useMutation({
    mutationFn: () => applyToOpportunity(profileId!, slug, note.trim() || undefined),
    onSuccess: () => {
      trackOnce(
        `applied:${slug}`,
        EV.JOB_APPLIED,
        { kind: o?.kind === "internship" ? "internship" : "job" },
        { entityId: entityId("opp", slug) },
      );
      clearDraft(slug);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["application", profileId, slug] });
      void qc.invalidateQueries({ queryKey: ["opportunities"] });
      void qc.invalidateQueries({ queryKey: ["my-applications"] });
      toast({
        title: "Application sent",
        body: "Every step the employer takes is dated on My applications.",
        action: { label: "Track it", to: "/applications" },
      });
    },
    onError: (e: Error) => toast({ tone: "bad", title: "That did not send", body: e.message }),
  });

  // The intent to apply, once per opening and channel per visit. An external click is a start, never an application.
  const startApplication = (channel: "native" | "external") =>
    trackOnce(
      `appstart:${slug}:${channel}`,
      EV.APPLICATION_STARTED,
      { kind: o?.kind === "internship" ? "internship" : "job", channel, signedIn: Boolean(user) },
      { entityId: entityId("opp", slug) },
    );

  if (q.isLoading) {
    return (
      <div className="container-x pt-40 text-center">
        <Loader2 size={22} className="mx-auto animate-spin text-ink-mute" aria-hidden />
      </div>
    );
  }

  if (!o) {
    return (
      <div className="container-x pt-40 text-center">
        <p className="font-display text-xl tracking-tight text-ink">
          {tx("That opening is no longer listed")}
        </p>
        <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink-soft">
          {tx("It may have been filled or withdrawn. There are others open right now.")}
        </p>
        <Link
          to={kind === "internship" ? "/internships" : "/jobs"}
          className="btn-primary mt-6 !py-2.5 !text-xs"
        >
          <ArrowLeft size={14} aria-hidden />
          {kind === "internship" ? tx("All internships") : tx("All jobs")}
        </Link>
      </div>
    );
  }

  const mySkills = (mine.data ?? []).map((s) => s.skill.name);
  const match = mySkills.length ? matchAgainst(o, mySkills) : null;

  /*
   * A draft built only from what is already on their account.
   *
   * Their headline in their own words, and the skills this employer asked
   * for that their profile already lists. No adjectives, no enthusiasm we
   * invented on their behalf, and nothing an employer could catch them out
   * on. Null when there is nothing true to say yet, in which case the empty
   * box and its placeholder are the honest offer.
   */
  /* A plain expression, not useMemo: this sits after the loading and
     not-found guards above, where a hook cannot go, and building one short
     string from four fields is not worth memoising anyway. */
  const startingNote = ((): string | null => {
    const headline = me.data?.headline?.trim();
    const have = match?.have ?? [];
    if (!headline && have.length === 0) return null;
    const lines: string[] = [];
    if (headline) lines.push(headline + ".");
    if (have.length > 0) {
      const list =
        have.length === 1
          ? have[0]
          : `${have.slice(0, -1).join(", ")} and ${have[have.length - 1]}`;
      lines.push(`You have asked for ${list}, which is already on my profile here.`);
    }
    lines.push(`I would like to be considered for ${o.title}.`);
    return lines.join(" ");
  })();
  const applied = application.data?.applied ?? false;
  const left = daysLeft(o);
  const pay = payLine(o);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      /* Clipboard refused; the address bar still has it. */
    }
  };

  const closed = left !== null && left < 0;

  return (
    <div className="container-x max-w-5xl pb-36 pt-28 lg:pb-24">
      <Reveal>
        <Link
          to={kind === "internship" ? "/internships" : "/jobs"}
          className="inline-flex items-center gap-1.5 font-body text-[12px] text-ink-mute transition-colors hover:text-saffron-600"
        >
          <ArrowLeft size={13} aria-hidden />
          {kind === "internship" ? tx("All internships") : tx("All jobs")}
        </Link>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          {o.employer?.logoUrl ? (
            <img
              src={o.employer.logoUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-saffron-50 text-saffron-600"
            >
              <Building2 size={22} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl leading-tight tracking-tight text-ink sm:text-3xl">
              {o.title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm text-ink-soft">
              <span>{o.employer?.name ?? tx("Employer not named")}</span>
              {industryOf(o.employer) && (
                <span className="text-ink-mute">· {industryOf(o.employer)}</span>
              )}
              {o.employer?.isVerified ? (
                <VerifiedBadge size="md" />
              ) : (
                <span className="font-body text-[12px] text-ink-mute">
                  {tx("Not yet verified")}
                </span>
              )}
              <LastUpdated iso={o.updatedAt ?? o.postedAt} />
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <BookmarkButton kind={o.kind} slug={o.slug} title={o.title} />
            <button onClick={share} className="btn-ghost shrink-0 !py-2 !text-xs">
              {shared ? (
                <>
                  <Check size={13} aria-hidden /> {tx("Link copied")}
                </>
              ) : (
                <>
                  <Share2 size={13} aria-hidden /> {tx("Share")}
                </>
              )}
            </button>
          </div>
        </div>

        {/*
          The facts somebody decides by, all of them, each one either the
          employer's figure or "Not stated". A blank where the salary should be
          is the fact; it is not filled in with a guess.
        */}
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink-line py-5 sm:grid-cols-4">
          {[
            [tx("Location"), o.location ?? tx("Not stated"), <MapPin key="m" size={12} />],
            [o.kind === "internship" ? tx("Stipend") : tx("Salary"), pay ?? tx("Not stated"), null],
            [
              tx("Work mode"),
              o.workMode.replace("_", " ").replace(/^./, (c) => c.toUpperCase()),
              null,
            ],
            [
              o.kind === "internship" ? tx("Duration") : tx("Openings"),
              o.kind === "internship"
                ? o.durationWeeks
                  ? `${o.durationWeeks} ${tx("weeks")}`
                  : tx("Not stated")
                : String(o.openings),
              <Users key="u" size={12} />,
            ],
            [
              tx("Last date to apply"),
              o.deadline
                ? new Date(o.deadline).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : tx("Open until filled"),
              null,
            ],
            [tx("Experience"), o.details.experience ?? tx("Not stated"), null],
            [
              tx("How to apply"),
              o.applyUrl ? tx("On the employer's site") : tx("Here, on स्वYAM"),
              null,
            ],
            /*
             * The link, and when it was last known to work.
             *
             * A dead apply link is the commonest way a jobs listing lies —
             * the page is still up, the role is gone, and the reader finds
             * out after writing a cover note. The checker has been recording
             * this all along and nothing showed it. A date the reader can
             * judge for themselves beats a badge that cannot go stale.
             */
            [
              tx("Apply link"),
              !o.applyUrl
                ? tx("Not needed — you apply here")
                : !o.applyUrlCheckedAt
                  ? tx("Not checked yet")
                  : `${
                      o.applyUrlStatus && o.applyUrlStatus < 400
                        ? tx("Answered")
                        : tx("Did not answer")
                    } · ${tx("checked")} ${checkedAgo(o.applyUrlCheckedAt, tx)}`,
              null,
            ],
            [
              tx("Applied so far"),
              o.applyUrl
                ? tx("Unknown — the employer counts")
                : o.applicationCount === 0
                  ? tx("Nobody yet")
                  : String(o.applicationCount),
              null,
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                {label}
              </dt>
              <dd className="mt-1 font-body text-[14px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        {/* ── The role ─────────────────────────────────────────── */}
        <div className="space-y-7">
          <ListingDecoded variant="detail" opportunity={o} />

          {o.description && (
            <section>
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("About the role")}
              </h2>
              <div className="mt-2 space-y-3">
                {o.description
                  .split("\n")
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i} className="font-body text-[14.5px] leading-relaxed text-ink-soft">
                      {p}
                    </p>
                  ))}
              </div>
            </section>
          )}

          {o.responsibilities.length > 0 && (
            <section>
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("What you would do")}
              </h2>
              <ul className="mt-3 space-y-2">
                {o.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500"
                    />
                    <span className="font-body text-[14px] leading-relaxed text-ink-soft">{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {o.eligibility && (
            <section>
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Who can apply")}
              </h2>
              <p className="mt-2 font-body text-[14.5px] leading-relaxed text-ink-soft">
                {o.eligibility}
              </p>
              {o.details.niceToHave && o.details.niceToHave.length > 0 && (
                <>
                  <p className="datum mt-4">{tx("Helps, but not required")}</p>
                  <ul className="mt-2 space-y-1.5">
                    {o.details.niceToHave.map((n, i) => (
                      <li key={i} className="font-body text-[13px] text-ink-mute">
                        · {n}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {o.skills.length > 0 && (
            <section>
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Skills asked for")}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {o.skills.map((s) => {
                  const have = mySkills.some((m) => m.toLowerCase() === s.toLowerCase());
                  return (
                    <li
                      key={s}
                      className={`chip inline-flex items-center gap-1 ${have ? "!border-emeraldx-400/40 !text-emeraldx-400" : ""}`}
                    >
                      {have && <Check size={11} aria-hidden />}
                      {s}
                    </li>
                  );
                })}
              </ul>
              {mySkills.length === 0 && user && (
                <p className="mt-2 font-body text-[12px] text-ink-mute">
                  <Link to="/profile" className="text-saffron-600 underline">
                    {tx("Add your skills")}
                  </Link>{" "}
                  {tx("and this list shows which ones you already have.")}
                </p>
              )}
            </section>
          )}

          {o.details.benefits && o.details.benefits.length > 0 && (
            <section>
              <h2 className="font-display text-lg tracking-tight text-ink">{tx("Benefits")}</h2>
              <ul className="mt-3 space-y-2">
                {o.details.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check size={14} className="mt-0.5 shrink-0 text-saffron-500" aria-hidden />
                    <span className="font-body text-[14px] leading-relaxed text-ink-soft">{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {o.details.whatYouLearn && o.details.whatYouLearn.length > 0 && (
            <section className="panel p-5">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("What this teaches you")}
              </h2>
              <ul className="mt-3 space-y-2">
                {o.details.whatYouLearn.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check size={14} className="mt-0.5 shrink-0 text-saffron-500" aria-hidden />
                    <span className="font-body text-[14px] leading-relaxed text-ink-soft">{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {o.details.hiringProcess && o.details.hiringProcess.length > 0 && (
            <section>
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("How hiring runs")}
              </h2>
              <ol className="mt-3 space-y-2.5">
                {o.details.hiringProcess.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink-line font-mono text-[11px] text-ink-mute"
                    >
                      {i + 1}
                    </span>
                    <span className="font-body text-[14px] leading-relaxed text-ink-soft">{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <h2 className="font-display text-lg tracking-tight text-ink">
              {tx("After you apply")}
            </h2>
            {o.applyUrl ? (
              <p className="mt-2 font-body text-[14px] leading-relaxed text-ink-soft">
                {tx(
                  "You apply on the employer's own page, so the employer holds your application and the reply comes from them. स्वYAM cannot see or track it.",
                )}
              </p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {[
                  tx("Your application and your Skill Passport reach the employer's dashboard."),
                  tx(
                    "The employer marks it Viewed, Shortlisted, Interview, and then Selected or Not selected.",
                  ),
                  tx(
                    "You get a notification at every step, and the dates are kept on My applications.",
                  ),
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink-line font-mono text-[11px] text-ink-mute"
                    >
                      {i + 1}
                    </span>
                    <span className="font-body text-[14px] leading-relaxed text-ink-soft">{s}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 font-body text-[13px] text-ink-mute">
              <span className="font-semibold text-ink-soft">{tx("Reply time")}: </span>
              {o.details.responseTime ??
                tx("the employer has not committed to one. We do not invent one for them.")}
            </p>
          </section>

          {o.details.interviewTips && o.details.interviewTips.length > 0 && (
            <section>
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Before the interview")}
              </h2>
              <ul className="mt-3 space-y-2">
                {o.details.interviewTips.map((t, i) => (
                  <li key={i} className="font-body text-[14px] leading-relaxed text-ink-soft">
                    · {t}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Applying ─────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            {left !== null && (
              <p
                className={`flex items-center gap-1.5 font-body text-[12px] ${
                  left <= 7 ? "text-saffron-600" : "text-ink-mute"
                }`}
              >
                <Clock size={12} aria-hidden />
                {left < 0
                  ? tx("Applications have closed")
                  : left === 0
                    ? tx("Closes today")
                    : `${left} ${left === 1 ? tx("day left to apply") : tx("days left to apply")}`}
              </p>
            )}

            {match && (
              <div className="mt-3 border-t border-ink-line pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="datum">{tx("How you match")}</span>
                  <span className="font-display text-lg tabular-nums text-saffron-500">
                    {match.score}%
                  </span>
                </div>
                {match.have.length > 0 && (
                  <p className="mt-1.5 font-body text-[11.5px] text-ink-mute">
                    {tx("You have")}: {match.have.join(", ")}
                  </p>
                )}
                {match.missing.length > 0 && (
                  <>
                    <p className="mt-1 font-body text-[11.5px] text-ink-mute">
                      {tx("Missing")}:{" "}
                      <span className="text-saffron-600">{match.missing.join(", ")}</span>
                    </p>
                    <Link
                      to="/board"
                      className="mt-2 inline-block font-body text-[11.5px] text-saffron-600 underline"
                    >
                      {tx("Learn what you are missing")}
                    </Link>
                  </>
                )}
              </div>
            )}

            {/*
              An outside employer's opening sends you to the employer.

              Everything here used to collect the application in-platform,
              which is only honest when स्वYAM is the one hiring. For a real
              company, an application sitting in our table reaches nobody —
              and a form that looks like it worked is worse than no form,
              because the applicant stops looking.

              No sign-in wall on this branch either: the destination is a
              public careers page, and making somebody register with us first
              to reach it would be a toll booth on somebody else's road.
            */}
            {o.applyUrl ? (
              <div className="mt-4">
                <a
                  href={o.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => startApplication("external")}
                  className="btn-primary w-full justify-center !py-3"
                >
                  {tx("Apply on")} {o.employer?.name ?? tx("the company site")}
                  <ExternalLink size={14} aria-hidden />
                </a>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-ink-mute">
                  {tx(
                    "This opening is filled by the company directly. Your application goes to them, not to स्वYAM.",
                  )}
                </p>
              </div>
            ) : !user ? (
              <>
                <button
                  onClick={() => {
                    startApplication("native");
                    rememberIntent({
                      kind: "apply",
                      slug,
                      title: o.title,
                      path: window.location.pathname,
                    });
                    void navigate({
                      to: "/auth",
                      search: { mode: "signup", next: window.location.pathname },
                    });
                  }}
                  className="btn-primary mt-4 w-full justify-center !py-3"
                >
                  {tx("Sign in to apply")}
                </button>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-ink-mute">
                  {tx(
                    "Free, and it takes a minute. This opening — and anything you have typed below — comes with you.",
                  )}
                </p>
              </>
            ) : applied ? (
              <div className="mt-4">
                <p className="flex items-center gap-2 font-body text-[14px] font-medium text-emeraldx-400">
                  <Check size={16} aria-hidden /> {tx("Application sent")}
                </p>
                <p className="mt-1 font-body text-[11.5px] text-ink-mute">
                  {tx("Every step the employer takes is dated on My applications.")}
                </p>
                <Link
                  to="/applications"
                  className="btn-ghost mt-3 w-full justify-center !py-2.5 !text-xs"
                >
                  {tx("Track this application")}
                </Link>
              </div>
            ) : (
              <div className="mt-4" ref={applyRef}>
                {/*
                  What the employer receives, and what is missing from it.
                  Applying is still allowed — a fresher with an empty profile
                  is exactly who this site is for — but "they will see no
                  skills" is better known before the application than after
                  the silence.
                */}
                <Readiness
                  hasSkills={mySkills.length > 0}
                  hasHeadline={Boolean(me.data?.headline?.trim())}
                  matchScore={match?.score ?? null}
                  missing={match?.missing ?? []}
                />
                <p className="mt-3 font-body text-[12px] leading-relaxed text-ink-mute">
                  {tx(
                    "Your Skill Passport — verified skills and the work behind them — goes with the application, as it stands today.",
                  )}
                </p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <label htmlFor="note" className="datum">
                    {tx("Add a note")}
                  </label>
                  {/*
                     Apply once, not every time.

                     Every application started from an empty box, so the same
                     person wrote the same three sentences for the fifth time
                     and the fifth one was the worst. This does not write a
                     letter for them — it assembles the facts this platform
                     already holds about them: their own headline, and the
                     skills this employer asked for that they have on their
                     profile. Nothing is claimed that is not already on their
                     account, and it drops into an editable box, because a
                     note nobody reads before sending is worse than none.
                  */}
                  {!note.trim() && startingNote && (
                    <button
                      type="button"
                      onClick={() => setNote(startingNote)}
                      className="font-body text-[12px] font-semibold text-saffron-700 underline-offset-2 hover:underline"
                    >
                      {tx("Start from my profile")}
                    </button>
                  )}
                </div>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => {
                    if (e.target.value.trim()) startApplication("native");
                    setNote(e.target.value);
                  }}
                  rows={4}
                  placeholder={tx(
                    "Two or three sentences on why this role, and what you have done that is closest to it.",
                  )}
                  className="input mt-1.5 resize-none !text-[13px]"
                />
                <button
                  onClick={() => apply.mutate()}
                  disabled={apply.isPending || (left !== null && left < 0)}
                  className="btn-primary mt-3 w-full justify-center !py-3 disabled:opacity-50"
                >
                  {apply.isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
                  {left !== null && left < 0 ? tx("Closed") : tx("Apply with my Skill Passport")}
                </button>
                {left !== null && left < 0 && (
                  <p className="mt-1.5 font-body text-[11.5px] text-ink-mute">
                    {tx("The employer's last date has passed, so applications are closed.")}
                  </p>
                )}
                {note.trim().length > 0 && (
                  <p className="mt-1.5 font-body text-[11px] text-ink-mute">
                    {tx("Your note is saved on this device as you type.")}
                  </p>
                )}
                {apply.isError && (
                  <p className="mt-2 font-body text-[12px] text-danger">
                    {(apply.error as Error).message}
                  </p>
                )}
              </div>
            )}
          </div>

          <Link
            to="/cv"
            search={{ for: o.slug }}
            className="card flex items-center gap-3 p-4 transition-colors hover:border-saffron-200"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron-50 text-saffron-600"
            >
              <FileText size={16} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[13px] font-medium text-ink">
                {tx("Check your CV for this role")}
              </span>
              <span className="block font-body text-[11px] text-ink-mute">
                {tx("See what a screen would trip on")}
              </span>
            </span>
          </Link>

          {o.skills.length > 0 && (
            <div className="card p-5">
              <p className="datum">{tx("Skills asked for")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {o.skills.map((s) => (
                  <span key={s} className="chip !text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/*
        The decision, within reach.

        On a phone the apply panel sits below two thousand pixels of role
        description — which is the right order to read it in and the wrong
        place to put the button. This bar carries the pay and one action, and
        it sits above the navigation bar rather than under it.
      */}
      <div className="fixed inset-x-0 bottom-[var(--bottom-bar,0px)] z-[44] border-t border-ink-line bg-paper-light/95 p-3 backdrop-blur-sm lg:hidden">
        <div className="container-x flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-[13px] font-semibold text-ink">
              {pay ?? tx("Pay not stated")}
            </p>
            <p className="truncate font-body text-[11.5px] text-ink-mute">
              {closed
                ? tx("Applications have closed")
                : left !== null
                  ? `${left} ${left === 1 ? tx("day left to apply") : tx("days left to apply")}`
                  : (o.location ?? o.workMode.replace("_", " "))}
            </p>
          </div>
          {o.applyUrl ? (
            <a
              href={o.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => startApplication("external")}
              className="btn-primary shrink-0 !px-4 !py-2.5 !text-xs"
            >
              {tx("Apply on their site")}
              <ExternalLink size={13} aria-hidden />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                startApplication("native");
                applyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                applyRef.current?.querySelector("textarea")?.focus();
              }}
              disabled={closed || applied}
              className="btn-primary shrink-0 !px-4 !py-2.5 !text-xs disabled:opacity-50"
            >
              {applied ? tx("Applied") : closed ? tx("Closed") : tx("Apply")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A short, honest account of the application about to be sent.
 *
 * Each line is a fact about this member's own record, with the place to fix
 * it. Nothing here blocks the Apply button.
 */
function Readiness({
  hasSkills,
  hasHeadline,
  matchScore,
  missing,
}: {
  hasSkills: boolean;
  hasHeadline: boolean;
  matchScore: number | null;
  missing: string[];
}) {
  const tx = useTx();
  const items = [
    {
      ok: hasSkills,
      done: tx("Your skills are listed, so the employer can match them"),
      todo: tx("No skills listed yet — the employer will see an empty passport"),
      fix: "/profile",
      fixLabel: tx("Add skills"),
    },
    {
      ok: hasHeadline,
      done: tx("Your headline says what you do"),
      todo: tx("No headline — one line about what you do helps a screener"),
      fix: "/profile",
      fixLabel: tx("Add a headline"),
    },
  ];
  const pending = items.filter((i) => !i.ok);
  if (pending.length === 0 && (matchScore === null || missing.length === 0)) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-emeraldx-400/10 p-3 font-body text-[12.5px] leading-relaxed text-emeraldx-400">
        <Check size={14} className="mt-0.5 shrink-0" aria-hidden />
        {tx("Your profile is ready to send with this application.")}
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-ink-line p-3">
      <p className="font-body text-[12px] font-semibold text-ink">{tx("Before you send")}</p>
      <ul className="mt-2 space-y-1.5">
        {pending.map((i) => (
          <li key={i.fixLabel} className="font-body text-[12px] leading-relaxed text-ink-mute">
            · {i.todo}{" "}
            <Link to={i.fix} className="text-saffron-600 underline">
              {i.fixLabel}
            </Link>
          </li>
        ))}
        {missing.length > 0 && (
          <li className="font-body text-[12px] leading-relaxed text-ink-mute">
            · {tx("This role also asks for")}{" "}
            <span className="text-saffron-600">{missing.slice(0, 3).join(", ")}</span>.{" "}
            <Link to="/courses" className="text-saffron-600 underline">
              {tx("Learn it")}
            </Link>
          </li>
        )}
      </ul>
      <p className="mt-2 font-body text-[11.5px] text-ink-mute">
        {tx("You can still apply — none of this stops you.")}
      </p>
    </div>
  );
}
