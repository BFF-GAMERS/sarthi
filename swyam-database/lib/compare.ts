import { useSyncExternalStore } from "react";
import {
  COMPARE_LIMIT,
  groupOf,
  isCompareKind,
  isValidCompareId,
  otherGroup,
  type CompareGroup,
  type CompareKind,
} from "./compare-fields";

/**
 * The compare shortlist: up to three things, side by side.
 *
 * Two groups, because a job and a course are not the same kind of decision:
 * jobs and internships compare together ("opportunity"), courses compare with
 * courses. Each group keeps its own list of up to three.
 *
 * Kept on the device, not the account, because it is scratch — the sort of
 * thing you do with three tabs open, only without the three tabs. It does
 * not need to follow anyone to another phone, and a signed-out visitor
 * should be able to use it too. If storage is blocked the list still works
 * for the life of the tab.
 *
 * The course group keeps the original key and format, so a shortlist made
 * before this file grew a second group is still there, and the course-only
 * exports at the bottom keep working untouched.
 */

const COURSE_KEY = "swayam-compare"; // string[] of course ids (the original)
const OPPORTUNITY_KEY = "swayam-compare-opportunities"; // { kind, id, title }[]
export const COMPARE_MAX = COMPARE_LIMIT;

export interface CompareEntry {
  kind: CompareKind;
  id: string;
  /** Empty for a course shortlisted before titles were kept; the dock looks those up. */
  title: string;
}

const listeners = new Set<() => void>();
const bump = () => listeners.forEach((l) => l());

/** The tab's own copy, used when storage is unavailable or refuses a write. */
const memory: Record<CompareGroup, CompareEntry[]> = { course: [], opportunity: [] };

function parseGroup(group: CompareGroup, text: string | null): CompareEntry[] | null {
  if (text === null) return null;
  const v: unknown = JSON.parse(text);
  if (!Array.isArray(v)) return [];
  const out: CompareEntry[] = [];
  for (const x of v) {
    if (group === "course") {
      if (isValidCompareId(x) && !out.some((e) => e.id === x))
        out.push({ kind: "course", id: x, title: "" });
    } else if (x && typeof x === "object") {
      const o = x as { kind?: unknown; id?: unknown; title?: unknown };
      if (
        isCompareKind(o.kind) &&
        o.kind !== "course" &&
        isValidCompareId(o.id) &&
        !out.some((e) => e.id === o.id)
      ) {
        out.push({
          kind: o.kind,
          id: o.id,
          title: typeof o.title === "string" ? o.title.slice(0, 160) : "",
        });
      }
    }
  }
  return out.slice(0, COMPARE_MAX);
}

function readGroup(group: CompareGroup): CompareEntry[] {
  if (typeof localStorage !== "undefined") {
    try {
      const stored = parseGroup(
        group,
        localStorage.getItem(group === "course" ? COURSE_KEY : OPPORTUNITY_KEY),
      );
      if (stored !== null) return stored;
    } catch {
      /* fall through to the tab's own copy */
    }
  }
  return memory[group];
}

function writeGroup(group: CompareGroup, entries: CompareEntry[]) {
  const next = entries.slice(0, COMPARE_MAX);
  memory[group] = next;
  if (typeof localStorage !== "undefined") {
    try {
      const payload = group === "course" ? next.map((e) => e.id) : next;
      localStorage.setItem(
        group === "course" ? COURSE_KEY : OPPORTUNITY_KEY,
        JSON.stringify(payload),
      );
    } catch {
      /* private mode or full: the in-memory copy carries on */
    }
  }
  bump();
}

/* ── group-aware API ────────────────────────────────────────────────── */

export const compareEntries = readGroup;

export type ToggleResult = "added" | "removed" | "full" | "mixed";

/**
 * What would stop this item being added, or null.
 * `full`: the group already holds three. `mixed`: the other group has picks
 * and this one has none, so the two would end up mixed.
 */
