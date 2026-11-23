/*
 * One place to read chapters for any class.
 *
 *  - Chapter list comes from data/syllabus.ts (Classes 8–12).
 *  - Hand-written chapters in data/curriculum.ts are used as-is.
 *  - Other chapters start "pending". Sarthi AI generates their notes, quiz
 *    and lecture searches on first open (server: POST /api/generate). The
 *    result is cached in this browser, so each chapter costs one AI call per
 *    device and then works without the AI.
 */

import { curriculum, type Chapter, type ClassLevel, type QuizQuestion, type Subject } from "../data/curriculum";
import { SYLLABUS, chapterId, type SyllabusSubject } from "../data/syllabus";
import { getItem, setItem } from "./store";
import seedVideos from "../data/videos.json";

export const CLASS_LEVELS: ClassLevel[] = [8, 9, 10, 11, 12];

export interface ChapterMeta {
  id: string;
  classLevel: ClassLevel;
  subjectId: string;
  subjectName: string;
  number: number;
  title: string;
}

interface GeneratedContent {
  topics: string[];
  lectures: { title: string; searchQuery: string; durationMin?: number }[];
  notes: Chapter["notes"];
  summary?: string[];
  examFocus?: { question: string; marks?: number; hint?: string }[];
  quiz: { topic: string; question: string; options: string[]; correctIndex: number; explanation: string }[];
}

export interface Video {
  id: string;
  title: string;
  channel: string;
  views: number;
  durationSec: number;
  oneShot?: boolean;
}

const videoKey = (id: string) => "videos." + id;

/** Hand-picked, oEmbed-verified lectures shipped with the app (scripts/build-video-seed.mjs). */
const SEED = seedVideos as Record<string, Video[]>;

function withVideos(ch: Chapter): Chapter {
  const vids = getItem<Video[] | null>(videoKey(ch.id), null) ?? SEED[ch.id] ?? null;
  if (!vids || vids.length === 0) return ch;
  return {
    ...ch,
    lectures: vids.map((v, i) => ({
      id: `${ch.id}-v${i + 1}`,
      title: v.title,
      durationMin: Math.max(1, Math.round(v.durationSec / 60)),
      searchQuery: v.title,
      youtubeId: v.id,
      channel: v.channel,
      views: v.views,
      oneShot: v.oneShot,
    })),
  };
}

export type VideoResult = { ok: true; chapter: Chapter } | { ok: false; error: string; configured: boolean };

/** Loads the most-watched YouTube lectures for a chapter (server-cached), then caches them here. */
export async function fetchVideos(id: string): Promise<VideoResult> {
  const meta = chapterMeta(id);
  if (!meta) return { ok: false, error: "Unknown chapter.", configured: true };
  if (getItem<Video[] | null>(videoKey(id), null) || SEED[id]) return { ok: true, chapter: getChapter(id)! };
  try {
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, classLevel: meta.classLevel, subject: meta.subjectName, chapter: meta.title }),
    });
    const data = (await res.json().catch(() => null)) as { videos?: Video[]; error?: string } | null;
    if (!res.ok || !data?.videos) return { ok: false, error: data?.error ?? "Could not load videos.", configured: res.status !== 503 };
    if (data.videos.length) setItem(videoKey(id), data.videos);
    return { ok: true, chapter: getChapter(id)! };
  } catch {
    return { ok: false, error: "Offline: videos need internet.", configured: true };
  }
}

/** Pulls every chapter's cached video list from the server in one call (used by the course catalogue). */
export async function preloadAllVideos(): Promise<{ count: number; youtube: boolean }> {
  try {
    const res = await fetch("/api/videos-all");
    const data = (await res.json()) as { videos: Record<string, Video[]>; youtube: boolean };
    let count = 0;
    for (const [id, vids] of Object.entries(data.videos)) {
      if (vids.length) {
        setItem(videoKey(id), vids);
        count += 1;
      }
    }
    return { count, youtube: data.youtube };
  } catch {
    return { count: 0, youtube: false };
  }
}

export function chapterVideoCount(id: string): number {
  return (getItem<Video[] | null>(videoKey(id), null) ?? SEED[id])?.length ?? 0;
}

