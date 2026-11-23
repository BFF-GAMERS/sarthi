/**
 * Sarvam AI — Indian-language speech, and the phone call.
 *
 * SERVER ONLY. Every function here reads `SARVAM_API_KEY` from the process
 * environment, which is deliberately not prefixed `VITE_`: a Vite variable
 * would be inlined into the browser bundle and the key would be public. All
 * of this is reached from the client through `/api/voice` and `/api/call`.
 *
 * Two capabilities:
 *
 *  1. Text-to-speech (Bulbul). The browser's own speech synthesis rarely has
 *     a usable Indian-language voice installed, so Hindi or Tamil comes out
 *     mispronounced or silently falls back to English. Bulbul is built for
 *     these languages, so when a key is present Sarthi speaks through it and
 *     falls back to the browser otherwise.
 *
 *  2. Outbound calls. An agent built in Samvaad and deployed against a
 *     telephony connection is dialled through the Instant Outbound service.
 *     The endpoint is fixed and documented; what varies is which agent, in
 *     which workspace, on which number — so those are configuration.
 */

const TTS_URL = "https://api.sarvam.ai/text-to-speech";
const CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";

/**
 * Bulbul v2 was retired, so v3 is the only usable model — and its speaker
 * list is different, which is why the default is a v3 name rather than one
 * of the old v2 voices.
 */
const TTS_MODEL = "bulbul:v3";
const DEFAULT_SPEAKER = "shubh";

/**
 * `sarvam-105b-conversations` is the chat-tuned variant. The plain
 * `sarvam-105b` emits its scratchpad in `reasoning_content` and can return a
 * null `content` when it runs out of tokens mid-thought; the conversations
 * model answers directly, which is what a chat window needs.
 */
const CHAT_MODEL = "sarvam-105b-conversations";

/** Languages Bulbul can speak, mapped from our own codes to Sarvam's. */
const SARVAM_LANG: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  or: "od-IN", // Sarvam spells Odia "od-IN"
  pa: "pa-IN",
  ta: "ta-IN",
  te: "te-IN",
};

export function sarvamKey(): string | null {
  const key = process.env["SARVAM_API_KEY"];
  return key && key.trim() ? key.trim() : null;
}

export const isSarvamConfigured = (): boolean => sarvamKey() !== null;

/**
 * The Voice Agents key, which is a different key.
 *
 * Speech and chat authenticate against api.sarvam.ai with
 * `api-subscription-key`; the Conversations API on apps.sarvam.ai issues its
 * own key in the Samvaad console and wants it as `X-API-Key`. Sending the
 * wrong one returns 401 with nothing to tell you which half is wrong, so the
 * two are kept deliberately separate here.
 */
export function samvaadKey(): string | null {
  const key = process.env["SARVAM_SAMVAAD_KEY"];
  return key && key.trim() ? key.trim() : null;
}

/** True when Bulbul covers this language; otherwise the browser voice is used. */
export const sarvamSpeaks = (code: string): boolean => code in SARVAM_LANG;

export interface SpeechResult {
  /** Base64-encoded WAV, ready for a `data:` URL. */
  audioBase64: string;
}

/**
 * Synthesise speech.
 *
 * Bulbul v3 caps a request at 2500 characters, so longer answers are cut at a
 * sentence boundary rather than rejected outright — a truncated spoken reply
 * is more useful than an error.
 */
