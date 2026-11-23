/**
 * The AI coach — what it takes in, what it gives back, and where it is kept.
 *
 * Two versions of one feature. A school student gets the "AI Study Coach":
 * marks in, a study plan and a first look at careers out. A college student
 * gets the "AI Career & Learning Coach": the same marks, plus degree, skills
 * and a target role, and a roadmap from where they are to their first job.
 * Same engine, different questions, different words.
 *
 * Everything here is the member's own academic record, which is the most
 * private thing on the site. So:
 *
 *  - It is stored on this device only, under a key that is theirs, and the
 *    button that deletes it deletes it — there is no server copy to forget.
 *  - It is sent to the model for the length of one request and not kept.
 *  - Nothing derived from it is shown to any other member. Ever.
 *
 * TRIAL NOTE. localStorage is the store because this folder shares the
 * production database. A real version keeps the same interface and swaps the
 * three functions at the bottom for a table with row-level security.
 */

export type CoachMode = "school" | "college";

export interface SubjectMark {
  subject: string;
  max: number;
  scored: number;
}

export interface CoachInputs {
  mode: CoachMode;
  /** "Class 10" · "B.Com, 2nd year" */
  level: string;
  /** CBSE, State board, university — optional, helps the plan. */
  board?: string;
  /** Classes 9–12: Science / Commerce / Arts / not decided. */
  stream?: string;
  marks: SubjectMark[];
  interests: string[];
  goal: string;
  city: string;
  /** Locale code the plan should be written in. */
  language: string;
  budget: "free" | "under-1000" | "under-3000" | "any";
  learningMode: "online" | "offline" | "hybrid" | "any";
  /* college */
  degree?: string;
  branch?: string;
  year?: string;
  skills?: string[];
  projects?: string;
  targetRole?: string;
}

export interface CoachSubject {
  subject: string;
  scored: number;
  max: number;
  percent: number;
  /** strength · steady · focus — never "weak". */
  band: "strength" | "steady" | "focus";
  note: string;
}

export interface CoachCourseRec {
  courseId: string;
  label: "Great starting point" | "Good match" | "Build this skill next";
  why: string;
  prerequisite?: string;
}

export interface CoachPlan {
  generatedAt: string;
  mode: CoachMode;
  language: string;
  snapshot: { headline: string; summary: string; overallPercent: number | null };
  subjects: CoachSubject[];
  strengths: string[];
  focusAreas: { subject: string; why: string; firstStep: string }[];
  weeklyPlan: { day: string; blocks: { subject: string; minutes: number; task: string }[] }[];
  tips: { subject: string; tip: string }[];
  concepts: { subject: string; items: string[] }[];
  practice: { subject: string; task: string }[];
  quizzes: {
    subject: string;
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  }[];
  timeManagement: string[];
  careerDirections: { title: string; why: string; firstStep: string }[];
  /** Classes 9–12 only. */
  streams?: { name: string; fit: "strong" | "possible" | "explore"; why: string }[];
  recommendedCourses: CoachCourseRec[];
  growthPath: { step: number; title: string; detail: string }[];
  nextActions: string[];
  encouragement: string;
}

export interface CoachRecord {
  inputs: CoachInputs;
  plan: CoachPlan | null;
  /** When the member agreed to the consent text. */
  consentedAt: string;
}

/* ── Storage (this device only) ──────────────────────────────────── */

const KEY = "swayam-coach";

function all(): Record<string, CoachRecord> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, CoachRecord>;
  } catch {
    return {};
  }
}

export function loadCoach(email: string): CoachRecord | null {
  return all()[email.toLowerCase()] ?? null;
}

export function saveCoach(email: string, record: CoachRecord): void {
  if (typeof localStorage === "undefined") return;
  const a = all();
  a[email.toLowerCase()] = record;
  localStorage.setItem(KEY, JSON.stringify(a));
}

