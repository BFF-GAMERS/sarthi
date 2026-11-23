/**
 * POST /api/membership (docs/evolution/subscriptions.md §2), as a plain function so tests can call it.
 * src/routes/api/membership.ts only wires it to the router. Cloned from src/evolution/server/handler.ts.
 *
 * Order of steps:
 *   size gate (content-length, then a capped read) → parse → validate input → kill switch → server LRU →
 *   limits → configured? → Gemini (lite models, enum schema) → validate → cache → reply
 *
 * Contract: after a well-formed request this ALWAYS answers 200 with a MembershipResponse, never a model
 * name, a key, a quota message or an error text. Failures are logged server-side by kind only. A malformed
 * request is the one 400; an oversize one is a 413; any method but POST is a 405. The card never waits on
 * this route: the rules fallback has already rendered, and the AI only ever reorders a fixed list. The AI
 * never sees or sets a price, and never picks the plan (it is a lookup on the declared profile type).
 */
import { GeminiError, ask, resolveKey } from "@/lib/gemini";
import { LIMITS, callerOf, rateLimitKey } from "@/lib/rate-limit";
import { LruCache } from "@/evolution/server/cache";
import type { AiFallback } from "@/evolution/types";
import { inputKeyOf, isAiEnabled, planForType, validateChoice } from "../core/chooser";
import type { MembershipResponse, PlanChoice } from "../core/types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { MAX_BODY_BYTES, parseChooserRequest } from "./request";
import { buildResponseSchema } from "./schema";

/** Lite models only: this feature must never touch the full Flash model's small quota. */
export const MEMBERSHIP_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
export const MEMBERSHIP_CALL = {
  temperature: 0.1,
  maxTokens: 300,
  timeoutMs: 3500,
  deadlineMs: 6000,
} as const;

const MAX_MODEL_TEXT = 2_000;

export interface HandlerDeps {
  env: () => Record<string, string | undefined>;
  now: () => number;
  /** The shared evolution-surface key (GEMINI_KEY_EVOLUTION, else GEMINI_API_KEY), or null. */
  apiKey: () => string | null;
  ask: typeof ask;
  cache: LruCache<PlanChoice>;
  log: (message: string) => void;
}

const sharedCache = new LruCache<PlanChoice>(200, 24 * 60 * 60_000);

/** Test hook: forget every cached choice. */
export const resetMembershipCache = (): void => sharedCache.clear();

const defaults: HandlerDeps = {
  env: () => process.env,
  now: () => Date.now(),
  apiKey: () => resolveKey("evolution"),
  ask,
  cache: sharedCache,
  log: (message) => console.warn(`[membership] ${message}`),
};

const HEADERS = { "cache-control": "no-store" };
const reply = (body: MembershipResponse): Response =>
  Response.json(body, { status: 200, headers: HEADERS });
const fail = (fallback: AiFallback): Response => reply({ ok: false, fallback });
const badRequest = (): Response =>
  Response.json({ error: "Bad request." }, { status: 400, headers: HEADERS });
const tooLarge = (): Response =>
  Response.json({ error: "Request too large." }, { status: 413, headers: HEADERS });

/** Any method but POST (a soft 404 page here used to answer a GET with 200). */
export const methodNotAllowed = (): Response =>
  Response.json(
    { error: "Method not allowed." },
    { status: 405, headers: { ...HEADERS, allow: "POST" } },
  );

/** Best-effort: drop the unread body so the connection is not held open for it. */
function discard(request: Request): void {
  try {
    void request.body?.cancel().catch(() => {});
  } catch {
    /* already locked or closed */
  }
}

type Body = { ok: true; text: string } | { ok: false; status: 400 | 413 };

/** Reads the body with a hard cap: a declared content-length over it is refused unread, a lying one is cut off. */
async function readBody(request: Request, max: number): Promise<Body> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > max) {
    discard(request);
    return { ok: false, status: 413 };
  }
  const stream = request.body;
  if (!stream) return { ok: true, text: "" };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(all) };
}

/** The kill switch: `VITE_MEMBERSHIP_AI=off` (or anything but unset/on) answers `off` without touching Gemini. */
export const aiEnabled = (env: Record<string, string | undefined>): boolean =>
  isAiEnabled(env["VITE_MEMBERSHIP_AI"]);

function fallbackFor(e: unknown): AiFallback {
  if (!(e instanceof GeminiError)) return "upstream";
  switch (e.kind) {
    case "timeout":
      return "timeout";
    case "rate_limited":
      return "rate_limited";
    case "invalid":
      return "invalid";
    case "unconfigured":
      return "unconfigured";
    default:
      return "upstream";
  }
}

export async function handleMembership(
  request: Request,
  overrides: Partial<HandlerDeps> = {},
): Promise<Response> {
  const d: HandlerDeps = { ...defaults, ...overrides };

  /* 1. parse and validate: the only place a 400 comes from. */
  const body = await readBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.status === 413 ? tooLarge() : badRequest();
  let raw: unknown;
  try {
    raw = JSON.parse(body.text);
  } catch {
    return badRequest();
  }
  const parsed = parseChooserRequest(raw);
  if (!parsed.ok) return badRequest();
  const req = parsed.value;
  const plan = planForType(req.profileType);
  if (!plan) return badRequest();

  /* The kill switch answers without touching the cache, the limits or Gemini. */
  if (!aiEnabled(d.env())) return fail("off");

  /* 2. the LRU: a hit costs no quota and no limit budget. */
  const key = inputKeyOf(req);
  const hit = d.cache.get(key, d.now());
  if (hit) return reply({ ok: true, source: "ai", choice: hit, cached: true });

  /* 3. limits, then 4. configured? */
  const caller = callerOf(request);
  if (
    !rateLimitKey(caller, LIMITS.planBurst).allowed ||
    !rateLimitKey(caller, LIMITS.planDay).allowed ||
    !rateLimitKey("instance", LIMITS.planGlobal).allowed
  )
    return fail("rate_limited");
  const apiKey = d.apiKey();
  if (!apiKey) return fail("unconfigured");

  /* 5. Gemini: lite models only, enum-constrained JSON, short and cold. */
  let answer: string;
  try {
    answer = await d.ask([{ role: "user", content: buildUserPrompt(req, plan) }], {
      system: SYSTEM_PROMPT,
      json: true,
      responseSchema: buildResponseSchema(plan),
      apiKey,
      models: MEMBERSHIP_MODELS,
      ...MEMBERSHIP_CALL,
    });
  } catch (e) {
    const fallback = fallbackFor(e);
    d.log(`gemini ${fallback}`);
    return fail(fallback);
  }

  /* 6. strict parse (no fence-stripping, no repair), validate, cache, reply. */
  let candidate: unknown;
  try {
    if (answer.length > MAX_MODEL_TEXT) throw new Error("too long");
    candidate = JSON.parse(answer);
  } catch {
    d.log("model answer was not a bare JSON object");
    return fail("invalid");
  }
  const checked = validateChoice(candidate, req.profileType);
  if (!checked.ok) {
    d.log(`model answer rejected: ${checked.field}`);
    return fail("invalid");
  }
  d.cache.set(key, checked.value, d.now());
  return reply({ ok: true, source: "ai", choice: checked.value });
}
