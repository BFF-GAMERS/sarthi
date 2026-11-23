/**
 * What is actually inside a course.
 *
 * Modules and lessons live in Postgres and are readable by anyone — a syllabus
 * is something you read *before* you decide. Progress is the private half:
 * `lesson_progress` rows only exist for an enrolment, and ticking one off is
 * what moves the progress bar, awards points and eventually issues the
 * certificate. All of that happens in database triggers, so this module only
 * has to write the tick.
 */

import { getSupabase, requireSupabase } from "./supabase";
import { resolveCourseId } from "./catalogue";

export interface Lesson {
  id: string;
  position: number;
  title: string;
  kind: string;
  durationMinutes: number;
  /** True once this member has marked it done. Always false when signed out. */
  completed: boolean;
}

export interface CourseModule {
  id: string;
  position: number;
  title: string;
  summary: string | null;
  lessons: Lesson[];
}

export interface CourseOutline {
  /** Null when the member is not enrolled — the tick buttons need it. */
  enrollmentId: string | null;
  enrolled: boolean;
  modules: CourseModule[];
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

const EMPTY: CourseOutline = {
  enrollmentId: null,
  enrolled: false,
  modules: [],
  totalLessons: 0,
  completedLessons: 0,
  progressPercent: 0,
};

/**
 * The syllabus, plus this member's place in it.
 *
 * `profileId` may be null: the lesson list still comes back, just with nothing
 * ticked, which is exactly what a visitor should see.
 */
export async function getCourseOutline(
  courseSlug: string,
  profileId: string | null,
): Promise<CourseOutline> {
  const supabase = getSupabase();
  const courseId = await resolveCourseId(courseSlug);
  if (!supabase || !courseId) return EMPTY;

  const { data: moduleRows, error: moduleError } = await supabase
    .from("course_modules")
    .select("id, position, title, summary, lessons ( id, position, title, kind, duration_minutes )")
    .eq("course_id", courseId);
  if (moduleError) throw new Error(moduleError.message);

  // The enrolment, and which lessons it has already ticked.
  let enrollmentId: string | null = null;
  const done = new Set<string>();

  if (profileId) {
    const { data: enrolment, error: enrolmentError } = await supabase
      .from("course_enrollments")
      .select("id, state")
      .eq("profile_id", profileId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (enrolmentError) throw new Error(enrolmentError.message);

    if (enrolment && enrolment.state !== "cancelled") {
      enrollmentId = enrolment.id;

      const { data: progress, error: progressError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, state")
        .eq("enrollment_id", enrolment.id)
        .eq("state", "completed");
      if (progressError) throw new Error(progressError.message);
      for (const row of progress ?? []) done.add(row.lesson_id);
    }
  }

  type RawLesson = {
    id: string;
    position: number;
    title: string;
    kind: string;
    duration_minutes: number | null;
  };

  const modules: CourseModule[] = (moduleRows ?? [])
    .map((m) => {
      const raw = ((m as { lessons: unknown }).lessons ?? []) as RawLesson[];
      return {
        id: m.id,
        position: m.position,
        title: m.title,
        summary: m.summary,
        lessons: raw
          .map((l) => ({
            id: l.id,
            position: l.position,
            title: l.title,
            kind: l.kind,
            durationMinutes: l.duration_minutes ?? 0,
            completed: done.has(l.id),
          }))
          .sort((a, b) => a.position - b.position),
      };
    })
    .sort((a, b) => a.position - b.position);

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const completedLessons = modules.reduce(
    (n, m) => n + m.lessons.filter((l) => l.completed).length,
    0,
  );

  return {
    enrollmentId,
    enrolled: Boolean(enrollmentId),
    modules,
    totalLessons,
    completedLessons,
    progressPercent: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
  };
}

/**
 * Tick a lesson, or untick it.
 *
 * Writing the row is the whole action — `lesson_progress_recompute` updates the
 * enrolment's percentage and flips it to completed at 100%, and
 * `points_on_lesson_complete` awards the hundred points. Unticking removes the
 * completion but deliberately leaves the points: they record work that was
 * done, and taking them back would let the bar be farmed up and down.
 */
export async function setLessonComplete(
  enrollmentId: string,
  lessonId: string,
  complete: boolean,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      state: complete ? "completed" : "in_progress",
      completed_at: complete ? new Date().toISOString() : null,
    },
    { onConflict: "enrollment_id,lesson_id" },
  );
  if (error) throw new Error(error.message);
}

/** The next unfinished lesson, for a "resume where you left off" link. */
export function nextLesson(outline: CourseOutline): Lesson | null {
  for (const m of outline.modules) {
    const next = m.lessons.find((l) => !l.completed);
    if (next) return next;
  }
  return null;
}
