/**
 * The prompt for the membership chooser. It carries ids and coarse numbers only: no price, no age, no name,
 * no free text. The model arranges a fixed list; it cannot add to it, rename it or change what anything costs.
 */
import { BENEFIT_BY_ID, LIVE_TOP, type Plan } from "../config/plans";
import type { ChooserInput } from "../core/types";

export const SYSTEM_PROMPT = [
  "You arrange the benefit list on a membership card for a learning and careers site.",
  "Reply with one JSON object and nothing else.",
  `Order benefitOrder by how well each benefit fits the strongest domains in the usage numbers; the first ${LIVE_TOP} must be marked live.`,
  "Use 3 to 6 distinct benefit ids from the allowed list. For modes QUICK or MINIMAL use exactly 3.",
  "Pick headlineId and reasonKey that match the strongest domain. If the state is UNIVERSAL or EXPLORER, pick a BALANCED headline and keep the listed order.",
  "You never choose a plan, a price or any wording; you only select ids from the allowed lists.",
].join(" ");

export function buildUserPrompt(input: ChooserInput, plan: Plan): string {
  const usage = {
    state: input.state,
    mode: input.mode,
    tier: input.tier,
    domains: input.domains,
  };
  const allowed = plan.benefitIds.map((id) => {
    const b = BENEFIT_BY_ID[id];
    return `${id} (${b.domain}, ${b.availability})`;
  });
  return [
    `planId must be ${plan.id}.`,
    `Usage: ${JSON.stringify(usage)}`,
    `Allowed benefits: ${allowed.join("; ")}`,
  ].join("\n");
}
