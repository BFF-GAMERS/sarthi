/*
 * CBSE chapter lists for Classes 8–12 (NCERT, rationalised syllabus).
 * The data lives in syllabus.json so the server and scripts can read it too.
 *
 * Verify titles against the current NCERT books before each session: NCERT
 * revises chapter lists from time to time.
 */

import type { ClassLevel } from "./curriculum";
import raw from "./syllabus.json";

export interface SyllabusSubject {
  id: string;
  code: string;
  name: string;
  chapters: string[];
}

export const SYLLABUS = raw as unknown as Record<ClassLevel, SyllabusSubject[]>;

/** Stream presets offered to Class 11–12 students. */
export const STREAMS: Record<string, string[]> = {
  PCM: ["physics", "chemistry", "mathematics"],
  PCB: ["physics", "chemistry", "biology"],
  PCMB: ["physics", "chemistry", "mathematics", "biology"],
};

export function chapterId(classLevel: ClassLevel, code: string, number: number): string {
  return `c${classLevel}-${code}-${String(number).padStart(2, "0")}`;
}
