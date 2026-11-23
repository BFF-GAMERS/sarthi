import { getSupabase, requireSupabase } from "./supabase";
import type { StoredPack } from "./offline/store";

/**
 * The learning engine.
 *
 * One course's state — modules, lessons, what is done, what is open — comes
 * from a single `course_learning_state` call rather than a query per module,
 * and the locking is decided there rather than here. That matters: a padlock
 * drawn in the browser is a suggestion, and this one has to be a rule.
 *
 * Nothing in this file is specific to UI/UX Design with Figma. It reads
 * whatever modules and lessons a course has, so a second course becomes a
 * second row of data rather than a second copy of this engine.
 */

export type LessonKind =
  "video" | "text" | "practice" | "quiz" | "assignment" | "document" | "external";

export interface LearnLesson {
  id: string;
  position: number;
  title: string;
  kind: LessonKind;
  durationMinutes: number | null;
  assessmentId: string | null;
  isPreview: boolean;
  completed: boolean;
  bookmarked: boolean;
}

export interface LearnModule {
  id: string;
  position: number;
  title: string;
  summary: string | null;
  lessons: LearnLesson[];
  lessonsDone: number;
  lessonsTotal: number;
  /** Open to work through. Module 1 always; the rest on the previous finishing. */
  unlocked: boolean;
  /** Every lesson done and, if it ends in an assessment, that assessment passed. */
  complete: boolean;
}

export interface LearnState {
  found: boolean;
  courseId: string;
  title: string;
  enrolled: boolean;
  enrollmentId: string | null;
  lessonsDone: number;
  lessonsTotal: number;
  percent: number;
  modules: LearnModule[];
}

/** A practice question. Answers live here because practice is not graded. */
export interface PracticeQuestion {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

export interface CodeSample {
  title: string;
  source: string;
  /** Exactly what running `source` prints; empty when it prints nothing. */
  output: string;
}

export interface LessonDetail {
  id: string;
  title: string;
  kind: LessonKind;
  durationMinutes: number | null;
  assessmentId: string | null;
  /** A YouTube id for video lessons. */
  videoId: string | null;
  objective: string | null;
  body: string[];
  concepts: string[];
  example: string | null;
  checklist: string[];
  resources: Array<{ label: string; url: string }>;
  practice: PracticeQuestion[];
  /** Worked code examples, each with the output it really prints. */
  code: CodeSample[];
  note: string;
  bookmarked: boolean;
  /**
   * Set only when this lesson was read from a downloaded pack. Never a video id
   * (a pack holds text only) and never the learner's own note or bookmark.
   */
  offlineCopy?: boolean;
  /** The written transcript, kept in a pack so a video lesson still has text. */
  transcript?: string | null;
}

/* ── State ───────────────────────────────────────────────────────── */

export async function getLearnState(courseSlug: string): Promise<LearnState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("course_learning_state", {
    p_course_slug: courseSlug,
  });
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["found"]) return null;

  return {
    found: true,
    courseId: String(r["course_id"]),
    title: String(r["title"]),
    enrolled: Boolean(r["enrolled"]),
    enrollmentId: (r["enrollment_id"] as string | null) ?? null,
    lessonsDone: Number(r["lessons_done"] ?? 0),
    lessonsTotal: Number(r["lessons_total"] ?? 0),
    percent: Number(r["percent"] ?? 0),
    modules: ((r["modules"] as unknown[]) ?? []).map((raw) => {
      const m = raw as Record<string, unknown>;
      return {
        id: String(m["id"]),
        position: Number(m["position"]),
        title: String(m["title"]),
        summary: (m["summary"] as string | null) ?? null,
        lessonsDone: Number(m["lessons_done"] ?? 0),
        lessonsTotal: Number(m["lessons_total"] ?? 0),
        unlocked: Boolean(m["unlocked"]),
        complete: Boolean(m["complete"]),
        lessons: ((m["lessons"] as unknown[]) ?? []).map((rawL) => {
          const l = rawL as Record<string, unknown>;
          return {
            id: String(l["id"]),
            position: Number(l["position"]),
            title: String(l["title"]),
            kind: String(l["kind"]) as LessonKind,
            durationMinutes: (l["duration_minutes"] as number | null) ?? null,
            assessmentId: (l["assessment_id"] as string | null) ?? null,
            isPreview: Boolean(l["is_preview"]),
            completed: Boolean(l["completed"]),
            bookmarked: Boolean(l["bookmarked"]),
          };
        }),
      };
    }),
  };
}