const written = new Map<string, Chapter>();
for (const s of curriculum) for (const c of s.chapters) written.set(c.id, c);

const aiKey = (id: string) => "ai." + id;

function lectureSearch(meta: ChapterMeta): string {
  return `CBSE class ${meta.classLevel} ${meta.subjectName} ${meta.title} full chapter`;
}

function buildChapter(meta: ChapterMeta): Chapter {
  return withVideos(buildBase(meta));
}

function buildBase(meta: ChapterMeta): Chapter {
  const hand = written.get(meta.id);
  if (hand) {
    const cachedAi = getItem<GeneratedContent | null>(aiKey(meta.id), null);
    return { ...hand, source: "written", examFocus: cachedAi?.examFocus };
  }

  const cached = getItem<GeneratedContent | null>(aiKey(meta.id), null);
  if (cached) return fromGenerated(meta, cached);

  return {
    id: meta.id,
    number: meta.number,
    title: meta.title,
    topics: [],
    lectures: [
      {
        id: `${meta.id}-l1`,
        title: `${meta.title} – full chapter lecture`,
        durationMin: 20,
        searchQuery: lectureSearch(meta),
        youtubeId: null,
      },
    ],
    notes: [],
    quiz: [],
    source: "pending",
  };
}

/** AI output can drift from the schema (a string instead of a list, an object instead of an array). */
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v == null || v === "" ? [] : [v as T]);
const text = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : typeof v === "object" ? Object.values(v as object).join(" ") : String(v));

function cleanNotes(raw: unknown): Chapter["notes"] {
  return arr<Record<string, unknown>>(raw)
    .filter((n) => n && typeof n === "object")
    .map((n) => ({
      heading: text(n.heading) || "Notes",
      body: arr<unknown>(n.body).map(text).filter(Boolean),
      definitions: arr<Record<string, unknown>>(n.definitions)
        .filter((d) => d && typeof d === "object")
        .map((d) => ({ term: text(d.term), meaning: text(d.meaning) }))
        .filter((d) => d.term),
      formulas: arr<unknown>(n.formulas).map(text).filter(Boolean),
      examples: arr<Record<string, unknown>>(n.examples)
        .filter((e) => e && typeof e === "object")
        .map((e) => ({ question: text(e.question), answer: text(e.answer) }))
        .filter((e) => e.question),
    }));
}

function fromGenerated(meta: ChapterMeta, raw: GeneratedContent): Chapter {
  const g: GeneratedContent = {
    topics: arr<unknown>(raw.topics).map(text).filter(Boolean),
    lectures: arr<GeneratedContent["lectures"][number]>(raw.lectures).filter((l) => l && typeof l === "object"),
    notes: cleanNotes(raw.notes),
    summary: arr<unknown>(raw.summary).map(text).filter(Boolean),
    examFocus: arr<Record<string, unknown>>(raw.examFocus)
      .filter((e) => e && typeof e === "object" && text(e.question))
      .map((e) => ({ question: text(e.question), marks: Number(e.marks) || undefined, hint: text(e.hint) || undefined })),
    quiz: arr<GeneratedContent["quiz"][number]>(raw.quiz).filter(
      (q) => q && typeof q === "object" && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex) && q.correctIndex < q.options.length,
    ),
  };
  const topics = g.topics.slice(0, 8);
  const quiz: QuizQuestion[] = g.quiz.map((q, i) => ({
    id: `${meta.id}-q${i + 1}`,
    topic: topics.includes(q.topic) ? q.topic : String(q.topic || topics[0] || meta.title),
    question: String(q.question),
    options: q.options.map(String),
    correctIndex: q.correctIndex,
    explanation: String(q.explanation ?? ""),
  }));
  const lectures = (g.lectures?.length ? g.lectures : [{ title: `${meta.title} – full chapter lecture`, searchQuery: lectureSearch(meta) }])
    .slice(0, 3)
    .map((l, i) => ({
      id: `${meta.id}-l${i + 1}`,
      title: String(l.title),
      durationMin: Number(l.durationMin) > 0 ? Math.round(Number(l.durationMin)) : 15,
      searchQuery: String(l.searchQuery || lectureSearch(meta)),
      youtubeId: null,
    }));
  return {
    id: meta.id,
    number: meta.number,
    title: meta.title,
    topics,
    lectures,
    notes: g.notes,
    quiz,
    summary: g.summary,
    examFocus: g.examFocus,
    source: "ai",
  };
}

