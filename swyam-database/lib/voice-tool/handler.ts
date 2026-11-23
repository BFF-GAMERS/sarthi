/**
 * POST /api/voice-tool — the API Tool a Sarvam voice agent calls mid-conversation.
 *
 * What it does: finds courses, describes one, enrols the caller, reads their progress
 * ("you have finished modules 1 to 3, you are on module 4, lesson 2") and marks the
 * lesson they are on as done. It answers with a short sentence for the agent to speak
 * (`say`) plus the structured fields, so the agent can phrase it in the caller's language.
 *
 * Who the caller is comes from ONE place: Sarvam's call-context "User Identifier", the
 * number on the line. It is matched in Postgres (public.voice_tool, db/027) against the
 * number a member saved on their own account while signed in. Nothing the caller SAYS is
 * ever used as an identity, and the route never returns a phone number.
 *
 * Three secrets, three holders, none of them the service_role key:
 *   SARVAM_TOOL_TOKEN  Sarvam → this route (Bearer). Sarvam holds nothing else.
 *   VOICE_DB_KEY       this route → voice_tool(). Only its hash is in the database.
 *   publishable key    public by design; useless here without VOICE_DB_KEY.
 *
 * Errors the caller can act on come back 200 with ok:false and a sentence to say, so the
 * agent never goes silent. Only a missing/wrong token (401), a malformed body (400/413),
 * a wrong method (405) or missing configuration (503) are HTTP errors.
 */
import { LIMITS, rateLimitKey } from "@/lib/rate-limit";

export const ACTIONS = [
  "identify",
  "find_course",
  "course_info",
  "enroll",
  "progress",
  "complete_lesson",
] as const;
export type VoiceAction = (typeof ACTIONS)[number];

export const MAX_BODY_BYTES = 16_384;
/** Only the end of the transcript matters: what the caller asked for just now. */
const TRANSCRIPT_TAIL = 400;

export interface VoiceToolDeps {
  env: () => Record<string, string | undefined>;
  fetch: typeof fetch;
  log: (m: string) => void;
}

const defaults: VoiceToolDeps = {
  env: () => process.env,
  fetch: (...a) => fetch(...a),
  log: (m) => console.warn(`[voice-tool] ${m}`),
};

const HEADERS = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });

export const methodNotAllowed = () =>
  Response.json(
    { error: "Method not allowed." },
    { status: 405, headers: { ...HEADERS, allow: "POST" } },
  );

/** Constant-time comparison, so the token cannot be guessed one character at a time. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Same rule as public.voice_normalise_phone: Indian mobiles to +91XXXXXXXXXX, else null. */
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

const str = (v: unknown, max: number): string =>
  typeof v === "string"
    ? Array.from(v, (c) => (c.charCodeAt(0) < 32 ? " " : c))
        .join("")
        .trim()
        .slice(0, max)
    : "";

export interface ParsedRequest {
  phone: string;
  action: VoiceAction;
  course: string;
  text: string;
}

export function parseRequest(raw: unknown): ParsedRequest | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const phone = normalisePhone(o["user_identifier"] ?? o["phone_number"]);
  const action = o["action"];
  if (!phone || typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action))
    return null;
  const transcript = str(o["transcript"], 20_000);
  return {
    phone,
    action: action as VoiceAction,
    course: str(o["course"], 120),
    text: transcript.slice(-TRANSCRIPT_TAIL),
  };
}

/* ── Turning the database answer into one sentence the agent can speak ── */

type Progress = {
  course: { slug: string; title: string };
  enrolled: boolean;
  percent: number;
  completed_modules: { position: number; title: string }[];
  resume: {
    module_position: number;
    module_title: string;
    lesson_position: number;
    lesson_title: string;
  } | null;
  finished: boolean;
};

const modulesDone = (p: Progress): string => {
  const n = p.completed_modules.map((m) => m.position);
  if (n.length === 0) return "no modules finished yet";
  if (n.length === 1) return `module ${n[0]} finished`;
  const contiguous = n.every((v, i) => i === 0 || v === n[i - 1]! + 1);
  return contiguous && n.length > 2
    ? `modules ${n[0]} to ${n.at(-1)} finished`
    : `modules ${n.slice(0, -1).join(", ")} and ${n.at(-1)} finished`;
};

export function describeProgress(p: Progress): string {
  if (p.finished)
    return `${p.course.title}: every lesson is finished. The final assessment earns the certificate.`;
  const where = p.resume
    ? `Resume at module ${p.resume.module_position}, ${p.resume.module_title}, lesson ${p.resume.lesson_position}: ${p.resume.lesson_title}.`
    : "";
  return `${p.course.title}: ${p.percent}% done, ${modulesDone(p)}. ${where}`.trim();
}

const NOT_LINKED =
  "I couldn't find a स्वYAM account for this phone number. The member can add this number in Settings on swyam.online, under Phone access, and then call again.";