/** The delete button. Removes the marks, the plan and the consent — all of it. */
export function deleteCoach(email: string): void {
  if (typeof localStorage === "undefined") return;
  const a = all();
  delete a[email.toLowerCase()];
  localStorage.setItem(KEY, JSON.stringify(a));
}

/* ── The API ─────────────────────────────────────────────────────── */

export interface ExtractedMarks {
  level?: string;
  board?: string;
  marks: SubjectMark[];
  /** Whatever the model could not read with confidence. */
  notes?: string;
}

/** Read a marksheet photo or PDF page into subjects and marks. */
export async function extractMarks(file: File): Promise<ExtractedMarks> {
  const data = await fileToBase64(file);
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "extract", image: { mimeType: file.type, data } }),
  });
  const body = (await res.json()) as ExtractedMarks & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not read the marksheet.");
  return body;
}

/** Turn inputs into a plan. The catalogue it recommends from is the real one. */
export async function generatePlan(inputs: CoachInputs): Promise<CoachPlan> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "plan", inputs }),
  });
  const body = (await res.json()) as CoachPlan & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not build the plan.");
  return body;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/* ── Helpers the page uses ───────────────────────────────────────── */

export const percentOf = (m: SubjectMark): number =>
  m.max > 0 ? Math.round((m.scored / m.max) * 100) : 0;

export const BUDGETS: { id: CoachInputs["budget"]; label: string }[] = [
  { id: "free", label: "Free only" },
  { id: "under-1000", label: "Up to ₹1,000" },
  { id: "under-3000", label: "Up to ₹3,000" },
  { id: "any", label: "Any" },
];

export const MODES: { id: CoachInputs["learningMode"]; label: string }[] = [
  { id: "online", label: "Online" },
  { id: "offline", label: "In person" },
  { id: "hybrid", label: "Both" },
  { id: "any", label: "No preference" },
];

export const SCHOOL_LEVELS = [
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];
export const STREAMS = [
  "Not decided yet",
  "Science",
  "Commerce",
  "Arts / Humanities",
  "Vocational",
];

export const SCHOOL_INTERESTS = [
  "Math",
  "Science",
  "Computers",
  "Languages",
  "Art & design",
  "Sports",
  "Business",
  "Social studies",
  "Music",
  "Writing",
  "Building things",
  "Helping people",
];
export const COLLEGE_INTERESTS = [
  "Software",
  "Data & analytics",
  "Design",
  "Marketing",
  "Finance",
  "Core engineering",
  "Healthcare",
  "Teaching",
  "Media & content",
  "Entrepreneurship",
  "Government exams",
  "Trades & manufacturing",
];

/* ── What onboarding already asked ───────────────────────────────── */

const PREFILL_KEY = "swayam-coach-prefill";

/**
 * The coach's form, part-filled from onboarding.
 *
 * A student who has just told us their class, their favourite subjects and
 * their goal should not be asked all three again two minutes later. This is
 * that handover: a partial `CoachInputs`, on the device, consumed the first
 * time the coach form opens and then left alone — if they edit the form, the
 * form wins.
 */
export type CoachPrefill = Partial<CoachInputs>;

export function saveCoachPrefill(email: string, prefill: CoachPrefill): void {
  if (typeof localStorage === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(PREFILL_KEY) ?? "{}") as Record<
      string,
      CoachPrefill
    >;
    all[email.toLowerCase()] = prefill;
    localStorage.setItem(PREFILL_KEY, JSON.stringify(all));
  } catch {
    /* the form simply starts empty */
  }
}

export function loadCoachPrefill(email: string): CoachPrefill | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(PREFILL_KEY) ?? "{}") as Record<
      string,
      CoachPrefill
    >;
    return all[email.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

export function clearCoachPrefill(email: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(PREFILL_KEY) ?? "{}") as Record<
      string,
      CoachPrefill
    >;
    delete all[email.toLowerCase()];
    localStorage.setItem(PREFILL_KEY, JSON.stringify(all));
  } catch {
    /* already gone */
  }
}
