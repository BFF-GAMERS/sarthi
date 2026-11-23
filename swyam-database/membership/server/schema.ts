/**
 * Gemini `responseSchema` for the five-key choice (docs/evolution/subscriptions.md §2).
 *
 * Every enum is generated from config/plans.ts and narrowed to the one plan the profile type maps to, so
 * the model is constrained at generation time to exactly what `validateChoice` accepts. The schema narrows
 * what the model can say; it never replaces validation, which still runs on whatever comes back.
 * There is no price, label or free-text field: there is nothing for the model to invent.
 */
import {
  ACCENT_IDS,
  HEADLINE_IDS,
  MAX_BENEFITS,
  MIN_BENEFITS,
  REASON_KEYS,
  type Plan,
} from "../config/plans";
import { CHOICE_KEYS } from "../core/types";

export function buildResponseSchema(plan: Plan): Record<string, unknown> {
  return {
    type: "OBJECT",
    properties: {
      planId: { type: "STRING", enum: [plan.id] },
      benefitOrder: {
        type: "ARRAY",
        minItems: MIN_BENEFITS,
        maxItems: MAX_BENEFITS,
        items: { type: "STRING", enum: [...plan.benefitIds] },
      },
      headlineId: { type: "STRING", enum: [...HEADLINE_IDS] },
      accentId: { type: "STRING", enum: [...ACCENT_IDS] },
      reasonKey: { type: "STRING", enum: [...REASON_KEYS] },
    },
    required: [...CHOICE_KEYS],
    propertyOrdering: [...CHOICE_KEYS],
  };
}
