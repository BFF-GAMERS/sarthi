import { describe, expect, it } from "vitest";
import { EVENT_TYPES } from "../../config/ids";
import { UNIVERSAL_DECISION } from "../evolution/compose";
import { mergeAdvice } from "./merge";
import { MAX_NAV_PATTERN, hashSummary, round05, summarize, summaryKey } from "./summarize";
import { decide, engineWith, ev } from "./testing";

const sent = { epoch: 0, meaningful: 20 };

const careerEngine = (over: Parameters<typeof engineWith>[0] = {}) =>
  engineWith({
    meaningful: 20,
    scores: { careerAffinity: 0.6, learningAffinity: 0.1, explorer: 0.1 },
    decision: { ...UNIVERSAL_DECISION, confidence: 0.4 },
    ...over,
  });

describe("mergeAdvice", () => {
  it("passes only the primary state and mode, with confidence capped at local + 0.15", () => {
    const out = mergeAdvice({
      decision: decide("CAREER_FIRST", "RESEARCH", 0.95),
      engine: careerEngine(),
      sent,
      locked: false,
    });
    expect(out.kind).toBe("advice");
    if (out.kind !== "advice") return;
    expect(out.advice.primaryState).toBe("CAREER_FIRST");
    expect(out.advice.behaviourMode).toBe("RESEARCH");
    expect(out.advice.confidence).toBeCloseTo(0.55, 5);
    // No tier, navigation, layout or actions can ride along: the tier is the engine's own.
    expect(Object.keys(out.advice).sort()).toEqual(
      ["aiReason", "behaviourMode", "confidence", "epoch", "meaningfulAt", "primaryState"].sort(),
    );
  });

  it("keeps the AI's own confidence when it is lower than the cap", () => {
    const out = mergeAdvice({
      decision: decide("CAREER_FIRST", "RESEARCH", 0.3),
      engine: careerEngine(),
      sent,
      locked: false,
    });
    expect(out.kind === "advice" && out.advice.confidence).toBe(0.3);
  });

  it("rejects a state without 0.25 of matching evidence", () => {
    const out = mergeAdvice({
      decision: decide("LEARNING_FIRST", "RESEARCH", 0.9),
      engine: careerEngine(),
      sent,
      locked: false,
    });
    expect(out).toEqual({ kind: "rejected", reason: "evidence_floor" });
  });

  it("does not require evidence to return to UNIVERSAL", () => {
    const out = mergeAdvice({
      decision: decide("UNIVERSAL", "QUICK", 0.6),
      engine: careerEngine({ decision: decide("CAREER_FIRST", "RESEARCH", 0.7) }),
      sent,
      locked: false,
    });
    expect(out.kind).toBe("advice");
  });

  it("cannot bypass the lock", () => {
    const out = mergeAdvice({
      decision: decide("CAREER_FIRST", "RESEARCH", 0.9),
      engine: careerEngine(),
      sent,
      locked: true,
    });
    expect(out).toEqual({ kind: "rejected", reason: "locked" });
  });

  it("drops advice from another epoch", () => {
    const out = mergeAdvice({
      decision: decide("CAREER_FIRST", "RESEARCH", 0.9),
      engine: careerEngine({ epoch: 1 }),
      sent,
      locked: false,
    });
    expect(out).toEqual({ kind: "rejected", reason: "wrong_epoch" });
  });

  it("drops advice older than 15 meaningful events, keeps advice exactly at 15", () => {
    const decision = decide("CAREER_FIRST", "RESEARCH", 0.9);
    expect(
      mergeAdvice({ decision, engine: careerEngine({ meaningful: 36 }), sent, locked: false }),
    ).toEqual({ kind: "rejected", reason: "stale" });
    expect(
      mergeAdvice({ decision, engine: careerEngine({ meaningful: 35 }), sent, locked: false }).kind,
    ).toBe("advice");
  });

  it("reports an answer that matches the local decision as the same", () => {
    const out = mergeAdvice({
      decision: decide("CAREER_FIRST", "RESEARCH", 0.9),
      engine: careerEngine({ decision: decide("CAREER_FIRST", "RESEARCH", 0.7) }),
      sent,
      locked: false,
    });
    expect(out).toEqual({ kind: "rejected", reason: "same" });
  });

  it("re-validates: an invalid decision is rejected, never coerced", () => {
    const bad = { ...decide("CAREER_FIRST"), navigationMode: "LEARNING_PRIORITY" };
    expect(mergeAdvice({ decision: bad, engine: careerEngine(), sent, locked: false })).toEqual({
      kind: "rejected",
      reason: "invalid",
    });
    expect(
      mergeAdvice({ decision: { x: 1 }, engine: careerEngine(), sent, locked: false }).kind,
    ).toBe("rejected");
  });

  it("returns the sanitised reason for the Lab only (the user-facing text is never the AI's)", () => {
    const out = mergeAdvice({
      decision: decide("CAREER_FIRST", "RESEARCH", 0.9, "  Jobs   dominate. "),
      engine: careerEngine(),
      sent,
      locked: false,
    });
    expect(out.kind === "advice" && out.advice.aiReason).toBe("Jobs dominate.");
  });
});

