import { describe, expect, it } from "vitest";
import {
  CONSISTENT_WINDOWS,
  INITIAL_STATE,
  MIN_SAMPLES,
  SCALE_MAX,
  SCALE_MIN,
  classify,
  clampScale,
  derivePace,
} from "./profile";
import type { PaceSignals } from "./signals";

function sig(over: Partial<PaceSignals> = {}): PaceSignals {
  return {
    samples: 40,
    taps: 30,
    navs: 6,
    nearMisses: 0,
    repeatTaps: 0,
    backOuts: 0,
    medianGapMs: 2000,
    scrollVelocity: 1000,
    nearMissRate: 0,
    repeatTapRate: 0,
    backOutRate: 0,
    ...over,
  };
}
const fast = () => sig({ medianGapMs: 700, scrollVelocity: 2600 });
const slow = () => sig({ medianGapMs: 6000, scrollVelocity: 300 });

describe("clampScale", () => {
  it("keeps the scale within 0.8 and 1.25", () => {
    expect(clampScale(0.1)).toBe(SCALE_MIN);
    expect(clampScale(9)).toBe(SCALE_MAX);
    expect(clampScale(1.1)).toBe(1.1);
    expect(clampScale(Number.NaN)).toBe(1);
  });
  it("every profile the table can produce is inside the clamp", () => {
    for (const s of [fast(), slow(), sig()]) {
      let st = INITIAL_STATE;
      for (let i = 0; i < 4; i++) st = derivePace(s, st);
      expect(st.durationScale).toBeGreaterThanOrEqual(SCALE_MIN);
      expect(st.durationScale).toBeLessThanOrEqual(SCALE_MAX);
    }
  });
});

describe("no signal", () => {
  it("is balanced, scale 1, not steady", () => {
    const s = derivePace(sig({ samples: 0, medianGapMs: null, scrollVelocity: null }));
    expect(s.pace).toBe("balanced");
    expect(s.durationScale).toBe(1);
    expect(s.steady).toBe(false);
  });
  it("fewer than MIN_SAMPLES changes nothing, however extreme", () => {
    const s = derivePace(sig({ ...fast(), samples: MIN_SAMPLES - 1 }));
    expect(s).toBe(INITIAL_STATE);
  });
  it("missing readings classify as balanced", () => {
    expect(classify(sig({ medianGapMs: null, scrollVelocity: null })).pace).toBe("balanced");
  });
});

describe("classify", () => {
  it("quick taps and fast scrolling are snappy, slow ones calm", () => {
    expect(classify(fast()).pace).toBe("snappy");
    expect(classify(slow()).pace).toBe("calm");
  });
  it("opposite signals cancel to balanced", () => {
    expect(classify(sig({ medianGapMs: 600, scrollVelocity: 200 })).pace).toBe("balanced");
  });
  it("missing taps or doubled taps mean steady", () => {
    expect(classify(sig({ nearMissRate: 0.2 })).steady).toBe(true);
    expect(classify(sig({ repeatTapRate: 0.2 })).steady).toBe(true);
    expect(classify(sig({ nearMissRate: 0.02 })).steady).toBe(false);
  });
  it("a steady reading is never snappy", () => {
    expect(classify({ ...fast(), nearMissRate: 0.3 }).pace).toBe("balanced");
  });
  it("needs a few taps before it will say steady", () => {
    expect(classify(sig({ taps: 5, nearMissRate: 0.5 })).steady).toBe(false);
  });
});

describe("hysteresis", () => {
  it("one window is not enough to change pace", () => {
    const s = derivePace(fast(), INITIAL_STATE);
    expect(s.pace).toBe("balanced");
    expect(s.pending).toBe("snappy");
    expect(s.pendingStreak).toBe(1);
  });
  it(`changes after ${CONSISTENT_WINDOWS} consistent windows`, () => {
    let s = derivePace(fast(), INITIAL_STATE);
    s = derivePace(fast(), s);
    expect(s.pace).toBe("snappy");
    expect(s.durationScale).toBeLessThan(1);
    expect(s.pending).toBeNull();
  });
  it("an interrupted run starts again", () => {
    let s = derivePace(fast(), INITIAL_STATE);
    s = derivePace(sig(), s); // balanced again
    expect(s.pending).toBeNull();
    s = derivePace(fast(), s);
    expect(s.pace).toBe("balanced");
    s = derivePace(slow(), s); // a different candidate resets the streak
    expect(s.pending).toBe("calm");
    expect(s.pendingStreak).toBe(1);
  });
  it("calm is slower and softer than balanced, snappy quicker", () => {
    let calm = INITIAL_STATE;
    let snappy = INITIAL_STATE;
    for (let i = 0; i < 2; i++) {
      calm = derivePace(slow(), calm);
      snappy = derivePace(fast(), snappy);
    }
    expect(calm.durationScale).toBeGreaterThan(1);
    expect(calm.scrollLerp).toBeLessThan(INITIAL_STATE.scrollLerp);
    expect(snappy.durationScale).toBeLessThan(1);
    expect(snappy.scrollLerp).toBeGreaterThan(INITIAL_STATE.scrollLerp);
  });
  it("steady flips on and off only after two consistent windows each", () => {
    const missing = sig({ nearMissRate: 0.25 });
    let s = derivePace(missing, INITIAL_STATE);
    expect(s.steady).toBe(false);
    s = derivePace(missing, s);
    expect(s.steady).toBe(true);
    s = derivePace(sig(), s);
    expect(s.steady).toBe(true);
    s = derivePace(sig(), s);
    expect(s.steady).toBe(false);
  });
});
