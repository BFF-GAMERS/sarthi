import { describe, expect, it } from "vitest";
import { computeEffective } from "./apply";
import { NEUTRAL } from "./effective";
import { INITIAL_STATE, type PaceState } from "./profile";
import { defaultData, type PaceData } from "./store";
import { SPRING_PARAMS, fade, scaledSpring } from "../../components/motion/tokens";

const learned = (over: Partial<PaceData> = {}, state: Partial<PaceState> = {}): PaceData => ({
  ...defaultData(0),
  state: {
    ...INITIAL_STATE,
    pace: "calm",
    durationScale: 1.2,
    scrollLerp: 0.08,
    wheelMultiplier: 0.85,
    ...state,
  },
  ...over,
});
const base = { adaptiveOff: false, reduced: false };

describe("computeEffective", () => {
  it("applies the learned pace when everything is on", () => {
    const e = computeEffective({ ...base, data: learned() });
    expect(e.pace).toBe("calm");
    expect(e.scale).toBe(1.2);
    expect(e.lerp).toBe(0.08);
  });
  it("is the neutral default when pace matching is off", () => {
    expect(computeEffective({ ...base, data: learned({ enabled: false }) })).toBe(NEUTRAL);
  });
  it("is neutral when Swayam's adaptation is off", () => {
    expect(computeEffective({ data: learned(), adaptiveOff: true, reduced: false })).toBe(NEUTRAL);
  });
  it("is neutral under reduced motion: scale 1 and no guard", () => {
    const e = computeEffective({
      data: learned({}, { steady: true }),
      adaptiveOff: false,
      reduced: true,
    });
    expect(e.scale).toBe(1);
    expect(e.guard).toBe(false);
    expect(e.steady).toBe(false);
  });
  it("auto steady follows what was learned", () => {
    expect(computeEffective({ ...base, data: learned({}, { steady: true }) }).guard).toBe(true);
    expect(computeEffective({ ...base, data: learned({}, { steady: false }) }).guard).toBe(false);
  });
  it("steady off wins over what was learned", () => {
    const data = learned({ steadyMode: "off" }, { steady: true });
    expect(computeEffective({ ...base, data }).steady).toBe(false);
  });
  it("steady on is the person's own choice and holds even with adaptation off or reduced motion", () => {
    const data = learned({ steadyMode: "on" });
    for (const input of [
      { data, adaptiveOff: true, reduced: false },
      { data, adaptiveOff: false, reduced: true },
    ]) {
      const e = computeEffective(input);
      expect(e.steady).toBe(true);
      expect(e.guard).toBe(true);
      expect(e.scale).toBe(1);
      expect(e.pace).toBe("off");
    }
  });
});

describe("motion tokens", () => {
  it("fade() is unchanged by default", () => {
    expect(fade(0.25).duration).toBe(0.25);
  });
  it("a scaled spring keeps its damping ratio, so it still does not overshoot", () => {
    const ratio = (k: number, c: number, m: number) => c / (2 * Math.sqrt(k * m));
    const p = SPRING_PARAMS.standard;
    const t = scaledSpring("standard", 1.25) as {
      stiffness: number;
      damping: number;
      mass: number;
    };
    expect(ratio(t.stiffness, t.damping, t.mass)).toBeCloseTo(
      ratio(p.stiffness, p.damping, p.mass),
      10,
    );
    // Slower: the natural frequency drops by the scale.
    expect(Math.sqrt(t.stiffness / t.mass)).toBeCloseTo(Math.sqrt(p.stiffness / p.mass) / 1.25, 10);
  });
  it("scale 1 returns the token itself", () => {
    expect(scaledSpring("micro", 1)).toEqual({ type: "spring", ...SPRING_PARAMS.micro });
  });
});
