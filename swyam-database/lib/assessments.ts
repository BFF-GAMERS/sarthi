import { getSupabase, requireSupabase } from "./supabase";

/**
 * Sitting an assessment.
 *
 * The questions, the attempt and the grading already existed in the database —
 * 140 questions across 26 assessments, graded server-side against an answer
 * key the client cannot read. What was missing was any way for a learner to
 * reach them, which meant the whole verification ladder was unreachable: a
 * course could be finished but never assessed, so nobody could become a
 * verified trainer.
 *
 * Nothing here decides anything. Whether an attempt may start, what it scores
 * and whether that is a pass are all answered by the server; this module
 * carries questions down and answers up.
 */

export interface AssessmentSummary {
  id: string;
  title: string;
  description: string | null;
  passScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  questionCount: number;
}

export interface AssessmentStanding {
  available: boolean;
  signedIn: boolean;
  passScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestScore: number | null;
  passed: boolean;
  /** An attempt already in progress — resume it rather than starting another. */
  openAttempt: string | null;
  /** When the cooldown lifts, if one is running. */
  readyAt: string | null;
  questionCount: number;
}

export interface AssessmentQuestion {
  id: string;
  position: number;
  kind: string;
  prompt: string;
  /** Choices for a multiple-choice question; empty for free text. */
  options: string[];
  points: number;
}

export interface OpenAttempt {
  id: string;
  assessmentId: string;
  startedAt: string;
  /** Null when the assessment is untimed. */
  expiresAt: string | null;
  questions: AssessmentQuestion[];
  /**
   * Answers already saved: question id -> the index of the chosen option.
   *
   * An index, because that is what the answer key holds and what the grader
   * compares. The two used to disagree — half the bank keyed by option id,
   * half by index — which would have scored a correct answer as wrong.
   */
  answers: Record<string, number>;
}

export interface AttemptResult {
  score: number;
  passed: boolean;
}

/**
 * The published assessments attached to a course, by its slug.
 *
 * Slug rather than id because that is what the course pages are routed on —
 * `/courses/course-welding` — while `assessments.course_id` is a uuid. The
 * join does the translation in one round trip instead of two.
 */
export async function listCourseAssessments(
  courseSlug: string,
  opts: { includeModules?: boolean } = {},
): Promise<AssessmentSummary[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let q = supabase
    .from("assessments")
    .select(
      "id, title, description, pass_score, time_limit_minutes, max_attempts, module_id, assessment_questions(count), courses!inner(slug)",
    )
    .eq("courses.slug", courseSlug)
    .eq("is_published", true)
    .order("created_at");

  // The course page advertises the *final* assessment — the one that earns
  // the certificate. Module assessments belong inside the lesson they close,
  // and listing all six on a marketing page would read as six exams to sit
  // before starting.
  if (!opts.includeModules) q = q.is("module_id", null);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((a) => ({
    id: a.id as string,
    title: a.title as string,
    description: (a.description as string | null) ?? null,
    passScore: Number(a.pass_score),
    timeLimitMinutes: (a.time_limit_minutes as number | null) ?? null,
    maxAttempts: (a.max_attempts as number | null) ?? null,
    questionCount: (a.assessment_questions as Array<{ count: number }> | null)?.[0]?.count ?? 0,
  }));
}

/** Attempts used, best score, cooldown — so the button can tell the truth. */
/**
 * The assessments that stand on their own, keyed to a skill.
 *
 * `listCourseAssessments` above joins `courses!inner`, which is right for a
 * course page and fatal everywhere else: an inner join silently discards every
 * assessment whose `course_id` is null. Six published ones are in exactly that
 * shape and had no way of being found.
 *
 * Returned keyed by skill, because the caller always has a skill in hand and
 * wants to know "is there a way to prove this one".
 */
export async function listSkillAssessments(
  skillIds: string[],
): Promise<Record<string, AssessmentSummary>> {
  const supabase = getSupabase();
  if (!supabase || skillIds.length === 0) return {};

  const { data, error } = await supabase
    .from("assessments")
    .select(
      "id, title, description, pass_score, time_limit_minutes, max_attempts, skill_id, assessment_questions(count)",
    )
    .in("skill_id", skillIds)
    .is("course_id", null)
    .eq("is_published", true)
    .order("created_at");
  if (error) throw new Error(error.message);

  const out: Record<string, AssessmentSummary> = {};
  for (const a of data ?? []) {
    const skillId = a.skill_id as string | null;
    if (!skillId || out[skillId]) continue;
    out[skillId] = {
      id: a.id as string,
      title: a.title as string,
      description: (a.description as string | null) ?? null,
      passScore: Number(a.pass_score),
      timeLimitMinutes: (a.time_limit_minutes as number | null) ?? null,
      maxAttempts: (a.max_attempts as number | null) ?? null,
      questionCount: (a.assessment_questions as Array<{ count: number }> | null)?.[0]?.count ?? 0,
    };
  }
  return out;
}

