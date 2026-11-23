/**
 * Persona journeys (plan §6.1) — golden tests, Lab personas, /lab/compare previews.
 *
 * CONTRACT: `PERSONAS` shape and `expected` outcomes are frozen. Each persona streams real
 * TrackInputs over 2+ sessions; the player inserts a session boundary between them. Entity ids are
 * public slugs only. Pure data: no clock, no randomness.
 */
import type {
  BehaviourMode,
  EntityId,
  EvolutionState,
  EventMetadata,
  EventType,
  PersonaId,
  Tier,
  TrackInput,
} from "../../types";

export interface PersonaJourney {
  id: PersonaId;
  label: string;
  description: string;
  /** Each inner array is one session; the player inserts a session boundary between them. */
  sessions: ReadonlyArray<ReadonlyArray<TrackInput>>;
  expected: { state: EvolutionState; mode: BehaviourMode; tier: Tier };
}

const ev = <T extends EventType>(
  type: T,
  entityId?: string,
  metadata?: EventMetadata[T],
): TrackInput => ({
  type,
  ...(entityId ? { entityId: entityId as EntityId } : {}),
  ...(metadata ? { metadata } : {}),
});

const learningExplorer: TrackInput[][] = [
  [
    ev("course_viewed", "crs_python-basics"),
    ev("course_viewed", "crs_data-analysis"),
    ev("search_performed", undefined, { surface: "courses" }),
    ev("skill_builder_opened", undefined, { action: "open" }),
    ev("course_saved", "crs_python-basics"),
    ev("course_viewed", "crs_web-development"),
    ev("course_compared", undefined, { count: 2 }),
    ev("course_viewed", "crs_sql-essentials"),
    ev("course_compared", undefined, { count: 3 }),
    ev("course_started", "crs_python-basics", { via: "enrol" }),
  ],
  [
    ev("course_viewed", "crs_machine-learning"),
    ev("practice_completed", undefined, { surface: "lesson" }),
    ev("course_viewed", "crs_statistics"),
    ev("course_compared", undefined, { count: 2 }),
    ev("skill_builder_opened", undefined, { action: "plan_built" }),
    ev("practice_completed", undefined, { surface: "assessment" }),
    ev("course_viewed", "crs_excel-skills"),
    ev("course_saved", "crs_statistics"),
  ],
];

const careerSeeker: TrackInput[][] = [
  [
    ev("job_viewed", "opp_junior-analyst", { source: "native" }),
    ev("job_viewed", "opp_support-associate", { source: "native" }),
    ev("filter_used", undefined, { surface: "jobs", filter: "location" }),
    ev("internship_viewed", "opp_marketing-intern", { source: "native" }),
    ev("job_saved", "opp_junior-analyst"),
    ev("career_launcher_opened", undefined, { surface: "careers", action: "open" }),
    ev("job_viewed", "opp_sales-trainee", { source: "external" }),
    ev("filter_used", undefined, { surface: "jobs", filter: "salary" }),
    ev("internship_viewed", "opp_design-intern", { source: "native" }),
  ],
  [
    ev("job_viewed", "opp_data-entry", { source: "native" }),
    ev("filter_used", undefined, { surface: "internships", filter: "stipend" }),
    ev("job_saved", "opp_support-associate"),
    ev("career_launcher_opened", undefined, { surface: "path", action: "plan_built" }),
    ev("internship_viewed", "opp_content-intern", { source: "native" }),
    ev("application_started", "opp_junior-analyst", {
      kind: "job",
      channel: "native",
      signedIn: true,
    }),
    ev("job_viewed", "opp_hr-assistant", { source: "native" }),
    ev("filter_used", undefined, { surface: "jobs", filter: "experience" }),
  ],
];

const skillBuilder: TrackInput[][] = [
  [
    ev("skill_viewed", "skl_spoken-english", { surface: "skillswap" }),
    ev("skill_searched", undefined, { surface: "skillswap" }),
    ev("skill_viewed", "skl_excel", { surface: "skillswap" }),
    ev("mentor_viewed", "skl_excel", { trainerCount: "2-5" }),
    ev("skill_passport_opened", undefined, { self: true }),
    ev("skill_swap_requested", "skl_excel", { role: "learn" }),
    ev("skill_viewed", "skl_guitar", { surface: "skillswap" }),
    ev("skill_searched", undefined, { surface: "skillswap" }),
  ],
  [
    ev("mentor_viewed", "skl_cooking", { trainerCount: "1" }),
    ev("skill_passport_opened", undefined, { self: true }),
    ev("skill_swap_requested", "skl_spoken-english", { role: "teach" }),
    ev("skill_viewed", "skl_photography", { surface: "board" }),
    ev("skill_searched", undefined, { surface: "skillswap" }),
    ev("skill_swap_requested", "skl_guitar", { role: "learn" }),
    ev("skill_passport_opened", undefined, { self: true }),
  ],
];

