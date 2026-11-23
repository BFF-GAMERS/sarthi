import { createFileRoute } from "@tanstack/react-router";

/**
 * Openings from other job boards.
 *
 * The five openings on this platform were posted by employers who came here.
 * That is a short list, and a person out of work does not care whose website
 * a vacancy was typed into. So this route fetches live listings from Adzuna,
 * a jobs aggregator with real India coverage, and hands them back for the
 * Jobs page to show in a section of their own.
 *
 * Three rules, and they come straight from `db/011_only_real_openings.sql`,
 * which deleted thirty-three listings this project had written itself:
 *
 *   Nothing is invented. Every field below is copied from the feed or left
 *   out. There is no fallback list, no sample, no "example opening" — if the
 *   feed is unavailable the section does not appear.
 *
 *   Nothing is stored. These rows never enter the database. They cannot be
 *   confused with a real स्वYAM posting, cannot be applied to through this
 *   platform's application flow, and cannot end up in somebody's saved list
 *   as though this site stood behind them.
 *
 *   Nothing is claimed. The employer is named as the feed names them, and
 *   every card links out to the original posting. This site does not verify
 *   these and says so on the page.
 *
 * With ADZUNA_APP_ID and ADZUNA_APP_KEY it asks Adzuna (India, local jobs). Without them it
 * uses two free, keyless boards instead — Remotive and RemoteOK — keeping only remote roles
 * open to people in India (or worldwide). Both ask to be named as the source with a link back,
 * and not to be polled hard: every card says "via <board>" and links to that board's own page,
 * and the result is cached for six hours. If every board is down the section is not drawn.
 */

const APP_ID = process.env["ADZUNA_APP_ID"];
const APP_KEY = process.env["ADZUNA_APP_KEY"];

/** How long a fetched page is reused before the feed is asked again. */
const TTL_MS = 3 * 60 * 60 * 1000;

export type { ExternalJob } from "../../lib/jobs/remote-boards";
import { clean, remoteBoards, type ExternalJob } from "../../lib/jobs/remote-boards";

interface AdzunaRow {
  id?: string | number;
  title?: string;
  created?: string;
  redirect_url?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_time?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
}

/*
 * One cache per server instance, which is the right size for this.
 *
 * The feed changes over hours, not seconds, and a serverless instance that
 * has never seen it simply fetches once. Anything more — a shared store, a
 * cron, a table — would mean keeping copies of somebody else's listings,
 * which is the thing this route exists to avoid.
 */
let cache: { at: number; jobs: ExternalJob[]; query: string } | null = null;

/**
 * Pay, said the way the rest of this site says it.
 *
 * Adzuna returns annual figures, and flags with `salary_is_predicted` when
 * the number is its own estimate rather than the employer's. An estimate
 * presented as the employer's offer is exactly the kind of small untruth
 * that costs a jobs site its credibility, so a predicted figure is dropped.
 */
function payOf(row: AdzunaRow): string | null {
  if (row.salary_is_predicted === "1") return null;
  const min = row.salary_min;
  const max = row.salary_max;
  if (!min && !max) return null;
  const monthly = (n: number) => Math.round(n / 12 / 1000) * 1000;
  const fmt = (n: number) => `₹${monthly(n).toLocaleString("en-IN")}`;
  if (min && max && Math.abs(max - min) > 1) return `${fmt(min)}–${fmt(max)} a month`;
  return `${fmt(min ?? max!)} a month`;
}

export const Route = createFileRoute("/api/jobs-feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          });

        /*
         * An empty list, not an error status.
         *
         * "No feed configured" and "the board is down" are both ordinary
         * states in which this section simply does not appear — and a
         * non-2xx response makes the browser log a red error on a page
         * where nothing is wrong. The section is an addition; its absence
         * is not a fault to announce.
         */
        if (!APP_ID || !APP_KEY) {
          // Free remote boards (cached for six hours in remote-boards.ts).
          // The Jobs page shows a dozen; the matcher uses the whole list.
          return json({ jobs: (await remoteBoards()).slice(0, 12), remote: true });
        }

        const url = new URL(request.url);
        // One optional keyword, capped. A free-text field forwarded whole to
        // a third party is a proxy somebody else can point wherever they like.
        const what = (url.searchParams.get("what") ?? "").slice(0, 60).trim();
        const where = (url.searchParams.get("where") ?? "").slice(0, 40).trim();
        const query = `${what}|${where}`;

        if (cache && cache.query === query && Date.now() - cache.at < TTL_MS) {
          return json({ jobs: cache.jobs, cached: true, fetchedAt: cache.at });
        }

        const api = new URL("https://api.adzuna.com/v1/api/jobs/in/search/1");
        api.searchParams.set("app_id", APP_ID);
        api.searchParams.set("app_key", APP_KEY);
        api.searchParams.set("results_per_page", "12");
        api.searchParams.set("content-type", "application/json");
        if (what) api.searchParams.set("what", what);
        if (where) api.searchParams.set("where", where);

        let rows: AdzunaRow[] = [];
        try {
          const res = await fetch(api, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) return json({ jobs: [], configured: true, available: false });
          const data = (await res.json()) as { results?: AdzunaRow[] };
          rows = data.results ?? [];
        } catch {
          // A board that is slow or down is not this site's emergency.
          return json({ jobs: [], configured: true, available: false });
        }

        const jobs: ExternalJob[] = rows
          // No link, no listing: a vacancy nobody can open is not a vacancy.
          .filter((r) => r.redirect_url && r.title)
          .map((r) => ({
            id: String(r.id ?? r.redirect_url),
            title: clean(r.title) ?? "",
            company: clean(r.company?.display_name),
            location: clean(r.location?.display_name),
            url: r.redirect_url!,
            postedAt: r.created ?? null,
            category: clean(r.category?.label),
            pay: payOf(r),
            contract: r.contract_time === "part_time" ? "Part-time" : null,
            source: "Adzuna",
          }));

        cache = { at: Date.now(), jobs, query };
        return json({ jobs, cached: false, fetchedAt: cache.at });
      },
    },
  },
});
