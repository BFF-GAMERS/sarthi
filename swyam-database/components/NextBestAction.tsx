import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Target } from "lucide-react";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";
import type { NextAction } from "../lib/next-action";

/**
 * The one card that answers "what should I do now?".
 *
 * It is the only thing on the dashboard with a primary button, and it is
 * above everything else. Underneath it, at a quarter of the weight, are the
 * next two or three — so the page still says what is waiting without asking
 * the reader to rank eleven cards themselves.
 *
 * Every line comes from the engine in `lib/next-action.ts`, which builds only
 * from counts this account actually has.
 */
export default function NextBestAction({
  actions,
  loading = false,
  heading,
}: {
  actions: NextAction[];
  loading?: boolean;
  heading?: string;
}) {
  const tx = useTx();
  const [first, ...rest] = actions;

  if (loading) {
    return (
      <section className="card mt-8 p-6" aria-busy="true">
        <div className="h-3 w-28 animate-pulse rounded bg-paper-deep" />
        <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-paper-deep" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-paper-deep" />
        <div className="mt-5 h-11 w-44 animate-pulse rounded-full bg-paper-deep" />
        <span className="sr-only">{tx("Working out what to do next…")}</span>
      </section>
    );
  }

  if (!first) return null;

  return (
    <section
      data-tour="nba"
      /* `nba-breathe` does nothing on paper. In the dark register it is the
         only thing on the dashboard that moves by itself, which is the
         point: one card asks, everything else waits. */
      className={`nba-breathe mt-8 overflow-hidden rounded-[var(--radius)] border bg-paper-light ${
        first.urgent ? "border-saffron-300" : "border-ink-line"
      }`}
      aria-labelledby="nba-title"
    >
      <div className="p-6 sm:p-7">
        <p className="datum flex items-center gap-1.5">
          <Target size={12} className="text-saffron-500" aria-hidden />
          {heading ?? tx("Do this next")}
        </p>

        <h2
          id="nba-title"
          className="mt-3 font-display text-2xl leading-tight tracking-tight text-ink"
        >
          {first.title}
        </h2>
        <p className="mt-2 max-w-xl font-body text-[14.5px] leading-relaxed text-ink-soft">
          {first.why}
        </p>

        {first.progress && first.progress.total > 0 && (
          <div className="mt-4 max-w-sm">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-paper-deep"
              role="progressbar"
              aria-valuenow={Math.round(first.progress.done)}
              aria-valuemin={0}
              aria-valuemax={first.progress.total}
              aria-label={tx(first.progress.label)}
            >
              <span
                className="block h-full rounded-full bg-saffron-500 transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, Math.round((first.progress.done / first.progress.total) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-mute">
              {/* Rounded: a course 2.78% in should say 3%, not read like a test. */}
              {Math.round(first.progress.done)}/{first.progress.total} {tx(first.progress.label)}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to={first.to}
            onClick={() =>
              track(EV.RECOMMENDATION_CLICKED, { surface: "next-action", rank: 1, via: "static" })
            }
            className="btn-primary !py-3"
          >
            {first.cta} <ArrowRight size={16} aria-hidden />
          </Link>
          {first.minutes !== null && (
            <span className="inline-flex items-center gap-1.5 font-body text-[12.5px] text-ink-mute">
              <Clock size={13} aria-hidden />
              {tx("about")} {first.minutes} {tx("min")}
            </span>
          )}
        </div>
      </div>

      {/* After that — quiet, and never more than three. */}
      {rest.length > 0 && (
        <div className="border-t border-ink-line bg-paper-dim/40 px-6 py-4 sm:px-7">
          <p className="datum">{tx("After that")}</p>
          <ul className="mt-2 divide-y divide-ink-line/70">
            {rest.slice(0, 3).map((a, i) => (
              <li key={a.id}>
                <Link
                  to={a.to}
                  onClick={() =>
                    track(EV.RECOMMENDATION_CLICKED, {
                      surface: "next-action",
                      rank: i + 2,
                      via: "static",
                    })
                  }
                  className="group flex items-center gap-3 py-2.5 transition-colors hover:text-saffron-600"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-[13.5px] font-medium text-ink group-hover:text-saffron-600">
                      {a.title}
                    </span>
                    <span className="block truncate font-body text-[12px] text-ink-mute">
                      {a.why}
                    </span>
                  </span>
                  {a.minutes !== null && (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-mute">
                      {a.minutes}m
                    </span>
                  )}
                  <ArrowRight size={14} className="shrink-0 text-ink-mute" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
