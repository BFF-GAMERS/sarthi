/**
 * Gemini — the second language model, and now the default one.
 *
 * SERVER ONLY. `GEMINI_API_KEY` has no `VITE_` prefix on purpose: a Vite
 * variable is inlined into the browser bundle, so an exposed key is a key
 * anyone can spend. The key travels in the `x-goog-api-key` header, never in
 * the URL, so it cannot end up in a request log or an error message.
 *
 * Why a second provider at all: Sarvam's credits ran out mid-project and every
 * AI feature stopped at once — the chat, and the study packs that the
 * certified-trainer model depends on when a skill has no trainer yet. A single
 * provider is a single point of failure for the whole feature set.
 *
 * The two are not interchangeable and the split reflects that:
 *
 *   Gemini  reasoning and long-form writing — chat answers, study packs
 *   Sarvam  Indian-language speech, which Gemini does not do as well
 *
 * So this does not replace `sarvam.ts`; Bulbul still speaks. It replaces the
 * part Sarvam was worst-suited to being the only option for.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Models to try, best first.
 *
 * The free tier meters each model separately and the daily allowance on the
 * full Flash model is small — twenty requests. Exhausting it used to take the
 * chat, the study packs and the AI mentor down together for the rest of the
 * day, with a raw "429 quota exceeded" as the only explanation.
 *
 * A 429 on the first model is not a failure, it is a signal to step down a
 * tier: the lite models answer the same questions slightly less well, and
 * slightly less well is enormously better than not at all. Overridable
 * because model names move — `bulbul:v2` was retired under this project once
 * already, and the fix should be an environment variable, not a deploy.
 */
const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash"];

export function geminiKey(): string | null {
  const key = process.env["GEMINI_API_KEY"];
  return key && key.trim() ? key.trim() : null;
}

export const isGeminiConfigured = (): boolean => geminiKey() !== null;

/**
 * Which feature is asking.
 *
 * Gemini's free tier meters per key and per day, and the cap is small enough
 * that one busy feature can spend the whole allowance by lunchtime — after
 * which every other feature is quiet too, and the one people notice going
 * quiet is the chat. So each surface may carry its own key, in its own
 * variable, and falls back to the shared GEMINI_API_KEY only when it has
 * none. Which key came from which account is written down in
 * docs/API-KEYS.md; keep that file honest when you add one.
 */
export type GeminiSurface =
  | "chat"
  | "mentor"
  | "cv"
  | "coach"
  | "community"
  | "study"
  | "schemes"
  | "evolution"
  | "translate"
  | "jobs";

export function keyFor(surface: GeminiSurface): string | undefined {
  const own = process.env[`GEMINI_KEY_${surface.toUpperCase()}`]?.trim();
  if (own) return own;
  // The community key predates this scheme; keep its old name working.
  if (surface === "community") {
    const legacy = process.env["GEMINI_COMMUNITY_KEY"]?.trim();
    if (legacy) return legacy;
  }
  return undefined;
}

/**
 * The key a surface should use: its own, else the shared one, else null.
 * `ask()` already falls back to the shared key; this is for callers that must
 * know up front whether anything is configured (the evolution route).
 */
export function resolveKey(surface: GeminiSurface): string | null {
  return keyFor(surface) ?? geminiKey();
}

