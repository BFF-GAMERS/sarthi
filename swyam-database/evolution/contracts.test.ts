/**
 * Contract smoke tests (owned by the contracts step). Lanes add their own tests
 * beside their files; these only pin the shared shapes the brief fixes.
 */
import { describe, expect, it } from "vitest";
import { EVOLUTION_CONFIG as C } from "./config/evolution-config";
import { EVENT_TYPES, EV } from "./config/ids";
import { compose, UNIVERSAL_DECISION } from "./core/evolution/compose";
import { validateDecision } from "./core/ui-state/validate";
import type { EvolutionDecision } from "./types";

const ctx = { signedIn: true, stableNav: false, locked: false };

describe("contracts", () => {
  it("has the 23 brief events plus 8", () => {
    expect(EVENT_TYPES.length).toBe(31);
    expect(Object.values(EV).sort()).toEqual([...EVENT_TYPES].sort());
  });

  it("validates the brief §11 example and rejects unsafe reasons", () => {
    const ex: EvolutionDecision = {
      primaryState: "CAREER_FIRST",
      behaviourMode: "RESEARCH",
      navigationMode: "CAREER_PRIORITY",
      homepageLayout: "CAREER_DISCOVERY",
      priorityActions: ["JOBS", "INTERNSHIPS", "APPLICATIONS", "CAREER_LAUNCHER"],
      reason: "You've recently explored jobs and internships frequently.",
      confidence: 0.91,
    };
    expect(validateDecision(ex, "ai").ok).toBe(true);
    expect(validateDecision({ ...ex, reason: "<script>x</script>" }).ok).toBe(false);
    expect(validateDecision({ ...ex, confidence: 1.7 }).ok).toBe(false);
    expect(validateDecision({ ...ex, extra: 1 }).ok).toBe(false);
    expect(validateDecision({ ...ex, navigationMode: "LEARNING_PRIORITY" }).ok).toBe(false);
    expect(validateDecision(UNIVERSAL_DECISION).ok).toBe(true);
  });

  it("compiles the brief §4 navigation lists verbatim at tier 2", () => {
    const at = (s: EvolutionDecision["primaryState"]) =>
      compose({ ...UNIVERSAL_DECISION, primaryState: s }, 2, ctx).navigation.top;
    expect(compose(UNIVERSAL_DECISION, 0, ctx).navigation.top).toEqual(C.navigation.UNIVERSAL);
    expect(at("CAREER_FIRST")).toEqual(C.navigation.CAREER_PRIORITY);
    expect(at("LEARNING_FIRST")).toEqual(C.navigation.LEARNING_PRIORITY);
    expect(at("SKILL_EXCHANGE_FIRST")).toEqual(C.navigation.SKILL_EXCHANGE_PRIORITY);
  });

  it("changes structure, not paint", () => {
    const base = compose(UNIVERSAL_DECISION, 0, ctx);
    for (const s of [
      "LEARNING_FIRST",
      "CAREER_FIRST",
      "SKILL_EXCHANGE_FIRST",
      "COMMUNITY_FIRST",
    ] as const) {
      const ui = compose({ ...UNIVERSAL_DECISION, primaryState: s }, 2, ctx);
      expect(ui.navigation.top).not.toEqual(base.navigation.top);
      expect(ui.sections.slice(0, 3).map((x) => x.id)).not.toEqual(
        base.sections.slice(0, 3).map((x) => x.id),
      );
      expect(ui.navigation.bottom.length).toBeLessThanOrEqual(5);
      expect(ui.navigation.bottom[0]).toBe("HOME");
    }
    expect(JSON.stringify(base)).not.toMatch(/colou?r|font|theme|gradient/i);
  });
});
