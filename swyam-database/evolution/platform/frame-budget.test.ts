import { describe, expect, it } from "vitest";
import {
  FRAME_MS,
  FX_BOOTSTRAP_SCRIPT,
  FX_PREF_KEY,
  FX_TIER_KEY,
  dropRatio,
  maxTier,
  resolveTier,
  tierFromFrames,
  tierFromSignals,
  type FxSignals,
  type FxTier,
} from "./frame-budget";

/** Runs the inline pre-paint script against fake globals and returns the stamped tier. */
function stamp(
  signals: FxSignals,
  store: Record<string, string> = {},
  opts: { throwStorage?: boolean } = {},
): string | null {
  const attrs = new Map<string, string>();
  const document = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
  const navigator = {
    deviceMemory: signals.deviceMemory,
    hardwareConcurrency: signals.hardwareConcurrency,
    connection:
      signals.saveData !== undefined || signals.effectiveType !== undefined
        ? { saveData: signals.saveData, effectiveType: signals.effectiveType }
        : undefined,
  };
  const localStorage = {
    getItem: (k: string) => {
      if (opts.throwStorage) throw new Error("blocked");
      return store[k] ?? null;
    },
  };
  new Function("document", "navigator", "localStorage", FX_BOOTSTRAP_SCRIPT)(
    document,
    navigator,
    localStorage,
  );
  return attrs.get("data-fx") ?? null;
}

const TABLE: Array<[string, FxSignals, FxTier]> = [
  ["a desktop", { deviceMemory: 8, hardwareConcurrency: 12, effectiveType: "4g" }, "full"],
  ["a flagship phone", { deviceMemory: 8, hardwareConcurrency: 8, effectiveType: "4g" }, "full"],
  ["nothing reported (Safari, Firefox)", {}, "full"],
  ["a mid phone", { deviceMemory: 4, hardwareConcurrency: 8, effectiveType: "4g" }, "full"],
  ["a small laptop", { deviceMemory: 4, hardwareConcurrency: 4 }, "lite"],
  ["save-data on", { deviceMemory: 8, hardwareConcurrency: 8, saveData: true }, "lite"],
  ["3g", { deviceMemory: 8, hardwareConcurrency: 8, effectiveType: "3g" }, "lite"],
  ["2 GB phone", { deviceMemory: 2, hardwareConcurrency: 8 }, "lite"],
  ["two cores", { deviceMemory: 8, hardwareConcurrency: 2 }, "lite"],
  ["2g", { deviceMemory: 8, hardwareConcurrency: 8, effectiveType: "2g" }, "static"],
  ["slow-2g", { effectiveType: "slow-2g" }, "static"],
  ["1 GB", { deviceMemory: 1, hardwareConcurrency: 8 }, "static"],
  ["0.5 GB", { deviceMemory: 0.5 }, "static"],
  ["2 GB and two cores", { deviceMemory: 2, hardwareConcurrency: 2 }, "static"],
];

describe("tierFromSignals", () => {
  for (const [name, signals, tier] of TABLE) {
    it(`${name} -> ${tier}`, () => {
      expect(tierFromSignals(signals)).toBe(tier);
    });
  }
});

