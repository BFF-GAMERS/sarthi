export type AskResult = { ok: true; answer: string } | { ok: false; error: string };
export type SarthiLang = "en" | "hi" | "hinglish";

export interface AskInput {
  question: string;
  context: string;
  lang: SarthiLang;
  classLevel: number;
  subject: string;
  chapter: string;
  history?: { role: "user" | "model"; text: string }[];
}

const FALLBACK_ERROR = "Sarthi AI is unavailable right now, so this answer comes from the offline lesson notes.";

export async function askSarthi(input: AskInput): Promise<AskResult> {
  try {
    const res = await fetch("/api/sarthi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, context: input.context.slice(0, 7500) }),
    });
    const data = (await res.json().catch(() => null)) as { answer?: unknown; error?: unknown } | null;
    if (!res.ok) {
      const msg = typeof data?.error === "string" && (res.status === 503 || res.status === 429) ? data.error : FALLBACK_ERROR;
      return { ok: false, error: msg };
    }
    return typeof data?.answer === "string" ? { ok: true, answer: data.answer } : { ok: false, error: FALLBACK_ERROR };
  } catch {
    return { ok: false, error: "You seem to be offline. Showing an answer from the saved lesson notes." };
  }
}

/** Rough check: does this look like a numerical / "solve this" question? */
export function looksNumerical(q: string): boolean {
  const hasNumber = /\d/.test(q);
  const verb = /(find|calculate|compute|determine|solve|evaluate|kitna|kitni|nikalo|nikaalo|ज्ञात|गणना|हल|प्रश्न हल)/i.test(q);
  const unit = /\b(m\/s|km\/h|kg|n\b|j\b|w\b|v\b|ohm|Ω|cm|mm|°|mol|g\b|hz|a\b|c\b)/i.test(q);
  return hasNumber && (verb || unit);
}

export type SolveResult = { ok: true; solution: import("../components/Whiteboard").Solution } | { ok: false; error: string };

export async function solveOnBoard(input: Omit<AskInput, "context" | "history">): Promise<SolveResult> {
  try {
    const res = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => null)) as { solution?: unknown; error?: string } | null;
    if (!res.ok || !data?.solution) return { ok: false, error: data?.error ?? "Sarthi could not solve this on the board." };
    return { ok: true, solution: data.solution as import("../components/Whiteboard").Solution };
  } catch {
    return { ok: false, error: "The board needs internet." };
  }
}

/** @deprecated kept for older callers */
export async function askGemini(question: string, context: string): Promise<AskResult> {
  return askSarthi({ question, context, lang: "en", classLevel: 10, subject: "", chapter: "" });
}
