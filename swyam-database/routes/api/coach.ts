import { createFileRoute } from "@tanstack/react-router";
import { ask, isGeminiConfigured, keyFor } from "@/lib/gemini";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { courses } from "@/data/mock";
import type { CoachInputs, CoachPlan, CoachSubject, ExtractedMarks } from "@/lib/coach";

/**
 * The AI coach, server side.
 *
 * Two jobs. `extract` reads a marksheet photo into subjects and marks, so a
 * student does not have to type twelve rows on a phone. `plan` turns marks,
 * interests, a goal, a city, a budget and a language into a study plan, a
 * first look at careers, and courses to take next.
 *
 * The courses it may recommend are the ones in the catalogue, listed in the
 * prompt by id, and every id that comes back is checked against that list.
 * A recommendation for a course that does not exist is not a small error on a
 * platform whose argument is that claims should be checkable; it is the
 * whole argument lost. The budget is enforced here as well, not left to the
 * model: "free only" means only free courses are even offered to it.
 *
 * The rules below are the ones the brief insists on, and they are in the
 * system prompt because that is the only place a model reliably keeps them.
 * Nothing sent here is stored. The marks arrive, the plan leaves, the request
 * ends.
 */

interface Body {
  action?: "extract" | "plan";
  image?: { mimeType: string; data: string };
  inputs?: CoachInputs;
}

const RULES = [
  "You are the study and career coach on स्वYAM, an Indian skilling platform.",
  "The reader is a student — often on a shared phone, often reading in a second language.",
  "",
  "RULES THAT OVERRIDE EVERYTHING ELSE:",
  "- Never shame. Never call a student weak, poor, bad or behind. Say what to focus on next.",
  "- Never say marks decide anything. Marks are one input; say so where it helps.",
  "- Never guarantee admission, employment, salary, placement or course completion.",
  "- Always include free and low-cost options. Never push a paid course when a free one fits.",
  "- Recommend ONLY courses from the catalog you are given, by their exact id. Never invent a course, a fee, a link, an employer or a scheme.",
  "- Do not give an exact 'match score'. Use the three labels you are given.",
  "- Plain, encouraging, practical language. Short sentences. No jargon.",
  "- Every suggestion must be something the student can actually do this week.",
].join("\n");

const BANDS = (pct: number): CoachSubject["band"] =>
  pct >= 75 ? "strength" : pct >= 50 ? "steady" : "focus";

/** The catalogue as the model sees it: compact, real, and pre-filtered for budget and mode. */
function catalogueFor(inputs: CoachInputs) {
  return courses
    .filter((c) => (inputs.budget === "free" ? c.free : true))
    .filter((c) => (inputs.learningMode === "online" ? c.mode !== "Offline" : true))
    .filter((c) => (inputs.learningMode === "offline" ? c.mode !== "Online" : true))
    .map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      level: c.difficulty,
      duration: c.duration,
      fee: c.free ? "Free" : c.fees,
      mode: c.mode,
      city: c.mode === "Online" ? "Anywhere" : `${c.city}, ${c.state}`,
      certificate: c.certification,
      placementSupport: c.placementAssistance,
      teaches: c.outcomes.slice(0, 3),
    }));
}

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
    throw new Error("The coach returned something that was not a plan.");
  }
}

const langLine = (code: string) =>
  code && code !== "en"
    ? `Write every human-readable string in the language with code "${code}". Keep JSON keys in English.`
    : "";

/* ── extract ─────────────────────────────────────────────────────── */

