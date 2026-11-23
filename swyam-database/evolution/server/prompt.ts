/**
 * The system prompt and the per-request prompt for the AI brain (plan §5.3).
 *
 * The model is a classifier, not an author: it picks values from the lists it
 * is given. The lists, and the state → navigation / layout / action coherence
 * table, are generated from config/ids.ts and EVOLUTION_CONFIG so the prompt,
 * the response schema and the validator can never disagree.
 *
 * Nothing in the user prompt is free text: it is the validated aggregates.
 */
import { EVOLUTION_CONFIG as C } from "../config/evolution-config";
import { BEHAVIOUR_MODES, EVOLUTION_STATES } from "../config/ids";
import type { AnalyzerRequest } from "../core/analyzer/types";
import { validateDecision } from "../core/ui-state/validate";

export const SYSTEM_PROMPT = [
  "You are a classifier inside Swayam, a learning, jobs, skill-exchange and community platform whose interface re-arranges itself around how a person uses it.",
  "You receive anonymous usage aggregates: rounded scores, counts of event types, a short navigation pattern and the on-device engine's own decision.",
  "Pick the arrangement that best fits the evidence. Agreeing with the on-device decision is the right answer whenever the evidence is mixed or thin.",
  "",
  "RULES THAT OVERRIDE EVERYTHING ELSE:",
  "- Output ONLY one JSON object with exactly these keys: primaryState, behaviourMode, navigationMode, homepageLayout, priorityActions, reason, confidence.",
  "- Choose ONLY from the listed values. Never invent a value, a key, a route or a section.",
  "- Never output code, markup, HTML, CSS, URLs, commands, backticks, braces or line breaks in any field.",
  "- navigationMode and homepageLayout must match the state exactly as the table says, or be UNIVERSAL.",
  "- priorityActions: 1 to 4 distinct ids, taken from the table row for the state you chose plus the UNIVERSAL row.",
  "- reason: one plain sentence of at most 120 characters about the usage pattern. No names, no advice, no promises.",
  "- confidence: a number from 0 to 1. Use below 0.5 when the evidence is thin.",
  "- Use behaviourMode BALANCED only with primaryState UNIVERSAL. A *_FOCUSED mode needs its own state. EXPLORER mode and EXPLORER state go together.",
  "- You are never given, and must never infer, a person's age, gender, religion, caste, disability, income, region or any other sensitive attribute. Judge only the usage pattern.",
].join("\n");

/**
 * Modes the validator accepts for a state. Asked of the validator itself, so
 * the prompt can never promise the model something the validator will reject.
 */
function allowedModes(state: (typeof EVOLUTION_STATES)[number]): string[] {
  const cfg = C.states[state];
  return BEHAVIOUR_MODES.filter(
    (behaviourMode) =>
      validateDecision(
        {
          primaryState: state,
          behaviourMode,
          navigationMode: cfg.nav,
          homepageLayout: cfg.layout,
          priorityActions: [C.priorityActions[state][0]],
          reason: "x",
          confidence: 0.5,
        },
        "ai",
      ).ok,
  );
}

const NL = String.fromCharCode(10);

/** State → what it implies, one compact line each (generated, never hand-written). */
function coherenceTable(): string {
  return EVOLUTION_STATES.map((s) => {
    const cfg = C.states[s];
    return [
      `${s}: navigationMode=${cfg.nav}; homepageLayout=${cfg.layout}`,
      `actions=${C.priorityActions[s].join(",")}`,
      `behaviourMode one of ${allowedModes(s).join(",")}`,
    ].join("; ");
  }).join(NL);
}

/** The reference block. Built once; it only depends on config. */
export const REFERENCE = [
  `primaryState values: ${EVOLUTION_STATES.join(", ")}`,
  `behaviourMode values: ${BEHAVIOUR_MODES.join(", ")}`,
  "Coherence table (each state implies its navigationMode, homepageLayout, action row and allowed modes):",
  coherenceTable(),
  `UNIVERSAL actions are also allowed with every state: ${C.priorityActions.UNIVERSAL.join(",")}`,
].join(NL);

/** The request, without the local `reason` (client text the model has no use for). */
function evidence(r: AnalyzerRequest): string {
  const d = r.deterministic;
  return JSON.stringify({
    scores: r.scores,
    topActions: r.topActions,
    repeatedThisSession: r.repeated,
    navigationPattern: r.navPattern,
    session: r.session,
    current: r.current,
    onDeviceDecision: {
      primaryState: d.primaryState,
      behaviourMode: d.behaviourMode,
      navigationMode: d.navigationMode,
      homepageLayout: d.homepageLayout,
      priorityActions: d.priorityActions,
      confidence: d.confidence,
    },
  });
}

export function buildUserPrompt(r: AnalyzerRequest): string {
  return [
    REFERENCE,
    "",
    "Usage aggregates (JSON):",
    evidence(r),
    "",
    "Answer with the JSON object only.",
  ].join("\n");
}
