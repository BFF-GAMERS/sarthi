/**
 * Free, keyless job boards (Remotive, RemoteOK): remote roles open to people in India or
 * worldwide. Used by /api/jobs-feed and by the "Jobs for me" matcher. Both boards ask to be
 * named with a link back and not to be polled hard, so results are cached for six hours.
 */
export interface ExternalJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  /** The original posting, on whichever board it came from. */
  url: string;
  postedAt: string | null;
  category: string | null;
  /** Already a sentence — "₹25,000–40,000 a month" — or null when unstated. */
  pay: string | null;
  contract: string | null;
  /** The board this came from, shown on the card ("via Remotive"). */
  source: string;
}

/** Tags are stripped: the feed returns HTML fragments and this is a snippet. */
export const clean = (s: string | undefined): string | null =>
  s
    ? s
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim() || null
    : null;

/** Locations a person in India can actually take the job from. */
const OPEN_TO_INDIA = /india|worldwide|anywhere|global|asia|apac/i;
const REMOTE_TTL_MS = 6 * 60 * 60 * 1000;

interface RemotiveRow {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
}
interface RemoteOkRow {
  id?: string;
  url?: string;
  position?: string;
  company?: string;
  location?: string;
  date?: string;
  tags?: string[];
}

async function fetchBoards(): Promise<ExternalJob[]> {
  const out: ExternalJob[] = [];
  const [remotive, remoteok] = await Promise.allSettled([
    fetch("https://remotive.com/api/remote-jobs?limit=100", {
      signal: AbortSignal.timeout(8000),
    }).then((r) => (r.ok ? (r.json() as Promise<{ jobs?: RemotiveRow[] }>) : { jobs: [] })),
    fetch("https://remoteok.com/api", {
      headers: { "user-agent": "swyam.online jobs page (links back to RemoteOK)" },
      signal: AbortSignal.timeout(8000),
    }).then((r) => (r.ok ? (r.json() as Promise<RemoteOkRow[]>) : [])),
  ]);
  if (remotive.status === "fulfilled")
    for (const r of remotive.value.jobs ?? []) {
      const where = r.candidate_required_location ?? "";
      if (!r.url || !r.title || !OPEN_TO_INDIA.test(where)) continue;
      out.push({
        id: `remotive:${r.id ?? r.url}`,
        title: clean(r.title) ?? "",
        company: clean(r.company_name),
        location: `Remote · ${clean(where) ?? "worldwide"}`,
        url: r.url,
        postedAt: r.publication_date ?? null,
        category: clean(r.category),
        // Remotive's salary is the employer's own text; shown only when given.
        pay: clean(r.salary),
        contract:
          r.job_type === "part_time" ? "Part-time" : r.job_type === "contract" ? "Contract" : null,
        source: "Remotive",
      });
    }
  if (remoteok.status === "fulfilled")
    // The first element is RemoteOK's legal notice, not a job.
    for (const r of remoteok.value.slice(1)) {
      const where = r.location ?? "";
      if (!r.url || !r.position || !OPEN_TO_INDIA.test(where)) continue;
      out.push({
        id: `remoteok:${r.id ?? r.url}`,
        title: clean(r.position) ?? "",
        company: clean(r.company),
        location: `Remote · ${clean(where) ?? "worldwide"}`,
        url: r.url,
        postedAt: r.date ?? null,
        category: r.tags?.[0] ?? null,
        pay: null,
        contract: null,
        source: "RemoteOK",
      });
    }
  return out
    .sort((a, b) => Date.parse(b.postedAt ?? "0") - Date.parse(a.postedAt ?? "0"))
    .slice(0, 60);
}

let remoteCache: { at: number; jobs: ExternalJob[] } | null = null;

/** The boards' current list, from cache when it is fresh enough. */
export async function remoteBoards(): Promise<ExternalJob[]> {
  if (remoteCache && Date.now() - remoteCache.at < REMOTE_TTL_MS) return remoteCache.jobs;
  const jobs = await fetchBoards().catch(() => []);
  if (jobs.length) remoteCache = { at: Date.now(), jobs };
  return jobs;
}