async function extract(image: { mimeType: string; data: string }): Promise<ExtractedMarks> {
  const system = [
    "You read Indian school and college marksheets from a photo or a scanned page.",
    "Return JSON only, with this shape:",
    '{ "level": string|null, "board": string|null, "marks": [{ "subject": string, "max": number, "scored": number }], "notes": string|null }',
    "Rules:",
    "- Only what is legible. If a number is unclear, leave that subject out and say so in notes.",
    "- max is the maximum for that subject (usually 100), scored is what was obtained. Ignore grace marks, totals, ranks.",
    "- Subject names as printed, in English if printed in English.",
    "- Never guess a mark. A missing row is better than an invented one.",
  ].join("\n");
  const text = await ask([{ role: "user", content: "Read this marksheet." }], {
    system,
    images: [image],
    json: true,
    maxTokens: 1200,
    temperature: 0.1,
    apiKey: keyFor("coach"),
  });
  const out = parseJson<Partial<ExtractedMarks>>(text);
  const marks = (out.marks ?? [])
    .filter(
      (m) =>
        m && typeof m.subject === "string" && Number.isFinite(m.max) && Number.isFinite(m.scored),
    )
    .map((m) => ({
      subject: m.subject.trim().slice(0, 60),
      max: Math.max(1, Math.round(m.max)),
      scored: Math.max(0, Math.round(m.scored)),
    }))
    .filter((m) => m.scored <= m.max)
    .slice(0, 20);
  return {
    level: out.level ?? undefined,
    board: out.board ?? undefined,
    marks,
    notes: out.notes ?? undefined,
  };
}

/* ── plan ────────────────────────────────────────────────────────── */

