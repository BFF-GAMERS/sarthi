// The storage seam: a throwing localStorage degrades to memory and never throws, quota compaction, storage events.
import { describe, expect, it, vi } from "vitest";
import { createFakeWindow, FakeStorage } from "../testing/fake-window";
import { createLocalAdapter, isQuotaError, type WindowLike } from "./local";
import { createMemoryAdapter } from "./memory";
import { createNullAdapter } from "./null";
import { quarantineKeyOf, safeJSONStorage } from "./safe-json-storage";

const win = (ls: FakeStorage) => createFakeWindow(ls) as unknown as WindowLike;

describe("local adapter", () => {
  it("works on a healthy localStorage", () => {
    const ls = new FakeStorage();
    const a = createLocalAdapter(win(ls));
    expect(a.kind).toBe("local");
    expect(a.durable).toBe(true);
    a.setItem("swayam.evo.guest.prefs", "x");
    expect(a.getItem("swayam.evo.guest.prefs")).toBe("x");
    expect(a.keys("swayam.evo.guest.")).toEqual(["swayam.evo.guest.prefs"]);
    a.removeItem("swayam.evo.guest.prefs");
    expect(a.getItem("swayam.evo.guest.prefs")).toBeNull();
  });

  it("localStorage that throws on every call falls back to memory and never throws", () => {
    const a = createLocalAdapter(win(new FakeStorage({ throwAll: true })));
    expect(a.kind).toBe("memory");
    expect(a.durable).toBe(false);
    expect(() => a.setItem("swayam.evo.k", "v")).not.toThrow();
    expect(a.getItem("swayam.evo.k")).toBe("v");
  });

  it("a failing probe write (Safari private mode) also falls back to memory", () => {
    expect(createLocalAdapter(win(new FakeStorage({ throwOnSet: true }))).kind).toBe("memory");
  });

  it("no window at all gives memory", () => {
    expect(createLocalAdapter(undefined).kind).toBe("memory");
  });

  it("a read or write that throws AFTER the probe is swallowed", () => {
    const ls = new FakeStorage();
    const a = createLocalAdapter(win(ls));
    ls.opts.throwAll = true;
    expect(a.getItem("swayam.evo.k")).toBeNull();
    expect(() => a.setItem("swayam.evo.k", "v")).not.toThrow();
    expect(() => a.removeItem("swayam.evo.k")).not.toThrow();
    expect(a.keys("swayam.evo.")).toEqual([]);
  });

  it("quota: the compaction hook runs once, then the write is retried", () => {
    const ls = new FakeStorage({ quotaChars: 30 });
    const onQuota = vi.fn(() => {
      ls.map.delete("swayam.evo.guest.behaviour");
    });
    const a = createLocalAdapter(win(ls), { onQuota });
    ls.map.set("swayam.evo.guest.behaviour", "x".repeat(25));
    a.setItem("swayam.evo.guest.engine", "y".repeat(20));
    expect(onQuota).toHaveBeenCalledTimes(1);
    expect(ls.map.get("swayam.evo.guest.engine")).toBe("y".repeat(20));
  });

  it("quota: a hook that rewrote the failed key is not overwritten by the stale value", () => {
    const ls = new FakeStorage({ quotaChars: 30 });
    const a: ReturnType<typeof createLocalAdapter> = createLocalAdapter(win(ls), {
      onQuota: (key) => {
        a.setItem(key, "small");
      },
    });
    a.setItem("swayam.evo.guest.behaviour", "z".repeat(50));
    expect(ls.map.get("swayam.evo.guest.behaviour")).toBe("small");
  });

  it("quota that never clears is swallowed", () => {
    const ls = new FakeStorage({ quotaChars: 5 });
    const a = createLocalAdapter(win(ls), { onQuota: () => {} });
    expect(() => a.setItem("swayam.evo.k", "long value")).not.toThrow();
  });

  it("recognises quota errors across browsers", () => {
    expect(isQuotaError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(isQuotaError(new Error("nope"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });

  it("storage events: only swayam.evo.* keys reach the listener; null means cleared", () => {
    const ls = new FakeStorage();
    const w = createFakeWindow(ls);
    const a = createLocalAdapter(w as unknown as WindowLike);
    const seen: Array<string | null> = [];
    const off = a.subscribe!((k) => seen.push(k));
    w.dispatch("storage", { key: "swayam.evo.guest.prefs", storageArea: ls });
    w.dispatch("storage", { key: "swayam-preferences", storageArea: ls });
    w.dispatch("storage", { key: null, storageArea: ls });
    w.dispatch("storage", { key: "swayam.evo.guest.engine", storageArea: new FakeStorage() });
    expect(seen).toEqual(["swayam.evo.guest.prefs", null]);
    off();
    expect(w.listenerCount("storage")).toBe(0);
  });
});

describe("memory and null adapters", () => {
  it("memory holds values and lists by prefix", () => {
    const m = createMemoryAdapter();
    m.setItem("swayam.evo.a", "1");
    m.setItem("other", "2");
    expect(m.keys("swayam.evo.")).toEqual(["swayam.evo.a"]);
    expect(m.durable).toBe(false);
  });

  it("null reads nothing and writes nothing", () => {
    const n = createNullAdapter();
    n.setItem("swayam.evo.a", "1");
    expect(n.getItem("swayam.evo.a")).toBeNull();
    expect(n.keys("")).toEqual([]);
  });
});

describe("safeJSONStorage", () => {
  it("quarantines non-JSON and non-envelope payloads and returns null", () => {
    const m = createMemoryAdapter();
    const s = safeJSONStorage<{ a: number }>(m);
    m.setItem("swayam.evo.guest.engine", "{broken");
    expect(s.getItem("swayam.evo.guest.engine")).toBeNull();
    expect(m.getItem(quarantineKeyOf("swayam.evo.guest.engine"))).toBe("{broken");
    m.setItem("swayam.evo.guest.prefs", JSON.stringify({ no: "version" }));
    expect(s.getItem("swayam.evo.guest.prefs")).toBeNull();
    expect(m.getItem("swayam.evo.quarantine.guest.prefs")).toBe('{"no":"version"}');
  });

  it("round-trips an envelope", () => {
    const m = createMemoryAdapter();
    const s = safeJSONStorage<{ a: number }>(m);
    s.setItem("swayam.evo.k", { state: { a: 1 }, version: 1 });
    expect(s.getItem("swayam.evo.k")).toEqual({ state: { a: 1 }, version: 1 });
  });
});
