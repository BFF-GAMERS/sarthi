import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReturn,
  listKeyForPath,
  noteNavigation,
  notePop,
  readReturn,
  resetNavigationForTests,
  returnFor,
  returnIdOf,
  saveReturn,
} from "./list-return";

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const NOW = 1_700_000_000_000;
const entry = (over: Partial<Parameters<typeof saveReturn>[0]> = {}) => ({
  listKey: "jobs" as const,
  id: "welder-pune",
  scrollY: 1500,
  ts: NOW,
  href: "/jobs/welder-pune",
  ...over,
});

describe("list-return storage", () => {
  const store = memoryStore();
  beforeEach(() => {
    store.removeItem("swayam-list-return");
    resetNavigationForTests();
  });

  it("round-trips an entry and keeps the lists apart", () => {
    saveReturn(entry(), store);
    saveReturn(entry({ listKey: "courses", id: "c1", scrollY: 40 }), store);
    expect(readReturn("jobs", NOW, store)?.scrollY).toBe(1500);
    expect(readReturn("courses", NOW, store)?.id).toBe("c1");
    expect(readReturn("skills", NOW, store)).toBeNull();
    clearReturn("jobs", store);
    expect(readReturn("jobs", NOW, store)).toBeNull();
    expect(readReturn("courses", NOW, store)).not.toBeNull();
  });

  it("forgets an entry after half an hour, and survives bad storage", () => {
    saveReturn(entry(), store);
    expect(readReturn("jobs", NOW + 31 * 60_000, store)).toBeNull();
    store.setItem("swayam-list-return", "{not json");
    expect(readReturn("jobs", NOW, store)).toBeNull();
    expect(readReturn("jobs", NOW, null)).toBeNull();
    expect(() => saveReturn(entry(), null)).not.toThrow();
  });

  it("maps list paths, tolerating a trailing slash", () => {
    expect(listKeyForPath("/jobs")).toBe("jobs");
    expect(listKeyForPath("/courses/")).toBe("courses");
    expect(listKeyForPath("/internships")).toBe("internships");
    expect(listKeyForPath("/skills")).toBe("skills");
    expect(listKeyForPath("/jobs/welder-pune")).toBeNull();
    expect(listKeyForPath("/")).toBeNull();
    expect(listKeyForPath(undefined)).toBeNull();
  });
});

describe("is this a return?", () => {
  const store = memoryStore();
  beforeEach(() => {
    store.removeItem("swayam-list-return");
    resetNavigationForTests();
    saveReturn(entry(), store);
  });

  it("Back (a recent popstate) is a return", () => {
    noteNavigation("/jobs");
    noteNavigation("/jobs/welder-pune");
    notePop(NOW);
    noteNavigation("/jobs");
    expect(returnFor("jobs", NOW + 200, store)?.id).toBe("welder-pune");
  });

  it("a link from the card's own page is a return", () => {
    noteNavigation("/jobs/welder-pune");
    noteNavigation("/jobs");
    expect(returnFor("jobs", NOW + 5000, store)?.scrollY).toBe(1500);
  });

  it("a fresh visit from somewhere else is not, and the stale entry is dropped", () => {
    noteNavigation("/");
    noteNavigation("/jobs");
    expect(returnFor("jobs", NOW + 5000, store)).toBeNull();
    expect(readReturn("jobs", NOW, store)).toBeNull();
  });

  it("answers the same way for the whole navigation", () => {
    noteNavigation("/jobs/welder-pune");
    noteNavigation("/jobs");
    const first = returnFor("jobs", NOW + 5000, store);
    expect(first).not.toBeNull();
    expect(returnFor("jobs", NOW + 60_000, store)).toBe(first);
  });

  it("does not return to a different list", () => {
    noteNavigation("/jobs/welder-pune");
    noteNavigation("/courses");
    notePop(NOW);
    expect(returnFor("courses", NOW + 100, store)).toBeNull();
    expect(readReturn("jobs", NOW, store)).not.toBeNull();
  });
});

describe("returnIdOf", () => {
  const card = { getAttribute: (n: string) => (n === "data-return-id" ? "welder-pune" : null) };
  const link = {
    closest: (s: string) => (s === "[data-return-id]" ? card : null),
    getAttribute: (n: string) => (n === "href" ? "/jobs/welder-pune" : null),
  };
  const inside = { closest: (s: string) => (s === "a[href]" ? link : null) };

  it("finds the card of a clicked link", () => {
    expect(returnIdOf(inside)).toEqual({ id: "welder-pune", href: "/jobs/welder-pune" });
  });
  it("ignores clicks that are not on a link in a card", () => {
    expect(returnIdOf({ closest: () => null })).toBeNull();
    expect(returnIdOf(null)).toBeNull();
    expect(returnIdOf({})).toBeNull();
  });
});