async function plan(inputs: CoachInputs): Promise<CoachPlan> {
  const school = inputs.mode === "school";
  const catalogue = catalogueFor(inputs);
  const ids = new Set(catalogue.map((c) => c.id));

  const subjects: CoachSubject[] = inputs.marks.map((m) => {
    const percent = m.max > 0 ? Math.round((m.scored / m.max) * 100) : 0;
    return {
      subject: m.subject,
      scored: m.scored,
      max: m.max,
      percent,
      band: BANDS(percent),
      note: "",
    };
  });
  const overall = subjects.length
    ? Math.round(subjects.reduce((a, s) => a + s.percent, 0) / subjects.length)
    : null;

  const classNum = Number((inputs.level.match(/\d+/) ?? [])[0] ?? 0);
  const askStreams = school && classNum >= 9 && classNum <= 12;

  const system = [
    RULES,
    "",
    school
      ? "This is the AI STUDY COACH for a school student (Class 6-12). Focus on study habits, subject-wise next steps, a weekly timetable, and gentle career and stream exploration. No job applications, no salary talk, no internship pressure."
      : "This is the AI CAREER & LEARNING COACH for a college student. Focus on the path from their degree to a first role: skill gaps for the target role, projects that prove skills, internship readiness, interview basics, and the courses that close the gaps.",
    "",
    "Bands are already computed and must be respected: strength (75%+), steady (50-74%), focus (under 50%). Write a one-line encouraging note per subject.",
    "Labels for recommended courses, and nothing else: 'Great starting point', 'Good match', 'Build this skill next'.",
    "Recommend 3 to 5 courses. Prefer free ones. If a course needs a prerequisite the student lacks, name a bridge course from the catalog in `prerequisite`.",
    langLine(inputs.language),
    "",
    "Return JSON only, exactly this shape:",
    JSON.stringify({
      snapshot: { headline: "string, 6-10 words, warm", summary: "2-3 sentences" },
      subjects: [{ subject: "string", note: "one encouraging line" }],
      strengths: ["3-4 short strings"],
      focusAreas: [
        { subject: "string", why: "one line", firstStep: "one concrete thing to do this week" },
      ],
      weeklyPlan: [
        { day: "Mon..Sun", blocks: [{ subject: "string", minutes: 30, task: "string" }] },
      ],
      tips: [{ subject: "string", tip: "string" }],
      concepts: [{ subject: "string", items: ["3-5 topics to revise"] }],
      practice: [{ subject: "string", task: "string" }],
      quizzes: [
        {
          subject: "string",
          question: "string",
          options: ["a", "b", "c", "d"],
          answer: 0,
          explanation: "string",
        },
      ],
      timeManagement: ["3-4 short tips"],
      careerDirections: [
        { title: "string", why: "one line tied to their strengths/interests", firstStep: "string" },
      ],
      ...(askStreams
        ? {
            streams: [
              {
                name: "Science|Commerce|Arts / Humanities|Vocational",
                fit: "strong|possible|explore",
                why: "one line",
              },
            ],
          }
        : {}),
      recommendedCourses: [
        {
          courseId: "id from catalog",
          label: "one of the three labels",
          why: "one line, plain",
          prerequisite: "optional course id",
        },
      ],
      growthPath: [{ step: 1, title: "string", detail: "string" }],
      nextActions: ["3-5 things to do this week"],
      encouragement: "two sentences, honest and kind",
    }),
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `MODE: ${inputs.mode}`,
    `LEVEL: ${inputs.level}${inputs.board ? ` (${inputs.board})` : ""}${inputs.stream ? ` · stream: ${inputs.stream}` : ""}`,
    !school && inputs.degree
      ? `DEGREE: ${inputs.degree}${inputs.branch ? `, ${inputs.branch}` : ""}${inputs.year ? `, ${inputs.year}` : ""}`
      : "",
    !school && inputs.skills?.length ? `SKILLS ALREADY: ${inputs.skills.join(", ")}` : "",
    !school && inputs.projects ? `PROJECTS SO FAR: ${inputs.projects}` : "",
    !school && inputs.targetRole ? `TARGET ROLE: ${inputs.targetRole}` : "",
    `MARKS (subject: scored/max = percent, band):`,
    ...subjects.map((s) => `- ${s.subject}: ${s.scored}/${s.max} = ${s.percent}% (${s.band})`),
    overall !== null ? `OVERALL AVERAGE: ${overall}%` : "",
    `INTERESTS: ${inputs.interests.join(", ") || "not given"}`,
    `GOAL: ${inputs.goal || "not given"}`,
    `CITY: ${inputs.city || "not given"}`,
    `BUDGET: ${inputs.budget}`,
    `LEARNING MODE: ${inputs.learningMode}`,
    `LANGUAGE: ${inputs.language}`,
    "",
    "CATALOG (the only courses you may recommend, by id):",
    JSON.stringify(catalogue),
  ]
    .filter(Boolean)
    .join("\n");

  type Raw = Partial<CoachPlan> & { subjects?: Array<{ subject: string; note: string }> };
  const once = async () =>
    parseJson<Raw>(
      await ask([{ role: "user", content: user }], {
        system,
        json: true,
        maxTokens: 6000,
        temperature: 0.5,
        apiKey: keyFor("coach"),
      }),
    );
  // A busy backend sometimes returns a plan cut off mid-JSON. One more try
  // is cheap and almost always enough; a second failure is reported.
  let raw: Raw;
  try {
    raw = await once();
  } catch {
    raw = await once();
  }

  // Bands and numbers are ours; the model only wrote the notes.
  const noteFor = new Map(
    (raw.subjects ?? []).map((s) => [String(s.subject).toLowerCase(), String(s.note ?? "")]),
  );
  const finalSubjects = subjects.map((s) => ({
    ...s,
    note: noteFor.get(s.subject.toLowerCase()) ?? "",
  }));

  // Only real courses, only ones this budget and mode allow.
  const LABELS = new Set(["Great starting point", "Good match", "Build this skill next"]);
  const recs = (raw.recommendedCourses ?? [])
    .filter((r) => r && ids.has(String(r.courseId)))
    .map((r) => ({
      courseId: String(r.courseId),
      label: (LABELS.has(String(r.label))
        ? r.label
        : "Good match") as CoachPlan["recommendedCourses"][number]["label"],
      why: String(r.why ?? ""),
      ...(r.prerequisite && ids.has(String(r.prerequisite))
        ? { prerequisite: String(r.prerequisite) }
        : {}),
    }))
    .slice(0, 5);

  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  return {
    generatedAt: new Date().toISOString(),
    mode: inputs.mode,
    language: inputs.language,
    snapshot: {
      headline: String(raw.snapshot?.headline ?? "Here is what to focus on next"),
      summary: String(raw.snapshot?.summary ?? ""),
      overallPercent: overall,
    },
    subjects: finalSubjects,
    strengths: arr<string>(raw.strengths).map(String).slice(0, 5),
    focusAreas: arr<CoachPlan["focusAreas"][number]>(raw.focusAreas).slice(0, 4),
    weeklyPlan: arr<CoachPlan["weeklyPlan"][number]>(raw.weeklyPlan).slice(0, 7),
    tips: arr<CoachPlan["tips"][number]>(raw.tips).slice(0, 8),
    concepts: arr<CoachPlan["concepts"][number]>(raw.concepts).slice(0, 8),
    practice: arr<CoachPlan["practice"][number]>(raw.practice).slice(0, 8),
    quizzes: arr<CoachPlan["quizzes"][number]>(raw.quizzes)
      .filter((q) => Array.isArray(q.options) && q.options.length >= 2)
      .slice(0, 6),
    timeManagement: arr<string>(raw.timeManagement).map(String).slice(0, 5),
    careerDirections: arr<CoachPlan["careerDirections"][number]>(raw.careerDirections).slice(0, 4),
    ...(askStreams
      ? { streams: arr<NonNullable<CoachPlan["streams"]>[number]>(raw.streams).slice(0, 4) }
      : {}),
    recommendedCourses: recs,
    growthPath: arr<CoachPlan["growthPath"][number]>(raw.growthPath).slice(0, 8),
    nextActions: arr<string>(raw.nextActions).map(String).slice(0, 6),
    encouragement: String(raw.encouragement ?? ""),
  };
}

