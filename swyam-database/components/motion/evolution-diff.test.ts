import { describe, expect, it } from "vitest";
import { diffStageKeys, pickGhosts, staggerDelays } from "./evolution-diff";
import { STAGGER } from "./tokens";

describe("diffStageKeys", () => {
  it("reports no change for the same order", () => {
    const d = diffStageKeys(["a", "b", "c"], ["a", "b", "c"]);
    expect(d.changed).toBe(false);
    expect(d.promoted).toEqual([]);
  });

  it("promotes the item that climbed, not the ones it passed", () => {
    const d = diffStageKeys(["a", "b", "c", "d"], ["d", "a", "b", "c"]);
    expect(d.changed).toBe(true);
    expect(d.promoted).toEqual(["d"]);
  });

  it("ranks climbers by how far they climbed and caps the list", () => {
    const d = diffStageKeys(["a", "b", "c", "d", "e"], ["d", "e", "a", "b", "c"], 2);
    expect(d.promoted).toEqual(["d", "e"]);
    const capped = diffStageKeys(["a", "b", "c", "d", "e"], ["d", "e", "a", "b", "c"], 1);
    expect(capped.promoted).toHaveLength(1);
  });

  it("does not treat a newcomer as pushing everyone else down", () => {
    const d = diffStageKeys(["a", "b"], ["n", "a", "b"]);
    expect(d.entered).toEqual(["n"]);
    expect(d.promoted).toEqual(["n"]);
  });

  it("does not treat a removal as promoting the items below it", () => {
    const d = diffStageKeys(["a", "b", "c"], ["b", "c"]);
    expect(d.left).toEqual(["a"]);
    expect(d.entered).toEqual([]);
    expect(d.promoted).toEqual([]);
    expect(d.changed).toBe(true);
  });

  it("can promote nothing", () => {
    expect(diffStageKeys(["a", "b"], ["b", "a"], 0).promoted).toEqual([]);
  });
});

describe("staggerDelays", () => {
  it("starts the promoted item first and caps the rest", () => {
    const keys = Array.from({ length: 30 }, (_, i) => `k${i}`);
    const delays = staggerDelays(keys, new Set(["k5"]));
    expect(delays.get("k5")).toBe(0);
    expect(delays.get("k0")).toBeCloseTo(STAGGER.lead);
    expect(Math.max(...delays.values())).toBeLessThanOrEqual(STAGGER.max);
  });
});

describe("pickGhosts", () => {
  it("returns nothing for the same order, and nothing for a pure insertion", () => {
    expect(pickGhosts(["a", "b", "c"], ["a", "b", "c"])).toEqual([]);
    expect(pickGhosts(["a", "b"], ["x", "a", "b"])).toEqual([]);
  });

  it("the biggest travellers first, capped, with the direction in the sign", () => {
    const picks = pickGhosts(["a", "b", "c", "d", "e"], ["e", "a", "b", "c", "d"], 3);
    expect(picks[0]).toEqual({ key: "e", delta: -4 });
    expect(picks.map((p) => p.key)).toEqual(["e", "a", "b"]);
    expect(picks[1]?.delta).toBe(1);
  });

  it("ignores items that left or arrived", () => {
    const picks = pickGhosts(["a", "b", "c"], ["c", "n", "a"]);
    expect(picks.map((p) => p.key).sort()).toEqual(["a", "c"]);
  });
});
