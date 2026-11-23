import type { DriveCareer, DriveTask } from "../../data/career-test-drive";

/**
 * Where a learner's career test drive lives: one localStorage key, on this
 * device only, one result per profile (or "guest") per career. Retaking
 * replaces it. Nothing is ever sent anywhere, and nothing here scores the
 * learner: the only judgement stored is how they said it felt.
 */

export const DRIVE_KEY = "swayam.testdrive.v1";
export const MAX_NOTE = 800;

export type Feel = "enjoyed" | "ok" | "tricky";

export interface DriveAnswer {
  feel?: Feel;
  /** Option index, for multiple choice. */
  pick?: number;
  /** The learner's own words, for self-check tasks. */
  text?: string;
  /** Rubric lines the learner ticked. */
  ticks?: number[];
}

export interface DriveResult {
  ts: number;
  answers: Record<string, DriveAnswer>;
}

type Store = { v: 1; results: Record<string, DriveResult> };

const keyOf = (scope: string, slug: string) => `${scope}|${slug}`;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function clean(raw: unknown): DriveResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { ts?: unknown; answers?: unknown };
  if (!r.answers || typeof r.answers !== "object") return null;
  const answers: Record<string, DriveAnswer> = {};
  for (const [id, v] of Object.entries(r.answers as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const a = v as Partial<Record<keyof DriveAnswer, unknown>>;
    answers[id.slice(0, 40)] = {
      ...(a.feel === "enjoyed" || a.feel === "ok" || a.feel === "tricky" ? { feel: a.feel } : {}),
      ...(typeof a.pick === "number" && Number.isFinite(a.pick) ? { pick: a.pick } : {}),
      ...(typeof a.text === "string" ? { text: a.text.slice(0, MAX_NOTE) } : {}),
      ...(Array.isArray(a.ticks)
        ? { ticks: a.ticks.filter((n): n is number => typeof n === "number").slice(0, 10) }
        : {}),
    };
  }
  return { ts: typeof r.ts === "number" ? r.ts : 0, answers };
}

function read(): Store {
  const empty: Store = { v: 1, results: {} };
  try {
    const raw = storage()?.getItem(DRIVE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as { results?: Record<string, unknown> };
    if (!parsed?.results || typeof parsed.results !== "object") return empty;
    const results: Record<string, DriveResult> = {};
    for (const [k, v] of Object.entries(parsed.results)) {
      const c = clean(v);
      if (c) results[k] = c;
    }
    return { v: 1, results };
  } catch {
    return empty;
  }
}

function write(store: Store): boolean {
  try {
    const s = storage();
    if (!s) return false;
    if (Object.keys(store.results).length === 0) s.removeItem(DRIVE_KEY);
    else s.setItem(DRIVE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function loadDrive(scope: string, slug: string): DriveResult | null {
  return read().results[keyOf(scope, slug)] ?? null;
}

export function saveDrive(scope: string, slug: string, result: DriveResult): boolean {
  const store = read();
  const c = clean(result);
  if (!c) return false;
  store.results[keyOf(scope, slug)] = c;
  return write(store);
}

/** Retake: forget this career's answers. */
export function clearDrive(scope: string, slug: string): void {
  const store = read();
  delete store.results[keyOf(scope, slug)];
  write(store);
}

export interface DriveSummary {
  enjoyed: DriveTask[];
  tricky: DriveTask[];
  done: number;
}

/** What they enjoyed and what they found tricky, by their own say-so. */
export function summarise(career: DriveCareer, result: DriveResult): DriveSummary {
  const done = career.tasks.filter((t) => result.answers[t.id]);
  return {
    enjoyed: done.filter((t) => result.answers[t.id]?.feel === "enjoyed"),
    tricky: done.filter((t) => result.answers[t.id]?.feel === "tricky"),
    done: done.length,
  };
}