/* ── route ───────────────────────────────────────────────────────── */

export const Route = createFileRoute("/api/coach")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.heavy);
        if (limited) return limited;

        if (!isGeminiConfigured()) {
          return Response.json(
            { error: "The coach is not configured on this server." },
            { status: 503 },
          );
        }
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400 });
        }

        try {
          if (body.action === "extract") {
            if (!body.image?.data || !body.image.mimeType.startsWith("image/")) {
              return Response.json(
                { error: "Send a photo of the marksheet as an image." },
                { status: 400 },
              );
            }
            // 6 MB of base64 is a generous phone photo; anything bigger is a mistake.
            if (body.image.data.length > 8_000_000) {
              return Response.json(
                { error: "That photo is too large. Try a smaller one." },
                { status: 413 },
              );
            }
            return Response.json(await extract(body.image));
          }

          if (body.action === "plan") {
            const i = body.inputs;
            if (!i || !Array.isArray(i.marks) || i.marks.length === 0 || !i.level) {
              return Response.json(
                { error: "Add at least one subject and your class or degree." },
                { status: 400 },
              );
            }
            if (i.mode !== "school" && i.mode !== "college") {
              return Response.json({ error: "Unknown coach mode." }, { status: 400 });
            }
            const safe: CoachInputs = {
              ...i,
              level: String(i.level).slice(0, 60),
              board: i.board ? String(i.board).slice(0, 60) : undefined,
              stream: i.stream ? String(i.stream).slice(0, 40) : undefined,
              marks: i.marks.slice(0, 20).map((m) => ({
                subject: String(m.subject).slice(0, 60),
                max: Math.max(1, Number(m.max) || 100),
                scored: Math.max(0, Number(m.scored) || 0),
              })),
              interests: (i.interests ?? []).slice(0, 8).map((s) => String(s).slice(0, 40)),
              goal: String(i.goal ?? "").slice(0, 200),
              city: String(i.city ?? "").slice(0, 60),
              language: String(i.language || "en").slice(0, 8),
              skills: (i.skills ?? []).slice(0, 12).map((s) => String(s).slice(0, 40)),
              projects: i.projects ? String(i.projects).slice(0, 400) : undefined,
              targetRole: i.targetRole ? String(i.targetRole).slice(0, 80) : undefined,
              degree: i.degree ? String(i.degree).slice(0, 80) : undefined,
              branch: i.branch ? String(i.branch).slice(0, 80) : undefined,
              year: i.year ? String(i.year).slice(0, 30) : undefined,
            };
            return Response.json(await plan(safe));
          }

          return Response.json({ error: "Unknown action." }, { status: 400 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "The coach could not answer.";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