/**
 * Where "Continue learning" should land.
 *
 * The first unfinished lesson in the first unfinished unlocked module — not
 * the last one visited, which sends somebody who wandered into module 4 back
 * to module 4 rather than to the work in front of them.
 */
export function nextLesson(state: LearnState): { module: LearnModule; lesson: LearnLesson } | null {
  for (const m of state.modules) {
    if (!m.unlocked) continue;
    const lesson = m.lessons.find((l) => !l.completed);
    if (lesson) return { module: m, lesson };
  }
  // Everything done: land on the last lesson rather than nowhere.
  const last = state.modules.at(-1);
  const lesson = last?.lessons.at(-1);
  return last && lesson ? { module: last, lesson } : null;
}

/** The text fields of a lesson's `content` JSON, shaped for the lesson view. */
export function parseLessonContent(
  content: unknown,
): Pick<
  LessonDetail,
  "objective" | "body" | "concepts" | "example" | "checklist" | "resources" | "practice" | "code"
> {
  const c = (content ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
  return {
    objective: (c["objective"] as string | null) ?? null,
    body: arr(c["body"]),
    concepts: arr(c["concepts"]),
    example: (c["example"] as string | null) ?? null,
    checklist: arr(c["checklist"]),
    resources: Array.isArray(c["resources"])
      ? (c["resources"] as Array<{ label: string; url: string }>)
      : [],
    practice: Array.isArray(c["practice"]) ? (c["practice"] as PracticeQuestion[]) : [],
    // Older lessons have no `code`; a malformed entry is dropped rather than rendered half-empty.
    code: Array.isArray(c["code"])
      ? (c["code"] as unknown[]).flatMap((raw) => {
          const s = (raw ?? {}) as Record<string, unknown>;
          return typeof s["source"] === "string" && s["source"].trim()
            ? [
                {
                  title: String(s["title"] ?? ""),
                  source: s["source"],
                  output: String(s["output"] ?? ""),
                },
              ]
            : [];
        })
      : [],
  };
}

/* ── One lesson ──────────────────────────────────────────────────── */

export async function getLesson(
  lessonId: string,
  profileId: string | null,
): Promise<LessonDetail | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [{ data, error }, note, mark] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, title, kind, content, media_url, duration_minutes, assessment_id")
      .eq("id", lessonId)
      .maybeSingle(),
    profileId
      ? supabase
          .from("lesson_notes")
          .select("body")
          .eq("lesson_id", lessonId)
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profileId
      ? supabase
          .from("lesson_bookmarks")
          .select("id")
          .eq("lesson_id", lessonId)
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(error.message);
  if (!data) return null;

  const parsed = parseLessonContent(data.content);

  return {
    id: data.id as string,
    title: data.title as string,
    kind: data.kind as LessonKind,
    durationMinutes: (data.duration_minutes as number | null) ?? null,
    assessmentId: (data.assessment_id as string | null) ?? null,
    videoId: (data.media_url as string | null) ?? null,
    ...parsed,
    note: ((note as { data: { body?: string } | null }).data?.body ?? "") as string,
    bookmarked: Boolean((mark as { data: unknown }).data),
  };
}

/* ── Downloaded packs ────────────────────────────────────────────── */

/**
 * The contents list for a downloaded pack, in the shape the Learn page already
 * draws. Progress is not stored in a pack (it is the learner's own record, and
 * it lives on the server), so nothing is ticked and the percentage is hidden by
 * the page. Every module in a pack was unlocked when it was downloaded.
 */
