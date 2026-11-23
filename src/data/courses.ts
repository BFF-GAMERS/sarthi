export type ClassLevel = 8 | 9 | 10 | 11 | 12;

export type ModuleKind = "lecture" | "notes" | "quiz";

export interface CourseModule {
  id: string;
  title: string;
  kind: ModuleKind;
  /** YouTube video id. null until a human has picked and checked the video. */
  youtubeId: string | null;
  searchQuery: string;
  durationMin: number | null;
  /** true only after a human has checked the video on YouTube. */
  verified: boolean;
}

export interface CourseChapter {
  id: string;
  number: number;
  title: string;
  modules: CourseModule[];
  /** Stays null until verified CBSE PYQ data is added. Never fill by guess. */
  examFocus: { source: "CBSE PYQ"; note: string } | null;
}

export interface Course {
  id: string;
  classLevel: ClassLevel;
  subject: string;
  title: string;
  chapters: CourseChapter[];
}

// Filled from verified sources only. Each chapter's lecture ids are added after a human checks them on YouTube.
export const courses: Course[] = [];

export function coursesFor(classLevel: ClassLevel): Course[] {
  return courses.filter((c) => c.classLevel === classLevel);
}

export function findChapter(chapterId: string): CourseChapter | undefined {
  for (const course of courses) {
    const found = course.chapters.find((ch) => ch.id === chapterId);
    if (found) return found;
  }
  return undefined;
}

export function chapterProgressPct(
  ch: CourseChapter,
  watched: Record<string, true>,
): number {
  if (ch.modules.length === 0) return 0;
  const done = ch.modules.filter(
    (m) => watched[`${ch.id}/${m.id}`] === true,
  ).length;
  return Math.round((done / ch.modules.length) * 100);
}
