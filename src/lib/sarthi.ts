/*
 * Sarthi: a local answer engine over the lessons stored in curriculum.ts.
 *
 * This is keyword matching only. The Hindi map below translates a small set
 * of Devanagari and Hinglish keywords into the English terms used in the
 * notes. It is NOT real Hindi understanding: there is no grammar, no word
 * forms and no meaning beyond these few words. Nothing here calls a network
 * or a language model.
 */

import { curriculum } from "../data/curriculum";
import type { Chapter, ClassLevel, NoteSection, QuizQuestion } from "../data/curriculum";
import { getChapter, listSubjects } from "./content";
import { chapterStatus } from "./progress";

/** Keyword-level only, not real Hindi understanding. Applied before stopword removal. */
const HINDI_KEYWORDS: ReadonlyMap<string, string> = new Map([
  ["संतुलन", "balancing"],
  ["अम्ल", "acid"],
  ["क्षार", "base"],
  ["अभिक्रिया", "reaction"],
  ["लवण", "salt"],
  ["अभाज्य", "prime"],
  ["संकेतक", "indicator"],
  ["उदासीनीकरण", "neutralisation"],
  ["ph", "ph"],
]);

const STOPWORDS: ReadonlySet<string> = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "what",
  "how",
  "of",
  "and",
  "to",
  "in",
  "on",
  "for",
  "me",
  "explain",
  "ka",
  "ki",
  "ke",
  "hai",
  "kya",
]);

const NO_MATCH_TEXT =
  "I don't have a local explanation for that yet. Try a chapter topic such as balancing equations, pH or Euclid's division lemma.";

/** Lowercases, strips punctuation (keeping Devanagari letters and marks), maps Hindi keywords, drops stopwords. */
function tokenise(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ");
  return cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => HINDI_KEYWORDS.get(w) ?? w)
    .flatMap((w) => w.split(/\s+/))
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/** All searchable text of a note section: heading, body, definition terms and meanings, formulas. */
function sectionText(section: NoteSection): string {
  const parts: string[] = [section.heading, ...section.body];
  for (const d of section.definitions ?? []) {
    parts.push(d.term, d.meaning);
  }
  parts.push(...(section.formulas ?? []));
  return parts.join(" ");
}

/** Heading, first body paragraph, then any definitions that share a word with the question. */
function renderSection(section: NoteSection, querySet: ReadonlySet<string>): string {
  const first = section.body[0];
  const lines: string[] = [first ? `${section.heading}. ${first}` : section.heading];
  for (const d of section.definitions ?? []) {
    const defTokens = tokenise(`${d.term} ${d.meaning}`);
    if (defTokens.some((t) => querySet.has(t))) {
      lines.push(`${d.term}: ${d.meaning}`);
    }
  }
  return lines.join("\n");
}

interface Candidate {
  chapter: Chapter;
  section: NoteSection;
  score: number;
}

/**
 * Finds the note section(s) that best match the question by token overlap.
 * Returns the best section, plus a second one only if it also scores well
 * (at least 2 shared tokens and at least 75% of the best score).
 */
export function answer(question: string, chapterId?: string): { text: string; sources: string[] } {
  const querySet = new Set(tokenise(question));

  let chapters: Chapter[];
  if (chapterId === undefined) {
    chapters = curriculum.flatMap((s) => s.chapters);
  } else {
    const one = getChapter(chapterId);
    chapters = one ? [one] : [];
  }

  const ranked: Candidate[] = [];
  for (const chapter of chapters) {
    for (const section of chapter.notes) {
      const sectionSet = new Set(tokenise(sectionText(section)));
      const score = Array.from(querySet).filter((t) => sectionSet.has(t)).length;
      ranked.push({ chapter, section, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score <= 0) {
    return { text: NO_MATCH_TEXT, sources: [] };
  }

  const picks: Candidate[] = [best];
  const second = ranked[1];
  if (second && second.score >= 2 && second.score >= best.score * 0.75) {
    picks.push(second);
  }

  return {
    text: picks.map((p) => renderSection(p.section, querySet)).join("\n\n"),
    sources: picks.map((p) => `${p.chapter.title} > ${p.section.heading}`),
  };
}

/** The first chapter for this class that the learner has not completed. */
export function suggestNext(classLevel: ClassLevel): string {
  for (const subject of listSubjects(classLevel)) {
    for (const chapter of subject.chapters) {
      if (!chapterStatus(chapter.id).completed) {
        return `Chapter ${chapter.number}: ${chapter.title}`;
      }
    }
  }
  return "You have completed every chapter for this class.";
}

/** A random quiz question from the chapter, or null if the chapter has none. */
export function practiceQuestion(chapterId: string): QuizQuestion | null {
  const quiz = getChapter(chapterId)?.quiz ?? [];
  if (quiz.length === 0) return null;
  const index = Math.floor(Math.random() * quiz.length);
  return quiz[index] ?? null;
}

/** The stored explanation for a quiz question, or a fallback if it cannot be found. */
export function explainWrong(chapterId: string, questionId: string): string {
  const q = getChapter(chapterId)?.quiz.find((item) => item.id === questionId);
  return q?.explanation ?? "No explanation available.";
}
