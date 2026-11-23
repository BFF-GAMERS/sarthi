/**
 * Phrase in, destination out. Keywords first; the model only when no keyword fits.
 *
 *   scrub (no PII, 120 chars) -> keyword matcher -> hit: done, no network
 *                                                 -> miss: POST /api/intent (2 s) -> validate
 *   anything else -> "no match", with a few suggestions.
 *
 * Every result is run through validateIntent. This module never navigates; it
 * only says where a phrase could go, and the dialog asks before going.
 */
import { matchKeywords } from "./keywords";
import { scrubPhrase } from "./phrase";
import { INTENT_SUGGESTIONS, type IntentMatch } from "./routes";
import { validateIntent } from "./validate";

export type IntentResult =
  | { kind: "match"; match: IntentMatch; source: "keyword" | "ai" }
  | { kind: "none"; suggestions: IntentMatch[] };

export interface ResolveOptions {
  /** Set false to stay on the keyword matcher only. */
  ai?: boolean;
  /** Test seam. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export const INTENT_ENDPOINT = "/api/intent";
export const CLIENT_TIMEOUT_MS = 2500;

const none = (): IntentResult => ({ kind: "none", suggestions: [...INTENT_SUGGESTIONS] });

async function askServer(phrase: string, opts: ResolveOptions): Promise<IntentMatch | null> {
  const doFetch = opts.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!doFetch) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? CLIENT_TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await doFetch(INTENT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: unknown; match?: unknown };
    return body && body.ok === true ? validateIntent(body.match) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export async function resolveIntent(raw: string, opts: ResolveOptions = {}): Promise<IntentResult> {
  const phrase = scrubPhrase(raw);
  if (phrase.length < 2) return none();

  const hit = validateIntent(matchKeywords(phrase));
  if (hit) return { kind: "match", match: hit, source: "keyword" };

  if (opts.ai === false) return none();
  const ai = await askServer(phrase, opts);
  return ai ? { kind: "match", match: ai, source: "ai" } : none();
}
