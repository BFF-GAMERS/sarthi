/**
 * Strict input validation for POST /api/evolution (plan §5.2).
 *
 * The request is aggregates only, so the check is exact: every key must be
 * known, every enum value must come from config/ids.ts, every number must be
 * finite and in range. Anything else is a 400. Unknown keys are refused rather
 * than dropped: a client that sends text, ids or a user id is a bug (or an
 * attack) and must hear about it, not be quietly trimmed.
 */
import {
  ANALYZER_TRIGGERS,
  BEHAVIOUR_MODES,
  EVENT_TYPES,
  EVOLUTION_STATES,
  NAV_ITEM_IDS,
  TIERS,
} from "../config/ids";
import { MAX_NAV_PATTERN, MAX_REPEATED, MAX_TOP_ACTIONS } from "../core/analyzer/summarize";
import type { AnalyzerRequest } from "../core/analyzer/types";
import { err, ok, type Result } from "../core/model/result";
import { validateDecision } from "../core/ui-state/validate";
import type { BehaviourScores } from "../types";

/** A real request is about 1.5 KB; this only stops someone posting a megabyte. */
export const MAX_BODY_CHARS = 8_000;
/**
 * The same cap in bytes, enforced BEFORE the body is parsed: on `content-length` first, then on the stream.
 * A request is enum strings and numbers (ASCII), so a byte cap equal to the char cap never refuses a real one.
 */
export const MAX_BODY_BYTES = MAX_BODY_CHARS;

const SCORE_KEYS: ReadonlyArray<keyof BehaviourScores> = [
  "learningAffinity",
  "careerAffinity",
  "skillExchangeAffinity",
  "communityAffinity",
  "quickUser",
  "researchUser",
  "repeatUser",
  "explorer",
  "careerFocused",
  "learningFocused",
  "skillFocused",
  "minimalUser",
];

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const exactKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const have = Object.keys(o);
  return have.length === keys.length && keys.every((k) => have.includes(k));
};

const oneOf = <T extends string | number>(list: readonly T[], v: unknown): v is T =>
  (list as readonly unknown[]).includes(v);

const unit = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

const count = (v: unknown, max = 1_000_000): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

function typeCounts(v: unknown, max: number): { type: string; count: number }[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: { type: string; count: number }[] = [];
  for (const item of v) {
    if (!isPlain(item) || !exactKeys(item, ["type", "count"])) return null;
    if (!oneOf(EVENT_TYPES, item["type"]) || !count(item["count"])) return null;
    out.push({ type: item["type"], count: item["count"] });
  }
  return out;
}

export function parseAnalyzerRequest(raw: unknown): Result<AnalyzerRequest, string> {
  if (!isPlain(raw)) return err("not an object");
  if (
    !exactKeys(raw, [
      "v",
      "trigger",
      "scores",
      "topActions",
      "repeated",
      "navPattern",
      "session",
      "current",
      "deterministic",
    ])
  )
    return err("unknown or missing keys");
  if (raw["v"] !== 1) return err("v");
  if (!oneOf(ANALYZER_TRIGGERS, raw["trigger"])) return err("trigger");

  const scores = raw["scores"];
  if (!isPlain(scores) || !exactKeys(scores, SCORE_KEYS)) return err("scores keys");
  for (const k of SCORE_KEYS) if (!unit(scores[k])) return err(`scores.${k}`);

  const topActions = typeCounts(raw["topActions"], MAX_TOP_ACTIONS);
  if (!topActions) return err("topActions");
  const repeated = typeCounts(raw["repeated"], MAX_REPEATED);
  if (!repeated) return err("repeated");

  const nav = raw["navPattern"];
  if (
    !Array.isArray(nav) ||
    nav.length > MAX_NAV_PATTERN ||
    !nav.every((n) => oneOf(NAV_ITEM_IDS, n))
  )
    return err("navPattern");

  const session = raw["session"];
  if (!isPlain(session) || !exactKeys(session, ["events", "minutes", "sessions", "completed"]))
    return err("session keys");
  if (
    !count(session["events"]) ||
    !count(session["minutes"], 100_000) ||
    !count(session["sessions"]) ||
    !count(session["completed"])
  )
    return err("session values");

  const current = raw["current"];
  if (
    !isPlain(current) ||
    !exactKeys(current, ["primaryState", "behaviourMode", "confidence", "tier"])
  )
    return err("current keys");
  if (
    !oneOf(EVOLUTION_STATES, current["primaryState"]) ||
    !oneOf(BEHAVIOUR_MODES, current["behaviourMode"]) ||
    !unit(current["confidence"]) ||
    !oneOf(TIERS, current["tier"])
  )
    return err("current values");

  // The deterministic decision must itself be a valid local decision (R0–R8).
  const deterministic = validateDecision(raw["deterministic"], "local");
  if (!deterministic.ok) return err("deterministic");

  return ok({
    v: 1,
    trigger: raw["trigger"],
    scores: scores as unknown as BehaviourScores,
    topActions: topActions as AnalyzerRequest["topActions"],
    repeated: repeated as AnalyzerRequest["repeated"],
    navPattern: nav as AnalyzerRequest["navPattern"],
    session: session as unknown as AnalyzerRequest["session"],
    current: current as unknown as AnalyzerRequest["current"],
    deterministic: deterministic.value,
  });
}
