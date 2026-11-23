import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { daysLeft, payLine, type Opportunity } from "@/lib/opportunities";
import { useTx } from "@/lib/i18n";
import type { Course } from "@/data/mock";
import { RevealOnView } from "@/components/motion/RevealOnView";
import HrefLink from "../HrefLink";
import { sectionClick } from "../track";
import type { SectionProps } from "../types";

export const signInHref = (next: string): string =>
  `/auth?mode=login&next=${encodeURIComponent(next)}`;

/** A deadline is an essential: it is shown whenever the employer set one. */
export function deadlineNote(o: Opportunity, tx: (s: string) => string): string | null {
  const left = daysLeft(o);
  if (left === null) return null;
  if (left < 0) return tx("Deadline passed");
  return left === 0
    ? tx("Closes today")
    : `${left} ${left === 1 ? tx("day left") : tx("days left")}`;
}

/**
 * The frame every new section shares: kicker, title, an optional "See all".
 * The title and the link both report dashboard_section_clicked. No colour of
 * its own; it reuses the card, kicker and button tokens the rest of the app uses.
 */
export function SectionShell({
  p,
  kicker,
  title,
  seeAll,
  children,
}: {
  p: SectionProps;
  kicker: string;
  title: string;
  seeAll?: { href: string; label: string };
  children: ReactNode;
}) {
  const mark = sectionClick(p);
  return (
    <div className="evo-shell" data-density={p.variant}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">{kicker}</p>
          <h2 className="evo-shell-title mt-2 font-display text-[1.6rem] font-semibold leading-tight tracking-tight text-ink sm:text-[1.9rem]">
            {seeAll ? (
              <HrefLink
                href={seeAll.href}
                onClick={mark}
                className="transition-colors hover:text-saffron-600"
              >
                {title}
              </HrefLink>
            ) : (
              title
            )}
          </h2>
        </div>
        {seeAll && (
          <HrefLink
            href={seeAll.href}
            onClick={mark}
            className="btn-ghost !px-4 !py-2 !text-[13px]"
          >
            {seeAll.label} <ArrowUpRight size={14} aria-hidden />
          </HrefLink>
        )}
      </header>
      {/* Reveal the content, never the section: the section may be gliding to a new place. Opacity stays 1 so nothing below the fold is ever dim to a contrast check. */}
      <RevealOnView className="mt-5" fromOpacity={1}>
        {children}
      </RevealOnView>
    </div>
  );
}

/** An honest empty state: says what is missing and where to fix it, never invents content. */
export function Empty({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string; onClick?: () => void };
}) {
  return (
    <div className="card p-6">
      <p className="font-display text-lg font-semibold leading-tight text-ink">{title}</p>
      <p className="mt-2 font-body text-[13.5px] leading-relaxed text-ink-soft">{body}</p>
      {cta && (
        <HrefLink
          href={cta.href}
          onClick={cta.onClick}
          className="btn-primary mt-4 !px-5 !py-2.5 !text-[13px]"
        >
          {cta.label}
        </HrefLink>
      )}
    </div>
  );
}

export function Skeleton({ h = "h-32" }: { h?: string }) {
  return <div className={`${h} animate-pulse rounded-2xl bg-paper-deep`} aria-busy="true" />;
}

/** Title, employer, pay and deadline, plus the link in: every essential an opening has. */
export function OpeningRow({ o }: { o: Opportunity }) {
  const tx = useTx();
  const pay = payLine(o);
  const when = deadlineNote(o, tx);
  return (
    <Link
      to={o.kind === "internship" ? "/internships/$id" : "/jobs/$id"}
      params={{ id: o.slug }}
      className="group flex items-center gap-4 border-b border-ink-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-[1.05rem] font-semibold leading-tight text-ink transition-colors group-hover:text-saffron-600">
          {o.title}
        </h3>
        <p className="mt-0.5 truncate font-body text-[12.5px] text-ink-mute">
          {[o.employer?.name, o.location, when].filter(Boolean).join(" · ")}
        </p>
      </div>
      {pay && (
        <span className="shrink-0 font-display text-[0.95rem] font-semibold text-ink">{pay}</span>
      )}
      <ArrowUpRight size={16} className="shrink-0 text-ink-soft" aria-hidden />
    </Link>
  );
}

export function OpeningList({ list }: { list: ReadonlyArray<Opportunity> }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
      {list.map((o) => (
        <OpeningRow key={o.id} o={o} />
      ))}
    </div>
  );
}

/** Title, fee, duration and the link in. */
export function CourseRow({ c }: { c: Course }) {
  const tx = useTx();
  return (
    <Link
      to="/courses/$id"
      params={{ id: c.id }}
      className="group flex items-center gap-4 border-b border-ink-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-[1.05rem] font-semibold leading-tight text-ink transition-colors group-hover:text-saffron-600">
          {c.title}
        </h3>
        <p className="mt-0.5 truncate font-body text-[12.5px] text-ink-mute">{c.duration}</p>
      </div>
      <span className="shrink-0 font-display text-[0.95rem] font-semibold text-ink">
        {c.free ? tx("Free") : c.fees}
      </span>
      <ArrowUpRight size={16} className="shrink-0 text-ink-soft" aria-hidden />
    </Link>
  );
}

/** A thin real progress bar, the same one MyLearning draws. */
export function Progress({ percent, label }: { percent: number; label: string }) {
  const n = Math.round(percent);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep/70"
        role="progressbar"
        aria-valuenow={n}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <span className="block h-full rounded-full bg-saffron-500" style={{ width: `${n}%` }} />
      </div>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-mute">{n}%</span>
    </div>
  );
}
