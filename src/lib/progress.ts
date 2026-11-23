import { getItem, setItem, removeItem } from "./store";
import { getSession } from "./auth";
import { getChapter, chapterMeta, listSubjects } from "./content";
import type { ClassLevel } from "../data/curriculum";

/*
 * Learning progress, stored PER STUDENT on this device (key: progress.<studentId>).
 * Student, parent and teacher dashboards all read the same records, so a
 * parent or teacher using this device sees exactly what the student did.
 *
 * These are client-side values in localStorage: not synced between devices
 * and not verified by a server. They are a study-motivation feature.
 */

const POINTS_PER_LECTURE = 10;
const POINTS_PER_CORRECT_ANSWER = 2;
const CHAPTER_COMPLETION_BONUS = 20;
const QUIZ_AWARD_WINDOW_MS = 24 * 60 * 60 * 1000;
const PASS_PERCENT = 60;
const DAY = 24 * 60 * 60 * 1000;

export type ActivityKind = "lecture" | "quiz" | "chapter" | "sarthi" | "plan" | "redeem";

export interface Activity {
  at: string;
  kind: ActivityKind;
  chapterId?: string;
  detail?: string;
}

export interface QuizAttempt {
  chapterId: string;
  at: string;
  score: number;
  total: number;
  wrongTopics: string[];
}

export interface Progress {
  watched: Record<string, true>;
  quizzes: QuizAttempt[];
  completedChapters: string[];
  points: number;
  /** Total points ever earned (never goes down when redeeming). */
  earned: number;
  lastAwardAt: Record<string, string>;
  activity: Activity[];
}

export interface ChapterStatus {
  lecturesWatched: number;
  lecturesTotal: number;
  bestScorePct: number | null;
  attempts: number;
  completed: boolean;
  /** 0–100, half lectures and half best quiz score. */
  pct: number;
}

export interface WeakTopic {
  topic: string;
  chapterId: string;
  misses: number;
}

function emptyProgress(): Progress {
  return { watched: {}, quizzes: [], completedChapters: [], points: 0, earned: 0, lastAwardAt: {}, activity: [] };
}

/** The student whose progress is read/written: an explicit id, or the logged-in student. */
function resolveId(studentId?: string): string | null {
  if (studentId) return studentId;
  const s = getSession();
  return s && s.role === "student" ? s.accountId : null;
}

export function getProgress(studentId?: string): Progress {
  const id = resolveId(studentId);
  if (!id) return emptyProgress();
  let stored = getItem<Partial<Progress> | null>("progress." + id, null);
  if (!stored && !studentId) {
    // one-time move of the old device-wide record to the logged-in student
    const legacy = getItem<Partial<Progress> | null>("progress", null);
    if (legacy) {
      stored = legacy;
      setItem("progress." + id, legacy);
      removeItem("progress");
    }
  }
  const p = { ...emptyProgress(), ...(stored ?? {}) };
  if (!p.earned) p.earned = p.points;
  return p;
}

function save(p: Progress, studentId?: string): void {
  const id = resolveId(studentId);
  if (!id) return;
  p.activity = p.activity.slice(-600);
  setItem("progress." + id, p);
}

function log(p: Progress, kind: ActivityKind, chapterId?: string, detail?: string): Progress {
  return { ...p, activity: [...p.activity, { at: new Date().toISOString(), kind, chapterId, detail }] };
}

const lectureKey = (chapterId: string, lectureId: string) => chapterId + "/" + lectureId;

function award(p: Progress, pts: number): Progress {
  return { ...p, points: p.points + pts, earned: p.earned + pts };
}

export function markLectureWatched(chapterId: string, lectureId: string): Progress {
  const p = getProgress();
  const key = lectureKey(chapterId, lectureId);
  if (p.watched[key]) return p;
  let next = award({ ...p, watched: { ...p.watched, [key]: true as const } }, POINTS_PER_LECTURE);
  next = log(next, "lecture", chapterId, lectureId);
  next = maybeCompleteChapter(next, chapterId);
  save(next);
  return next;
}

