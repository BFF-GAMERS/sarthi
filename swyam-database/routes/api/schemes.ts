import { createFileRoute } from "@tanstack/react-router";
import { ask, isGeminiConfigured, keyFor } from "@/lib/gemini";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { schemes } from "@/data/topics";
import type { SchemeAnswers, SchemeCheck, SchemeResult, Verdict } from "@/lib/schemes";

/**
 * "Which of these schemes might I qualify for?"
 *
 * The model is given the schemes exactly as the page shows them — name,
 * benefit, eligibility line, how to apply — and the visitor's answers, and is
 * asked for a verdict per scheme with a reason that quotes the eligibility
 * line. It may not add a scheme, an amount or a rule that is not in the list.
 * Every id that comes back is checked against the list; anything else is
 * dropped. "Likely" is the strongest word it is allowed, because the
 * ministry decides, not this server, and every result carries the official
 * link for that reason.
 *
 * Nothing is stored. Income, category and disability are among the answers,
 * which is exactly why the request is not logged and the answers are not
 * written anywhere.
 */

interface Body {
  answers?: Partial<SchemeAnswers>;
}

const VERDICTS: Verdict[] = ["likely", "maybe", "unlikely"];

const RULES = [
  "You help people in India find out which government skilling schemes they might qualify for.",
  "You are given the FULL list of schemes this site knows, with each scheme's own eligibility line.",
  "",
  "RULES THAT OVERRIDE EVERYTHING ELSE:",
  "- Judge ONLY against the eligibility line and benefit given for each scheme. Never add a rule, an amount, an age band or a deadline that is not in the list.",
  "- Never say someone IS eligible. The strongest verdict is 'likely'. The ministry decides.",
  "- Give a verdict for EVERY scheme in the list, by its exact id.",
  "- 'likely' = nothing they said conflicts with the eligibility line and the scheme fits at least one of their goals.",
  "- 'maybe' = it could fit but something is unknown, or the scheme is only loosely related to their goals.",
  "- 'unlikely' = something they said clearly conflicts (for example age outside a stated band, or a scheme reserved for a group they are not in).",
  "- If they chose 'prefer not to say' for income or category, treat that fact as unknown — never guess it, and say what to check.",
  "- The reason must be one short plain sentence tied to what they told you. No jargon.",
  "- 'confirm' is one short line: the document or fact to have ready, or the thing to check on the official page.",
  "- Plain language, second person, kind. No promises.",
].join("\n");

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

function normalise(a: Partial<SchemeAnswers>): SchemeAnswers {
  const age = typeof a.age === "number" && a.age >= 5 && a.age <= 99 ? Math.round(a.age) : null;
  const goals = Array.isArray(a.goals)
    ? a.goals
        .map((g) => clean(g, 30))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return {
    age,
    state: clean(a.state, 40),
    situation: (clean(a.situation, 20) || "unemployed") as SchemeAnswers["situation"],
    qualification: clean(a.qualification, 40),
    income: (clean(a.income, 10) || "skip") as SchemeAnswers["income"],
    goals: goals as SchemeAnswers["goals"],
    category: (clean(a.category, 10) || "skip") as SchemeAnswers["category"],
    woman: typeof a.woman === "boolean" ? a.woman : null,
    disability: typeof a.disability === "boolean" ? a.disability : null,
    minority: typeof a.minority === "boolean" ? a.minority : null,
    trade: clean(a.trade, 60),
  };
}

const INCOME_WORDS: Record<string, string> = {
  "under-1": "under ₹1 lakh a year",
  "1-2.5": "₹1 to 2.5 lakh a year",
  "2.5-8": "₹2.5 to 8 lakh a year",
  "over-8": "over ₹8 lakh a year",
  skip: "not given",
};

const yesNo = (v: boolean | null) => (v === null ? "not given" : v ? "yes" : "no");

function parseJson<T>(text: string): T {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("The checker gave an answer that could not be read.");
  }
}

async function check(answers: SchemeAnswers): Promise<SchemeCheck> {
  const list = schemes.map((s) => ({
    id: s.id,
    name: s.name,
    benefit: s.benefit,
    eligibility: s.eligibility,
    how: s.how,
  }));

  const system = [
    RULES,
    "",
    "Answer with JSON only, in exactly this shape:",
    JSON.stringify({
      summary: "one or two sentences across all schemes",
      results: [
        {
          id: "scheme id",
          verdict: "likely|maybe|unlikely",
          reason: "one sentence",
          confirm: "one line",
        },
      ],
    }),
  ].join("\n");

  const user = [
    `AGE: ${answers.age ?? "not given"}`,
    `STATE: ${answers.state || "not given"}`,
    `CURRENTLY: ${answers.situation}`,
    `HIGHEST QUALIFICATION: ${answers.qualification || "not given"}`,
    `FAMILY INCOME: ${INCOME_WORDS[answers.income] ?? "not given"}`,
    `CATEGORY: ${answers.category === "skip" ? "not given" : answers.category.toUpperCase()}`,
    `WOMAN: ${yesNo(answers.woman)}`,
    `PERSON WITH DISABILITY: ${yesNo(answers.disability)}`,
    `MINORITY COMMUNITY: ${yesNo(answers.minority)}`,
    `WANTS: ${answers.goals.join(", ") || "not given"}`,
    `TRADE OR FIELD IN MIND: ${answers.trade || "not given"}`,
    "",
    "SCHEMES (judge every one of these, by id):",
    JSON.stringify(list),
  ].join("\n");

  type Raw = { summary?: unknown; results?: unknown };
  const once = async () =>
    parseJson<Raw>(
      await ask([{ role: "user", content: user }], {
        system,
        json: true,
        maxTokens: 4000,
        temperature: 0.2,
        apiKey: keyFor("schemes"),
      }),
    );

  let raw: Raw;
  try {
    raw = await once();
  } catch {
    raw = await once();
  }

  const known = new Map(schemes.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const results: SchemeResult[] = [];
  for (const r of Array.isArray(raw.results) ? raw.results : []) {
    const item = r as Partial<SchemeResult>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    const verdict = VERDICTS.includes(item.verdict as Verdict)
      ? (item.verdict as Verdict)
      : "maybe";
    results.push({
      id,
      verdict,
      reason: clean(item.reason, 240) || "Check the eligibility line against your details.",
      confirm: clean(item.confirm, 200) || "Confirm on the official page before you apply.",
    });
  }
  // A scheme the model skipped is not "unlikely"; it is unanswered, and said so.
  for (const s of schemes) {
    if (!seen.has(s.id)) {
      results.push({
        id: s.id,
        verdict: "maybe",
        reason: "Not assessed this time — read the eligibility line yourself.",
        confirm: "Confirm on the official page.",
      });
    }
  }

  return {
    summary: clean(raw.summary, 400),
    results,
  };
}

export const Route = createFileRoute("/api/schemes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.heavy);
        if (limited) return limited;

        if (!isGeminiConfigured()) {
          return Response.json(
            { error: "The eligibility checker is not configured on this server." },
            { status: 503 },
          );
        }
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400 });
        }
        if (!body.answers || typeof body.answers !== "object") {
          return Response.json({ error: "Bad request." }, { status: 400 });
        }
        try {
          return Response.json(await check(normalise(body.answers)));
        } catch (err) {
          const message = err instanceof Error ? err.message : "The checker could not answer.";
          const status = /429|quota|exhausted/i.test(message) ? 429 : 502;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
