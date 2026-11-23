import { createFileRoute } from "@tanstack/react-router";
import { ask, isGeminiConfigured, keyFor } from "@/lib/gemini";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { languageFor } from "@/lib/languages";

/**
 * The AI mentor: the self-paced route through a skill.
 *
 * "Self-paced" used to be one option in the same dropdown as video call, chat
 * and in person — which asked someone to find a human trainer and then not
 * meet them. It was a contradiction, and it produced sessions where a trainer
 * was on the hook for a lesson the learner never expected to attend.
 *
 * Self-paced is not a format of human teaching. It is the absence of one, and
 * what belongs in that absence is a mentor that is always awake. This endpoint
 * is that mentor, and it does exactly two things:
 *
 *   plan   Build the modules. The learner has no syllabus, no trainer and no
 *          idea what order to learn things in, and that -- not the answers --
 *          is what stops people learning alone.
 *
 *   guide  Answer while they work. Deliberately crippled: it explains, points,
 *          asks back and gives the next step, and it will not hand over
 *          finished work. Somebody who gets the answer has learnt nothing and
 *          will fail the assessment that the certificate depends on, so a
 *          mentor that does the exercise for you is not being generous.
 *
 * There is no key on the client. Without a key configured the plan falls back
 * to a structured local one, because a learner with no trainer and no plan is
 * exactly the person this route exists for.
 */

interface PlanRequest {
  op: "plan";
  skill: string;
  level?: string;
  language?: string;
  goal?: string;
}

interface GuideRequest {
  op: "guide";
  skill: string;
  module?: string;
  step?: string;
  question: string;
  language?: string;
  history?: Array<{ role?: string; content?: string }>;
}

type MentorRequest = PlanRequest | GuideRequest;

export interface MentorStep {
  title: string;
  detail: string;
}

export interface MentorModule {
  title: string;
  /** Why this module exists — one sentence, in the learner's terms. */
  why: string;
  minutes: number;
  steps: MentorStep[];
  /** Something to make or do, offline where possible. */
  practice: string;
  /** Questions they should be able to answer before moving on. */
  checks: string[];
}

export interface MentorPlan {
  skill: string;
  level: string;
  summary: string;
  modules: MentorModule[];
  /** True when a language model wrote it; false for the built-in fallback. */
  generated: boolean;
}

/* ── Plan ────────────────────────────────────────────────────────── */

function planSystem(language: string): string {
  const lang = languageFor(language);
  return [
    "You design self-study plans for Indian vocational learners on स्वYAM.",
    "The learner has NO trainer. The plan is the only structure they will get.",
    "",
    "Return ONLY a JSON object, no prose and no code fence, of this shape:",
    '{"summary": string, "modules": [{"title": string, "why": string,',
    ' "minutes": number, "steps": [{"title": string, "detail": string}],',
    ' "practice": string, "checks": [string]}]}',
    "",
    "Rules:",
    "- Between 5 and 7 modules, ordered so each one only needs the ones before it.",
    "- 3 to 5 steps per module. `detail` is two or three plain sentences.",
    "- `minutes` is honest study time for one module, typically 30 to 90.",
    "- `practice` must be something they can actually do with cheap or free",
    "  tools available in India. Name the tool.",
    "- 2 to 4 `checks`: questions they should be able to answer, not tasks.",
    "- No links, no book recommendations, no course names, no prices.",
    "- Short sentences. Assume no jargon and no prior study.",
    lang.code === "en"
      ? "- Write in Indian English."
      : `- Write in ${lang.label}. Keep technical terms in English where that is what a workplace would say.`,
  ].join("\n");
}

/**
 * A plan that does not depend on a model being reachable.
 *
 * It is generic by construction, and says so on the page. A generic plan a
 * learner can start today beats a spinner that never resolves, which is what
 * the alternative looks like when a key expires.
 */