export async function synthesizeSpeech(
  text: string,
  languageCode: string,
  speaker = DEFAULT_SPEAKER,
): Promise<SpeechResult> {
  const key = sarvamKey();
  if (!key) throw new Error("Sarvam is not configured.");

  const lang = SARVAM_LANG[languageCode];
  if (!lang) throw new Error(`Sarvam has no voice for "${languageCode}".`);

  const clipped = text.length > 2400 ? `${text.slice(0, 2400).replace(/\s+\S*$/, "")}…` : text;

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "api-subscription-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text: clipped,
      target_language_code: lang,
      language_code: lang,
      speaker,
      model: TTS_MODEL,
      speech_sample_rate: 22050,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sarvam speech failed (${res.status}). ${detail.slice(0, 200)}`);
  }

  const body = (await res.json()) as { audios?: string[] };
  const audio = body.audios?.[0];
  if (!audio) throw new Error("Sarvam returned no audio.");
  return { audioBase64: audio };
}

/* ── Outbound calls ──────────────────────────────────────────────── */

/**
 * Sarvam's Conversations API — the one that rings a real phone.
 *
 * This is the documented Instant Outbound service, not a guess: agents are
 * built in Samvaad (the console at indus.sarvam.ai), deployed against a
 * telephony connection, and dialled through
 *
 *   POST {OUTBOUND_BASE}/v1/orgs/{org}/workspaces/{ws}/outbounds
 *
 * Note the header: the Conversations API authenticates with `X-API-Key`,
 * where the speech and chat APIs use `api-subscription-key`. Same key, two
 * different header names — getting this wrong returns 401 with no hint.
 */
const OUTBOUND_BASE = "https://apps.sarvam.ai/api/outbounds";

/**
 * The language names the agent accepts.
 *
 * `initial_language_name` is an enum of English names, not BCP-47 codes, and
 * it is a shorter list than the site's 23 languages — anything absent starts
 * the call in English, which the agent can still switch out of when the
 * caller speaks.
 */
const AGENT_LANGUAGE: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  or: "Odia",
  pa: "Punjabi",
  ta: "Tamil",
  te: "Telugu",
  as: "Assamese",
  sa: "Sanskrit",
};

export interface AgentConfig {
  orgId: string;
  workspaceId: string;
  appId: string;
  appVersion: number;
  connectionId: string;
  /** The number the agent calls *from* — the one connected in the console. */
  agentPhoneNumber: string;
  /** Where Sarvam posts the outcome. Required by the API. */
  webhookUrl: string;
}

/**
 * Everything needed to place a call, or null.
 *
 * Every field is required by the API, so a half-filled configuration is the
 * same as none — better to hide the button than to fail at the moment
 * somebody is waiting for their phone to ring.
 */
export function agentConfig(): AgentConfig | null {
  const env = (name: string) => process.env[name]?.trim() || "";
  const orgId = env("SARVAM_ORG_ID");
  const workspaceId = env("SARVAM_WORKSPACE_ID");
  const appId = env("SARVAM_APP_ID");
  const connectionId = env("SARVAM_CONNECTION_ID");
  const agentPhoneNumber = env("SARVAM_AGENT_PHONE_NUMBER");
  const webhookUrl = env("SARVAM_WEBHOOK_URL");
  const appVersion = Number(env("SARVAM_APP_VERSION") || "1");

  if (
    !orgId ||
    !workspaceId ||
    !appId ||
    !connectionId ||
    !agentPhoneNumber ||
    !webhookUrl ||
    !Number.isFinite(appVersion)
  ) {
    return null;
  }
  return { orgId, workspaceId, appId, appVersion, connectionId, agentPhoneNumber, webhookUrl };
}

export const isCallConfigured = (): boolean => samvaadKey() !== null && agentConfig() !== null;

/**
 * Indian mobile numbers, normalised to E.164.
 *
 * Validated here as well as in the browser: this is the last point before a
 * real phone rings, and a typo dials a stranger.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const bare = digits.replace(/^\+?91/, "").replace(/^0/, "");
  return /^[6-9]\d{9}$/.test(bare) ? `+91${bare}` : null;
}

export interface CallRequest {
  toNumber: string;
  languageCode: string;
  /** What the person was asking about, handed to the agent as a variable. */
  context?: string;
  /** Passed through the webhook untouched, so an outcome can be traced back. */
  metadata?: Record<string, string>;
}

/**
 * Ask the deployed agent to ring someone.
 *
 * `agent_variables` is how the chat window and the phone line stay the same
 * assistant: whatever the person was already asking about is handed to the
 * agent, so the call opens where the conversation left off instead of
 * starting again from "how can I help".
 */
export async function placeCall(req: CallRequest): Promise<{ attemptId: string | null }> {
  const key = samvaadKey();
  const cfg = agentConfig();
  if (!key) throw new Error("No Samvaad key configured.");
  if (!cfg) throw new Error("No voice agent is configured.");

  const to = normalisePhone(req.toNumber);
  if (!to) throw new Error("That doesn't look like an Indian mobile number.");

  const url = `${OUTBOUND_BASE}/v1/orgs/${encodeURIComponent(cfg.orgId)}/workspaces/${encodeURIComponent(cfg.workspaceId)}/outbounds`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json" },
    body: JSON.stringify({
      app_config: {
        app_id: cfg.appId,
        app_version: cfg.appVersion,
        app_type: "agent",
        connection_config: {
          connection_id: cfg.connectionId,
          agent_phone_number: cfg.agentPhoneNumber,
        },
        ...(req.context ? { agent_variables: { context: req.context } } : {}),
        app_overrides: {
          initial_language_name: AGENT_LANGUAGE[req.languageCode] ?? "English",
        },
      },
      user_config: { user_phone_number: to },
      webhook_config: {
        url: cfg.webhookUrl,
        ...(req.metadata ? { metadata: req.metadata } : {}),
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Call could not be placed (${res.status}). ${detail.slice(0, 200)}`);
  }

  const body = (await res.json().catch(() => ({}))) as { attempt_id?: string };
  return { attemptId: body.attempt_id ?? null };
}

/* ── Chat ────────────────────────────────────────────────────────── */

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export const isChatConfigured = (): boolean => sarvamKey() !== null;

/**
 * Ask Sarvam's chat model.
 *
 * Grounding is the caller's job: `/api/chat` retrieves the real courses,
 * schemes and openings that match the question and puts them in the system
 * turn, so the model rephrases facts from the catalogue rather than inventing
 * a course that does not exist. That property is the whole reason the local
 * engine still runs first.
 */
export async function chat(messages: ChatTurn[], maxTokens = 700): Promise<string> {
  const key = sarvamKey();
  if (!key) throw new Error("Sarvam is not configured.");

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "api-subscription-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sarvam chat failed (${res.status}). ${detail.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content || !content.trim()) throw new Error("Sarvam returned an empty reply.");
  return content.trim();
}
