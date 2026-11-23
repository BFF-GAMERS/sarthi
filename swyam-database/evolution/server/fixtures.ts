/**
 * Canned AI decisions for EVOLUTION_AI_MODE=fixture (plan §5.6).
 *
 * Hand-written to match the five Lab personas' expected outcomes, so the whole
 * AI path (route, client validation, merge, status card) can be demonstrated
 * and tested with no key and no quota. Not recorded from Gemini.
 */
import career from "../__fixtures__/gemini/valid-career-seeker.json";
import community from "../__fixtures__/gemini/valid-community-explorer.json";
import fast from "../__fixtures__/gemini/valid-fast-user.json";
import learning from "../__fixtures__/gemini/valid-learning-explorer.json";
import skill from "../__fixtures__/gemini/valid-skill-builder.json";
import type { AnalyzerRequest } from "../core/analyzer/types";
import { validateDecision } from "../core/ui-state/validate";
import type { EvolutionDecision } from "../types";

/** The decision JSON is the string inside the recorded Gemini envelope. */
function decisionOf(envelope: {
  body: { candidates: { content: { parts: { text: string }[] } }[] };
}) {
  return JSON.parse(envelope.body.candidates[0]!.content.parts[0]!.text) as unknown;
}

const FIXTURES = {
  learning: decisionOf(learning),
  career: decisionOf(career),
  skill: decisionOf(skill),
  community: decisionOf(community),
  fast: decisionOf(fast),
};

const FLOOR = 0.25;

/**
 * The fixture whose domain has the strongest affinity in the request, or the
 * quick-user fixture when no domain stands out. Deterministic: same summary,
 * same answer.
 */
export function fixtureDecisionFor(r: AnalyzerRequest): EvolutionDecision {
  const s = r.scores;
  const ranked = [
    { key: "learning" as const, v: s.learningAffinity },
    { key: "career" as const, v: s.careerAffinity },
    { key: "skill" as const, v: s.skillExchangeAffinity },
    { key: "community" as const, v: s.communityAffinity },
  ].sort((a, b) => b.v - a.v);
  const top = ranked[0]!;
  const pick = top.v >= FLOOR ? FIXTURES[top.key] : FIXTURES.fast;
  const checked = validateDecision(pick, "ai");
  // The fixtures are validated by tests; this keeps a bad edit from reaching a client.
  if (!checked.ok) throw new Error("Evolution fixture failed validation");
  return checked.value;
}