export function compareBlocker(kind: CompareKind, id: string): "full" | "mixed" | null {
  const group = groupOf(kind);
  const mine = readGroup(group);
  if (mine.some((e) => e.id === id)) return null;
  if (mine.length >= COMPARE_MAX) return "full";
  if (mine.length === 0 && readGroup(otherGroup(group)).length > 0) return "mixed";
  return null;
}

export function toggleCompareItem(kind: CompareKind, id: string, title = ""): ToggleResult {
  const group = groupOf(kind);
  const mine = readGroup(group);
  if (mine.some((e) => e.id === id)) {
    writeGroup(
      group,
      mine.filter((e) => e.id !== id),
    );
    return "removed";
  }
  const blocked = compareBlocker(kind, id);
  if (blocked) return blocked;
  writeGroup(group, [...mine, { kind, id, title }]);
  return "added";
}

export function removeCompareItem(group: CompareGroup, id: string) {
  const mine = readGroup(group);
  if (mine.some((e) => e.id === id)) {
    writeGroup(
      group,
      mine.filter((e) => e.id !== id),
    );
  }
}

export const clearCompareGroup = (group: CompareGroup) => writeGroup(group, []);

const subscribe = (l: () => void) => {
  listeners.add(l);
  if (typeof window !== "undefined") window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", l);
  };
};

// Stable snapshots: useSyncExternalStore compares by identity, so the same
// contents must come back as the same array or every render would loop.
const EMPTY: CompareEntry[] = [];
const caches: Record<CompareGroup, { key: string; list: CompareEntry[] }> = {
  course: { key: "", list: EMPTY },
  opportunity: { key: "", list: EMPTY },
};

function snapshotOf(group: CompareGroup): CompareEntry[] {
  const list = readGroup(group);
  const key = list.map((e) => `${e.kind}:${e.id}:${e.title}`).join("|");
  const c = caches[group];
  if (key !== c.key) {
    c.key = key;
    c.list = list.length ? list : EMPTY;
  }
  return c.list;
}

const snapshots: Record<CompareGroup, () => CompareEntry[]> = {
  course: () => snapshotOf("course"),
  opportunity: () => snapshotOf("opportunity"),
};
const serverSnapshot = () => EMPTY;

export function useCompareGroup(group: CompareGroup): CompareEntry[] {
  return useSyncExternalStore(subscribe, snapshots[group], serverSnapshot);
}

/** What a Compare checkbox needs to know about one item. */
export function useCompareStatus(kind: CompareKind, id: string) {
  const group = groupOf(kind);
  const mine = useCompareGroup(group);
  const other = useCompareGroup(otherGroup(group));
  const on = mine.some((e) => e.id === id);
  const blocked: "full" | "mixed" | null = on
    ? null
    : mine.length >= COMPARE_MAX
      ? "full"
      : mine.length === 0 && other.length > 0
        ? "mixed"
        : null;
  return { on, blocked, count: mine.length, group };
}

/* ── the original, courses-only API (Saved, CourseFilters, the old page) ─ */

export const compareList = (): string[] => readGroup("course").map((e) => e.id);
export const inCompare = (id: string) => compareList().includes(id);

/** Add or remove. Returns false if the list is full and the id is not in it. */
export function toggleCompare(id: string): boolean {
  const mine = readGroup("course");
  if (mine.some((e) => e.id === id)) {
    writeGroup(
      "course",
      mine.filter((e) => e.id !== id),
    );
    return true;
  }
  if (mine.length >= COMPARE_MAX) return false;
  writeGroup("course", [...mine, { kind: "course", id, title: "" }]);
  return true;
}

export const clearCompare = () => clearCompareGroup("course");

let idsCache: string[] = [];
let idsKey = "";
const EMPTY_IDS: string[] = [];
function idsSnapshot(): string[] {
  const ids = compareList();
  const k = ids.join("|");
  if (k !== idsKey) {
    idsCache = ids.length ? ids : EMPTY_IDS;
    idsKey = k;
  }
  return idsCache;
}

export function useCompare(): string[] {
  return useSyncExternalStore(subscribe, idsSnapshot, () => EMPTY_IDS);
}
