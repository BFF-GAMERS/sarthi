/**
 * The isomorphic EvolutionDecision validator (rules R0–R8, plan §3.4 / §5.3).
 * Used for the deterministic blueprint, persisted state on restore, the
 * server's Gemini reply and the client's copy of it. REJECT, NEVER COERCE.
 *
 * Pure: no react, no DOM, no clock.
 */
import { EVOLUTION_CONFIG as C } from "../../config/evolution-config";
import {
  BEHAVIOUR_MODES,
  EVOLUTION_STATES,
  HOME_LAYOUTS,
  NAV_MODES,
  PRIORITY_ACTION_IDS,
} from "../../config/ids";
import { DECISION_KEYS, type EvolutionDecision } from "../../types";
import { err, ok, type Result } from "../model/result";

export type DecisionSourceKind = "local" | "ai";

const has = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

/** Plain text only: no markup, braces, backticks, URLs, newlines or control characters. */
// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
export const UNSAFE_REASON = /[<>{}`\u0000-\u001f\u007f]|https?:|www\.|javascript:|data:/i;
export const MAX_REASON = 160;

export function validateDecision(
  input: unknown,
  source: DecisionSourceKind = "local",
): Result<EvolutionDecision, string[]> {
  const errors: string[] = [];
  // R0 — a plain object with exactly the 7 keys.
  if (!input || typeof input !== "object" || Array.isArray(input))
    return err(["R0: not an object"]);
  if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
    return err(["R0: not a plain object"]);
  const o = input as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== DECISION_KEYS.length || !DECISION_KEYS.every((k) => keys.includes(k)))
    return err(["R0: keys must be exactly " + DECISION_KEYS.join(",")]);

  const ps = o["primaryState"];
  const bm = o["behaviourMode"];
  const nm = o["navigationMode"];
  const hl = o["homepageLayout"];
  const pa = o["priorityActions"];
  const reason = o["reason"];
  const confidence = o["confidence"];

  // R1 — enums.
  if (!has(EVOLUTION_STATES, ps)) errors.push("R1: primaryState");
  if (!has(BEHAVIOUR_MODES, bm)) errors.push("R1: behaviourMode");
  if (!has(NAV_MODES, nm)) errors.push("R1: navigationMode");
  if (!has(HOME_LAYOUTS, hl)) errors.push("R1: homepageLayout");
  if (errors.length) return err(errors);
  const state = ps as EvolutionDecision["primaryState"];
  const mode = bm as EvolutionDecision["behaviourMode"];

  // R2 — navigation coherent with the state.
  if (nm !== "UNIVERSAL" && nm !== C.states[state].nav) errors.push("R2: navigationMode vs state");
  // R3 — layout coherent with the state.
  if (hl !== "UNIVERSAL" && hl !== C.states[state].layout)
    errors.push("R3: homepageLayout vs state");
  // R4 — mode coherent with the state.
  if (state === "EXPLORER" && (mode !== "EXPLORER" || nm !== "UNIVERSAL"))
    errors.push("R4: EXPLORER needs mode EXPLORER and UNIVERSAL nav");
  if (mode === "EXPLORER" && state !== "EXPLORER")
    errors.push("R4: mode EXPLORER needs state EXPLORER");
  const focusedState = C.focusedModeState[mode];
  if (focusedState && focusedState !== state) errors.push("R4: focused mode vs state");
  if (state === "UNIVERSAL" && !C.universalModes.includes(mode)) errors.push("R4: UNIVERSAL mode");
  if (source === "ai" && mode === "BALANCED" && state !== "UNIVERSAL")
    errors.push("R4: AI may use BALANCED only with UNIVERSAL");

  // R5 — 1..4 unique, allow-listed, in scope for the state.
  if (!Array.isArray(pa) || pa.length < 1 || pa.length > 4)
    errors.push("R5: priorityActions length");
  else {
    const scope = new Set<string>([...C.priorityActions[state], ...C.priorityActions.UNIVERSAL]);
    if (new Set(pa).size !== pa.length) errors.push("R5: duplicate action");
    for (const id of pa)
      if (!has(PRIORITY_ACTION_IDS, id) || !scope.has(id)) errors.push("R5: action out of scope");
  }

  // R6 — confidence finite in 0..1.
  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  )
    errors.push("R6: confidence");

  // R7 — reason is short plain text.
  if (typeof reason !== "string" || reason.length > MAX_REASON || UNSAFE_REASON.test(reason))
    errors.push("R7: reason");

  // R8 — no prototype tricks or non-JSON values smuggled through.
  if (keys.some((k) => k === "__proto__" || k === "constructor" || k === "prototype"))
    errors.push("R8: forbidden key");

  if (errors.length) return err(errors);
  return ok({
    primaryState: state,
    behaviourMode: mode,
    navigationMode: nm as EvolutionDecision["navigationMode"],
    homepageLayout: hl as EvolutionDecision["homepageLayout"],
    priorityActions: [...(pa as EvolutionDecision["priorityActions"])],
    reason: reason as string,
    confidence: confidence as number,
  });
}