export function sayFor(action: VoiceAction, r: Record<string, unknown>): string {
  const reason = r["reason"];
  if (r["ok"] !== true) {
    switch (reason) {
      case "not_linked":
        return NOT_LINKED;
      case "course_not_found":
        return "I couldn't find that course. Could you say the course name again?";
      case "paid_course": {
        const c = r["course"] as { title: string; price_inr: number };
        return `${c.title} is a paid course (₹${c.price_inr}). It can be bought on swyam.online; I can only start free courses by phone.`;
      }
      case "not_enrolled":
        return "You're not enrolled on that course yet. Shall I enroll you?";
      case "already_finished":
        return "Every lesson of this course is already finished.";
      case "quiz_needed":
        return "The next step is the module quiz. A quiz is taken on the website, so I can't mark it done by phone.";
      default:
        return "Sorry, I couldn't do that just now.";
    }
  }
  const name = typeof r["first_name"] === "string" && r["first_name"] ? `${r["first_name"]}, ` : "";
  switch (action) {
    case "identify":
      return r["linked"]
        ? `This number belongs to ${String(r["first_name"] ?? "a member")}.`
        : NOT_LINKED;
    case "find_course": {
      const list = (r["courses"] as { title: string; free: boolean; price_inr: number }[]) ?? [];
      if (list.length === 0) return "I couldn't find a course like that.";
      return `I found: ${list.map((c) => `${c.title} (${c.free ? "free" : `₹${c.price_inr}`})`).join("; ")}.`;
    }
    case "course_info": {
      const c = r["course"] as {
        title: string;
        level: string;
        free: boolean;
        price_inr: number;
        duration_minutes: number;
        modules: string[];
      };
      const hours = Math.max(1, Math.round(c.duration_minutes / 60));
      return `${c.title} is a ${c.level} course, ${c.free ? "free" : `₹${c.price_inr}`}, about ${hours} hours, in ${c.modules.length} modules: ${c.modules.join(", ")}.`;
    }
    case "enroll": {
      const p = (r["progress"] as Progress[])[0]!;
      return `${name}you're enrolled on ${p.course.title}. ${p.resume ? `Start with module 1: ${p.resume.module_title}.` : ""}`.trim();
    }
    case "progress": {
      const list = (r["progress"] as Progress[]) ?? [];
      if (list.length === 0) return `${name}you're not enrolled on any course yet.`;
      const lead = r["asked_course_found"] === false ? "You're not enrolled on that one. " : "";
      return `${lead}${name}${list.map(describeProgress).join(" ")}`;
    }
    case "complete_lesson": {
      const done = r["completed_lesson"] as { lesson_title: string };
      const p = (r["progress"] as Progress[])[0]!;
      return `Marked "${done.lesson_title}" as done. ${describeProgress(p)}`;
    }
  }
}

/* ── The route ── */

async function readCapped(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text;
}

export async function handleVoiceTool(
  request: Request,
  overrides: Partial<VoiceToolDeps> = {},
): Promise<Response> {
  const d = { ...defaults, ...overrides };
  const env = d.env();
  const token = env["SARVAM_TOOL_TOKEN"];
  const dbKey = env["VOICE_DB_KEY"];
  const url = env["VITE_SUPABASE_URL"];
  const publishable = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!token || !dbKey || !url || !publishable) {
    return json({ ok: false, error: "Phone access is not configured." }, 503);
  }

  const auth = request.headers.get("authorization") ?? "";
  const presented = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!presented || !safeEqual(presented, token))
    return json({ ok: false, error: "Unauthorised." }, 401);

  const text = await readCapped(request);
  if (text === null) return json({ ok: false, error: "Request too large." }, 413);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "Bad request." }, 400);
  }
  const req = parseRequest(raw);
  if (!req)
    return json(
      { ok: false, error: "Bad request: user_identifier and a known action are required." },
      400,
    );

  if (
    !rateLimitKey(req.phone, LIMITS.voiceTool).allowed ||
    !rateLimitKey("instance", LIMITS.voiceToolGlobal).allowed
  ) {
    return json({
      ok: false,
      reason: "rate_limited",
      say: "Let's pause for a minute and try that again.",
    });
  }

  let result: Record<string, unknown>;
  try {
    const res = await d.fetch(`${url}/rest/v1/rpc/voice_tool`, {
      method: "POST",
      headers: {
        apikey: publishable,
        authorization: `Bearer ${publishable}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_key: dbKey,
        p_phone: req.phone,
        p_action: req.action,
        p_args: { course: req.course, text: req.text },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      d.log(`rpc ${res.status}`);
      return json({
        ok: false,
        reason: "unavailable",
        say: "Sorry, I can't reach your courses right now.",
      });
    }
    result = (await res.json()) as Record<string, unknown>;
  } catch {
    d.log("rpc unreachable");
    return json({
      ok: false,
      reason: "unavailable",
      say: "Sorry, I can't reach your courses right now.",
    });
  }

  return json({ ...result, say: sayFor(req.action, result) });
}
