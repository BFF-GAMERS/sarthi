import { freshState, pruneMastered, review, type Box, type SpacedState } from "./spaced";

/**
 * The mistake notebook's store.
 *
 * Local only: one localStorage key, never sent anywhere. Each signed-in profile
 * (or "guest") has its own list so a shared device does not mix people up. Every
 * read and write is guarded, because storage can be blocked, full or corrupt,
 * and the notebook is a convenience that must never break an assessment.
 *
 * Only wrong answers are stored, with what the learner chose. No scores, no
 * right answers. The correct option is kept only if the grader ever exposes it.
 */

export const MISTAKES_KEY = "swayam.mistakes.v1";
export const REMIND_KEY = "swayam.mistakes.remind.v1";
export const MISTAKES_EVENT = "swayam:mistakes";
export const MISTAKE_CAP = 200;
const MAX_TEXT = 600;
const MAX_OPTION = 240;
const MAX_OPTIONS = 8;

export interface MistakeItem extends SpacedState {
  /** `${assessmentId}:${questionId}` */
  id: string;
  assessmentId: string;
  questionId: string;
  question: string;
  options: string[];
  chosen: string;
  chosenIndex: number;
  /** Only when the result payload exposed it. */
  correct?: string;
  source: string;
  /** Last time it was answered wrongly. */
  ts: number;
  reviews: number;
}

export interface WrongEntry {
  assessmentId: string;
  questionId: string;
  question: string;
  options?: string[];
  chosenIndex: number;
  chosen: string;
  correct?: string;
  source: string;
}

interface Store {
  v: 1;
  scopes: Record<string, MistakeItem[]>;
}

export const scopeFor = (profileId?: string | null): string => profileId || "guest";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const clip = (s: unknown, n: number): string => (typeof s === "string" ? s.slice(0, n) : "");
const num = (n: unknown, d: number): number =>
  typeof n === "number" && Number.isFinite(n) ? n : d;

function coerce(raw: unknown): MistakeItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Record<keyof MistakeItem, unknown>>;
  const assessmentId = clip(r.assessmentId, 80);
  const questionId = clip(r.questionId, 80);
  const question = clip(r.question, MAX_TEXT);
  if (!assessmentId || !questionId || !question) return null;
  const box = [1, 2, 3, 4].includes(num(r.box, 0)) ? (num(r.box, 1) as Box) : 1;
  const options = Array.isArray(r.options)
    ? r.options.slice(0, MAX_OPTIONS).map((o) => clip(o, MAX_OPTION))
    : [];
  const correct = clip(r.correct, MAX_OPTION);
  return {
    id: `${assessmentId}:${questionId}`,
    assessmentId,
    questionId,
    question,
    options,
    chosen: clip(r.chosen, MAX_OPTION),
    chosenIndex: num(r.chosenIndex, -1),
    ...(correct ? { correct } : {}),
    source: clip(r.source, 60) || "assessment",
    ts: num(r.ts, 0),
    reviews: Math.max(0, num(r.reviews, 0)),
    box,
    dueAt: num(r.dueAt, 0),
    mastered: r.mastered === true,
    ...(typeof r.masteredAt === "number" ? { masteredAt: r.masteredAt } : {}),
  };
}

function readStore(): Store {
  const empty: Store = { v: 1, scopes: {} };
  try {
    const raw = storage()?.getItem(MISTAKES_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as { scopes?: Record<string, unknown> };
    if (!parsed || typeof parsed.scopes !== "object" || !parsed.scopes) return empty;
    const scopes: Record<string, MistakeItem[]> = {};
    for (const [k, v] of Object.entries(parsed.scopes)) {
      if (!Array.isArray(v)) continue;
      scopes[k] = v.map(coerce).filter((x): x is MistakeItem => x !== null);
    }
    return { v: 1, scopes };
  } catch {
    return empty;
  }
}

function notify() {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(MISTAKES_EVENT));
  } catch {
    /* nothing listening is fine */
  }
}

