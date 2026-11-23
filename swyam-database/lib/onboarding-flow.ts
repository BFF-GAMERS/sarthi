import type { ProfileType } from "./profile-type";

/**
 * What the first five minutes asks, and why each question is asked.
 *
 * The old onboarding asked everyone the same six things and then dropped
 * them on a dashboard that could not use most of the answers. This is
 * role-based: a Class 9 student is asked about subjects, a job seeker about
 * the work they want, a recruiter about the company — and every answer is
 * written somewhere the site actually reads.
 *
 * Rules the shell enforces:
 *   · one decision per screen
 *   · nothing is required — every step can be skipped
 *   · the answers are saved on the device as they are typed, and the step
 *     number in `profiles.onboarding_step`, so "save and exit" is real and
 *     so is coming back on another device
 *   · the last screen is not a form; it is what was built from the answers
 */

export type StepId =
  // shared
  | "who"
  | "language"
  | "done"
  // school
  | "class"
  | "subjects"
  | "help"
  | "marks"
  // college
  | "study"
  | "goal"
  | "field"
  | "skills"
  | "preference"
  // job seeker / professional
  | "work"
  | "experience"
  | "support"
  // recruiter
  | "company"
  | "roles"
  | "requirements"
  | "verify"
  // institute
  | "institute"
  | "delivery"
  | "teaching"
  | "certificates";

export interface StepDef {
  id: StepId;
  /** The question, as a person would ask it. */
  title: string;
  /** One line under it. Never instructions for a form. */
  blurb: string;
  /** Optional steps say so on the button rather than hiding the fact. */
  optional?: boolean;
}

export interface OnboardingAnswers {
  type?: ProfileType;
  locale?: string;

  // school
  classBand?: "6-8" | "9-10" | "11-12";
  subjects?: string[];
  helpWith?: string[];
  marksChoice?: "upload" | "manual" | "later";

  // college
  degree?: string;
  branch?: string;
  year?: string;
  goal?: string;
  fields?: string[];
  skillIds?: string[];
  budget?: "free" | "low" | "any";
  mode?: "online" | "offline" | "hybrid";

  // job seeker / professional
  role?: string;
  industry?: string;
  city?: string;
  workMode?: "remote" | "hybrid" | "onsite" | "any";
  experience?: "fresher" | "0-1" | "1-3" | "3+";
  support?: string[];

  // recruiter
  companyName?: string;
  companyIndustry?: string;
  companyCity?: string;
  companyWebsite?: string;
  hiringFor?: string;
  requirements?: string[];

  // institute
  instituteName?: string;
  instituteCity?: string;
  deliveryModes?: string[];
  teaches?: string[];
  certifies?: "own" | "partner" | "none";
}

const SHARED_END: StepDef[] = [
  {
    id: "language",
    title: "Which language should the site speak?",
    blurb: "Every page, and the coach, in the language you actually read in.",
    optional: true,
  },
];

const SCHOOL: StepDef[] = [
  {
    id: "class",
    title: "What class are you in?",
    blurb: "It decides what the coach plans for, and which careers are worth looking at yet.",
  },
  {
    id: "subjects",
    title: "Which subjects do you like most?",
    blurb: "Not the ones you score highest in — the ones you would pick.",
    optional: true,
  },
  {
    id: "help",
    title: "What would you like help with?",
    blurb: "Pick as many as are true.",
    optional: true,
  },
  {
    id: "marks",
    title: "Want a study plan built from your own marks?",
    blurb: "Your marks stay on your device. You can do this later instead.",
    optional: true,
  },
  ...SHARED_END,
];

const COLLEGE: StepDef[] = [
  {
    id: "study",
    title: "What are you studying?",
    blurb: "Your degree is where the roadmap starts.",
  },
  {
    id: "goal",
    title: "What are you working toward?",
    blurb: "One choice. It is what the dashboard points at from now on.",
  },
  {
    id: "field",
    title: "Which field interests you?",
    blurb: "It narrows the courses and the internships you are shown.",
    optional: true,
  },
  {
    id: "skills",
    title: "What can you already do?",
    blurb: "Anything counts. This is what matching runs on.",
    optional: true,
  },
  {
    id: "preference",
    title: "How do you want to learn?",
    blurb: "Free options are shown first either way.",
    optional: true,
  },
  ...SHARED_END,
];

const WORK: StepDef[] = [
  {
    id: "work",
    title: "What kind of work are you looking for?",
    blurb: "Role, place and how you want to work.",
  },
  {
    id: "experience",
    title: "How much experience do you have?",
    blurb: "Fresher is an answer, not a gap.",
  },
  {
    id: "skills",
    title: "What can you already do?",
    blurb: "These go on your Skill Passport, which employers read.",
    optional: true,
  },
  {
    id: "support",
    title: "What do you need most?",
    blurb: "Pick as many as are true.",
    optional: true,
  },
  ...SHARED_END,
];