describe("summarize", () => {
  it("rounds scores to 0.05 and reports caps, never ids or text", () => {
    const counts = Object.fromEntries(EVENT_TYPES.map((t, i) => [t, 40 - i]));
    const engine = engineWith({
      meaningful: 99,
      scores: { careerAffinity: 0.6234, learningAffinity: 0.0249 },
      countsByType: counts,
      decision: decide("CAREER_FIRST", "RESEARCH", 0.7234),
    });
    const events = [
      ...Array.from({ length: 14 }, () =>
        ev("navigation_item_clicked", { metadata: { item: "JOBS" } }),
      ),
      ev("navigation_item_clicked", { metadata: { item: "<script>" } as never }),
      ...Array.from({ length: 6 }, () => ev("job_viewed", { entityId: "opp_secret-id" })),
    ];
    const r = summarize(engine, events, "threshold");

    expect(r.scores.careerAffinity).toBe(0.6);
    expect(r.scores.learningAffinity).toBe(0);
    expect(r.current.confidence).toBe(0.7);
    expect(r.topActions).toHaveLength(8);
    expect(r.repeated.length).toBeLessThanOrEqual(5);
    expect(r.repeated[0]).toEqual({ type: "navigation_item_clicked", count: 15 });
    expect(r.navPattern).toHaveLength(MAX_NAV_PATTERN);
    expect(r.navPattern.every((n) => n === "JOBS")).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/opp_secret|script|entityId/);
    expect(Object.keys(r).sort()).toEqual(
      [
        "current",
        "deterministic",
        "navPattern",
        "repeated",
        "scores",
        "session",
        "topActions",
        "trigger",
        "v",
      ].sort(),
    );
  });

  it("round05 is idempotent and clamps", () => {
    expect(round05(0.62)).toBe(0.6);
    expect(round05(round05(0.62))).toBe(0.6);
    expect(round05(1.4)).toBe(1);
    expect(round05(Number.NaN)).toBe(0);
  });

  it("gives equal hashes for near-identical summaries and different ones for different evidence", () => {
    const a = engineWith({
      meaningful: 20,
      scores: { careerAffinity: 0.61 },
      countsByType: { job_viewed: 5 },
    });
    const b = engineWith({
      meaningful: 20,
      scores: { careerAffinity: 0.62 },
      countsByType: { job_viewed: 5 },
    });
    const c = engineWith({
      meaningful: 20,
      scores: { careerAffinity: 0.8 },
      countsByType: { job_viewed: 5 },
    });
    const ra = summarize(a, [], "threshold");
    expect(hashSummary(ra)).toBe(hashSummary(summarize(b, [], "lab")));
    expect(hashSummary(ra)).not.toBe(hashSummary(summarize(c, [], "threshold")));
    expect(summaryKey(ra)).toBe(summaryKey(summarize(b, [], "session_end")));
  });
});