function writeStore(store: Store): boolean {
  try {
    const s = storage();
    if (!s) return false;
    const live = Object.fromEntries(Object.entries(store.scopes).filter(([, v]) => v.length > 0));
    if (Object.keys(live).length === 0) s.removeItem(MISTAKES_KEY);
    else s.setItem(MISTAKES_KEY, JSON.stringify({ v: 1, scopes: live }));
    notify();
    return true;
  } catch {
    return false;
  }
}

/** Keep at most `cap`: mastered items go first (oldest first), then the oldest misses. */
export function trimToCap(items: MistakeItem[], cap = MISTAKE_CAP): MistakeItem[] {
  if (items.length <= cap) return items;
  const rank = (i: MistakeItem) =>
    i.mastered ? (i.masteredAt ?? 0) : Number.MAX_SAFE_INTEGER / 2 + i.ts;
  const drop = new Set(
    [...items]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, items.length - cap)
      .map((i) => i.id),
  );
  return items.filter((i) => !drop.has(i.id));
}

export function loadMistakes(scope: string, now = Date.now()): MistakeItem[] {
  return pruneMastered(readStore().scopes[scope] ?? [], now);
}

/** Save wrong answers (never right ones). A repeat miss resets the item to box 1. */
export function recordWrong(scope: string, entries: WrongEntry[], now = Date.now()): number {
  if (entries.length === 0) return 0;
  const store = readStore();
  const list = [...(store.scopes[scope] ?? [])];
  let saved = 0;
  for (const e of entries) {
    const base = coerce({ ...e, ts: now, reviews: 0, ...freshState(now) });
    if (!base) continue;
    const at = list.findIndex((i) => i.id === base.id);
    if (at >= 0) list[at] = { ...base, reviews: list[at].reviews };
    else list.push(base);
    saved += 1;
  }
  store.scopes[scope] = trimToCap(list);
  return writeStore(store) ? saved : 0;
}

/** Apply one practice result to one item. */
export function applyReview(scope: string, id: string, correct: boolean, now = Date.now()): void {
  const store = readStore();
  const list = store.scopes[scope] ?? [];
  const at = list.findIndex((i) => i.id === id);
  if (at < 0) return;
  list[at] = { ...list[at], ...review(list[at], correct, now), reviews: list[at].reviews + 1 };
  store.scopes[scope] = list;
  writeStore(store);
}

export function removeMistake(scope: string, id: string): void {
  const store = readStore();
  store.scopes[scope] = (store.scopes[scope] ?? []).filter((i) => i.id !== id);
  writeStore(store);
}

/** Delete this profile's notebook. */
export function clearScope(scope: string): void {
  const store = readStore();
  delete store.scopes[scope];
  writeStore(store);
}

/** Delete every notebook on this device (all profiles). */
export function clearAllMistakes(): void {
  try {
    storage()?.removeItem(MISTAKES_KEY);
    notify();
  } catch {
    /* storage blocked: nothing was saved */
  }
}

/** A readable copy the learner can keep. Built only from what is already on their device. */
export function exportMistakes(scope: string): string {
  const rows = loadMistakes(scope).map((i) => ({
    question: i.question,
    yourAnswer: i.chosen,
    ...(i.correct ? { correctAnswer: i.correct } : {}),
    from: i.source,
    savedAt: new Date(i.ts).toISOString(),
  }));
  return JSON.stringify({ app: "Swayam", notebook: rows }, null, 2);
}

export function remindersOn(): boolean {
  try {
    return storage()?.getItem(REMIND_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRemindersOn(on: boolean): void {
  try {
    const s = storage();
    if (!s) return;
    if (on) s.setItem(REMIND_KEY, "1");
    else s.removeItem(REMIND_KEY);
    notify();
  } catch {
    /* ignore */
  }
}
