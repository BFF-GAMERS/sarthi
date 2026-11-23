import { Link } from "@tanstack/react-router";
import { Building2, Clock, MapPin, Users } from "lucide-react";
import { useCardExpand } from "../lib/use-card-expand";
import {
  daysLeft,
  industryOf,
  payLine,
  type MatchResult,
  type Opportunity,
} from "../lib/opportunities";
import { LastUpdated, VerifiedBadge } from "./Trust";
import { useTx } from "../lib/i18n";
import { BookmarkButton } from "./Cards";
import ListingDecoded from "./ListingDecoded";
import CompareCheckbox from "./compare/CompareCheckbox";
import ReturnTick from "./return/ReturnTick";

/**
 * One opening, as a card.
 *
 * Separate from the cards in `Cards.tsx` because those take the shapes in
 * `data/mock.ts` and look the employer up in a hard-coded map. This one takes
 * a row from the database with its employer already joined, which is the only
 * version that can show a vacancy somebody actually posted.
 *
 * The match is the part worth arguing for. A percentage on its own tells a
 * learner they are a 40% fit and leaves them there. Naming the skill they are
 * missing turns the same number into an instruction — that skill has a course
 * and a trainer on this platform, so "you are short of Excel" is a thing they
 * can go and fix this week.
 */
export default function OpportunityCard({
  opportunity: o,
  match,
  because = null,
  distanceKm = null,
}: {
  opportunity: Opportunity;
  /** A percentage. Only ever pass one computed from a signed-in member's own profile skills. */
  match?: MatchResult | null;
  /** When the basis is what the visitor viewed: names the view, shows no bar and no number. */
  because?: { title: string; shared: string[] } | null;
  distanceKm?: number | null;
}) {
  const tx = useTx();
  const { cardProps } = useCardExpand();

  const pay = payLine(o);
  const left = daysLeft(o);
  const closing = left !== null && left <= 7;
  // A labelled sample has no detail page, so it points at the list it belongs to.
  const sample = o.id.startsWith("sample:");

  return (
    <article
      {...cardProps}
      data-return-id={sample ? undefined : o.slug}
      className="card card-reveal group flex h-full flex-col p-5"
    >
      <ReturnTick />
      <div className="flex items-start gap-3.5">
        {o.employer?.logoUrl ? (
          <img
            src={o.employer.logoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-saffron-50 text-saffron-600"
          >
            <Building2 size={18} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] leading-tight tracking-tight text-ink">
            {sample ? (
              <Link
                to={o.kind === "internship" ? "/internships" : "/jobs"}
                className="after:absolute after:inset-0"
              >
                {o.title}
              </Link>
            ) : (
              <Link
                to={o.kind === "internship" ? "/internships/$id" : "/jobs/$id"}
                params={{ id: o.slug }}
                className="after:absolute after:inset-0"
              >
                {o.title}
              </Link>
            )}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-[12px] text-ink-mute">
            <span className="truncate">{o.employer?.name ?? tx("Employer not named")}</span>
            {/* A tick nobody can explain is a decoration; this one opens the explanation. */}
            {o.employer?.isVerified && <VerifiedBadge />}
            <LastUpdated iso={o.updatedAt ?? o.postedAt} />
          </p>
        </div>
      </div>

      {o.summary && (
        <p className="mt-3 line-clamp-2 font-body text-[13px] leading-snug text-ink-soft">
          {o.summary}
        </p>
      )}

      {/* The plain-language read of the listing, visible on a phone as well. */}
      <ListingDecoded variant="card" opportunity={o} className="mt-2" />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-body text-[11.5px] text-ink-mute">
        <span className="inline-flex items-center gap-1">
          <MapPin size={11} aria-hidden />
          {o.location ?? tx("Location not stated")}
          {distanceKm !== null && distanceKm > 0 && (
            <span className="text-ink-mute"> · {Math.round(distanceKm)} km</span>
          )}
        </span>
        <span className="chip !text-[10px] !capitalize">{o.workMode.replace("_", " ")}</span>
        {sample && <span className="chip !text-[10px]">{tx("Sample listing")}</span>}
        {o.openings > 1 && (
          <span className="inline-flex items-center gap-1">
            <Users size={11} aria-hidden /> {o.openings} {tx("openings")}
          </span>
        )}
      </div>

      {/* Match, when we know enough about them to compute one. */}
      {match && match.score > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep/70"
              role="progressbar"
              aria-valuenow={match.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={tx("How well you match")}
            >
              <span
                className="block h-full rounded-full bg-saffron-500"
                style={{ width: `${match.score}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-mute">
              {match.score}% {tx("match")}
            </span>
          </div>
          {match.missing.length > 0 && (
            <p className="mt-1.5 font-body text-[11px] text-ink-mute">
              {tx("You are short of")}{" "}
              <span className="text-saffron-600">{match.missing.slice(0, 2).join(", ")}</span>
            </p>
          )}
        </div>
      )}

      {/* Views are not a profile: say what the suggestion came from, never score it. */}
      {!match && because && (
        <p className="mt-3 font-body text-[11.5px] leading-snug text-ink-mute">
          {tx("Because you viewed")} <span className="text-ink-soft">{because.title}</span>
          {because.shared.length > 0 && (
            <>
              {" · "}
              {tx("shares")} {because.shared.join(", ")}
            </>
          )}
        </p>
      )}

      {/* The detail that only matters once they are interested. */}
      <div className="hover-panel">
        <div>
          <div className="hover-panel-inner">
            {o.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {o.skills.slice(0, 5).map((s) => (
                  <span key={s} className="chip !text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {o.details.whatYouLearn && o.details.whatYouLearn.length > 0 && (
              <p className="mt-2.5 font-body text-[11.5px] leading-snug text-ink-mute">
                {tx("You learn")}: {o.details.whatYouLearn.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4">
        <span className="font-display text-[15px] text-ink">
          {pay ?? (
            <span className="font-body text-[12px] text-ink-mute">{tx("Pay not stated")}</span>
          )}
          {o.kind === "internship" && o.durationWeeks && (
            <span className="ml-1.5 font-body text-[11px] text-ink-mute">
              · {o.durationWeeks} {tx("weeks")}
            </span>
          )}
        </span>

        {/* Above the whole-card link overlay, so Save is its own target. */}
        <div className="relative z-10 flex items-center gap-2.5">
          {left !== null && left >= 0 && (
            <span
              className={`inline-flex items-center gap-1 font-body text-[11px] ${
                closing ? "text-saffron-600" : "text-ink-mute"
              }`}
            >
              <Clock size={11} aria-hidden />
              {left === 0
                ? tx("Closes today")
                : `${left} ${left === 1 ? tx("day left") : tx("days left")}`}
            </span>
          )}
          {!sample && <CompareCheckbox kind={o.kind} id={o.slug} title={o.title} />}
          {!sample && <BookmarkButton kind={o.kind} slug={o.slug} title={o.title} />}
        </div>
      </div>
    </article>
  );
}
