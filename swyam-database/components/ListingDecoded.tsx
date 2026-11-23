import { useId, useMemo, useState } from "react";
import {
  ChevronDown,
  FileText,
  Info,
  IndianRupee,
  ListChecks,
  MapPin,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { Opportunity } from "../lib/opportunities";
import type { Course } from "../data/mock";
import {
  decodeCourse,
  decodeOpportunity,
  type DecodedBullet,
  type DecodedKey,
} from "../lib/decode";
import { useTx } from "../lib/i18n";

/**
 * The listing in plain words, with the listing's own words under each line.
 *
 * Pure rules over the listing's fields (see lib/decode.ts): no AI call, no
 * network, same output every time. Each line carries a short verbatim quote so
 * a reader can check it, and a line the listing does not support says "Not
 * stated" instead of guessing.
 *
 *  - variant="detail": every bullet, each with a "From the listing" quote.
 *  - variant="card":   at most three bullets, quotes tucked behind a native
 *    disclosure. Collapsed behind a toggle below 640 px, open from 640 px up.
 *    Everything clickable is `relative z-10` and stops propagation, because the
 *    host card puts a whole-card link overlay over itself.
 */

const ICON: Record<DecodedKey, typeof Info> = {
  do: ListChecks,
  pay: IndianRupee,
  where: MapPin,
  who: UserCheck,
  extra: Sparkles,
};

const NOTE =
  "An automatic plain-language summary of this listing. Check the original wording below.";

interface Props {
  opportunity?: Opportunity;
  course?: Course;
  variant: "card" | "detail";
  className?: string;
}

export default function ListingDecoded({ opportunity, course, variant, className = "" }: Props) {
  const tx = useTx();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const bullets = useMemo<DecodedBullet[]>(
    () => (opportunity ? decodeOpportunity(opportunity) : course ? decodeCourse(course) : []),
    [opportunity, course],
  );

  if (bullets.length === 0) return null;

  if (variant === "detail") {
    const headId = `${uid}-h`;
    return (
      <section
        aria-labelledby={headId}
        className={`card decoded decoded-detail p-5 sm:p-6 ${className}`.trim()}
      >
        <h2 id={headId} className="flex items-center gap-2 font-display text-xl text-ink">
          <FileText size={18} className="text-saffron-500" aria-hidden />
          {tx("The listing, in plain words")}
        </h2>
        <p className="mt-1 font-body text-[12.5px] leading-snug text-ink-mute">{tx(NOTE)}</p>

        <ul className="mt-3 list-none p-0">
          {bullets.map((b) => {
            const Icon = b.missing ? Info : ICON[b.key];
            return (
              <li key={b.key} className="decoded-item" data-missing={b.missing}>
                <Icon
                  size={16}
                  className={`mt-1 ${b.missing ? "text-ink-mute" : "text-saffron-500"}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="decoded-label font-body">{tx(b.label)}</p>
                  {b.missing ? (
                    <p className="decoded-text decoded-note-missing mt-0.5 font-body text-[14.5px] leading-relaxed">
                      <strong>{tx("Not stated")}</strong>
                      <span>{tx("in the listing. Ask before you rely on it.")}</span>
                    </p>
                  ) : (
                    <p className="decoded-text mt-0.5 font-body text-[14.5px] leading-relaxed">
                      {b.text}
                    </p>
                  )}
                  {!b.missing && b.quote && (
                    <figure className="decoded-quote font-body text-[13.5px] leading-snug">
                      <figcaption>{tx("From the listing")}</figcaption>
                      <blockquote>
                        <p>{`“${b.quote}”`}</p>
                      </blockquote>
                    </figure>
                  )}
                  {!b.missing && !b.quote && (
                    <p className="mt-1.5 font-body text-[12.5px] leading-snug text-ink-mute">
                      {tx("Based on the listing's details, not quoted from it.")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  /* ── card ───────────────────────────────────────────────────────────── */
  const shown = bullets.slice(0, 3);
  const sources = shown.filter((b) => !b.missing && b.quote);
  const bodyId = `${uid}-b`;
  const title = tx("What this listing says");

  return (
    <div
      className={`decoded decoded-card font-body ${className}`.trim()}
      data-open={open ? "true" : "false"}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="decoded-title">{title}</p>
      <button
        type="button"
        className="decoded-toggle relative z-10"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <ChevronDown size={18} className="decoded-chev" aria-hidden />
      </button>

      <div id={bodyId} className="decoded-body">
        <ul className="decoded-card-list">
          {shown.map((b) => {
            const Icon = b.missing ? Info : ICON[b.key];
            return (
              <li key={b.key} data-missing={b.missing}>
                <Icon
                  size={14}
                  className={`mt-0.5 ${b.missing ? "text-ink-mute" : "text-saffron-500"}`}
                  aria-hidden
                />
                <span>
                  <span className="font-semibold">{`${tx(b.label)}:`}</span>{" "}
                  {b.missing ? (
                    <>
                      <strong className="font-semibold">{tx("Not stated")}</strong>{" "}
                      {tx("in the listing")}
                    </>
                  ) : (
                    b.text
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {sources.length > 0 && (
          <details className="decoded-src">
            <summary className="relative z-10">{tx("Show original wording")}</summary>
            <ul>
              {sources.map((b) => (
                <li key={b.key}>
                  <b>{`${tx(b.label)}:`}</b> {`“${b.quote}”`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
