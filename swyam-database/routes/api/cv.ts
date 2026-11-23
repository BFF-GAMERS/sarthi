import { createFileRoute } from "@tanstack/react-router";
import { ask, isGeminiConfigured, keyFor } from "@/lib/gemini";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/**
 * CV review.
 *
 * A person applying for their first job is usually rejected by a filter they
 * never see, for reasons nobody tells them: the file was a photo, the phone
 * number was in a header the parser dropped, the bullet said "worked on
 * billing" where the posting said "invoicing". None of that is about ability,
 * and all of it is fixable in twenty minutes if somebody points at it.
 *
 * The hard rule, and the reason most of the prompt is about it: this rewrites
 * what the person already wrote. It does not invent. A tool that adds a
 * plausible achievement gets somebody caught in an interview they would
 * otherwise have passed, and the cost of that lands on them, not on us. So
 * every suggestion has to be traceable to a line they wrote, and anything the
 * CV is genuinely missing is reported as a gap for them to fill in themselves.
 *
 * The CV is not stored. It is held in memory for the length of the request and
 * goes out with the response.
 */

interface CvRequest {
  /** Plain text of the CV. Never a file — parsing happens in the browser. */
  cv?: string;
  /** Optional posting to tailor against. */
  role?: {
    title?: string;
    company?: string;
    summary?: string;
    responsibilities?: string[];
    eligibility?: string;
    skills?: string[];
  };
  language?: string;
}

const SYSTEM = [
  "You review CVs for स्वYAM, an Indian skilling platform.",
  "The reader is usually applying for a first or second job. Many did not go to",
  "university, many are writing in their second language, and most have never",
  "been told why an application was rejected.",
  "",
  "THE RULE THAT OVERRIDES EVERYTHING ELSE:",
  "Never invent experience, employers, dates, qualifications or numbers. Every",
  "rewritten line must be traceable to something the person actually wrote. If",
  "a line is weak because it is missing a detail, do not supply the detail —",
  "put it in `gaps` as a question for them to answer themselves. A CV that",
  "claims something untrue fails at the interview, and that cost lands on the",
  "applicant, not on us.",
  "",
  "What you are looking for, in order of how much it costs them:",
  "1. Anything that stops a screening system reading the file at all — contact",
  "   details buried in a header, tables, columns, an email that is a picture.",
  "2. Missing basics: phone, email, city, the job title they are applying for.",
  "3. Bullets that describe duties rather than results, or that hide the",
  "   candidate behind 'we'.",
  "4. Wording that does not match the posting when the underlying work does.",
  "   Same work, different word, is the most common silent rejection there is.",
  "5. Length, order and anything that buries the relevant part.",
  "",
  "Tone: direct, warm, specific. Never condescending. Never tell somebody their",
  "experience is not good enough — tell them how to describe what they have.",
  "Rupees stay rupees. Indian conventions throughout.",
].join("\n");

function userPrompt(cv: string, role: CvRequest["role"], language: string): string {
  const target = role
    ? [
        "",
        "THEY ARE APPLYING FOR THIS ROLE:",
        `Title: ${role.title ?? "not given"}`,
        role.company ? `Employer: ${role.company}` : "",
        role.summary ? `About the role: ${role.summary}` : "",
        role.responsibilities?.length
          ? "Responsibilities:\n" + role.responsibilities.map((r) => `  - ${r}`).join("\n")
          : "",
        role.eligibility ? `Eligibility: ${role.eligibility}` : "",
        role.skills?.length ? `Skills asked for: ${role.skills.join(", ")}` : "",
        "",
        "Tailor the review to this posting. Where the CV describes the same work",
        "in different words, say which word to use. Where the posting asks for",
        "something the CV genuinely does not show, put it in `gaps`.",
      ]
        .filter(Boolean)
        .join("\n")
    : "\nNo specific role was given, so review it as a general application.";

  return [
    "Review this CV and reply with ONLY a JSON object, no prose around it, no",
    "markdown fence. Shape:",
    "",
    "{",
    '  "score": 0-100,',
    '  "verdict": "one honest sentence about where this CV stands",',
    '  "readability": {',
    '    "willParse": true|false,',
    '    "problems": ["anything that would break an automatic screen"]',
    "  },",
    '  "missing": ["basics absent from the CV entirely — phone, city, and so on"],',
    '  "rewrites": [',
    "    {",
    '      "original": "the exact line from their CV",',
    '      "suggested": "the same claim, written better — no new facts",',
    '      "why": "one sentence"',
    "    }",
    "  ],",
    '  "keywords": {',
    '    "matched": ["words the CV and the posting share"],',
    '    "toAdd": ["words from the posting for work the CV already shows, worded differently"]',
    "  },",
    '  "gaps": ["questions only they can answer, phrased as a question"],',
    '  "nextSteps": ["3 things to do now, most valuable first"]',
    "}",
    "",
    "Between five and eight rewrites. Quote `original` exactly as it appears so",
    "they can find the line. If the CV is too short or too garbled to review,",
    "say so in `verdict`, score it low, and put the real problem in `missing`.",
    language && language !== "en"
      ? `Write all prose in the language with code "${language}". Keep the JSON keys in English.`
      : "",
    target,
    "",
    "THE CV:",
    "---",
    cv.slice(0, 18_000),
    "---",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Models like to wrap JSON in a fence however firmly you ask them not to. */
function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

export const Route = createFileRoute("/api/cv")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.heavy);
        if (limited) return limited;

        const { cv, role, language } = (await request.json()) as CvRequest;

        const text = (cv ?? "").trim();
        if (text.length < 120) {
          return Response.json(
            {
              error:
                "That is too short to review. Paste the whole CV — the text, not a screenshot.",
            },
            { status: 400 },
          );
        }

        if (!isGeminiConfigured()) {
          return Response.json(
            {
              error: "CV review is not switched on right now. Your CV was not sent anywhere.",
            },
            { status: 503 },
          );
        }

        try {
          const reply = await ask(
            [{ role: "user", content: userPrompt(text, role, language ?? "en") }],
            {
              system: SYSTEM,
              apiKey: keyFor("cv"),
              maxTokens: 3000,
              // Low, because this is analysis. A creative temperature here is
              // exactly how a model starts inventing a job that never happened.
              temperature: 0.2,
            },
          );

          const parsed = parseJson(reply);
          if (!parsed || typeof parsed !== "object") {
            return Response.json(
              { error: "The review came back in a shape we could not read. Try again." },
              { status: 502 },
            );
          }
          return Response.json(parsed);
        } catch (error) {
          console.error("cv review failed", error);
          const message = error instanceof Error ? error.message : "Unknown error";
          // A quota message is worth passing through: it clears on its own and
          // "try again in a minute" is actionable, unlike "something failed".
          const quota = /429|quota|rate/i.test(message);
          return Response.json(
            {
              error: quota
                ? "The review service is busy right now. Try again in a minute."
                : "The review could not be completed. Your CV was not stored.",
            },
            { status: quota ? 429 : 500 },
          );
        }
      },
    },
  },
});
