/**
 * POST /api/evolution (plan §5.3), as a plain function so tests can call it.
 * src/routes/api/evolution.ts only wires it to the router.
 *
 * Order of steps:
 *   size gate (content-length, then a capped read) → parse → validate input → (dev header | off | fixture) → summary key →
 *   server LRU → limits → configured? → Gemini → validate → cache → reply
 *
 * Contract: after a well-formed request this ALWAYS answers 200 with an
 * AnalyzerResponse, never a model name, a key, a quota message or an error
 * text. Failures are logged server-side by kind only. A malformed request is
 * the one 400; an oversize one is refused with 413 before the body is read (on
 * `content-length`) and the stream is cut at the cap; any method but POST is a
 * 405 with `Allow: POST`. The UI never waits on this route, and the on-device
 * engine has already decided by the time it is called.
 */
import { GeminiError, ask, resolveKey } from "@/lib/gemini";
import { LIMITS, callerOf, rateLimitKey } from "@/lib/rate-limit";
import { summaryKey } from "../core/analyzer/summarize";
import {
  EVOLUTION_FIXTURE_HEADER,
  type AnalyzerResponse,
  type EvolutionFixtureMode,
} from "../core/analyzer/types";
import { validateDecision } from "../core/ui-state/validate";
import type { AiFallback, EvolutionDecision } from "../types";
import { LruCache } from "./cache";
import { fixtureDecisionFor } from "./fixtures";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { MAX_BODY_BYTES, parseAnalyzerRequest } from "./request";
import { buildResponseSchema } from "./schema";

/** Lite models only: this feature must never touch the full Flash model's small quota. */
export const EVOLUTION_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
export const EVOLUTION_CALL = {
  temperature: 0.1,
  maxTokens: 300,
  timeoutMs: 3500,
  deadlineMs: 6000,
} as const;

const MAX_MODEL_TEXT = 4_000;

type Mode = "live" | "fixture" | "off";

export interface HandlerDeps {
  env: () => Record<string, string | undefined>;
  now: () => number;
  /** The evolution surface key (GEMINI_KEY_EVOLUTION, else GEMINI_API_KEY), or null. */
  apiKey: () => string | null;
  ask: typeof ask;
  cache: LruCache<EvolutionDecision>;
  log: (message: string) => void;
}

const sharedCache = new LruCache<EvolutionDecision>(200, 24 * 60 * 60_000);

/** Test hook: forget every cached decision. */
export const resetEvolutionCache = (): void => sharedCache.clear();

const defaults: HandlerDeps = {
  env: () => process.env,
  now: () => Date.now(),
  apiKey: () => resolveKey("evolution"),
  ask,
  cache: sharedCache,
  log: (message) => console.warn(`[evolution] ${message}`),
};

const HEADERS = { "cache-control": "no-store" };
const reply = (body: AnalyzerResponse): Response =>
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

/**
 * Reads the body with a hard cap. A declared `content-length` over the cap is refused without reading a byte;
 * a missing or lying one is caught by counting the stream, which is cancelled the moment it passes the cap.
 */
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

const FIXTURE_FALLBACK: Record<EvolutionFixtureMode, AiFallback> = {
  timeout: "timeout",
  invalid: "invalid",
  rate_limited: "rate_limited",
  unavailable: "upstream",
};

/** Unset means live; anything unrecognised fails closed to off. */
function modeOf(env: Record<string, string | undefined>): Mode {
  const raw = env["EVOLUTION_AI_MODE"]?.trim().toLowerCase();
  if (!raw) return "live";
  return raw === "live" || raw === "fixture" || raw === "off" ? raw : "off";
}

/** The dev-only failure-path switch. Ignored entirely in production. */
function devFixture(
  request: Request,
  env: Record<string, string | undefined>,
): EvolutionFixtureMode | null {
  if (env["NODE_ENV"] === "production") return null;
  const v = request.headers.get(EVOLUTION_FIXTURE_HEADER)?.trim();
  return v && Object.prototype.hasOwnProperty.call(FIXTURE_FALLBACK, v)
    ? (v as EvolutionFixtureMode)
    : null;
}

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

export async function handleEvolution(
  request: Request,
  overrides: Partial<HandlerDeps> = {},
): Promise<Response> {
  const d: HandlerDeps = { ...defaults, ...overrides };

  /* 1. parse and validate: the only place a 400 comes from. */
  const body = await readBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.status === 413 ? tooLarge() : badRequest();
  const text = body.text;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return badRequest();
  }
  const parsed = parseAnalyzerRequest(raw);
  if (!parsed.ok) return badRequest();
  const req = parsed.value;

  const env = d.env();

  /* Dev header, kill switch and fixture mode all answer without touching Gemini. */
  const forced = devFixture(request, env);
  if (forced) return fail(FIXTURE_FALLBACK[forced]);
  const mode = modeOf(env);
  if (mode === "off") return fail("off");
  if (mode === "fixture")
    return reply({ ok: true, source: "ai", decision: fixtureDecisionFor(req) });

  /* 2. summary key, then the LRU. A hit costs no quota and no limit budget. */
  const key = summaryKey(req);
  const hit = d.cache.get(key, d.now());
  if (hit) return reply({ ok: true, source: "ai", decision: hit, cached: true });

  /* 3. limits, then 4. configured? */
  const caller = callerOf(request);
  if (
    !rateLimitKey(caller, LIMITS.evoBurst).allowed ||
    !rateLimitKey(caller, LIMITS.evoDay).allowed ||
    !rateLimitKey("instance", LIMITS.evoGlobal).allowed
  )
    return fail("rate_limited");
  const apiKey = d.apiKey();
  if (!apiKey) return fail("unconfigured");

  /* 5. Gemini: lite models only, enum-constrained JSON, short and cold. */
  let answer: string;
  try {
    answer = await d.ask([{ role: "user", content: buildUserPrompt(req) }], {
      system: SYSTEM_PROMPT,
      json: true,
      responseSchema: buildResponseSchema(),
      apiKey,
      models: EVOLUTION_MODELS,
      ...EVOLUTION_CALL,
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
  const checked = validateDecision(candidate, "ai");
  if (!checked.ok) {
    d.log(`model answer rejected: ${checked.error.join(" | ")}`);
    return fail("invalid");
  }
  d.cache.set(key, checked.value, d.now());
  return reply({ ok: true, source: "ai", decision: checked.value });
}
