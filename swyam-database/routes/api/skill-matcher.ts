import { createFileRoute } from "@tanstack/react-router";
import { courses, orgById } from "@/data/mock";
import { cachedOpenings, payLine, type Opportunity } from "@/lib/opportunities";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { skillCategories } from "@/data/topics";

/**
 * Mock "Skill Matcher".
 *
 * Deliberately deterministic rather than model-backed: the same input always
 * returns the same ranking, which makes the UI demoable offline and testable.
 * Swapping in a real model later means replacing `score()` only — the request
 * and response shapes are already the ones a live endpoint would use.
 */

export interface MatchRequest {
  /** Free text: what the person can already do, in their words. */
  have?: string;
  /** Free text: where they want to end up. */
  want?: string;
  /** Optional filters. */
  state?: string;
  commitment?: "short" | "medium" | "long";
}

export interface MatchResult {
  kind: "course" | "internship" | "job";
  id: string;
  title: string;
  org: string;
  meta: string;
  score: number;
  /** Human-readable justification — never a bare number. */
  because: string[];
}

export interface MatchResponse {
  category: { id: string; name: string; tagline: string } | null;
  results: MatchResult[];
  gaps: string[];
}

const STOP = new Set([
  "i",
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "my",
  "me",
  "am",
  "is",
  "are",
  "want",
  "like",
  "would",
  "know",
  "learn",
  "job",
  "work",
  "get",
  "be",
  "become",
  "good",
  "at",
  "some",
  "can",
  "do",
]);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Do two tokens refer to the same thing?
 *
 * Exact match, or a shared stem where the shorter token is a prefix of the
 * longer one and is substantial on its own ("install" ~ "installation").
 * Plain containment is deliberately NOT used: it matches "work" inside
 * "networking" and quietly poisons the ranking.
 */
function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

/** Overlap of two token sets, normalised against the smaller one. */
function overlap(a: string[], b: string[]): { hits: string[]; ratio: number } {
  const setB = new Set(b);
  const hits = [...new Set(a)].filter((t) => setB.has(t) || b.some((x) => sameStem(t, x)));
  const denom = Math.max(1, Math.min(a.length, 6));
  return { hits, ratio: Math.min(1, hits.length / denom) };
}

/** Below this, a category label would be a guess dressed up as a result. */
const CATEGORY_FLOOR = 25;

function score(haystack: string[], have: string[], want: string[]) {
  // Aspiration is weighted above current ability: the matcher points forward.
  const h = overlap(have, haystack);
  const w = overlap(want, haystack);
  return {
    value: Math.round((w.ratio * 0.62 + h.ratio * 0.38) * 100),
    hits: [...new Set([...w.hits, ...h.hits])].slice(0, 4),
  };
}

function match(body: MatchRequest, openings: Opportunity[]): MatchResponse {
  const have = tokenize(body.have ?? "");
  const want = tokenize(body.want ?? "");
  const state = body.state?.trim().toLowerCase();

  const results: MatchResult[] = [];

  for (const c of courses) {
    const hay = tokenize(
      [
        c.title,
        c.category,
        c.overview,
        ...c.outcomes,
        ...c.curriculum.flatMap((m) => m.topics),
      ].join(" "),
    );
    const s = score(hay, have, want);
    if (s.value <= 0) continue;
    const because = [
      ...s.hits.map((h) => `Covers ${h}`),
      c.free ? "No fee" : c.scholarship ? "Scholarship available" : "",
      c.placementAssistance ? "Placement assistance" : "",
    ].filter(Boolean);
    results.push({
      kind: "course",
      id: c.id,
      title: c.title,
      org: orgById(c.orgId)?.name ?? "",
      meta: `${c.duration} · ${c.mode} · ${c.city}`,
      score: s.value + (c.free ? 6 : 0) + (state && c.state.toLowerCase() === state ? 10 : 0),
      because: because.slice(0, 3),
    });
  }

  // Openings are the live rows, not the sample catalogue: a match that
  // leads to "That opening is no longer listed" is worse than no match.
  for (const o of openings) {
    const hay = tokenize(
      [o.title, o.summary ?? "", o.description ?? "", o.eligibility ?? "", ...o.skills].join(" "),
    );
    const s = score(hay, have, want);
    if (s.value <= 0) continue;
    const pay = payLine(o);
    const region = (o.region ?? "").toLowerCase();
    const internship = o.kind === "internship";
    results.push({
      kind: internship ? "internship" : "job",
      id: o.slug,
      title: o.title,
      org: o.employer?.name ?? "",
      meta: internship
        ? `${o.durationWeeks ? `${o.durationWeeks} weeks` : "Duration not stated"} · ${pay ?? "Stipend not stated"} · ${o.location ?? o.workMode}`
        : `${pay ?? "Pay not stated"} · ${o.details.experience ?? "Experience not stated"} · ${o.location ?? o.workMode}`,
      score:
        s.value +
        (state && (region === state || (o.location ?? "").toLowerCase().includes(state)) ? 10 : 0) +
        (o.workMode === "remote" ? 4 : 0),
      because: [
        ...s.hits.map((h) => (internship ? `Uses ${h}` : `Asks for ${h}`)),
        pay ? `${internship ? "Paid" : "Pay stated"} — ${pay}` : "",
        o.employer?.isVerified ? "Verified employer" : "",
      ]
        .filter(Boolean)
        .slice(0, 3),
    });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 6);

  // Best-fitting skill category, by overlap with its competency list.
  let category: MatchResponse["category"] = null;
  let best = 0;
  for (const cat of skillCategories) {
    const hay = tokenize(
      [cat.name, cat.tagline, ...cat.skills.flatMap((s) => [s.title, ...s.competencies])].join(" "),
    );
    const v = score(hay, have, want).value;
    if (v > best && v >= CATEGORY_FLOOR) {
      best = v;
      category = { id: cat.id, name: cat.name, tagline: cat.tagline };
    }
  }

  // Competencies the aspiration implies that nothing in `have` covers yet.
  const gaps = category
    ? skillCategories
        .find((c) => c.id === category!.id)!
        .skills.flatMap((s) => s.competencies)
        .filter((c) => !have.some((h) => c.toLowerCase().includes(h)))
        .slice(0, 5)
    : [];

  return { category, results: top, gaps };
}

export const Route = createFileRoute("/api/skill-matcher")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.chat);
        if (limited) return limited;

        let body: MatchRequest;
        try {
          body = (await request.json()) as MatchRequest;
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        if (!body.have?.trim() && !body.want?.trim()) {
          return Response.json(
            { error: "Tell us either what you can do or what you want to do." },
            { status: 400 },
          );
        }

        return Response.json(match(body, await cachedOpenings()), {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
