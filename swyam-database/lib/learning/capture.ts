import { recordWrong, type WrongEntry } from "./mistakes";

/**
 * Turning a graded attempt into notebook entries.
 *
 * The grader returns only a score and a pass flag, so which answers were wrong
 * comes from the per-answer `is_correct` the server writes on the learner's own
 * response rows. If that is missing or unreadable, nothing is saved: the
 * notebook never guesses. Right answers and scores are never stored.
 */

export interface CaptureQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface BuildArgs {
  assessmentId: string;
  source: string;
  questions: CaptureQuestion[];
  /** question id -> chosen option index */
  answers: Record<string, number>;
  /** question id -> server verdict; only `false` becomes an entry */
  correctness: Record<string, boolean | null | undefined>;
  /** question id -> correct option index, only if the payload ever exposes it */
  correctOptions?: Record<string, number>;
}

/** Pure: wrong, answered, multiple-choice questions only. */
export function buildWrongEntries(a: BuildArgs): WrongEntry[] {
  const out: WrongEntry[] = [];
  for (const q of a.questions) {
    if (a.correctness[q.id] !== false) continue;
    const idx = a.answers[q.id];
    if (typeof idx !== "number" || !q.options[idx]) continue;
    const ci = a.correctOptions?.[q.id];
    out.push({
      assessmentId: a.assessmentId,
      questionId: q.id,
      question: q.prompt,
      options: q.options,
      chosenIndex: idx,
      chosen: q.options[idx],
      ...(typeof ci === "number" && q.options[ci] ? { correct: q.options[ci] } : {}),
      source: a.source,
    });
  }
  return out;
}

/** The learner's own graded responses. Resolves to {} on any failure. */
export async function fetchCorrectness(attemptId: string): Promise<Record<string, boolean | null>> {
  try {
    const { getSupabase } = await import("../supabase");
    const supabase = getSupabase();
    if (!supabase) return {};
    const { data, error } = await supabase
      .from("assessment_responses")
      .select("question_id, is_correct")
      .eq("attempt_id", attemptId);
    if (error || !data) return {};
    const out: Record<string, boolean | null> = {};
    for (const r of data as Array<{ question_id: string; is_correct: boolean | null }>) {
      out[r.question_id] = r.is_correct;
    }
    return out;
  } catch {
    return {};
  }
}

/** Fire and forget from the runner. Never throws, never blocks the result screen. */
export async function captureWrongAnswers(
  args: Omit<BuildArgs, "correctness"> & { scope: string; attemptId: string },
): Promise<number> {
  try {
    const correctness = await fetchCorrectness(args.attemptId);
    return recordWrong(args.scope, buildWrongEntries({ ...args, correctness }));
  } catch {
    return 0;
  }
}
