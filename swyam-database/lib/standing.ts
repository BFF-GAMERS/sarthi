/**
 * Where a member stands, in one call.
 *
 * `learner_standing()` in Postgres computes both ladders at once, so every
 * card that mentions a level, a role or a count reads the same numbers. The
 * alternative — each panel doing its own arithmetic — is how a dashboard ends
 * up contradicting itself.
 *
 * The two ladders are deliberately separate:
 *
 *   learning level   basic -> advanced          what you know
 *   role             student -> biggerr -> trainer -> master_trainer
 *                                              what you do for other people
 *
 * And eligibility is reported, never granted: `trainerEligible` says the bar
 * is cleared, while `role` says what a human has actually conferred.
 */

import { getSupabase } from "./supabase";

export interface Standing {
  learningLevel: "basic" | "advanced";
  /** "Student" or "Professor" — the title that goes with the level. */
  learningTitle: string;
  role: "student" | "biggerr" | "trainer" | "master_trainer";
  nextRole: string | null;
  xp: number;
  coursesCompleted: number;
  coursesActive: number;
  skillsTotal: number;
  skillsVerified: number;
  skillsExpertVerified: number;
  /** Average of the best score per assessment, or null if none taken. */
  quizMastery: number | null;
  quizAssessmentsTaken: number;
  trainingsCompleted: number;
  trainingsRequired: number;
  certificates: number;
  /** Bar cleared for Trainer. Not the same as holding the role. */
  trainerEligible: boolean;
  masterTrainerEligible: boolean;
}

const EMPTY: Standing = {
  learningLevel: "basic",
  learningTitle: "Student",
  role: "student",
  nextRole: "biggerr",
  xp: 0,
  coursesCompleted: 0,
  coursesActive: 0,
  skillsTotal: 0,
  skillsVerified: 0,
  skillsExpertVerified: 0,
  quizMastery: null,
  quizAssessmentsTaken: 0,
  trainingsCompleted: 0,
  trainingsRequired: 10,
  certificates: 0,
  trainerEligible: false,
  masterTrainerEligible: false,
};

export async function getStanding(profileId: string): Promise<Standing> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY;

  const { data, error } = await supabase.rpc("learner_standing", { p_profile: profileId });
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as Record<string, unknown>;
  const num = (k: string) => Number(r[k] ?? 0);
  const role = String(r["role"] ?? "student");

  return {
    learningLevel: r["learning_level"] === "advanced" ? "advanced" : "basic",
    learningTitle: String(r["learning_title"] ?? "Student"),
    role: (["student", "biggerr", "trainer", "master_trainer"].includes(role)
      ? role
      : "student") as Standing["role"],
    nextRole: r["next_role"] ? String(r["next_role"]) : null,
    xp: num("xp"),
    coursesCompleted: num("courses_completed"),
    coursesActive: num("courses_active"),
    skillsTotal: num("skills_total"),
    skillsVerified: num("skills_verified"),
    skillsExpertVerified: num("skills_expert_verified"),
    // Null and zero mean different things here: nobody has sat an assessment
    // versus everybody failed it.
    quizMastery:
      r["quiz_mastery"] === null || r["quiz_mastery"] === undefined
        ? null
        : Number(r["quiz_mastery"]),
    quizAssessmentsTaken: num("quiz_assessments_taken"),
    trainingsCompleted: num("trainings_completed"),
    trainingsRequired: num("trainings_required") || 10,
    certificates: num("certificates"),
    trainerEligible: r["trainer_eligible"] === true,
    masterTrainerEligible: r["master_trainer_eligible"] === true,
  };
}

/** Human labels for the role ladder, used wherever a role is shown. */
export const ROLE_LABEL: Record<Standing["role"], string> = {
  student: "Student",
  biggerr: "Biggerr",
  trainer: "Trainer",
  master_trainer: "Master Trainer",
};