export function submitQuiz(
  chapterId: string,
  answers: number[],
): { score: number; total: number; wrongTopics: string[]; earned: number; progress: Progress } {
  const chapter = getChapter(chapterId);
  const p = getProgress();
  if (!chapter || chapter.quiz.length === 0) return { score: 0, total: 0, wrongTopics: [], earned: 0, progress: p };

  let score = 0;
  const wrongTopics: string[] = [];
  chapter.quiz.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score += 1;
    else wrongTopics.push(q.topic);
  });
  const total = chapter.quiz.length;
  const now = Date.now();
  const lastAt = p.lastAwardAt[chapterId];
  const inWindow = lastAt !== undefined && now - Date.parse(lastAt) < QUIZ_AWARD_WINDOW_MS;
  const earned = inWindow ? 0 : score * POINTS_PER_CORRECT_ANSWER;
  const at = new Date(now).toISOString();

  let next: Progress = {
    ...award(p, earned),
    quizzes: [...p.quizzes, { chapterId, at, score, total, wrongTopics }],
    lastAwardAt: earned > 0 ? { ...p.lastAwardAt, [chapterId]: at } : p.lastAwardAt,
  };
  next = log(next, "quiz", chapterId, `${score}/${total}`);
  next = maybeCompleteChapter(next, chapterId);
  save(next);
  return { score, total, wrongTopics, earned, progress: next };
}

function maybeCompleteChapter(p: Progress, chapterId: string): Progress {
  if (p.completedChapters.includes(chapterId)) return p;
  const chapter = getChapter(chapterId);
  if (!chapter) return p;
  const passed = p.quizzes.some(
    (q) => q.chapterId === chapterId && q.total > 0 && q.score * 100 >= PASS_PERCENT * q.total,
  );
  const allWatched = chapter.lectures.every((l) => p.watched[lectureKey(chapterId, l.id)] === true);
  if (!passed || !allWatched) return p;
  return log(award({ ...p, completedChapters: [...p.completedChapters, chapterId] }, CHAPTER_COMPLETION_BONUS), "chapter", chapterId);
}

/** Logs a non-scoring activity (e.g. a Sarthi question) for streaks and weekly charts. */
export function recordActivity(kind: ActivityKind, chapterId?: string, detail?: string): void {
  const p = getProgress();
  if (!resolveId()) return;
  save(log(p, kind, chapterId, detail));
}

/** Deducts points for a reward. Returns false if the balance is too low. */
export function spendPoints(cost: number, detail: string): boolean {
  const p = getProgress();
  if (!resolveId() || p.points < cost) return false;
  save(log({ ...p, points: p.points - cost }, "redeem", undefined, detail));
  return true;
}

export function chapterStatus(chapterId: string, studentId?: string, progress?: Progress): ChapterStatus {
  const chapter = getChapter(chapterId);
  const p = progress ?? getProgress(studentId);
  const lectures = chapter?.lectures ?? [];
  const lecturesWatched = lectures.filter((l) => p.watched[lectureKey(chapterId, l.id)] === true).length;
  let bestScorePct: number | null = null;
  let attempts = 0;
  for (const q of p.quizzes) {
    if (q.chapterId !== chapterId || q.total === 0) continue;
    attempts += 1;
    const pct = Math.round((q.score / q.total) * 100);
    if (bestScorePct === null || pct > bestScorePct) bestScorePct = pct;
  }
  const completed = p.completedChapters.includes(chapterId);
  const lectureRatio = lectures.length ? lecturesWatched / lectures.length : 0;
  const pct = completed ? 100 : Math.min(100, Math.round(lectureRatio * 50 + (bestScorePct ?? 0) * 0.5));
  return { lecturesWatched, lecturesTotal: lectures.length, bestScorePct, attempts, completed, pct };
}

/** Topics missed most often, newest attempts weighted the same. Topics later answered correctly still count. */
export function weakTopics(studentId?: string, limit = 5): WeakTopic[] {
  const counts = new Map<string, WeakTopic>();
  for (const q of getProgress(studentId).quizzes) {
    for (const topic of q.wrongTopics) {
      const k = q.chapterId + "::" + topic;
      const cur = counts.get(k) ?? { topic, chapterId: q.chapterId, misses: 0 };
      cur.misses += 1;
      counts.set(k, cur);
    }
  }
  return [...counts.values()].sort((a, b) => b.misses - a.misses || a.topic.localeCompare(b.topic)).slice(0, limit);
}