function fallbackPlan(skill: string, level: string): MentorPlan {
  const mk = (
    title: string,
    why: string,
    minutes: number,
    steps: [string, string][],
    practice: string,
    checks: string[],
  ): MentorModule => ({
    title,
    why,
    minutes,
    steps: steps.map(([t, d]) => ({ title: t, detail: d })),
    practice,
    checks,
  });

  return {
    skill,
    level,
    summary: `A working order for learning ${skill} on your own. Do the practice in each module before moving on — reading alone does not pass an assessment.`,
    generated: false,
    modules: [
      mk(
        `What ${skill} actually is`,
        "Knowing the shape of the whole thing stops you learning parts in the wrong order.",
        45,
        [
          ["The job it does", `Write down, in your own words, what ${skill} is used for at work.`],
          ["The words people use", "List the ten terms you keep seeing. Define each in one line."],
          ["Who pays for it", "Find three job posts asking for it. Note what they expect."],
        ],
        `Write a one-page note explaining ${skill} to somebody who has never heard of it.`,
        [`What problem does ${skill} solve?`, "Which three terms matter most?"],
      ),
      mk(
        "Set up and first attempt",
        "Getting the tools working is where most self-study stops. Do it before you need it.",
        60,
        [
          ["Install what you need", "Set up the free tool people actually use. Note every error."],
          ["Copy something that works", "Reproduce a small working example exactly."],
          ["Break it on purpose", "Change one thing, see what fails, and change it back."],
        ],
        "Get one small thing working end to end, however ugly.",
        ["Can you set it up again from scratch?", "What broke, and why?"],
      ),
      mk(
        "The core skill",
        "This is the part an assessment tests. Everything else is scaffolding around it.",
        90,
        [
          ["The main idea", "Learn the one technique the skill is built on."],
          ["Do it five times", "Repeat on five different inputs until it is boring."],
          ["Explain it out loud", "If you cannot say it plainly, you do not have it yet."],
        ],
        "Do the core task five times on five different examples.",
        ["Can you do it without looking anything up?", "Where do you still hesitate?"],
      ),
      mk(
        "Doing it properly",
        "The difference between knowing it and being paid for it is the checking.",
        60,
        [
          ["Standards", "Find how the work is judged: safety, accuracy, finish, speed."],
          ["Check your own work", "Make a checklist and run your last attempt through it."],
          ["Fix, do not restart", "Repair one flawed piece rather than beginning again."],
        ],
        "Take your best attempt and bring it up to the standard on your checklist.",
        ["What are the three ways this is usually judged?", "Which do you fail most?"],
      ),
      mk(
        "Something you can show",
        "Nobody hires from a certificate alone. They hire from work they can see.",
        90,
        [
          ["Pick something real", "Choose a task an employer would recognize."],
          ["Finish it", "Complete it, flaws and all. Unfinished work proves nothing."],
          ["Write what you did", "Two paragraphs: what you built, and what went wrong."],
        ],
        "Finish one piece and add it to your skill passport.",
        ["Would somebody hiring understand it?", "What would you do differently?"],
      ),
      mk(
        "Ready for the assessment",
        "Sitting it cold is how people fail something they already know.",
        45,
        [
          ["Find the gaps", "List everything from the modules above you are unsure of."],
          ["Work the weakest", "Redo the practice for the two you are worst at."],
          ["Time yourself", "Answer under time pressure once before the real thing."],
        ],
        "Redo the practice from your two weakest modules, timed.",
        ["Which two modules are weakest?", "Have you closed them?"],
      ),
    ],
  };
}

/** Models sometimes fence JSON despite being asked not to. */
function parsePlan(raw: string): { summary: string; modules: MentorModule[] } | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  try {
    const body = JSON.parse(cleaned.slice(start, end + 1)) as {
      summary?: string;
      modules?: MentorModule[];
    };
    if (!Array.isArray(body.modules) || body.modules.length === 0) return null;

    // Trust the shape only as far as it can be checked; a half-formed module
    // renders as a blank card, which is worse than the fallback plan.
    const modules = body.modules
      .filter((m) => m && typeof m.title === "string" && Array.isArray(m.steps))
      .map((m) => ({
        title: String(m.title),
        why: String(m.why ?? ""),
        minutes: Number(m.minutes) || 60,
        steps: (m.steps ?? [])
          .filter((s) => s && typeof s.title === "string")
          .map((s) => ({ title: String(s.title), detail: String(s.detail ?? "") })),
        practice: String(m.practice ?? ""),
        checks: Array.isArray(m.checks) ? m.checks.map(String) : [],
      }))
      .filter((m) => m.steps.length > 0);

    if (modules.length === 0) return null;
    return { summary: String(body.summary ?? ""), modules };
  } catch {
    return null;
  }
}

