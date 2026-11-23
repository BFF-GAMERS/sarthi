import { describe, expect, it } from "vitest";
import { INITIAL_STATE } from "./profile";
import {
  DECAY_MS,
  PACE_KEY,
  defaultData,
  loadFrom,
  parseData,
  saveTo,
  serializeData,
  type StorageLike,
} from "./store";

function fakeStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const NOW = 1_700_000_000_000;

describe("pace store", () => {
  it("round-trips settings, counts and the profile", () => {
    const d = {
      ...defaultData(NOW),
      enabled: false,
      steadyMode: "on" as const,
      counts: { taps: 12, scrolls: 3, navs: 2, nearMisses: 1, repeatTaps: 0, backOuts: 1 },
      state: { ...INITIAL_STATE, pace: "calm" as const, durationScale: 1.2, steady: true },
    };
    const st = fakeStorage();
    expect(saveTo(st, d)).toBe(true);
    const back = loadFrom(st, NOW + 1000);
    expect(back.enabled).toBe(false);
    expect(back.steadyMode).toBe("on");
    expect(back.counts).toEqual(d.counts);
    expect(back.state.pace).toBe("calm");
    expect(back.state.durationScale).toBe(1.2);
    expect(back.state.steady).toBe(true);
  });
  it("stores only settings, counts and the profile, nothing else", () => {
    const keys = Object.keys(JSON.parse(serializeData(defaultData(NOW)))).sort();
    expect(keys).toEqual(["counts", "enabled", "state", "steadyMode", "updatedAt", "v"]);
  });
  it("drops learned data after 30 days but keeps the person's switches", () => {
    const d = {
      ...defaultData(NOW),
      enabled: false,
      steadyMode: "off" as const,
      counts: { taps: 99, scrolls: 9, navs: 9, nearMisses: 9, repeatTaps: 9, backOuts: 9 },
      state: { ...INITIAL_STATE, pace: "snappy" as const, durationScale: 0.85 },
    };
    const raw = serializeData(d);
    const fresh = parseData(raw, NOW + DECAY_MS - 1000);
    expect(fresh.counts.taps).toBe(99);
    expect(fresh.state.pace).toBe("snappy");
    const stale = parseData(raw, NOW + DECAY_MS + 1000);
    expect(stale.counts.taps).toBe(0);
    expect(stale.state.pace).toBe("balanced");
    expect(stale.state.durationScale).toBe(1);
    expect(stale.enabled).toBe(false);
    expect(stale.steadyMode).toBe("off");
  });
  it("falls back to defaults on garbage and clamps a tampered scale", () => {
    expect(parseData("not json", NOW)).toEqual(defaultData(NOW));
    expect(parseData(JSON.stringify({ v: 2 }), NOW)).toEqual(defaultData(NOW));
    const tampered = JSON.stringify({
      v: 1,
      enabled: true,
      steadyMode: "weird",
      counts: { taps: -5 },
      state: { pace: "hyper", durationScale: 50 },
      updatedAt: NOW,
    });
    const d = parseData(tampered, NOW);
    expect(d.steadyMode).toBe("auto");
    expect(d.counts.taps).toBe(0);
    expect(d.state.pace).toBe("balanced");
    expect(d.state.durationScale).toBe(1.25);
  });
  it("survives storage that throws", () => {
    const bad: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {},
    };
    expect(loadFrom(bad, NOW)).toEqual(defaultData(NOW));
    expect(saveTo(bad, defaultData(NOW))).toBe(false);
    expect(loadFrom(null, NOW)).toEqual(defaultData(NOW));
  });
  it("uses the documented key", () => {
    expect(PACE_KEY).toBe("swayam.pace.v1");
  });
});
