import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Globe } from "lucide-react";
import { Reveal } from "./Reveal";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";
import { entityId } from "@/evolution/runtime/tracker/track";

/**
 * Openings from other job boards, kept visibly apart from this site's own.
 *
 * `db/011_only_real_openings.sql` deleted thirty-three listings this project
 * had written itself, on the grounds that a job listing is a claim that an
 * employer is hiring. These are somebody else's claims, and the design says
 * so rather than hoping the reader works it out: a different heading, a
 * different card, no verified mark, no Apply button, and every link leaving
 * the site to the original posting.
 *
 * It draws nothing at all when the feed is not configured or is unavailable.
 * A section headed "elsewhere" with an error in it is worse than no section.
 */

interface ExternalJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  postedAt: string | null;
  category: string | null;
  pay: string | null;
  contract: string | null;
  source?: string;
}

async function fetchFeed(): Promise<ExternalJob[]> {
  const res = await fetch("/api/jobs-feed");
  if (!res.ok) return [];
  const out = (await res.json()) as { jobs?: ExternalJob[] };
  return out.jobs ?? [];
}

function ago(iso: string | null, tx: (s: string) => string): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return tx("today");
  if (days === 1) return tx("yesterday");
  return `${days} ${tx("days ago")}`;
}

export default function ExternalJobs() {
  const tx = useTx();
  const feed = useQuery({
    queryKey: ["external-jobs"],
    queryFn: fetchFeed,
    /* The server caches for three hours; asking again inside that window only
       costs a round trip to be told the same thing. */
    staleTime: 30 * 60_000,
    retry: false,
  });

  const jobs = feed.data ?? [];
  if (jobs.length === 0) return null;

  return (
    <Reveal className="mt-14">
      <section aria-labelledby="elsewhere-title">
        <div className="flex items-baseline gap-2">
          <h2
            id="elsewhere-title"
            className="flex items-center gap-2 font-display text-xl tracking-tight text-ink"
          >
            <Globe size={17} className="text-ink-mute" aria-hidden />
            {tx("Also open elsewhere")}
          </h2>
          <span className="font-mono text-[12px] tabular-nums text-ink-mute">{jobs.length}</span>
        </div>
        <p className="mt-1.5 max-w-2xl font-body text-[13px] leading-relaxed text-ink-mute">
          {tx(
            "Listed on other job boards, not posted here. स्वYAM has not checked these employers, and applying happens on their site.",
          )}
        </p>

        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => {
            const when = ago(j.postedAt, tx);
            return (
              <li key={j.id}>
                <a
                  href={j.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={() =>
                    track(
                      EV.JOB_VIEWED,
                      { source: "external" },
                      { entityId: entityId("ext", j.id) },
                    )
                  }
                  className="card-flat flex h-full flex-col gap-2 p-4"
                >
                  <p className="font-body text-[14.5px] font-semibold leading-snug text-ink">
                    {j.title}
                  </p>
                  <p className="font-body text-[12.5px] text-ink-soft">
                    {j.company ?? tx("Employer not named")}
                    {j.location ? ` · ${j.location}` : ""}
                  </p>
                  {j.contract && (
                    <p className="font-body text-[12px] text-ink-mute">{tx(j.contract)}</p>
                  )}
                  {j.pay && <p className="font-mono text-[12px] tabular-nums text-ink">{j.pay}</p>}
                  <span className="grow" />
                  <p className="flex items-center gap-1.5 font-body text-[11.5px] text-ink-mute">
                    {when ? `${tx("Posted")} ${when}` : tx("Posting date not given")}
                    {j.source ? ` · ${tx("via")} ${j.source}` : ""}
                    <span className="grow" />
                    <span className="inline-flex items-center gap-1 font-semibold text-saffron-700">
                      {tx("Open")}
                      <ArrowUpRight size={12} aria-hidden />
                    </span>
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </Reveal>
  );
}