export async function assessmentStanding(assessmentId: string): Promise<AssessmentStanding | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("assessment_standing", {
    p_assessment: assessmentId,
  });
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["available"]) return null;

  return {
    available: true,
    signedIn: Boolean(r["signed_in"]),
    passScore: Number(r["pass_score"] ?? 0),
    timeLimitMinutes: (r["time_limit_minutes"] as number | null) ?? null,
    maxAttempts: (r["max_attempts"] as number | null) ?? null,
    attemptsUsed: Number(r["attempts_used"] ?? 0),
    bestScore:
      r["best_score"] === null || r["best_score"] === undefined ? null : Number(r["best_score"]),
    passed: Boolean(r["passed"]),
    openAttempt: (r["open_attempt"] as string | null) ?? null,
    readyAt: (r["ready_at"] as string | null) ?? null,
    questionCount: Number(r["question_count"] ?? 0),
  };
}

/**
 * Begin, or resume.
 *
 * The attempt limit, the cooldown and the "you already passed" rule are all
 * enforced inside the function — a refusal comes back as its own sentence,
 * which is what the caller shows.
 */
export async function startAttempt(assessmentId: string): Promise<OpenAttempt> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc("start_assessment_attempt", {
    p_assessment: assessmentId,
  });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string;
    assessment_id: string;
    started_at: string;
    expires_at: string | null;
  };
  return loadAttempt(row.id, row.assessment_id, row.started_at, row.expires_at);
}

/** The questions for an attempt, plus whatever has been answered so far. */
async function loadAttempt(
  attemptId: string,
  assessmentId: string,
  startedAt: string,
  expiresAt: string | null,
): Promise<OpenAttempt> {
  const supabase = requireSupabase();

  const [{ data: questions, error: qErr }, { data: saved, error: rErr }] = await Promise.all([
    supabase
      .from("assessment_questions")
      // Deliberately no answer column exists on this table — the key lives in
      // assessment_answer_keys, which no client role can read.
      .select("id, position, kind, prompt, options, points")
      .eq("assessment_id", assessmentId)
      .order("position"),
    supabase
      .from("assessment_responses")
      .select("question_id, response")
      .eq("attempt_id", attemptId),
  ]);
  if (qErr) throw new Error(qErr.message);
  if (rErr) throw new Error(rErr.message);

  const answers: Record<string, number> = {};
  for (const r of saved ?? []) {
    const value = (r as { response: unknown }).response as { index?: unknown } | null;
    const idx = Number(value?.index);
    if (Number.isInteger(idx)) {
      answers[(r as { question_id: string }).question_id] = idx;
    }
  }

  return {
    id: attemptId,
    assessmentId,
    startedAt,
    expiresAt,
    questions: (questions ?? []).map((q) => ({
      id: q.id as string,
      position: q.position as number,
      kind: q.kind as string,
      prompt: q.prompt as string,
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      points: Number(q.points ?? 1),
    })),
    answers,
  };
}

/**
 * Save one answer.
 *
 * Written as it is chosen rather than all at once on submit, so a closed tab,
 * a flat battery or a dropped connection does not cost the attempt. RLS allows
 * this only while the attempt is still `in_progress`, so a saved answer cannot
 * be changed after grading.
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  optionIndex: number,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("assessment_responses").upsert(
    {
      attempt_id: attemptId,
      question_id: questionId,
      // The shape the grader reads. Anything else scores zero silently.
      response: { index: optionIndex },
      answered_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,question_id" },
  );
  if (error) throw new Error(error.message);
}

/** Hand it in. The score comes back from the server, never from here. */
export async function submitAttempt(attemptId: string): Promise<AttemptResult> {
  const supabase = requireSupabase();

  const { error: markErr } = await supabase
    .from("assessment_attempts")
    .update({ state: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (markErr) throw new Error(markErr.message);

  const { data, error } = await supabase.rpc("grade_assessment_attempt", {
    p_attempt_id: attemptId,
  });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as { score: number; passed: boolean };
  return { score: Number(row?.score ?? 0), passed: Boolean(row?.passed) };
}
