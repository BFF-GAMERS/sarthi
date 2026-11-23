import { describe, expect, it } from "vitest";
import { compose, UNIVERSAL_DECISION } from "@/evolution/core/evolution/compose";
import { IDLE_AI } from "@/evolution/state/defaults";
import type { BehaviourScores, EvolutionDecision } from "@/evolution/types";
import { PERSONA_IDS } from "@/evolution/config/ids";
import {
  AI_OFF_COPY,
  compareUis,
  diffUi,
  domainShares,
  firstDivergence,
  formatDecision,
  labStatusLine,
  openSections,
  outcomeText,
  personaUi,
  resolvePlayParam,
} from "./labModel";

const ZERO: BehaviourScores = {
  learningAffinity: 0,
  careerAffinity: 0,
  skillExchangeAffinity: 0,
  communityAffinity: 0,
  quickUser: 0,
  researchUser: 0,
  repeatUser: 0,
  explorer: 0,
  careerFocused: 0,
  learningFocused: 0,
  skillFocused: 0,
  minimalUser: 0,
};

describe("labModel", () => {
  it("domain shares sum to 1, or are all 0 before any signal", () => {
    expect(domainShares(ZERO)).toEqual([0, 0, 0, 0]);
    const s = domainShares({ ...ZERO, learningAffinity: 1, careerAffinity: 3 });
    expect(s).toEqual([0.25, 0.75, 0, 0]);
  });

  it("says plainly when the AI is off and never turns the decision into markup", () => {
    expect(outcomeText({ ...IDLE_AI, kind: "unavailable" })).toBe(AI_OFF_COPY);
    expect(outcomeText({ ...IDLE_AI, kind: "held" })).toBe("Held by stability rules");
    expect(outcomeText({ ...IDLE_AI, kind: "rejected", detail: "R3" })).toBe("Rejected: R3");
    const lastDecision: EvolutionDecision = { ...UNIVERSAL_DECISION, reason: "<img onerror=x>" };
    const json = formatDecision({ ...IDLE_AI, lastDecision }) ?? "";
    expect(JSON.parse(json).reason).toBe("<img onerror=x>");
    expect(formatDecision(IDLE_AI)).toBeNull();
  });

  it("diffUi is empty for the same plan and flags a changed one", () => {
    const ctx = { signedIn: true, stableNav: false, locked: false };
    const base = compose(UNIVERSAL_DECISION, 0, ctx);
    expect(diffUi(base, base)).toEqual({ nav: [], sections: [] });
    const career = compose(
      { ...UNIVERSAL_DECISION, primaryState: "CAREER_FIRST", navigationMode: "CAREER_PRIORITY" },
      3,
      ctx,
    );
    const d = diffUi(base, career);
    expect(d.nav.length + d.sections.length).toBeGreaterThan(0);
  });
});

describe("?play= resolution", () => {
  it("maps short names and full ids, and ignores everything else", () => {
    expect(resolvePlayParam("career")).toBe("career-seeker");
    expect(resolvePlayParam(" Learning ")).toBe("learning-explorer");
    expect(resolvePlayParam("skills")).toBe("skill-builder");
    expect(resolvePlayParam("community")).toBe("community-explorer");
    expect(resolvePlayParam("fast")).toBe("fast-user");
    for (const id of PERSONA_IDS) expect(resolvePlayParam(id)).toBe(id);
    for (const bad of ["", "nope", "__proto__", "constructor", null, undefined, 3, ["career"]]) {
      expect(resolvePlayParam(bad)).toBeNull();
    }
  });
});

describe("compare model", () => {
  const ctx = { signedIn: false, stableNav: false, locked: false };

  it("firstDivergence finds the first differing position, or -1", () => {
    expect(firstDivergence(["a", "b"], ["a", "b"])).toBe(-1);
    expect(firstDivergence(["a", "b", "c"], ["a", "x", "c"])).toBe(1);
    expect(firstDivergence(["a"], ["a", "b"])).toBe(1);
  });

  it("each persona composes to its expected state at its expected tier", () => {
    const learning = personaUi("learning-explorer", ctx);
    const career = personaUi("career-seeker", ctx);
    expect(learning.state).toBe("LEARNING_FIRST");
    expect(career.state).toBe("CAREER_FIRST");
    expect(career.tier).toBe(3);
  });

  it("learning vs career differ in nav, hero button and Home order, and name a target section each", () => {
    const a = personaUi("learning-explorer", ctx);
    const b = personaUi("career-seeker", ctx);
    const m = compareUis(a, b);
    const row = (label: string) => m.rows.find((r) => r.label === label);
    expect(row("Experience")?.differs).toBe(true);
    expect(row("Hero button")?.differs).toBe(true);
    expect(row("Top bar")?.differs).toBe(true);
    expect(m.firstIndex).toBeGreaterThanOrEqual(0);
    expect(m.targetA).toBe(openSections(a)[m.firstIndex]);
    expect(m.targetB).toBe(openSections(b)[m.firstIndex]);
    expect(m.targetA).not.toBe(m.targetB);
    expect(m.rows.some((r) => r.label === `Home ${m.firstIndex + 1}` && r.differs)).toBe(true);
  });

  it("a plan compared with itself has nothing to scroll to", () => {
    const a = personaUi("career-seeker", ctx);
    const m = compareUis(a, a);
    expect(m.firstIndex).toBe(-1);
    expect(m.targetA).toBeNull();
    expect(m.targetB).toBeNull();
    expect(m.rows.every((r) => !r.differs)).toBe(true);
  });
});

describe("labStatusLine", () => {
  const base = {
    demo: null,
    running: null,
    replayStep: null,
    state: "UNIVERSAL",
    tier: 0,
  } as const;

  it("says what the Lab is doing in one plain sentence", () => {
    expect(labStatusLine(base)).toBe("Pick a persona to watch स्वYAM adapt.");
    expect(
      labStatusLine({ ...base, demo: "career-seeker", running: "career-seeker", tier: 2 }),
    ).toContain("Career Seeker is playing");
    expect(
      labStatusLine({ ...base, demo: "career-seeker", state: "CAREER_FIRST", tier: 3 }),
    ).toContain("Reached tier 3: Career-focused");
    expect(labStatusLine({ ...base, replayStep: { index: 2, total: 9 } })).toBe(
      "Replaying step 2 of 9.",
    );
  });
});
