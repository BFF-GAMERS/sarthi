import { describe, expect, it } from "vitest";
import { MAX_REASON, validateDecision } from "./validate";

/** Brief §11 example. */
const BRIEF = {
  primaryState: "CAREER_FIRST",
  behaviourMode: "RESEARCH",
  navigationMode: "CAREER_PRIORITY",
  homepageLayout: "CAREER_DISCOVERY",
  priorityActions: ["JOBS", "INTERNSHIPS", "APPLICATIONS", "CAREER_LAUNCHER"],
  reason: "You keep looking at jobs and internships and comparing them.",
  confidence: 0.91,
};

const with_ = (patch: Record<string, unknown>) => ({ ...BRIEF, ...patch });
const rejects = (input: unknown, source: "local" | "ai" = "local") =>
  expect(validateDecision(input, source).ok).toBe(false);

describe("validateDecision (R0-R8)", () => {
  it("accepts the brief §11 example, locally and from the AI", () => {
    for (const source of ["local", "ai"] as const) {
      const r = validateDecision(BRIEF, source);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual(BRIEF);
    }
  });

  it("R0: exactly the 7 keys", () => {
    rejects(null);
    rejects([]);
    rejects("CAREER_FIRST");
    rejects({ ...BRIEF, extra: 1 });
    const { reason: _r, ...missing } = BRIEF;
    rejects(missing);
    rejects(Object.create({ primaryState: "UNIVERSAL" }));
  });

  it("R1: enums only, nothing coerced", () => {
    rejects(with_({ primaryState: "career_first" }));
    rejects(with_({ behaviourMode: "TURBO" }));
    rejects(with_({ navigationMode: "PINK" }));
    rejects(with_({ homepageLayout: 7 }));
  });

  it("R2-R4: navigation, layout and mode coherent with the state", () => {
    rejects(with_({ navigationMode: "LEARNING_PRIORITY" }));
    rejects(with_({ homepageLayout: "LEARNING_HUB" }));
    rejects(with_({ behaviourMode: "EXPLORER" }));
    rejects(with_({ behaviourMode: "LEARNING_FOCUSED" }));
    rejects(
      with_({
        primaryState: "UNIVERSAL",
        navigationMode: "UNIVERSAL",
        homepageLayout: "UNIVERSAL",
        behaviourMode: "RESEARCH",
      }),
    );
    rejects(with_({ behaviourMode: "BALANCED" }), "ai");
    expect(validateDecision(with_({ behaviourMode: "CAREER_FOCUSED" })).ok).toBe(true);
    expect(validateDecision(with_({ behaviourMode: "BALANCED" }), "local").ok).toBe(true);
  });

  it("R5: 1 to 4 unique allow-listed actions in scope for the state", () => {
    rejects(with_({ priorityActions: [] }));
    rejects(with_({ priorityActions: ["JOBS", "JOBS"] }));
    rejects(
      with_({
        priorityActions: ["JOBS", "INTERNSHIPS", "APPLICATIONS", "CAREER_LAUNCHER", "FIND_JOBS"],
      }),
    );
    rejects(with_({ priorityActions: ["DROP_TABLE"] }));
    rejects(with_({ priorityActions: ["MATCHES"] }));
    rejects(with_({ priorityActions: "JOBS" }));
  });

  it("R6: confidence is finite in 0..1", () => {
    for (const c of [1.7, -0.1, Number.NaN, Infinity, "0.9", null])
      rejects(with_({ confidence: c }));
    for (const c of [0, 0.5, 1]) expect(validateDecision(with_({ confidence: c })).ok).toBe(true);
  });

  it("R7: script tags, URLs, JSON and control characters in reason are rejected", () => {
    const bad = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "see https://evil.example/login",
      "visit www.evil.example",
      "javascript:alert(1)",
      "data:text/html;base64,AAAA",
      '{"navigationMode":"CAREER_PRIORITY"}',
      "run `rm -rf /`",
      "line one\nline two",
      "tab\there",
      "x".repeat(MAX_REASON + 1),
      42,
      null,
    ];
    for (const reason of bad) rejects(with_({ reason }), "ai");
    expect(validateDecision(with_({ reason: "x".repeat(MAX_REASON) })).ok).toBe(true);
  });

  it("R8: prototype tricks do not get through", () => {
    const evil = JSON.parse('{"__proto__": {"polluted": true}}') as object;
    rejects({ ...BRIEF, ...evil, constructor: "x" });
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("the validated value is a fresh copy (the input is never aliased)", () => {
    const r = validateDecision(BRIEF);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.priorityActions).not.toBe(BRIEF.priorityActions);
  });
});

describe("validateDecision with the Intent Lane in every layout", () => {
  it("accepts a decision for every state; the lane is a section, never a decision field", async () => {
    const { EVOLUTION_CONFIG: C } = await import("../../config/evolution-config");
    const { EVOLUTION_STATES, SECTION_IDS } = await import("../../config/ids");
    const { actionsFor, UNIVERSAL_DECISION } = await import("../evolution/compose");
    expect(SECTION_IDS).toContain("INTENT_LANE");
    for (const state of EVOLUTION_STATES) {
      const mode = state === "EXPLORER" ? "EXPLORER" : "BALANCED";
      const r = validateDecision({
        ...UNIVERSAL_DECISION,
        primaryState: state,
        behaviourMode: mode,
        navigationMode: C.states[state].nav,
        homepageLayout: C.states[state].layout,
        priorityActions: actionsFor(state, 3),
      });
      expect(r.ok, state).toBe(true);
    }
    // a section id smuggled in as a layout or action is still rejected
    rejects(with_({ homepageLayout: "INTENT_LANE" }));
    rejects(with_({ priorityActions: ["INTENT_LANE"] }));
  });
});
