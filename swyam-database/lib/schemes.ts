/**
 * The scheme eligibility checker, client side.
 *
 * A short form — age, state, what you are doing now, qualification, income
 * band, and what you want the money or training for — goes to /api/schemes,
 * which reads it against the schemes in `src/data/topics.ts` and comes back
 * with a verdict per scheme. Nothing here is stored anywhere; the answers go
 * out and the verdicts come back.
 */

export type Situation = "school" | "college" | "iti" | "unemployed" | "working" | "self-employed";
export type IncomeBand = "under-1" | "1-2.5" | "2.5-8" | "over-8" | "skip";
export type Goal = "free-training" | "apprenticeship" | "loan" | "scholarship" | "job" | "business";

export interface SchemeAnswers {
  age: number | null;
  state: string;
  situation: Situation;
  qualification: string;
  /** Family income per year, in lakhs, as a band. "skip" is respected. */
  income: IncomeBand;
  goals: Goal[];
  /** Optional, and only because several schemes are reserved. */
  category: "sc" | "st" | "obc" | "ews" | "general" | "skip";
  woman: boolean | null;
  disability: boolean | null;
  minority: boolean | null;
  /** A trade or field, if they have one in mind. */
  trade: string;
}

export type Verdict = "likely" | "maybe" | "unlikely";

export interface SchemeResult {
  id: string;
  verdict: Verdict;
  /** One line, in plain words, tied to what they told us. */
  reason: string;
  /** What to have ready or to confirm on the official page. */
  confirm: string;
}

export interface SchemeCheck {
  results: SchemeResult[];
  /** One or two sentences across all of it. */
  summary: string;
}

export const SITUATIONS: { id: Situation; label: string }[] = [
  { id: "school", label: "In school" },
  { id: "college", label: "In college / diploma" },
  { id: "iti", label: "In ITI or training" },
  { id: "unemployed", label: "Looking for work" },
  { id: "working", label: "Working" },
  { id: "self-employed", label: "Self-employed / artisan" },
];

export const INCOME_BANDS: { id: IncomeBand; label: string }[] = [
  { id: "under-1", label: "Under ₹1 lakh" },
  { id: "1-2.5", label: "₹1 – 2.5 lakh" },
  { id: "2.5-8", label: "₹2.5 – 8 lakh" },
  { id: "over-8", label: "Over ₹8 lakh" },
  { id: "skip", label: "Prefer not to say" },
];

export const GOALS: { id: Goal; label: string }[] = [
  { id: "free-training", label: "Free training" },
  { id: "apprenticeship", label: "A paid apprenticeship" },
  { id: "loan", label: "A loan for a course or tools" },
  { id: "scholarship", label: "A scholarship" },
  { id: "job", label: "Help finding a job" },
  { id: "business", label: "Starting or growing a small business" },
];

export const QUALIFICATIONS = [
  "Below Class 8",
  "Class 8 pass",
  "Class 10 pass",
  "Class 12 pass",
  "ITI / diploma",
  "Graduate",
  "Postgraduate",
];

export const EMPTY_ANSWERS: SchemeAnswers = {
  age: null,
  state: "",
  situation: "unemployed",
  qualification: "Class 10 pass",
  income: "skip",
  goals: [],
  category: "skip",
  woman: null,
  disability: null,
  minority: null,
  trade: "",
};

export async function checkSchemes(answers: SchemeAnswers): Promise<SchemeCheck> {
  const res = await fetch("/api/schemes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  const data = (await res.json().catch(() => ({}))) as SchemeCheck & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "The checker could not answer just now.");
  return data;
}