export interface Stats {
  points: number;
  earned: number;
  lecturesWatched: number;
  quizzesTaken: number;
  accuracy: number | null;
  chaptersCompleted: number;
  streak: number;
  /** Activities per day for the last 7 days, oldest first. */
  week: { label: string; count: number }[];
  todayCount: number;
  lastActive: string | null;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function stats(studentId?: string): Stats {
  const p = getProgress(studentId);
  const answered = p.quizzes.reduce((n, q) => n + q.total, 0);
  const correct = p.quizzes.reduce((n, q) => n + q.score, 0);
  const perDay = new Map<string, number>();
  for (const a of p.activity) {
    const k = dayKey(new Date(a.at));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * DAY);
    return { label: d.toLocaleDateString("en-IN", { weekday: "short" }), count: perDay.get(dayKey(d)) ?? 0 };
  });
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * DAY);
    if (perDay.get(dayKey(d))) streak += 1;
    else if (i > 0) break;
  }
  return {
    points: p.points,
    earned: p.earned,
    lecturesWatched: Object.keys(p.watched).length,
    quizzesTaken: p.quizzes.length,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
    chaptersCompleted: p.completedChapters.length,
    streak,
    week,
    todayCount: perDay.get(dayKey(today)) ?? 0,
    lastActive: p.activity.length ? p.activity[p.activity.length - 1].at : null,
  };
}

export interface SubjectProgress {
  subjectId: string;
  name: string;
  total: number;
  completed: number;
  started: number;
  pct: number;
}

export function subjectProgress(classLevel: ClassLevel, studentId?: string): SubjectProgress[] {
  const p = getProgress(studentId);
  return listSubjects(classLevel).map((s) => {
    let sum = 0;
    let completed = 0;
    let started = 0;
    for (const c of s.chapters) {
      const st = chapterStatus(c.id, studentId, p);
      sum += st.pct;
      if (st.completed) completed += 1;
      if (st.pct > 0) started += 1;
    }
    return {
      subjectId: s.id,
      name: s.name,
      total: s.chapters.length,
      completed,
      started,
      pct: s.chapters.length ? Math.round(sum / s.chapters.length) : 0,
    };
  });
}

/** Chapters touched recently, newest first. */
export function recentChapters(studentId?: string, limit = 4): string[] {
  const seen: string[] = [];
  const acts = getProgress(studentId).activity;
  for (let i = acts.length - 1; i >= 0 && seen.length < limit; i--) {
    const id = acts[i].chapterId;
    if (id && !seen.includes(id) && chapterMeta(id)) seen.push(id);
  }
  return seen;
}

/** Next chapter to study: a started-but-unfinished one, else the first untouched chapter. */
export function nextChapter(classLevel: ClassLevel, studentId?: string): string | null {
  const p = getProgress(studentId);
  const recent = recentChapters(studentId, 6).find((id) => !p.completedChapters.includes(id));
  if (recent) return recent;
  for (const s of listSubjects(classLevel)) {
    for (const c of s.chapters) if (!p.completedChapters.includes(c.id)) return c.id;
  }
  return null;
}

export const BADGES = [
  { id: "first-step", label: "First step", test: (s: Stats) => s.lecturesWatched + s.quizzesTaken > 0 },
  { id: "quiz-taker", label: "Quiz taker · 5 quizzes", test: (s: Stats) => s.quizzesTaken >= 5 },
  { id: "chapter-1", label: "Chapter champion", test: (s: Stats) => s.chaptersCompleted >= 1 },
  { id: "streak-3", label: "3-day streak", test: (s: Stats) => s.streak >= 3 },
  { id: "sharp", label: "Sharp · 80%+ accuracy", test: (s: Stats) => (s.accuracy ?? 0) >= 80 && s.quizzesTaken >= 3 },
  { id: "century", label: "100 SkillPoints earned", test: (s: Stats) => s.earned >= 100 },
];