async function buildPlan(req: PlanRequest): Promise<MentorPlan> {
  const level = req.level || "beginner";
  if (!isGeminiConfigured()) return fallbackPlan(req.skill, level);

  const prompt = [
    `Skill: ${req.skill}`,
    `Starting level: ${level}`,
    req.goal ? `What they want out of it: ${req.goal}` : "",
    "Design their self-study plan.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await ask([{ role: "user", content: prompt }], {
      system: planSystem(req.language ?? "en"),
      apiKey: keyFor("mentor"),
      maxTokens: 4000,
      // Study plans should be predictable; two learners asking for the same
      // skill should not get wildly different orders.
      temperature: 0.3,
    });
    const parsed = parsePlan(raw);
    if (!parsed) return fallbackPlan(req.skill, level);
    return {
      skill: req.skill,
      level,
      summary: parsed.summary,
      modules: parsed.modules,
      generated: true,
    };
  } catch (error) {
    console.error("mentor plan fell back to the built-in one", error);
    return fallbackPlan(req.skill, level);
  }
}

/* ── Guide ───────────────────────────────────────────────────────── */

function guideSystem(req: GuideRequest): string {
  const lang = languageFor(req.language ?? "en");
  return [
    `You are the AI mentor on स्वYAM, guiding somebody learning ${req.skill} with no human trainer.`,
    req.module ? `They are on the module: ${req.module}.` : "",
    req.step ? `Specifically the step: ${req.step}.` : "",
    "",
    "You GUIDE. You do not do the work.",
    "",
    "That means:",
    "- Explain the idea behind what they are stuck on, in plain language.",
    "- Give the next single step, not the whole solution.",
    "- If they ask for finished work -- code, a design, an answer to their",
    "  practice task -- say plainly that you will not, and explain the part",
    "  they are missing instead. Somebody who is handed the answer fails the",
    "  assessment their certificate depends on.",
    "- Ask one question back when their question is too vague to answer well.",
    "- Point out what to check to know whether they got it right.",
    "",
    "Keep it short: 3 to 6 sentences, or a tight list. No preamble.",
    "Never invent a course, a price, a scheme or a link.",
    lang.code === "en" ? "Reply in Indian English." : `Reply in ${lang.label}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function guide(req: GuideRequest): Promise<string> {
  if (!isGeminiConfigured()) {
    return [
      "The guide is not available right now, so here is the method it would use.",
      "",
      "1. Write down exactly what you expected to happen, and what happened instead.",
      "2. Take the smallest piece that still shows the problem and work only on that.",
      "3. Change one thing at a time. If two things change, you learn nothing from the result.",
      "4. Re-read the step above this one — most blocks are the previous step half-done.",
      "",
      "If it is still stuck, post it in the community: somebody one step ahead of you will know.",
    ].join("\n");
  }

  const past = (req.history ?? [])
    .filter((t) => t && typeof t.content === "string" && t.content.trim())
    .slice(-6)
    .map((t) => ({
      role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(t.content),
    }));

  return ask([...past, { role: "user", content: req.question }], {
    system: guideSystem(req),
    maxTokens: 700,
    temperature: 0.4,
  });
}

export const Route = createFileRoute("/api/mentor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.heavy);
        if (limited) return limited;

        let body: MentorRequest;
        try {
          body = (await request.json()) as MentorRequest;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!body || typeof body !== "object" || !("op" in body)) {
          return new Response("An op of 'plan' or 'guide' is required", { status: 400 });
        }

        try {
          if (body.op === "plan") {
            if (!body.skill?.trim()) return new Response("A skill is required", { status: 400 });
            const plan = await buildPlan(body);
            return Response.json(plan);
          }

          if (body.op === "guide") {
            if (!body.question?.trim()) {
              return new Response("A question is required", { status: 400 });
            }
            const answer = await guide(body);
            return Response.json({ answer });
          }

          return new Response("Unknown op", { status: 400 });
        } catch (error) {
          console.error("mentor error", error);
          const message = error instanceof Error ? error.message : "Unknown error";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
