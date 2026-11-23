/**
 * EVENT_SPEC (plan §3.2): the one table that sanitiser, accumulator and tests read.
 *
 * Weight ladder: view 1.5 · save 2.0 · start 2.5 · commit 4.0. An event is MEANINGFUL
 * (counts toward gates and confirmations) at weight >= 1.0. Navigation and section clicks
 * feed affinity at 0.5 but are never meaningful, so tile spam never adapts the app.
 *
 * Pure: no react, no DOM, no clock.
 */
import {
  EVOLUTION_STATES,
  HOME_LAYOUTS,
  NAV_ITEM_IDS,
  NAV_SURFACES,
  SECTION_IDS,
} from "../../config/ids";
import { NAV_REGISTRY } from "../../config/navigation";
import { SECTION_META } from "../../config/sections";
import type { DomainId, EventType, NavItemId, SectionId, ServiceId } from "../../types";

export type EventKind =
  "view" | "save" | "start" | "commit" | "research" | "search" | "nav" | "platform";

/** Kinds that close a small task: they feed QUICK samples and MINIMAL sessions. */
export const GOAL_KINDS: ReadonlySet<EventKind> = new Set<EventKind>(["save", "start", "commit"]);

export const MEANINGFUL_MIN_WEIGHT = 1.0;

type MetaRule = (v: unknown) => boolean;
const en =
  (...values: readonly (string | number)[]): MetaRule =>
  (v) =>
    (typeof v === "string" || typeof v === "number") && values.includes(v);
const bool: MetaRule = (v) => typeof v === "boolean";
const int =
  (min: number, max: number): MetaRule =>
  (v) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const slug: MetaRule = (v) => typeof v === "string" && /^[a-z0-9:_-]{1,32}$/.test(v);
const inList =
  (list: readonly string[]): MetaRule =>
  (v) =>
    typeof v === "string" && list.includes(v);
/** A route TEMPLATE like /jobs/$id: no query, no hash, no segment that looks like an id. */
const route: MetaRule = (v) =>
  typeof v === "string" &&
  v.length <= 64 &&
  /^\/[A-Za-z0-9/$_.-]*$/.test(v) &&
  !v.split("/").some((s) => /^[0-9a-f-]{16,}$/i.test(s) || /^\d{3,}$/.test(s));

/** Surfaces a feature may report. Anything else is dropped (never free text). */
export const SURFACES = [
  "home",
  "courses",
  "learn",
  "my_courses",
  "practice",
  "jobs",
  "internships",
  "opportunities",
  "applications",
  "careers",
  "board",
  "skills",
  "skillswap",
  "mentor",
  "matches",
  "passport",
  "community",
  "events",
  "messages",
  "search",
  "explore",
  "cv",
  "coach",
  "path",
  "lesson",
  "assessment",
  "saved",
] as const;
const SURFACE_DOMAIN: Readonly<Record<string, DomainId>> = {
  courses: "LEARNING",
  learn: "LEARNING",
  my_courses: "LEARNING",
  practice: "LEARNING",
  lesson: "LEARNING",
  assessment: "LEARNING",
  jobs: "CAREER",
  internships: "CAREER",
  opportunities: "CAREER",
  applications: "CAREER",
  careers: "CAREER",
  cv: "CAREER",
  path: "CAREER",
  board: "SKILL_EXCHANGE",
  skills: "SKILL_EXCHANGE",
  skillswap: "SKILL_EXCHANGE",
  mentor: "SKILL_EXCHANGE",
  matches: "SKILL_EXCHANGE",
  passport: "SKILL_EXCHANGE",
  community: "COMMUNITY",
  events: "COMMUNITY",
  messages: "COMMUNITY",
};
const surface: MetaRule = inList(SURFACES);
/** The list pages that report filters and searches. A list event with any other surface is dropped. */
const listSurface: MetaRule = inList(["jobs", "internships", "courses"]);
/** Weak: below MEANINGFUL_MIN_WEIGHT (1.0) so it feeds affinity only; same weight as a nav click. */
const LIST_WEAK_W = 0.5;

export type DomainRule =
  | { fixed: DomainId }
  | { oneOf: readonly DomainId[]; bySurface: true; fallback: DomainId }
  | { platform: true }
  /** search / filter / recommendation: explicit domain, else the surface's domain, else PLATFORM. */
  | { inferred: true }
  | { nav: true }
  | { section: true };

export interface EventSpec {
  readonly kind: EventKind;
  /** Meaningful weight (ladder). */
  readonly w: number;
  /** Affinity contribution before novelty and the adaptive discount. */
  readonly aff: number;
  readonly domain: DomainRule;
  readonly entity: boolean;
  readonly goal: boolean;
  readonly meta: Readonly<Record<string, MetaRule>>;
}

const sp = (
  kind: EventKind,
  w: number,
  domain: DomainRule,
  meta: Record<string, MetaRule> = {},
  o: { aff?: number; entity?: boolean } = {},
): EventSpec => ({
  kind,
  w,
  aff: o.aff ?? w,
  domain,
  entity: o.entity ?? true,
  goal: GOAL_KINDS.has(kind),
  meta,
});

