// persisted(): synchronous hydration, migrations, quarantine, read-before-write across two "tabs".
import { describe, expect, it } from "vitest";
import { createFakeWindow, FakeStorage } from "../platform/testing/fake-window";
import { createLocalAdapter, type WindowLike } from "../platform/storage/local";
import { createPersistedStore, refresh, runMigrations, silently, write } from "./persisted";
import { appendEvents, BEHAVIOUR_CAP, BEHAVIOUR_TTL_MS } from "./stores";
import type { BehaviourEvent } from "../types";

interface S {
  n: number;
  tag: string;
}
const KEY = "swayam.evo.test.x";
const Q = "swayam.evo.quarantine.test.x";
const isObj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);

function mk(
  ls: FakeStorage,
  over: { version?: number; migrations?: Record<number, (p: unknown) => unknown> } = {},
) {
  const adapter = createLocalAdapter(createFakeWindow(ls) as unknown as WindowLike);
  return createPersistedStore<S>({
    adapter,
    key: KEY,
    version: over.version ?? 1,
    initial: () => ({ n: 0, tag: "a" }),
    isValid: (x): x is Partial<S> =>
      isObj(x) && (x["n"] === undefined || typeof x["n"] === "number"),
    migrations: over.migrations ?? {},
  });
}

describe("hydration", () => {
  it("hydrates synchronously and never writes a fresh key", () => {
    const ls = new FakeStorage();
    ls.map.set(KEY, JSON.stringify({ state: { n: 7, tag: "b" }, version: 1 }));
    const s = mk(ls);
    expect(s.getState()).toEqual({ n: 7, tag: "b" });
    expect(s.persist.hasHydrated()).toBe(true);
    const fresh = new FakeStorage();
    mk(fresh);
    expect(fresh.map.size).toBe(0);
  });

  it("corrupt JSON gives defaults, hydrated, and the raw text kept in quarantine", () => {
    const ls = new FakeStorage();
    ls.map.set(KEY, '{"state":{"n":');
    const s = mk(ls);
    expect(s.persist.hasHydrated()).toBe(true);
    expect(s.getState()).toEqual({ n: 0, tag: "a" });
    expect(ls.map.get(Q)).toBe('{"state":{"n":');
  });

  it("a wrong shape gives defaults and is quarantined", () => {
    const ls = new FakeStorage();
    ls.map.set(KEY, JSON.stringify({ state: { n: "nope" }, version: 1 }));
    const s = mk(ls);
    expect(s.getState().n).toBe(0);
    expect(ls.map.get(Q)).toContain('"nope"');
  });
});

describe("migrations", () => {
  it("runs each step from the stored version to the current one", () => {
    const ls = new FakeStorage();
    ls.map.set(KEY, JSON.stringify({ state: { n: 3, tag: "a" }, version: 1 }));
    const s = mk(ls, {
      version: 3,
      migrations: {
        2: (p) => ({ ...(p as S), tag: "v2" }),
        3: (p) => ({ ...(p as S), n: (p as S).n + 10 }),
      },
    });
    expect(s.getState()).toEqual({ n: 13, tag: "v2" });
    // the migrated value is written back at the new version
    expect(JSON.parse(ls.map.get(KEY) ?? "{}").version).toBe(3);
  });

  it("a newer schema than this build knows is quarantined and defaults are used", () => {
    const ls = new FakeStorage();
    ls.map.set(KEY, JSON.stringify({ state: { n: 9, tag: "future" }, version: 5 }));
    const s = mk(ls, { version: 1 });
    expect(s.getState()).toEqual({ n: 0, tag: "a" });
    expect(JSON.parse(ls.map.get(Q) ?? "{}").version).toBe(5);
  });

  it("a missing migration step is quarantined, not fatal", () => {
    const ls = new FakeStorage();
    ls.map.set(KEY, JSON.stringify({ state: { n: 1, tag: "a" }, version: 1 }));
    const s = mk(ls, { version: 2, migrations: {} });
    expect(s.getState()).toEqual({ n: 0, tag: "a" });
    expect(ls.map.has(Q)).toBe(true);
  });

  it("runMigrations throws on a newer schema and on a gap", () => {
    expect(() => runMigrations({}, {}, 4, 2)).toThrow("newer-schema");
    expect(() => runMigrations({}, {}, 1, 2)).toThrow("missing v2");
    expect(runMigrations({ 2: (p) => ({ ...(p as object), ok: 1 }) }, {}, 1, 2)).toEqual({ ok: 1 });
  });
});

describe("write discipline", () => {
  it("read-before-write: two tabs never lose each other's writes", () => {
    const ls = new FakeStorage();
    const a = mk(ls);
    const b = mk(ls);
    write(a, () => ({ n: 1 }));
    write(b, (s) => ({ n: s.n + 1 })); // b rehydrates first, sees 1
    expect(b.getState().n).toBe(2);
    refresh(a);
    expect(a.getState().n).toBe(2);
  });

  it("a recipe that returns null writes nothing", () => {
    const ls = new FakeStorage();
    const s = mk(ls);
    const before = ls.writes;
    write(s, () => null);
    expect(ls.writes).toBe(before);
  });

  it("silently() applies state without persisting it", () => {
    const ls = new FakeStorage();
    const s = mk(ls);
    write(s, () => ({ n: 1 }));
    const raw = ls.map.get(KEY);
    silently(() => s.setState({ n: 99 }));
    expect(s.getState().n).toBe(99);
    expect(ls.map.get(KEY)).toBe(raw);
  });

  it("a write that fails to land does not make the tab believe storage holds it", () => {
    const ls = new FakeStorage();
    const s = mk(ls);
    write(s, () => ({ n: 1 }));
    ls.opts.quotaChars = 1;
    write(s, () => ({ n: 2 })); // cannot land
    expect(s.getState().n).toBe(2); // in-memory state stays valid
    expect(JSON.parse(ls.map.get(KEY) ?? "{}").state.n).toBe(1);
  });

  it("localStorage that throws never breaks a store", () => {
    const s = mk(new FakeStorage({ throwAll: true }));
    expect(() => write(s, () => ({ n: 4 }))).not.toThrow();
    expect(s.getState().n).toBe(4);
  });
});

describe("behaviour ring", () => {
  const ev = (seq: number, timestamp: number): BehaviourEvent => ({
    v: 1,
    seq,
    type: "page_viewed",
    timestamp,
    sessionId: "s",
    service: "PLATFORM",
    entityId: null,
    metadata: {},
  });

  it("keeps the newest 300", () => {
    const now = 1_800_000_000_000;
    const add = Array.from({ length: BEHAVIOUR_CAP + 5 }, (_, i) => ev(i + 1, now - 1000));
    const out = appendEvents([], add, now);
    expect(out).toHaveLength(BEHAVIOUR_CAP);
    expect(out[0]?.seq).toBe(6);
  });

  it("drops events older than 30 days", () => {
    const now = 1_800_000_000_000;
    const out = appendEvents(
      [ev(1, now - BEHAVIOUR_TTL_MS - 1), ev(2, now - 1000)],
      [ev(3, now)],
      now,
    );
    expect(out.map((e) => e.seq)).toEqual([2, 3]);
  });
});