const communityExplorer: TrackInput[][] = [
  [
    ev("community_opened", "com_study-circle"),
    ev("community_post_viewed", "pst_exam-tips"),
    ev("community_post_viewed", "pst_resume-help"),
    ev("profile_viewed", undefined, { self: false }),
    ev("community_opened", "com_job-seekers"),
    ev("community_post_viewed", "pst_exam-tips"),
    ev("course_viewed", "crs_python-basics"),
    ev("community_post_created"),
    ev("community_post_viewed", "pst_resume-help"),
    ev("community_post_viewed", "pst_career-tips"),
  ],
  [
    ev("community_opened", "com_study-circle"),
    ev("community_post_viewed", "pst_exam-tips"),
    ev("community_post_viewed", "pst_career-tips"),
    ev("job_viewed", "opp_junior-analyst", { source: "native" }),
    ev("community_opened", "com_job-seekers"),
    ev("community_post_viewed", "pst_resume-help"),
    ev("profile_viewed", undefined, { self: false }),
    ev("community_post_viewed", "pst_exam-tips"),
    ev("community_post_viewed", "pst_career-tips"),
    ev("community_post_created"),
    ev("community_opened", "com_study-circle"),
    ev("community_post_viewed", "pst_exam-tips"),
  ],
];

const fastUser: TrackInput[][] = [
  [
    ev("course_viewed", "crs_python-basics"),
    ev("course_saved", "crs_python-basics"),
    ev("job_viewed", "opp_junior-analyst", { source: "native" }),
    ev("job_saved", "opp_junior-analyst"),
  ],
  [
    ev("job_viewed", "opp_junior-analyst", { source: "native" }),
    ev("job_saved", "opp_junior-analyst"),
    ev("course_viewed", "crs_python-basics"),
    ev("course_saved", "crs_python-basics"),
  ],
  [
    ev("course_viewed", "crs_python-basics"),
    ev("course_saved", "crs_python-basics"),
    ev("job_viewed", "opp_junior-analyst", { source: "native" }),
    ev("job_saved", "opp_junior-analyst"),
  ],
  [
    ev("job_viewed", "opp_junior-analyst", { source: "native" }),
    ev("job_saved", "opp_junior-analyst"),
    ev("course_viewed", "crs_python-basics"),
    ev("course_saved", "crs_python-basics"),
  ],
];

export const PERSONAS: Readonly<Record<PersonaId, PersonaJourney>> = {
  "learning-explorer": {
    id: "learning-explorer",
    label: "Learning Explorer",
    description: "Browses and compares courses, builds a skill plan, practices.",
    sessions: learningExplorer,
    expected: { state: "LEARNING_FIRST", mode: "RESEARCH", tier: 3 },
  },
  "career-seeker": {
    id: "career-seeker",
    label: "Career Seeker",
    description: "Views and saves jobs and internships, filters, starts an application.",
    sessions: careerSeeker,
    expected: { state: "CAREER_FIRST", mode: "RESEARCH", tier: 3 },
  },
  "skill-builder": {
    id: "skill-builder",
    label: "Skill Builder",
    description: "Searches skills, opens passports, views mentors, requests swaps.",
    sessions: skillBuilder,
    expected: { state: "SKILL_EXCHANGE_FIRST", mode: "SKILL_FOCUSED", tier: 3 },
  },
  "community-explorer": {
    id: "community-explorer",
    label: "Community Explorer",
    description: "Opens communities, reads and writes posts, visits profiles.",
    sessions: communityExplorer,
    expected: { state: "COMMUNITY_FIRST", mode: "REPEAT", tier: 3 },
  },
  "fast-user": {
    id: "fast-user",
    label: "Fast User",
    description: "Short sessions, the same few pages, quick exits.",
    sessions: fastUser,
    expected: { state: "UNIVERSAL", mode: "QUICK", tier: 3 },
  },
};