const RECRUITER: StepDef[] = [
  {
    id: "company",
    title: "Tell us about your company",
    blurb: "Candidates see this on every opening you post.",
  },
  {
    id: "roles",
    title: "What are you hiring for?",
    blurb: "One line. You can post the full opening in a minute.",
    optional: true,
  },
  {
    id: "requirements",
    title: "What matters in a candidate?",
    blurb: "It decides how applicants are matched and sorted for you.",
    optional: true,
  },
  {
    id: "verify",
    title: "About verification",
    blurb: "What the tick means, and how a company gets one.",
  },
];

const INSTITUTE: StepDef[] = [
  {
    id: "institute",
    title: "Tell us about your institute",
    blurb: "Learners see this on every course you run.",
  },
  {
    id: "delivery",
    title: "How do you teach?",
    blurb: "In person, online, or both — and where.",
    optional: true,
  },
  {
    id: "teaching",
    title: "What do you teach?",
    blurb: "The trades and subjects you run courses in.",
    optional: true,
  },
  {
    id: "certificates",
    title: "How do learners get certified?",
    blurb: "Every certificate on स्वYAM names who issued it.",
    optional: true,
  },
  ...SHARED_END,
];

const WHO: StepDef = {
  id: "who",
  title: "Which of these is you?",
  blurb: "It decides your dashboard, your navigation and which coach you get. Changeable any time.",
};

const DONE: StepDef = {
  id: "done",
  title: "Ready",
  blurb: "Built from what you just told us.",
};

/** The steps for a member, including the first question and the last screen. */
export function stepsFor(type: ProfileType | undefined, askType: boolean): StepDef[] {
  const body =
    type === "school"
      ? SCHOOL
      : type === "college"
        ? COLLEGE
        : type === "recruiter"
          ? RECRUITER
          : type === "institute"
            ? INSTITUTE
            : type
              ? WORK
              : [];
  return [...(askType ? [WHO] : []), ...body, DONE];
}

/* ── The option lists ────────────────────────────────────────────── */

export const CLASS_BANDS = [
  { id: "6-8" as const, label: "Class 6–8" },
  { id: "9-10" as const, label: "Class 9–10" },
  { id: "11-12" as const, label: "Class 11–12" },
];

export const SCHOOL_SUBJECTS = [
  "Mathematics",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Hindi",
  "Social Science",
  "Computer Science",
  "Accountancy",
  "Economics",
  "Business Studies",
  "Art",
  "Physical Education",
];

export const SCHOOL_HELP = [
  "Improve my marks",
  "Build a study routine",
  "Explore future careers",
  "Learn a new skill",
  "Prepare for board exams",
];

export const COLLEGE_GOALS = [
  "An internship",
  "My first job",
  "Higher studies",
  "Freelancing",
  "Practical skills",
  "Starting a business",
];

export const FIELDS = [
  "Technology",
  "Design",
  "Finance",
  "Marketing",
  "Skilled trades",
  "Healthcare",
  "Government exams",
  "Teaching",
  "Hospitality",
];

export const EXPERIENCE_BANDS = [
  { id: "fresher" as const, label: "Fresher" },
  { id: "0-1" as const, label: "Under a year" },
  { id: "1-3" as const, label: "1–3 years" },
  { id: "3+" as const, label: "More than 3 years" },
];

export const SUPPORT_NEEDS = [
  "Find jobs",
  "Improve my CV",
  "Prepare for interviews",
  "Learn the missing skills",
];

export const DELIVERY_MODES = ["In person", "Online", "Hybrid"];

export const CERTIFY_CHOICES = [
  { id: "own" as const, label: "Our own certificate" },
  { id: "partner" as const, label: "A partner or board certificate" },
  { id: "none" as const, label: "No certificate yet" },
];

/* ── Saving and coming back ──────────────────────────────────────── */

const KEY = "swayam-onboarding";

interface Saved {
  answers: OnboardingAnswers;
  step: number;
  at: number;
}

function all(): Record<string, Saved> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Saved>;
  } catch {
    return {};
  }
}

/** Autosave. Called on every answer, so closing the tab costs nothing. */
export function saveDraft(email: string, answers: OnboardingAnswers, step: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const a = all();
    a[email.toLowerCase()] = { answers, step, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* private window: the wizard still works, it just cannot be resumed */
  }
}

export function loadDraft(email: string): Saved | null {
  return all()[email.toLowerCase()] ?? null;
}

export function clearDraft(email: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const a = all();
    delete a[email.toLowerCase()];
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* nothing to clear */
  }
}