function metaFor(classLevel: ClassLevel, subj: SyllabusSubject, index: number): ChapterMeta {
  return {
    id: chapterId(classLevel, subj.code, index + 1),
    classLevel,
    subjectId: subj.id,
    subjectName: subj.name,
    number: index + 1,
    title: subj.chapters[index],
  };
}

export function listSubjects(classLevel: ClassLevel): Subject[] {
  return (SYLLABUS[classLevel] ?? []).map((subj) => ({
    id: subj.id,
    name: subj.name,
    classLevel,
    chapters: subj.chapters.map((_, i) => buildChapter(metaFor(classLevel, subj, i))),
  }));
}

export function getSubject(classLevel: ClassLevel, subjectId: string): Subject | undefined {
  return listSubjects(classLevel).find((s) => s.id === subjectId);
}

export function chapterMeta(id: string): ChapterMeta | undefined {
  const m = /^c(\d+)-([a-z]+)-(\d+)$/.exec(id);
  if (!m) return undefined;
  const classLevel = Number(m[1]) as ClassLevel;
  const subj = (SYLLABUS[classLevel] ?? []).find((s) => s.code === m[2]);
  const index = Number(m[3]) - 1;
  if (!subj || index < 0 || index >= subj.chapters.length) return undefined;
  return metaFor(classLevel, subj, index);
}

export function getChapter(id: string): Chapter | undefined {
  const meta = chapterMeta(id);
  return meta ? buildChapter(meta) : written.get(id);
}

export function allChapters(classLevel: ClassLevel): Chapter[] {
  return listSubjects(classLevel).flatMap((s) => s.chapters);
}

export function allChapterMetas(classLevel: ClassLevel): ChapterMeta[] {
  return (SYLLABUS[classLevel] ?? []).flatMap((subj) => subj.chapters.map((_, i) => metaFor(classLevel, subj, i)));
}

export type GenerateResult = { ok: true; chapter: Chapter } | { ok: false; error: string };

/** Asks Sarthi AI to write the notes + quiz for a pending chapter, then caches them on this device. */
export async function generateChapter(id: string): Promise<GenerateResult> {
  const meta = chapterMeta(id);
  if (!meta) return { ok: false, error: "Unknown chapter." };
  const existing = buildChapter(meta);
  if (existing.source !== "pending") return { ok: true, chapter: existing };

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classLevel: meta.classLevel, subject: meta.subjectName, chapter: meta.title }),
    });
    const data = (await res.json().catch(() => null)) as { content?: GeneratedContent; error?: string } | null;
    if (!res.ok || !data?.content) {
      const error =
        res.status === 503
          ? "Sarthi AI is not set up on the server yet (GEMINI_API_KEY missing)."
          : res.status === 429
            ? "Too many requests right now. Wait a minute and try again."
            : data?.error ?? "Sarthi could not prepare this chapter. Check your internet and try again.";
      return { ok: false, error };
    }
    setItem(aiKey(id), data.content);
    return { ok: true, chapter: fromGenerated(meta, data.content) };
  } catch {
    return { ok: false, error: "You seem to be offline. Chapter notes need internet the first time; after that they work offline." };
  }
}

/** Removes the cached AI material so the chapter can be generated again. */
export function clearGenerated(id: string): void {
  try {
    localStorage.removeItem("swyam." + aiKey(id));
  } catch {
    /* ignore */
  }
}

/** Plain-text lesson material for grounding Sarthi's answers. */
export function chapterContext(chapter: Chapter, limit = 6000): string {
  const lines: string[] = [];
  for (const section of chapter.notes) {
    lines.push(section.heading, ...section.body);
    for (const d of section.definitions ?? []) lines.push(`${d.term}: ${d.meaning}`);
    lines.push(...(section.formulas ?? []));
  }
  lines.push(...(chapter.summary ?? []));
  return lines.join("\n").slice(0, limit);
}