export function packToLearnState(pack: StoredPack): LearnState {
  const sorted = [...pack.lessons].sort(
    (a, b) => (a.modulePosition ?? 0) - (b.modulePosition ?? 0) || a.position - b.position,
  );
  const byKey = new Map<string, LearnModule>();
  for (const l of sorted) {
    const key = `${l.modulePosition ?? 0}:${l.moduleTitle}`;
    let m = byKey.get(key);
    if (!m) {
      m = {
        id: `offline-${key}`,
        position: l.modulePosition ?? byKey.size + 1,
        title: l.moduleTitle,
        summary: null,
        lessons: [],
        lessonsDone: 0,
        lessonsTotal: 0,
        unlocked: true,
        complete: false,
      };
      byKey.set(key, m);
    }
    m.lessons.push({
      id: l.id,
      position: l.position,
      title: l.title,
      kind: l.kind as LessonKind,
      durationMinutes: l.durationMinutes,
      assessmentId: null,
      isPreview: false,
      completed: false,
      bookmarked: false,
    });
    m.lessonsTotal += 1;
  }
  return {
    found: true,
    courseId: pack.courseSlug,
    title: pack.title,
    enrolled: true,
    enrollmentId: null,
    lessonsDone: 0,
    lessonsTotal: pack.lessons.length,
    percent: 0,
    modules: [...byKey.values()],
  };
}

/** One lesson from a pack: text only, no video id, no note, no bookmark. */
export function packLessonToDetail(pack: StoredPack, lessonId: string): LessonDetail | null {
  const l = pack.lessons.find((x) => x.id === lessonId);
  if (!l) return null;
  return {
    id: l.id,
    title: l.title,
    kind: l.kind as LessonKind,
    durationMinutes: l.durationMinutes,
    assessmentId: null,
    videoId: null,
    ...parseLessonContent(l.content),
    note: "",
    bookmarked: false,
    offlineCopy: true,
    transcript: l.transcript,
  };
}

/* ── Writes ──────────────────────────────────────────────────────── */

/**
 * Mark a lesson done, and recalculate the course percentage.
 *
 * The percentage is derived from rows rather than incremented, so it cannot
 * drift out of step with reality after a retry, a double-click or a lesson
 * being added to the course later.
 */
export async function completeLesson(
  enrollmentId: string,
  lessonId: string,
  complete = true,
): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      state: complete ? "completed" : "in_progress",
      completed_at: complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "enrollment_id,lesson_id" },
  );
  if (error) throw new Error(error.message);

  await supabase.rpc("recompute_course_progress", { p_enrollment: enrollmentId });
}

export async function saveNote(profileId: string, lessonId: string, body: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("lesson_notes")
    .upsert(
      { profile_id: profileId, lesson_id: lessonId, body, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,lesson_id" },
    );
  if (error) throw new Error(error.message);
}

export async function setBookmark(profileId: string, lessonId: string, on: boolean): Promise<void> {
  const supabase = requireSupabase();
  if (on) {
    const { error } = await supabase
      .from("lesson_bookmarks")
      .upsert(
        { profile_id: profileId, lesson_id: lessonId },
        { onConflict: "profile_id,lesson_id" },
      );
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("lesson_bookmarks")
    .delete()
    .eq("profile_id", profileId)
    .eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);
}

/** Record how a practice run went. Not a grade — evidence that it happened. */
export async function recordPractice(
  profileId: string,
  lessonId: string,
  correct: number,
  total: number,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("practice_attempts").upsert(
    {
      profile_id: profileId,
      lesson_id: lessonId,
      correct,
      total,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,lesson_id" },
  );
  if (error) throw new Error(error.message);
}

export interface BookmarkRow {
  lessonId: string;
  title: string;
  moduleTitle: string;
  courseSlug: string;
}

/** Everything the learner has starred, for the My Bookmarks list. */
export async function listBookmarks(profileId: string): Promise<BookmarkRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("lesson_bookmarks")
    .select("lesson_id, lessons!inner(title, course_modules!inner(title, courses!inner(slug)))")
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const l = r as unknown as {
      lesson_id: string;
      lessons: { title: string; course_modules: { title: string; courses: { slug: string } } };
    };
    return {
      lessonId: l.lesson_id,
      title: l.lessons?.title ?? "Lesson",
      moduleTitle: l.lessons?.course_modules?.title ?? "",
      courseSlug: l.lessons?.course_modules?.courses?.slug ?? "",
    };
  });
}

