/**
 * Gemini `responseSchema` for the 7-key decision (plan §5.3).
 *
 * Every enum array is generated from config/ids.ts, so the model is
 * constrained at generation time to exactly the values the validator accepts.
 * The schema narrows what the model can say; it never replaces validation:
 * validateDecision(…, "ai") still runs on whatever comes back.
 */
import {
  BEHAVIOUR_MODES,
  EVOLUTION_STATES,
  HOME_LAYOUTS,
  NAV_MODES,
  PRIORITY_ACTION_IDS,
} from "../config/ids";
import { DECISION_KEYS } from "../types";

export function buildResponseSchema(): Record<string, unknown> {
  return {
    type: "OBJECT",
    properties: {
      primaryState: { type: "STRING", enum: [...EVOLUTION_STATES] },
      behaviourMode: { type: "STRING", enum: [...BEHAVIOUR_MODES] },
      navigationMode: { type: "STRING", enum: [...NAV_MODES] },
      homepageLayout: { type: "STRING", enum: [...HOME_LAYOUTS] },
      priorityActions: {
        type: "ARRAY",
        minItems: 1,
        maxItems: 4,
        items: { type: "STRING", enum: [...PRIORITY_ACTION_IDS] },
      },
      reason: {
        type: "STRING",
        description: "One plain sentence, at most 120 characters, no markup or links.",
      },
      confidence: { type: "NUMBER", description: "From 0 to 1." },
    },
    required: [...DECISION_KEYS],
    propertyOrdering: [...DECISION_KEYS],
  };
}
