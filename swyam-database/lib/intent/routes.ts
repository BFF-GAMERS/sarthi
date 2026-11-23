/**
 * "Say it": the list of places a phrase is allowed to take someone.
 *
 * The ids are the site's own navigation ids (NAV_REGISTRY, read-only) minus the
 * demo lab, and the only extra things a destination may carry are the filters
 * listed in INTENT_FILTERS. Nothing outside this file's allowlist can become a
 * link: the keyword matcher and the server model both produce an
 * `IntentMatch`, and validate.ts re-checks it against these tables before a
 * link is built.
 */
import { NAV_ITEM_IDS } from "@/evolution/config/ids";
import { NAV_REGISTRY } from "@/evolution/config/navigation";
import type { NavItemId } from "@/evolution/types";

export type IntentRouteId = Exclude<NavItemId, "LAB">;

export const INTENT_ROUTE_IDS: readonly IntentRouteId[] = Object.freeze(
  NAV_ITEM_IDS.filter((id): id is IntentRouteId => id !== "LAB"),
);

const ROUTE_SET: ReadonlySet<string> = new Set(INTENT_ROUTE_IDS);
export const isIntentRouteId = (v: unknown): v is IntentRouteId =>
  typeof v === "string" && ROUTE_SET.has(v);

export const INTENT_KINDS = ["course", "internship", "job", "work"] as const;
export type IntentKind = (typeof INTENT_KINDS)[number];

/** Either a closed list of values, or a bounded text pattern (never produced by the server model). */
export type FilterSpec = readonly string[] | { readonly pattern: RegExp; readonly max: number };

/**
 * The filters a destination accepts. `/opportunities` reads `kind` today; `remote`, `free` and `track` are
 * declared so the page can start honouring them without another change here.
 */
export const INTENT_FILTERS: Readonly<
  Partial<Record<IntentRouteId, Readonly<Record<string, FilterSpec>>>>
> = Object.freeze({
  OPPORTUNITIES: Object.freeze({
    kind: INTENT_KINDS,
    remote: ["1"],
    free: ["1"],
    track: { pattern: /^[a-z0-9-]+$/, max: 32 },
  }),
  SEARCH: Object.freeze({
    q: { pattern: /^[\p{L}\p{M}\p{N} '+#.&-]+$/u, max: 60 },
  }),
});

export interface IntentMatch {
  routeId: IntentRouteId;
  /** Search-param filters, every key and value allowed by INTENT_FILTERS. */
  filters: Record<string, string>;
}

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Is `key=value` an allowed filter for this destination? */
export function filterAllowed(routeId: IntentRouteId, key: string, value: unknown): boolean {
  const specs = INTENT_FILTERS[routeId];
  if (!specs || !has(specs, key) || typeof value !== "string") return false;
  const spec = specs[key]!;
  if (Array.isArray(spec)) return (spec as readonly string[]).includes(value);
  const text = spec as { pattern: RegExp; max: number };
  return value.length > 0 && value.length <= text.max && text.pattern.test(value);
}

/** Splits a registry href into path, query and hash without letting a second `#` or `?` slip through. */
export function splitHref(href: string): { path: string; query: string; hash: string } {
  const h = href.indexOf("#");
  const noHash = h < 0 ? href : href.slice(0, h);
  const q = noHash.indexOf("?");
  return {
    path: q < 0 ? noHash : noHash.slice(0, q),
    query: q < 0 ? "" : noHash.slice(q + 1),
    hash: h < 0 ? "" : href.slice(h + 1),
  };
}

/**
 * The link for a match that has already been validated.
 *
 * Signed-in people get the member route, visitors the visitor route (a sign-in redirect for pages that need an
 * account, which the registry builds and which drops the filters).
 */
export function hrefForMatch(match: IntentMatch, signedIn: boolean): string {
  const dest = NAV_REGISTRY[match.routeId];
  const base = signedIn ? dest.member : dest.visitor;
  if (base.startsWith("/auth")) return base;
  const { path, query, hash } = splitHref(base);
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(match.filters)) params.set(k, v);
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Where a phrase that matched nothing offers to go instead. Each one still needs a confirm. */
export const INTENT_SUGGESTIONS: readonly IntentMatch[] = Object.freeze([
  { routeId: "INTERNSHIPS", filters: {} },
  { routeId: "JOBS", filters: {} },
  { routeId: "COURSES", filters: {} },
  { routeId: "SKILLS", filters: {} },
  { routeId: "SKILL_DIRECTORY", filters: {} },
] as IntentMatch[]);