describe("the pre-paint script", () => {
  for (const [name, signals, tier] of TABLE) {
    it(`stamps the same tier as the module for ${name}`, () => {
      expect(stamp(signals)).toBe(tier);
    });
  }

  it("always stamps something, even with storage blocked", () => {
    expect(stamp({ deviceMemory: 1 }, {}, { throwStorage: true })).toBe("static");
    expect(stamp({}, {}, { throwStorage: true })).toBe("full");
  });

  it("the member's Full effects beats every signal and the saved measurement", () => {
    expect(
      stamp(
        { deviceMemory: 1, saveData: true },
        { [FX_PREF_KEY]: "full", [FX_TIER_KEY]: "static" },
      ),
    ).toBe("full");
  });

  it("a saved measured tier only ever sheds more, never less", () => {
    expect(stamp({ deviceMemory: 8, hardwareConcurrency: 8 }, { [FX_TIER_KEY]: "lite" })).toBe(
      "lite",
    );
    expect(stamp({ deviceMemory: 8, hardwareConcurrency: 8 }, { [FX_TIER_KEY]: "static" })).toBe(
      "static",
    );
    expect(stamp({ deviceMemory: 1 }, { [FX_TIER_KEY]: "lite" })).toBe("static");
    expect(stamp({ saveData: true }, { [FX_TIER_KEY]: "full" })).toBe("lite");
    expect(stamp({}, { [FX_TIER_KEY]: "nonsense" })).toBe("full");
  });

  it("is plain ES5 with no template holes left over", () => {
    expect(FX_BOOTSTRAP_SCRIPT).not.toMatch(/\$\{|=>|\blet\b|\bconst\b/);
  });
});

describe("resolveTier", () => {
  it("is full with no signals", () => {
    expect(resolveTier({ pref: "auto", saved: null, signals: {} })).toEqual({
      tier: "full",
      reason: "default",
    });
  });
  it("takes the worse of signals and the saved measurement, and says which", () => {
    expect(resolveTier({ pref: "auto", saved: "lite", signals: {} })).toEqual({
      tier: "lite",
      reason: "saved",
    });
    expect(resolveTier({ pref: "auto", saved: "lite", signals: { deviceMemory: 1 } })).toEqual({
      tier: "static",
      reason: "signals",
    });
  });
  it("pref=full wins", () => {
    expect(resolveTier({ pref: "full", saved: "static", signals: { deviceMemory: 1 } })).toEqual({
      tier: "full",
      reason: "pref",
    });
  });
  it("maxTier orders full < lite < static", () => {
    expect(maxTier("full", "lite")).toBe("lite");
    expect(maxTier("static", "lite")).toBe("static");
    expect(maxTier("full", "full")).toBe("full");
  });
});

/** n frames at a steady gap, optionally with some long gaps. */
function frames(n: number, gap = FRAME_MS, longEvery = 0, longGap = 100): number[] {
  const out: number[] = [];
  let t = 1000;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += longEvery && i % longEvery === longEvery - 1 ? longGap : gap;
  }
  return out;
}

describe("dropRatio", () => {
  it("is 0 for a steady 60 Hz, 120 Hz or 30 Hz-vsync'd page", () => {
    expect(dropRatio(frames(180))).toBe(0);
    expect(dropRatio(frames(360, 1000 / 120))).toBe(0);
  });
  it("tolerates ordinary rAF jitter", () => {
    const jittery = frames(180).map((t, i) => t + (i % 2 ? 1.5 : -1.5));
    expect(dropRatio(jittery)).toBe(0);
  });
  it("is 0 when there are too few frames to judge", () => {
    expect(dropRatio(frames(10, 200))).toBe(0);
  });
  it("counts the frames inside long gaps", () => {
    // 100 ms gaps every 5th frame: 5 missed refreshes each.
    const r = dropRatio(frames(100, FRAME_MS, 5, 100));
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.7);
  });
  it("a steady 20 fps page drops about two frames in three", () => {
    expect(dropRatio(frames(60, 50))).toBeGreaterThan(0.6);
  });
});

describe("tierFromFrames", () => {
  it("leaves a smooth page alone", () => {
    expect(tierFromFrames(0.05, "full")).toBe("full");
    expect(tierFromFrames(0.24, "lite")).toBe("lite");
  });
  it("sheds one rung on moderate jank", () => {
    expect(tierFromFrames(0.3, "full")).toBe("lite");
    expect(tierFromFrames(0.3, "lite")).toBe("lite");
  });
  it("goes static on heavy jank, from either rung", () => {
    expect(tierFromFrames(0.5, "full")).toBe("static");
    expect(tierFromFrames(0.5, "lite")).toBe("static");
  });
  it("never promotes", () => {
    expect(tierFromFrames(0, "static")).toBe("static");
    expect(tierFromFrames(0.3, "static")).toBe("static");
  });
});