/* ── Final project ───────────────────────────────────────────────── */

export interface ProjectSubmission {
  title: string;
  body: string;
  url: string;
  submittedAt: string | null;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
}

/**
 * The state machine a submission moves through.
 *
 * Deliberately derived from the row rather than stored as a column: a state
 * field that can disagree with `submitted_at` and `graded_at` is a bug waiting
 * to happen, and there is nothing here those two timestamps cannot answer.
 */
export type SubmissionState = "not_started" | "submitted" | "under_review" | "completed";

export function submissionState(s: ProjectSubmission | null): SubmissionState {
  if (!s?.submittedAt) return "not_started";
  if (s.gradedAt) return "completed";
  return "submitted";
}

export async function getSubmission(
  enrollmentId: string,
  lessonId: string,
): Promise<ProjectSubmission | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("body, attachment_url, submitted_at, grade, feedback, graded_at")
    .eq("enrollment_id", enrollmentId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  // Title and description share one text column, split on the first blank
  // line — the table predates this form and adding a column for something a
  // convention handles would be the wrong trade.
  const raw = (data.body as string) ?? "";
  const [title, ...rest] = raw.split("\n\n");
  return {
    title: title ?? "",
    body: rest.join("\n\n"),
    url: (data.attachment_url as string | null) ?? "",
    submittedAt: (data.submitted_at as string | null) ?? null,
    grade: data.grade === null ? null : Number(data.grade),
    feedback: (data.feedback as string | null) ?? null,
    gradedAt: (data.graded_at as string | null) ?? null,
  };
}

export async function submitProject(
  enrollmentId: string,
  lessonId: string,
  input: { title: string; body: string; url: string },
): Promise<void> {
  const supabase = requireSupabase();

  if (!input.title.trim()) throw new Error("Give the project a title.");
  if (!/^https?:\/\/\S+$/i.test(input.url.trim())) {
    throw new Error("Add a link to your Figma file, starting with https://");
  }

  const { error } = await supabase.from("assignment_submissions").upsert(
    {
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      body: `${input.title.trim()}\n\n${input.body.trim()}`,
      attachment_url: input.url.trim(),
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "enrollment_id,lesson_id" },
  );
  if (error) throw new Error(error.message);
}

/* ── Completion ──────────────────────────────────────────────────── */

export interface CompletionState {
  found: boolean;
  enrollmentId: string | null;
  percent: number;
  lessonsDone: boolean;
  modulesPassed: boolean;
  projectSubmitted: boolean;
  finalPassed: boolean;
  finalScore: number | null;
  complete: boolean;
  certificateSerial: string | null;
}

/** The four requirements, answered separately so the UI can name what is left. */
export async function getCompletion(courseSlug: string): Promise<CompletionState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("course_completion_state", {
    p_course_slug: courseSlug,
  });
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["found"]) return null;

  return {
    found: true,
    enrollmentId: (r["enrollment_id"] as string | null) ?? null,
    percent: Number(r["percent"] ?? 0),
    lessonsDone: Boolean(r["lessons_done"]),
    modulesPassed: Boolean(r["modules_passed"]),
    projectSubmitted: Boolean(r["project_submitted"]),
    finalPassed: Boolean(r["final_passed"]),
    finalScore: r["final_score"] == null ? null : Number(r["final_score"]),
    complete: Boolean(r["complete"]),
    certificateSerial: (r["certificate_serial"] as string | null) ?? null,
  };
}
