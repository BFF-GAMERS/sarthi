import type { Course } from "../data/mock";
import { getPreferredCity } from "./local-store";

/**
 * Filtering and sorting the catalogue.
 *
 * Every filter here tests a fact the course record actually holds. Two the
 * brief asks for are deliberately absent: a language filter, because no
 * course carries a language yet (the field exists and the filter appears
 * the day one does), and "certificate included", because every course on
 * the platform ends in an assessment and a certificate — a filter that
 * matches everything is a decoration.
 *
 * "Near me" is not a distance. It is the member's chosen city, then their
 * state, then online, then the rest — which is what a person in Pune means
 * by nearest when the alternative is Kolkata.
 */

export interface CourseFilters {
  price: "any" | "free" | "paid";
  mode: "any" | "Online" | "Offline" | "Hybrid";
  city: string | "any";
  duration: "any" | "short" | "medium" | "long";
  level: "any" | "Beginner" | "Intermediate" | "Advanced";
  /** Self-paced, or a batch starting within 30 days. */
  startingSoon: boolean;
  placement: boolean;
}

export const DEFAULT_FILTERS: CourseFilters = {
  price: "any",
  mode: "any",
  city: "any",
  duration: "any",
  level: "any",
  startingSoon: false,
  placement: false,
};

export type SortId = "match" | "near" | "price" | "duration" | "rating" | "cohort";

export const SORTS: { id: SortId; label: string }[] = [
  { id: "match", label: "Best match" },
  { id: "near", label: "Near me first" },
  { id: "price", label: "Lowest price" },
  { id: "duration", label: "Shortest first" },
  { id: "rating", label: "Highest rated" },
  { id: "cohort", label: "Next to start" },
];

/* ── Reading the record ──────────────────────────────────────────── */

/** "₹2,999" → 2999; "Free" → 0. Unparseable prices sort last. */
export function priceOf(c: Course): number {
  if (c.free || /^free/i.test(c.fees)) return 0;
  const n = Number(c.fees.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
}

/** Duration in weeks, read from "6 weeks", "4 months · 10 hrs/week", "10 days". */
export function weeksOf(c: Course): number {
  const d = c.duration.toLowerCase();
  const m = /(\d+(?:\.\d+)?)\s*(week|month|day|hour)/.exec(d);
  if (!m) return Number.POSITIVE_INFINITY;
  const n = Number(m[1]);
  switch (m[2]) {
    case "month":
      return n * 4.33;
    case "day":
      return n / 7;
    case "hour":
      return n / 40;
    default:
      return n;
  }
}

export function durationBucket(c: Course): "short" | "medium" | "long" | null {
  const w = weeksOf(c);
  if (!Number.isFinite(w)) return null;
  if (w <= 4) return "short";
  if (w <= 13) return "medium";
  return "long";
}

export function startsSoon(c: Course, now = Date.now()): boolean {
  if (c.mode === "Online" && !c.startsOn) return true; // self-paced: start today
  if (!c.startsOn) return false;
  const t = new Date(c.startsOn).getTime();
  return t >= now - 86_400_000 && t <= now + 30 * 86_400_000;
}

/** Cities with at least one in-person course, for the filter. */
export function catalogueCities(all: Course[]): string[] {
  return [...new Set(all.filter((c) => c.mode !== "Online").map((c) => c.city))].sort();
}

/* ── Applying ────────────────────────────────────────────────────── */

export function applyFilters(all: Course[], f: CourseFilters): Course[] {
  return all.filter((c) => {
    if (f.price === "free" && !c.free) return false;
    if (f.price === "paid" && c.free) return false;
    if (f.mode !== "any" && c.mode !== f.mode) return false;
    if (f.city !== "any" && c.mode !== "Online" && c.city !== f.city) return false;
    if (f.city !== "any" && c.mode === "Online") return false;
    if (f.duration !== "any" && durationBucket(c) !== f.duration) return false;
    if (f.level !== "any" && c.difficulty !== f.level) return false;
    if (f.startingSoon && !startsSoon(c)) return false;
    if (f.placement && !c.placementAssistance) return false;
    return true;
  });
}

export function countActive(f: CourseFilters): number {
  let n = 0;
  if (f.price !== "any") n++;
  if (f.mode !== "any") n++;
  if (f.city !== "any") n++;
  if (f.duration !== "any") n++;
  if (f.level !== "any") n++;
  if (f.startingSoon) n++;
  if (f.placement) n++;
  return n;
}

/**
 * Sort a list already in "best match" order.
 *
 * `match` keeps the incoming order, which is the catalogue's own or the
 * skill-scored one the page computed. Every other sort is stable, so ties
 * fall back to that order rather than jumping about.
 */
export function applySort(list: Course[], sort: SortId): Course[] {
  if (sort === "match") return list;
  const city = getPreferredCity();
  const stateOf = (c: Course) => c.state;
  const myState = city ? (list.find((c) => c.city === city)?.state ?? null) : null;

  const key = (c: Course): number => {
    switch (sort) {
      case "price":
        return priceOf(c);
      case "duration":
        return weeksOf(c);
      case "rating":
        return -(c.rating || 0);
      case "cohort": {
        if (c.startsOn) return new Date(c.startsOn).getTime();
        if (c.mode === "Online") return Number.MAX_SAFE_INTEGER - 1; // start any time, after dated ones
        return Number.MAX_SAFE_INTEGER; // unknown
      }
      case "near": {
        if (!city) return c.mode === "Online" ? 0 : 1;
        if (c.city === city) return 0;
        if (myState && stateOf(c) === myState) return 1;
        if (c.mode === "Online") return 2;
        return 3;
      }
      default:
        return 0;
    }
  };
  return list
    .map((c, i) => ({ c, i, k: key(c) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.c);
}
