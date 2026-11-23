import { ArrowRight, Check } from "lucide-react";
import { useEvolutionSnapshot } from "@/evolution/react/hooks";
import { useTx } from "@/lib/i18n";
import HrefLink from "../HrefLink";
import { useIntentLane, useOpenings } from "../data";
import { sectionClick } from "../track";
import type { SectionProps } from "../types";
import { MIN_TAGS, type LaneStep } from "./intent-model";
import { Empty, SectionShell, Skeleton } from "./shared";

/**
 * The Intent Lane: one cross-service path (Learn, Prove, Apply, plus a Swap or Ask step in the skill
 * and community layouts) built from the tags that keep coming up in what this visitor opened. Every
 * step says where it came from. Worked out on this device; a visitor never sees a match percentage.
 *
 * In the standard and discovery layouts it stays out of the way until two skills actually repeat
 * (the grid learns this from useEmptySections); in the evolved layouts it explains itself instead.
 */
export default function IntentLane(p: SectionProps) {
  const tx = useTx();
  const lane = useIntentLane(p.signedIn, p.layout);
  const openings = useOpenings();
  const recent = useEvolutionSnapshot().profile.recent;
  const mark = sectionClick(p);
  const quiet = p.layout === "UNIVERSAL" || p.layout === "DISCOVERY";

  if (lane.status === "empty") {
    if (quiet) return null;
    return (
      <SectionShell p={p} kicker={tx("Your path")} title={tx("Learn, prove, apply")}>
        {openings.isPending && recent.length > 0 ? (
          <Skeleton h="h-40" />
        ) : (
          <Empty
            title={tx("Your path starts with what you open")}
            body={`${tx("Open a few roles or courses. When two skills keep coming up, Swayam lines up a course, a way to prove it and an opening to apply for.")} ${Math.min(lane.recurring, MIN_TAGS)} ${tx("of")} ${MIN_TAGS} ${tx("repeating skills so far. It stays on this device.")}`}
            cta={{ href: "/jobs", label: tx("Browse jobs"), onClick: mark }}
          />
        )}
      </SectionShell>
    );
  }

  const compact = p.variant === "compact";
  const four = lane.steps.length >= 4;
  const cols = four ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  const joint = four ? "lg:block" : "md:block";

  return (
    <SectionShell p={p} kicker={tx("Your path")} title={tx("Learn, prove, apply")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-body text-[12.5px] text-ink-mute">
          {tx("These keep coming up in what you opened:")}
        </span>
        {lane.tags.map((t) => (
          <span key={t.tag} className="chip !text-[11px]">
            {t.label}
            {p.variant === "research" ? ` · ${t.total}` : ""}
          </span>
        ))}
      </div>

      <ol className={`grid gap-3 ${cols}`} aria-label={tx("Your path, step by step")}>
        {lane.steps.map((s, i) => (
          <li key={s.kind} className="relative min-w-0">
            <StepCard step={s} index={i} compact={compact} mark={mark} />
            {i < lane.steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute -right-3 top-9 hidden h-px w-3 bg-ink-line ${joint}`}
              />
            )}
          </li>
        ))}
      </ol>

      <p className="mt-3 font-body text-[12px] leading-relaxed text-ink-mute">
        {tx("Worked out on this device from the skills on what you opened. Nothing is scored.")}
      </p>
    </SectionShell>
  );
}

function StepCard({
  step: s,
  index,
  compact,
  mark,
}: {
  step: LaneStep;
  index: number;
  compact: boolean;
  mark: () => void;
}) {
  const tx = useTx();
  return (
    <div className="card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron-50 font-mono text-[12px] font-semibold text-saffron-600"
        >
          {index + 1}
        </span>
        <p className="kicker">{tx(s.verb)}</p>
        {s.sample && <span className="chip !text-[10px]">{tx("Sample")}</span>}
      </div>
      <h3 className="mt-3 font-display text-[1.05rem] font-semibold leading-snug text-ink">
        {s.title}
      </h3>
      {s.sub && !compact && (
        <p className="mt-1 font-body text-[12.5px] leading-snug text-ink-soft">{s.sub}</p>
      )}
      <p className="mt-3 flex items-start gap-1.5 font-body text-[12px] leading-snug text-ink-mute">
        <Check size={13} aria-hidden className="mt-0.5 shrink-0 text-saffron-600" />
        <span>
          <span className="sr-only">{tx("Why this step")}: </span>
          {s.receipt}
        </span>
      </p>
      {!compact && s.alt.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4">
          {s.alt.map((a) => (
            <li key={a.href}>
              <HrefLink
                href={a.href}
                onClick={mark}
                className="inline-flex min-h-11 items-center font-body text-[12.5px] text-ink-soft underline underline-offset-4 transition-colors hover:text-saffron-600 motion-reduce:transition-none"
              >
                {tx(a.label)}
              </HrefLink>
            </li>
          ))}
        </ul>
      )}
      {/* The primary action sits on the card's bottom edge, so the buttons line up across the row. */}
      <div className="mt-auto pt-4">
        <HrefLink
          href={s.href}
          onClick={mark}
          className={`${index === 0 ? "btn-primary" : "btn-ghost"} min-h-11 !px-4 !py-2.5 !text-[13px]`}
        >
          {tx(s.cta)} <ArrowRight size={14} aria-hidden />
        </HrefLink>
      </div>
    </div>
  );
}