const L: DomainRule = { fixed: "LEARNING" };
const C: DomainRule = { fixed: "CAREER" };
const S: DomainRule = { fixed: "SKILL_EXCHANGE" };
const M: DomainRule = { fixed: "COMMUNITY" };
const skillSurface: DomainRule = {
  oneOf: ["LEARNING", "SKILL_EXCHANGE"],
  bySurface: true,
  fallback: "SKILL_EXCHANGE",
};
const SKILL_SURFACES = ["board", "skills", "mentor", "skillswap"] as const;

export const EVENT_SPEC: Readonly<Record<EventType, EventSpec>> = Object.freeze({
  course_viewed: sp("view", 1.5, L, { group: slug, level: slug, free: bool }),
  course_started: sp("start", 2.5, L, { via: en("enrol", "cart") }),
  course_completed: sp("commit", 4.0, L),
  course_saved: sp("save", 2.0, L),
  course_compared: sp("research", 1.0, L, { count: en(1, 2, 3) }),
  practice_completed: sp("start", 2.5, L, { surface: en("lesson", "assessment", "coach") }),
  job_viewed: sp("view", 1.5, C, { source: en("native", "external") }),
  job_saved: sp("save", 2.0, C),
  job_applied: sp("commit", 4.0, C, { kind: en("job", "internship") }),
  internship_viewed: sp("view", 1.5, C, { source: en("native", "external") }),
  internship_saved: sp("save", 2.0, C),
  application_started: sp("start", 2.5, C, {
    kind: en("job", "internship"),
    channel: en("native", "external"),
    signedIn: bool,
  }),
  career_launcher_opened: sp("view", 1.5, C, {
    surface: en("careers", "path", "cv", "coach"),
    action: en("open", "plan_built"),
  }),
  skill_viewed: sp("view", 1.5, skillSurface, { surface: inList(SKILL_SURFACES) }),
  skill_searched: sp("search", 1.0, skillSurface, {
    surface: inList([...SKILL_SURFACES, "search", "courses"]),
  }),
  skill_builder_opened: sp("view", 2.0, L, { action: en("open", "plan_built") }),
  skill_passport_opened: sp("view", 2.0, S, { self: bool }),
  skill_swap_requested: sp("commit", 4.0, S, { role: en("learn", "teach") }),
  mentor_viewed: sp("view", 1.5, S, { trainerCount: en("1", "2-5", "6+") }),
  profile_viewed: sp("view", 1.0, M, { self: bool }, { entity: false }),
  community_opened: sp("view", 1.0, M),
  community_post_viewed: sp("view", 1.5, M),
  community_post_created: sp("commit", 4.0, M),
  search_performed: sp(
    "search",
    1.0,
    { inferred: true },
    {
      surface,
      suggestionKind: slug,
      domain: inList(["LEARNING", "CAREER", "SKILL_EXCHANGE", "COMMUNITY", "PLATFORM"]),
    },
    { entity: false },
  ),
  filter_used: sp(
    "research",
    1.0,
    { inferred: true },
    { surface, filter: slug },
    { aff: 0.75, entity: false },
  ),
  // Weak list-page signals: affinity only (w < 1.0), never meaningful, so filter/search spam cannot adapt the app.
  list_filtered: sp(
    "research",
    LIST_WEAK_W,
    { inferred: true },
    { surface: listSurface, filter: slug },
    { aff: LIST_WEAK_W, entity: false },
  ),
  list_searched: sp(
    "search",
    LIST_WEAK_W,
    { inferred: true },
    { surface: listSurface },
    { aff: LIST_WEAK_W, entity: false },
  ),
  recommendation_clicked: sp(
    "view",
    1.0,
    { inferred: true },
    { surface, rank: int(1, 8), via: en("adaptive", "static") },
  ),
  navigation_item_clicked: sp(
    "nav",
    0.5,
    { nav: true },
    {
      item: inList(NAV_ITEM_IDS),
      surface: inList(NAV_SURFACES),
      position: int(0, 12),
      state: inList(EVOLUTION_STATES),
    },
    { entity: false },
  ),
  dashboard_section_clicked: sp(
    "nav",
    0.5,
    { section: true },
    { section: inList(SECTION_IDS), position: int(0, 24), layout: inList(HOME_LAYOUTS) },
    { entity: false },
  ),
  page_viewed: sp("platform", 0, { platform: true }, { route }, { aff: 0, entity: false }),
});

export const isMeaningful = (type: EventType): boolean =>
  EVENT_SPEC[type].w >= MEANINGFUL_MIN_WEIGHT;

/** Meaningful weight of a concrete event (career_launcher plan_built counts 2.5). */
export function weightOf(type: EventType, meta: Readonly<Record<string, unknown>>): number {
  if (type === "career_launcher_opened" && meta["action"] === "plan_built") return 2.5;
  return EVENT_SPEC[type].w;
}

export const surfaceDomain = (s: unknown): DomainId | null =>
  typeof s === "string" ? (SURFACE_DOMAIN[s] ?? null) : null;

export function navItemDomain(id: NavItemId): ServiceId {
  const d = NAV_REGISTRY[id].domain;
  return d === "ACCOUNT" ? "PLATFORM" : d;
}

export function sectionDomain(id: SectionId): ServiceId {
  return SECTION_META[id].domain;
}