/** `GEMINI_MODEL` may name one model or a comma-separated preference order. */
function models(): string[] {
  const configured = process.env["GEMINI_MODEL"]?.trim();
  if (!configured) return DEFAULT_MODELS;
  const list = configured
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  // Keep the fallbacks behind whatever was configured, minus duplicates.
  return [...new Set([...list, ...DEFAULT_MODELS])];
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface AskOptions {
  /** Framing and, for grounded answers, the facts it is allowed to use. */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /**
   * Use a different key than the shared one.
   *
   * Gemini's free tier meters per key, so a surface that can be busy — the
   * community feed — is given its own budget rather than being allowed to
   * exhaust the assistant chat, which is the feature people notice going
   * quiet. Omitted, it falls back to GEMINI_API_KEY.
   */
  apiKey?: string;
  /**
   * Pictures to look at, attached to the last user turn.
   *
   * Added for the coach, which reads a marksheet photo. Base64 without the
   * data-URL prefix; the mime type is what the browser reported for the file.
   */
  images?: Array<{ mimeType: string; data: string }>;
  /** Ask for JSON and nothing else. The caller still parses defensively. */
  json?: boolean;
  /**
   * Use exactly these models, in this order, ignoring `GEMINI_MODEL`.
   * For features that must never reach the full Flash model's small quota.
   */
  models?: string[];
  /** Per-attempt timeout: each model gets its own AbortController. */
  timeoutMs?: number;
  /** Budget for the whole chain of attempts; no new attempt starts after it. */
  deadlineMs?: number;
  /** Gemini `responseSchema` (OpenAPI subset). Implies JSON output. */
  responseSchema?: Record<string, unknown>;
  /** Test seam: replaces the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export type GeminiFailure = "unconfigured" | "timeout" | "rate_limited" | "invalid" | "upstream";

/** An `Error` that also says what kind of failure ended the chain. Messages are unchanged. */
export class GeminiError extends Error {
  readonly kind: GeminiFailure;
  constructor(message: string, kind: GeminiFailure) {
    super(message);
    this.name = "GeminiError";
    this.kind = kind;
  }
}

/**
 * Ask Gemini.
 *
 * Grounding stays the caller's job, exactly as it is for Sarvam: the route
 * retrieves real courses and openings and puts them in `system`, so the model
 * rephrases the catalogue rather than inventing a course that does not exist.
 * That property is why the local engine still runs first.
 */
export async function ask(turns: Turn[], options: AskOptions = {}): Promise<string> {
  const key = options.apiKey?.trim() || geminiKey();
  if (!key) throw new GeminiError("Gemini is not configured.", "unconfigured");
  const doFetch = options.fetchImpl ?? fetch;
  const wantJson = Boolean(options.json || options.responseSchema);

  const contents = turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }] as Array<Record<string, unknown>>,
  }));
  // Pictures ride on the final user turn, after its text.
  if (options.images?.length) {
    const last = [...contents].reverse().find((c) => c.role === "user");
    if (last) {
      for (const im of options.images) {
        last.parts.push({ inline_data: { mime_type: im.mimeType, data: im.data } });
      }
    }
  }

  const payload = JSON.stringify({
    // Gemini says "model" where the rest of the world says "assistant".
    contents,
    ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 800,
      temperature: options.temperature ?? 0.4,
      ...(wantJson ? { responseMimeType: "application/json" } : {}),
      ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
    },
  });

  let lastError = "";
  let lastKind: GeminiFailure = "upstream";
  const started = Date.now();
  for (const name of options.models?.length ? options.models : models()) {
    let budget = options.timeoutMs ?? Number.POSITIVE_INFINITY;
    if (options.deadlineMs !== undefined) {
      const left = options.deadlineMs - (Date.now() - started);
      if (left <= 0) {
        lastError ||= "deadline exceeded";
        lastKind = "timeout";
        break;
      }
      budget = Math.min(budget, left);
    }
    const controller = new AbortController();
    const timer = Number.isFinite(budget) ? setTimeout(() => controller.abort(), budget) : null;
    try {
      const res = await doFetch(`${BASE}/${name}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: payload,
        signal: controller.signal,
      });

      if (res.ok) {
        const body = (await res.json()) as {
          candidates?: Array<{
            finishReason?: string;
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const candidate = body.candidates?.[0];
        // A JSON answer that stopped for any reason but STOP is truncated or
        // blocked: it may parse, and it may be wrong. Reject, try the next model.
        if (wantJson && candidate?.finishReason && candidate.finishReason !== "STOP") {
          lastError = `${name} stopped early (${candidate.finishReason})`;
          lastKind = "invalid";
          continue;
        }
        const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
        if (text && text.trim()) return text.trim();
        lastError = `${name} returned an empty answer`;
        lastKind = "invalid";
        continue;
      }

      const detail = await res.text().catch(() => "");
      lastError = `${name}: ${res.status} ${detail.slice(0, 160)}`;
      lastKind = res.status === 429 ? "rate_limited" : "upstream";

      // 429 is the quota, 404 is a retired model name, 503 is a busy backend.
      // All three are answered by trying the next model. A 400 or 403 is our
      // own mistake or a dead key, and trying again with a different model
      // would just make the same request three times.
      if (res.status !== 429 && res.status !== 404 && res.status !== 503) break;
    } catch {
      // One model's network failure or timeout is not the chain's failure.
      const timedOut = controller.signal.aborted;
      lastError = `${name}: ${timedOut ? "timed out" : "network error"}`;
      lastKind = timedOut ? "timeout" : "upstream";
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new GeminiError(`Gemini failed. ${lastError}`, lastKind);
}

/**
 * A study pack for a skill nobody is certified to teach yet.
 *
 * This is the cold-start escape hatch in the certified-trainer model: without
 * it a new skill has no trainer, so nobody can learn it, so nobody can ever
 * become its trainer. The pack lets someone self-study and then sit the same
 * assessment at the same pass mark.
 *
 * The prompt is deliberately strict about scope. A study pack that wanders
 * into material the assessment does not cover fails the person who trusted it.
 */
export async function studyPack(input: {
  skill: string;
  level: string;
  syllabus: string[];
  language?: string;
}): Promise<string> {
  const system = [
    "You write self-study material for Indian vocational learners on स्वYAM.",
    "The reader has no trainer for this skill, so the pack must stand alone.",
    "",
    "Rules:",
    "- Cover only the syllabus given. Do not add topics it does not list.",
    "- Plain language. Short sentences. Assume no prior jargon.",
    "- Prefer worked examples and things the reader can practice offline.",
    "- Where a tool or material is needed, name a cheap Indian equivalent.",
    "- End with 8 self-check questions and their answers.",
    "- Markdown headings only — no HTML, no images, no external links.",
    input.language && input.language !== "en"
      ? `- Write in the language with code "${input.language}".`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    `Skill: ${input.skill}`,
    `Level: ${input.level}`,
    "Syllabus this pack must cover, and nothing else:",
    ...input.syllabus.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n");

  // Long-form, so a higher ceiling than a chat turn and a cooler temperature:
  // study material should be predictable, not creative.
  return ask([{ role: "user", content: prompt }], {
    system,
    maxTokens: 4000,
    temperature: 0.25,
  });
}
