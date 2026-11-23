/**
 * Swayam Plus plan catalogue (docs/evolution/subscriptions.md §1), as frozen tuples.
 *
 * One plan per declared profile type, one regular price per plan, the same for everyone.
 * The AI never sees a price and never picks a plan: `PLAN_BY_TYPE` is a plain lookup.
 * Every plan is a DEMO during the pilot: ₹1 for the first month, no payment taken, nothing existing gated.
 *
 * Pure: no react, no DOM, no clock. Labels are English source strings; the UI wraps them in tx().
 */
import type { DomainId, NavItemId } from "../../evolution/types";
import type { ProfileType } from "../../lib/profile-type";

export const PLAN_IDS = ["SCHOLAR", "CAMPUS", "LAUNCH", "ASCEND", "FACULTY", "HIRE"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BENEFIT_IDS = [
  "COACH_HIGHER_CAP",
  "PRACTICE_HISTORY",
  "MARKS_TO_CAREER",
  "SCHEME_CHECKER",
  "CERT_EXPORT",
  "SKILLBUILDER_MENTOR",
  "CV_REVIEW",
  "PASSPORT_SHARE",
  "INTERNSHIP_ALERTS",
  "SWAP_PRIORITY",
  "COURSE_TO_JOB_ROADMAP",
  "CV_GAP_REPORT",
  "JOB_ALERTS",
  "APPLICATION_TRACKER",
  "INTERVIEW_COACH",
  "LAUNCHER_FULL_PLAN",
  "UPSKILL_PATH",
  "TEACHBACK_PRIORITY",
  "PASSPORT_VERIFIED",
  "MENTOR_SLOTS",
  "EVENTS_ACCESS",
  "MORE_COHORTS",
  "OUTCOME_TRACKING",
  "LEARNER_VERIFICATION",
  "HOSTED_EVENTS",
  "VERIFIED_BADGE",
  "LEARNER_INSIGHTS",
  "MORE_POSTINGS",
  "VERIFIED_SHORTLISTS",
  "APPLICANT_COMPARE",
  "SAVED_SEARCHES",
  "PASSPORT_VERIFY_LOOKUP",
  "HIRE_ALERTS",
] as const;
export type BenefitId = (typeof BENEFIT_IDS)[number];

export type Availability = "live" | "preview";

export interface Benefit {
  id: BenefitId;
  /** Every plan that offers it (a few are shared). */
  planIds: readonly PlanId[];
  /** English source string; the UI renders it through tx(). */
  label: string;
  /** A NAV_REGISTRY id: the destination resolves through hrefFor(route, signedIn). */
  route: NavItemId;
  /** `preview` is not built yet and carries a visible "Preview" chip. */
  availability: Availability;
  domain: DomainId;
  /** 1 to 3: how strongly the rules fallback lets the domain score move it. */
  weight: number;
}

const b = (
  id: BenefitId,
  planIds: readonly PlanId[],
  label: string,
  route: NavItemId,
  availability: Availability,
  domain: DomainId,
  weight: number,
): Benefit =>
  Object.freeze({
    id,
    planIds: Object.freeze([...planIds]),
    label,
    route,
    availability,
    domain,
    weight,
  });

export const BENEFITS: readonly Benefit[] = Object.freeze([
  b(
    "COACH_HIGHER_CAP",
    ["SCHOLAR", "CAMPUS"],
    "Higher daily limit on your Coach",
    "COACH",
    "live",
    "LEARNING",
    3,
  ),
  b(
    "PRACTICE_HISTORY",
    ["SCHOLAR"],
    "Practice history, kept for you",
    "PRACTICE",
    "live",
    "LEARNING",
    2,
  ),
  b(
    "MARKS_TO_CAREER",
    ["SCHOLAR"],
    "Marks-to-career guidance",
    "CAREER_LAUNCHER",
    "live",
    "CAREER",
    2,
  ),
  b(
    "SCHEME_CHECKER",
    ["SCHOLAR"],
    "Scholarship and scheme checker",
    "SCHEMES",
    "live",
    "LEARNING",
    1,
  ),
  b(
    "CERT_EXPORT",
    ["SCHOLAR"],
    "Download your certificates",
    "PASSPORT",
    "preview",
    "SKILL_EXCHANGE",
    1,
  ),
  b(
    "SKILLBUILDER_MENTOR",
    ["SCHOLAR"],
    "Mentor feedback in Skill Builder",
    "SKILL_BUILDER",
    "preview",
    "LEARNING",
    1,
  ),
  b("CV_REVIEW", ["CAMPUS"], "Detailed CV review", "CV", "live", "CAREER", 3),
  b(
    "PASSPORT_SHARE",
    ["CAMPUS"],
    "Share your Skill Passport",
    "PASSPORT",
    "live",
    "SKILL_EXCHANGE",
    2,
  ),
  b("INTERNSHIP_ALERTS", ["CAMPUS"], "Internship alerts", "INTERNSHIPS", "preview", "CAREER", 2),
  b(
    "SWAP_PRIORITY",
    ["CAMPUS", "LAUNCH"],
    "Priority in Skill Swap matches",
    "SKILLS",
    "live",
    "SKILL_EXCHANGE",
    3,
  ),
  b(
    "COURSE_TO_JOB_ROADMAP",
    ["CAMPUS"],
    "Course-to-job roadmap",
    "CAREER_LAUNCHER",
    "live",
    "CAREER",
    2,
  ),
  b("CV_GAP_REPORT", ["LAUNCH"], "CV gap report for the role you want", "CV", "live", "CAREER", 3),
  b("JOB_ALERTS", ["LAUNCH", "ASCEND"], "Job alerts", "JOBS", "preview", "CAREER", 2),
  b("APPLICATION_TRACKER", ["LAUNCH"], "Application tracker", "APPLICATIONS", "live", "CAREER", 2),
  b("INTERVIEW_COACH", ["LAUNCH"], "Interview practice with Coach", "COACH", "live", "CAREER", 3),
  b(
    "LAUNCHER_FULL_PLAN",
    ["LAUNCH"],
    "Full Career Launcher plan",
    "CAREER_LAUNCHER",
    "live",
    "CAREER",
    2,
  ),
  b("UPSKILL_PATH", ["ASCEND"], "Guided upskilling path", "COURSES", "live", "LEARNING", 3),
  b(
    "TEACHBACK_PRIORITY",
    ["ASCEND"],
    "Priority for teach-back requests",
    "SKILLS",
    "live",
    "SKILL_EXCHANGE",
    3,
  ),
  b(
    "PASSPORT_VERIFIED",
    ["ASCEND"],
    "Verified Skill Passport",
    "PASSPORT",
    "live",
    "SKILL_EXCHANGE",
    2,
  ),
  b("MENTOR_SLOTS", ["ASCEND"], "Mentor sessions", "SKILL_DIRECTORY", "preview", "LEARNING", 2),
  b("EVENTS_ACCESS", ["ASCEND"], "Access to community events", "EVENTS", "live", "COMMUNITY", 2),
  b("MORE_COHORTS", ["FACULTY"], "More cohorts", "DASHBOARD", "preview", "LEARNING", 3),
  b(
    "OUTCOME_TRACKING",
    ["FACULTY"],
    "Learner outcome tracking",
    "DASHBOARD",
    "preview",
    "LEARNING",
    2,
  ),
  b(
    "LEARNER_VERIFICATION",
    ["FACULTY"],
    "Verify learner Passports",
    "PASSPORT",
    "live",
    "SKILL_EXCHANGE",
    3,
  ),
  b("HOSTED_EVENTS", ["FACULTY"], "Host events", "EVENTS", "live", "COMMUNITY", 2),
  b(
    "VERIFIED_BADGE",
    ["FACULTY"],
    "Verified institute badge",
    "PROFILE",
    "preview",
    "COMMUNITY",
    1,
  ),
  b("LEARNER_INSIGHTS", ["FACULTY"], "Learner insights", "DASHBOARD", "live", "LEARNING", 2),
  b("MORE_POSTINGS", ["HIRE"], "More open postings", "OPPORTUNITIES", "live", "CAREER", 3),
  b(
    "VERIFIED_SHORTLISTS",
    ["HIRE"],
    "Shortlists of verified candidates",
    "SEARCH",
    "live",
    "CAREER",
    3,
  ),
  b(
    "APPLICANT_COMPARE",
    ["HIRE"],
    "Compare applicants side by side",
    "OPPORTUNITIES",
    "preview",
    "CAREER",
    2,
  ),
  b("SAVED_SEARCHES", ["HIRE"], "Saved candidate searches", "SEARCH", "preview", "CAREER", 2),
  b(
    "PASSPORT_VERIFY_LOOKUP",
    ["HIRE"],
    "Look up and verify a Passport",
    "PASSPORT",
    "live",
    "SKILL_EXCHANGE",
    2,
  ),
  b("HIRE_ALERTS", ["HIRE"], "New-match alerts", "NOTIFICATIONS", "preview", "CAREER", 1),
]);

export const BENEFIT_BY_ID: Readonly<Record<BenefitId, Benefit>> = Object.freeze(
  Object.fromEntries(BENEFITS.map((x) => [x.id, x])) as Record<BenefitId, Benefit>,
);

export interface Plan {
  id: PlanId;
  profileType: ProfileType;
  /** "Swayam Plus · <name>" is composed by the UI. */
  name: string;
  /** Rupees per month after the intro month. The same for everyone with this profile type. */
  regularPrice: number;
  /** Rupees for the intro month. */
  introPrice: 1;
  introMonths: 1;
  /** Pilot truth: a demo, nothing is charged. */
  demo: true;
  paymentTaken: false;
  /** Canonical order, first three always `live`. It is also the tie-break order. */
  benefitIds: readonly BenefitId[];
}

const plan = (
  id: PlanId,
  profileType: ProfileType,
  name: string,
  regularPrice: number,
  benefitIds: readonly BenefitId[],
): Plan =>
  Object.freeze({
    id,
    profileType,
    name,
    regularPrice,
    introPrice: 1,
    introMonths: 1,
    demo: true,
    paymentTaken: false,
    benefitIds: Object.freeze([...benefitIds]),
  } as Plan);

export const PLANS: readonly Plan[] = Object.freeze([
  plan("SCHOLAR", "school", "Scholar", 99, [
    "COACH_HIGHER_CAP",
    "PRACTICE_HISTORY",
    "MARKS_TO_CAREER",
    "SCHEME_CHECKER",
    "CERT_EXPORT",
    "SKILLBUILDER_MENTOR",
  ]),
  plan("CAMPUS", "college", "Campus", 199, [
    "CV_REVIEW",
    "PASSPORT_SHARE",
    "SWAP_PRIORITY",
    "COURSE_TO_JOB_ROADMAP",
    "COACH_HIGHER_CAP",
    "INTERNSHIP_ALERTS",
  ]),
  plan("LAUNCH", "jobseeker", "Launch", 299, [
    "CV_GAP_REPORT",
    "APPLICATION_TRACKER",
    "INTERVIEW_COACH",
    "LAUNCHER_FULL_PLAN",
    "SWAP_PRIORITY",
    "JOB_ALERTS",
  ]),
  plan("ASCEND", "professional", "Ascend", 399, [
    "UPSKILL_PATH",
    "TEACHBACK_PRIORITY",
    "PASSPORT_VERIFIED",
    "EVENTS_ACCESS",
    "MENTOR_SLOTS",
    "JOB_ALERTS",
  ]),
  plan("FACULTY", "institute", "Faculty", 499, [
    "LEARNER_VERIFICATION",
    "HOSTED_EVENTS",
    "LEARNER_INSIGHTS",
    "MORE_COHORTS",
    "OUTCOME_TRACKING",
    "VERIFIED_BADGE",
  ]),
  plan("HIRE", "recruiter", "Hire", 999, [
    "MORE_POSTINGS",
    "VERIFIED_SHORTLISTS",
    "PASSPORT_VERIFY_LOOKUP",
    "APPLICANT_COMPARE",
    "SAVED_SEARCHES",
    "HIRE_ALERTS",
  ]),
]);

export const PLAN_BY_ID: Readonly<Record<PlanId, Plan>> = Object.freeze(
  Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>,
);

/** The deterministic map from the declared profile type. This is the only way a plan is chosen. */
export const PLAN_BY_TYPE: Readonly<Record<ProfileType, Plan>> = Object.freeze(
  Object.fromEntries(PLANS.map((p) => [p.profileType, p])) as Record<ProfileType, Plan>,
);

export const MAX_BENEFITS = 6;
export const MIN_BENEFITS = 3;
/** How many of the first benefits must be live. */
export const LIVE_TOP = 3;

/* ── headlines, accents, reasons: ids only on the wire, text rendered locally ────────────── */

export const HEADLINE_IDS = [
  "H_LEARNING_1",
  "H_LEARNING_2",
  "H_CAREER_1",
  "H_CAREER_2",
  "H_SKILL_1",
  "H_SKILL_2",
  "H_COMMUNITY_1",
  "H_COMMUNITY_2",
  "H_BALANCED_1",
  "H_BALANCED_2",
  "H_QUICK_1",
  "H_FOCUS_1",
] as const;
export type HeadlineId = (typeof HEADLINE_IDS)[number];

/** Plan-neutral, no scarcity, no guilt. English source strings for tx(). */
export const HEADLINES: Readonly<Record<HeadlineId, string>> = Object.freeze({
  H_LEARNING_1: "Go further with what you are building",
  H_LEARNING_2: "Extras to help you keep growing",
  H_CAREER_1: "Make your next step easier",
  H_CAREER_2: "Extras for the work that matters most",
  H_SKILL_1: "Get more from the skills you share",
  H_SKILL_2: "Show what you can do, with extras",
  H_COMMUNITY_1: "More from the people around you",
  H_COMMUNITY_2: "Join in, with a little extra",
  H_BALANCED_1: "A little extra for everything you do",
  H_BALANCED_2: "Everything Swayam, plus extras",
  H_QUICK_1: "Just the short list, picked for you",
  H_FOCUS_1: "Extras for the way you work",
});

export const ACCENT_IDS = ["MARIGOLD", "PEACOCK", "RANI", "INDIGO"] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const REASON_KEYS = [
  "R_LEARNING_ACTIVITY",
  "R_CAREER_ACTIVITY",
  "R_SKILL_EXCHANGE_ACTIVITY",
  "R_COMMUNITY_ACTIVITY",
  "R_BALANCED",
  "R_QUICK",
  "R_ROLE_DEFAULT",
] as const;
export type ReasonKey = (typeof REASON_KEYS)[number];

/** Why the order is what it is. Honest about its basis; the UI adds "chosen by rules" or "by AI". */
export const REASONS: Readonly<Record<ReasonKey, string>> = Object.freeze({
  R_LEARNING_ACTIVITY: "Ordered by how much of your time on Swayam goes to learning.",
  R_CAREER_ACTIVITY: "Ordered by how much of your time on Swayam goes to careers.",
  R_SKILL_EXCHANGE_ACTIVITY: "Ordered by how much of your time on Swayam goes to skills.",
  R_COMMUNITY_ACTIVITY: "Ordered by how much of your time on Swayam goes to community.",
  R_BALANCED: "You use a bit of everything, so the list is in its usual order.",
  R_QUICK: "A shorter list, because you like to move fast.",
  R_ROLE_DEFAULT:
    "The usual list for your role. The price is the same for everyone with this role.",
});
