// The real runtime on the node environment: fake storage, injected clock and session, no timers, no network.
// Written to hold with the stub engine AND the real one: nothing here depends on a particular decision.
import { afterEach, describe, expect, it } from "vitest";
import { actionsFor } from "../core/evolution/compose";
import { createEngine } from "../core/evolution/engine";
import { createLocalAdapter, type WindowLike } from "../platform/storage/local";
import { keyOf, SESSION_KEY } from "../platform/storage/keys";
import { createFakeWindow, FakeStorage } from "../platform/testing/fake-window";
import { noticeBus } from "./notice";
import { scopeFor, SESSION_GAP_MS, type SessionMarker, type SessionPort } from "./scope";
import { createEvolutionRuntime, type EvolutionRuntimeHandle } from "./runtime";
import type { TrackInput } from "../types";

const T0 = 1_800_000_000_000;
const OTHER_KEYS: Record<string, string> = {
  "swayam-preferences": '{"interfaceMode":"millennial","reducedMotion":true}',
  "swayam-recent-searches": '["python","data analyst"]',
  "swayam-storage-notice": "seen",
  "swayam.cart": '{"lines":[1,2,3]}',
};

const job = (n: number): TrackInput => ({
  type: "job_viewed",
  entityId: `opp_${n}`,
  metadata: { source: "native" },
});

class Port implements SessionPort {
  m: SessionMarker | null = null;
  read = () => this.m;
  write = (m: SessionMarker) => {
    this.m = m;
  };
}

interface Rig {
  rt: EvolutionRuntimeHandle;
  ls: FakeStorage;
  win: ReturnType<typeof createFakeWindow>;
  clock: { t: number };
  session: Port;
}

const rigs: EvolutionRuntimeHandle[] = [];
afterEach(() => {
  for (const r of rigs.splice(0)) r.dispose();
  noticeBus.set(null);
});

function rig(o: { ls?: FakeStorage; session?: Port; clock?: { t: number } } = {}): Rig {
  const ls = o.ls ?? new FakeStorage();
  const win = createFakeWindow(ls);
  const clock = o.clock ?? { t: T0 };
  const session = o.session ?? new Port();
  const rt = createEvolutionRuntime({
    adapter: createLocalAdapter(win as unknown as WindowLike),
    session,
    now: () => clock.t,
    sync: null,
    presenterPorts: { prefersInstant: () => true },
    coordinatorPorts: { every: () => () => {}, later: () => () => {} },
  });
  rigs.push(rt);
  return { rt, ls, win, clock, session };
}

const guest = { profileId: null, isMinor: false, stableNav: false } as const;
const member = (id = "member-1") => ({ profileId: id, isMinor: false, stableNav: false });

const evoKeys = (ls: FakeStorage) => [...ls.map.keys()].filter((k) => k.startsWith("swayam.evo."));
const otherSnapshot = (ls: FakeStorage) =>
  JSON.stringify([...ls.map.entries()].filter(([k]) => !k.startsWith("swayam.evo.")).sort());

describe("SSR and hydration", () => {
  it("the server snapshot is UNIVERSAL, a visitor and not hydrated, and never changes", () => {
    const { rt } = rig();
    const s = rt.getServerSnapshot();
    expect(s.hydrated).toBe(false);
    expect(s.ui.state).toBe("UNIVERSAL");
    expect(s.ui.tier).toBe(0);
    expect(s.scope).toBe("guest");
    rt.setAuth(guest);
    expect(rt.getServerSnapshot()).toBe(s);
  });

  it("is not hydrated before auth, hydrated after, and the snapshot is stable between reads", () => {
    const { rt } = rig();
    expect(rt.getSnapshot().hydrated).toBe(false);
    rt.setAuth(guest);
    const a = rt.getSnapshot();
    expect(a.hydrated).toBe(true);
    expect(a.scope).toBe("guest");
    expect(rt.getSnapshot()).toBe(a);
  });

  it("events that arrive before auth are buffered and folded afterwards", () => {
    const { rt } = rig();
    rt.ingestBatch([job(1), job(2)]);
    expect(rt.getEvents()).toHaveLength(0);
    rt.setAuth(guest);
    expect(rt.getEvents().length).toBeGreaterThan(0);
  });

  it("writes the boot hint (about 120 bytes) on commit", () => {
    const { rt, ls } = rig();
    rt.setAuth(guest);
    const raw = ls.map.get("swayam.evo.boot") ?? "";
    const boot = JSON.parse(raw);
    expect(boot).toMatchObject({
      v: 1,
      scope: "guest",
      state: "UNIVERSAL",
      tier: 0,
      locked: false,
    });
    expect(raw.length).toBeLessThan(200);
  });
});

describe("storage failures", () => {
  it("localStorage that throws on every call: the runtime still works, in memory", () => {
    const { rt } = rig({ ls: new FakeStorage({ throwAll: true }) });
    expect(() => {
      rt.setAuth(guest);
      rt.ingestBatch([job(1)]);
      rt.setLocked(true);
      rt.resetExperience();
    }).not.toThrow();
    expect(rt.getSnapshot().hydrated).toBe(true);
  });

  it("a full localStorage never breaks ingest", () => {
    const { rt } = rig({ ls: new FakeStorage({ quotaChars: 10 }) });
    rt.setAuth(guest);
    expect(() => rt.ingestBatch([job(1), job(2), job(3)])).not.toThrow();
  });

  it("corrupt stored data is quarantined and the runtime starts clean", () => {
    const ls = new FakeStorage();
    ls.map.set(keyOf("guest", "engine"), "{garbage");
    ls.map.set(keyOf("guest", "prefs"), '{"state":{"adaptive":"sideways"},"version":1}');
    const { rt } = rig({ ls });
    rt.setAuth(guest);
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL");
    expect(rt.getSnapshot().prefs.adaptive).toBe("on");
    expect(ls.map.get("swayam.evo.quarantine.guest.engine")).toBe("{garbage");
    expect(ls.map.has("swayam.evo.quarantine.guest.prefs")).toBe(true);
  });
});

describe("resets leave every non-evolution swayam-* key byte-identical", () => {
  function used() {
    const r = rig();
    for (const [k, v] of Object.entries(OTHER_KEYS)) r.ls.map.set(k, v);
    r.rt.setAuth(member());
    r.rt.ingestBatch([job(1), job(2), job(3)]);
    r.rt.setLocked(true);
    return r;
  }

  it.each(["resetBehaviour", "resetEvolution", "resetExperience"] as const)("%s", (cmd) => {
    const { rt, ls } = used();
    const before = otherSnapshot(ls);
    rt[cmd]();
    expect(otherSnapshot(ls)).toBe(before);
    expect(JSON.parse(before)).toHaveLength(Object.keys(OTHER_KEYS).length);
  });

  it("resetBehaviour clears the events and the history; resetEvolution keeps the events", () => {
    const { rt } = used();
    expect(rt.getEvents().length).toBeGreaterThan(0);
    const n = rt.getEvents().length;
    rt.resetEvolution();
    expect(rt.getEvents()).toHaveLength(n);
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL");
    rt.resetBehaviour();
    expect(rt.getEvents()).toHaveLength(0);
    expect(rt.getSnapshot().history).toHaveLength(0);
  });

  it("resetExperience wipes the events and goes UNIVERSAL instantly with one reset announcement", () => {
    const { rt } = used();
    rt.resetExperience();
    expect(rt.getEvents()).toHaveLength(0);
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL");
    expect(noticeBus.get()).toMatchObject({ kind: "reset", undoable: false });
  });

  it("the engine epoch moves on a reset, so stale advice from before is dropped", () => {
    const { rt } = used();
    const e0 = rt.getEngineState().epoch;
    rt.resetEvolution();
    expect(rt.getEngineState().epoch).toBe(e0 + 1);
  });
});

describe("scope switching", () => {
  it("sign-in merges the guest scope ONCE per device, then marks it merged", () => {
    const { rt, ls } = rig();
    rt.setAuth(guest);
    rt.ingestBatch([job(1), job(2)]);
    const guestEvents = rt.getEvents().length;
    expect(evoKeys(ls).some((k) => k.startsWith("swayam.evo.guest."))).toBe(true);

    rt.setAuth(member("member-1"));
    const acct = scopeFor("member-1");
    expect(rt.getSnapshot().scope).toBe(acct);
    expect(rt.getEvents()).toHaveLength(guestEvents);
    expect(ls.map.get("swayam.evo.merged")).toBe("1");
    expect(evoKeys(ls).some((k) => k.startsWith("swayam.evo.guest."))).toBe(false);
    expect(evoKeys(ls).some((k) => k.startsWith(`swayam.evo.${acct}.`))).toBe(true);

    // a second account on the same device starts clean: no second merge
    rt.setAuth(guest);
    rt.ingestBatch([job(9)]);
    rt.setAuth(member("member-2"));
    expect(rt.getSnapshot().scope).toBe(scopeFor("member-2"));
    expect(rt.getEvents()).toHaveLength(0);
  });

  it("sign-out switches to guest and keeps an UNSYNCED account's local keys", () => {
    const { rt, ls } = rig();
    rt.setAuth(member("member-1"));
    rt.ingestBatch([job(1)]);
    const acct = scopeFor("member-1");
    rt.setAuth(guest);
    expect(rt.getSnapshot().scope).toBe("guest");
    expect(evoKeys(ls).some((k) => k.startsWith(`swayam.evo.${acct}.`))).toBe(true);
  });

  it("sign-out deletes a SYNCED account's local keys (shared-computer rule)", () => {
    const ls = new FakeStorage();
    const acct = scopeFor("member-1");
    const synced = {
      state: {
        engine: { ...createEngine(acct) },
        rev: 1,
        presented: null,
        sessionId: null,
        committedSource: "deterministic",
        committedAt: 1,
        updatedAt: 5,
        syncedAt: 123,
      },
      version: 1,
    };
    ls.map.set(keyOf(acct, "engine"), JSON.stringify(synced));
    ls.map.set("swayam.evo.merged", "1");
    const { rt } = rig({ ls });
    rt.setAuth(member("member-1"));
    expect(evoKeys(ls).some((k) => k.startsWith(`swayam.evo.${acct}.`))).toBe(true);
    rt.setAuth(guest);
    expect(evoKeys(ls).filter((k) => k.startsWith(`swayam.evo.${acct}.`))).toEqual([]);
    expect(rt.getSnapshot().scope).toBe("guest");
  });

  it("the pre-sign-in guest events do not leak into the next visitor after sign-out", () => {
    const { rt } = rig();
    rt.setAuth(member("member-1"));
    rt.ingestBatch([job(1)]);
    rt.setAuth(guest);
    expect(rt.getEvents()).toHaveLength(0);
  });
});

describe("D10 sessions", () => {
  it("one session count per session id: 29 minutes of silence keeps it, 31 starts a new one", () => {
    const { rt, clock } = rig();
    rt.setAuth(guest);
    rt.ingestBatch([job(1)]);
    const c1 = rt.getEngineState().profile.sessionCount;
    expect(c1).toBeGreaterThanOrEqual(1);

    clock.t += SESSION_GAP_MS - 60_000;
    rt.ingestBatch([job(2)]);
    expect(rt.getEngineState().profile.sessionCount).toBe(c1);

    clock.t += SESSION_GAP_MS + 60_000;
    rt.ingestBatch([job(3)]);
    expect(rt.getEngineState().profile.sessionCount).toBe(c1 + 1);
  });

  it("a fresh tab (no session marker) counts a new session; a refresh (marker kept) does not", () => {
    const first = rig();
    first.rt.setAuth(guest);
    first.rt.ingestBatch([job(1)]);
    const c1 = first.rt.getEngineState().profile.sessionCount;

    const refresh = rig({ ls: first.ls, session: first.session, clock: first.clock });
    refresh.rt.setAuth(guest);
    expect(refresh.rt.getEngineState().profile.sessionCount).toBe(c1);

    const freshTab = rig({ ls: first.ls, clock: first.clock });
    freshTab.rt.setAuth(guest);
    expect(freshTab.rt.getEngineState().profile.sessionCount).toBe(c1 + 1);
  });

  it("newSession() forces a boundary", () => {
    const { rt } = rig();
    rt.setAuth(guest);
    rt.ingestBatch([job(1)]);
    const c = rt.getEngineState().profile.sessionCount;
    rt.newSession();
    expect(rt.getEngineState().profile.sessionCount).toBe(c + 1);
  });

  it("the session marker is only ever written through the injected port (sessionStorage in the browser)", () => {
    const { rt, ls } = rig();
    rt.setAuth(guest);
    expect(ls.map.has(SESSION_KEY)).toBe(false);
  });
});

describe("restored state (visit 2)", () => {
  function careerRecord(scope: string) {
    const decision = {
      primaryState: "CAREER_FIRST",
      behaviourMode: "CAREER_FOCUSED",
      navigationMode: "CAREER_PRIORITY",
      homepageLayout: "CAREER_DISCOVERY",
      priorityActions: actionsFor("CAREER_FIRST", 3),
      reason: "Arranged around what you do most.",
      confidence: 0.86,
    };
    const committed = {
      rev: 4,
      decision,
      tier: 3,
      reasonCode: { key: "DOMAIN_CONFIRMED" },
      source: "deterministic",
      at: 5,
    };
    const engine = { ...createEngine(scope as never), decision, tier: 3, seq: 0 };
    return {
      state: {
        engine,
        rev: 4,
        presented: committed,
        sessionId: "old",
        committedSource: "deterministic",
        committedAt: 5,
        updatedAt: 5,
        syncedAt: null,
      },
      version: 1,
    };
  }

  it("presents what the user left, flags it restored, and does not announce it", () => {
    const ls = new FakeStorage();
    ls.map.set(keyOf("guest", "engine"), JSON.stringify(careerRecord("guest")));
    const { rt } = rig({ ls });
    rt.setAuth(guest);
    const s = rt.getSnapshot();
    expect(s.ui.state).toBe("CAREER_FIRST");
    expect(s.tier).toBe(3);
    expect(s.status.restored).toBe(true);
    expect(s.status.label).toBe("Career focused");
    expect(noticeBus.get()).toBeNull();
    expect(JSON.parse(ls.map.get("swayam.evo.boot") ?? "{}")).toMatchObject({
      state: "CAREER_FIRST",
      tier: 3,
    });
  });

  it("an invalid stored decision is dropped (and quarantined), then rebuilt from the log", () => {
    const ls = new FakeStorage();
    const rec = careerRecord("guest");
    (rec.state.engine.decision as { primaryState: string }).primaryState = "NOT_A_STATE";
    ls.map.set(keyOf("guest", "engine"), JSON.stringify(rec));
    const { rt } = rig({ ls });
    rt.setAuth(guest);
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL");
    expect(rt.getSnapshot().status.restored).toBe(false);
  });

  it("Off renders UNIVERSAL without forgetting; turning it back on restores the arrangement", () => {
    const ls = new FakeStorage();
    ls.map.set(keyOf("guest", "engine"), JSON.stringify(careerRecord("guest")));
    const { rt } = rig({ ls });
    rt.setAuth(guest);
    rt.setAdaptive("off");
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL");
    expect(JSON.parse(ls.map.get("swayam.evo.boot") ?? "{}").state).toBe("UNIVERSAL");
    rt.setAdaptive("on");
    expect(rt.getSnapshot().ui.state).toBe("CAREER_FIRST");
  });
});

describe("commands and prefs", () => {
  it("Off stops tracking, and the learned events stay as they were", () => {
    const { rt } = rig();
    rt.setAuth(guest);
    rt.ingestBatch([job(1)]);
    const n = rt.getEvents().length;
    rt.setAdaptive("off");
    rt.ingestBatch([job(2), job(3)]);
    rt.ingestNow(job(4), "deterministic");
    expect(rt.getEvents()).toHaveLength(n);
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL");
  });

  it("paused also stops learning", () => {
    const { rt } = rig();
    rt.setAuth(guest);
    rt.ingestBatch([job(1)]);
    const n = rt.getEvents().length;
    rt.setAdaptive("paused");
    rt.ingestBatch([job(2)]);
    expect(rt.getEvents()).toHaveLength(n);
  });

  it("Keep my current layout freezes the structure, keeps learning, and survives a reload", () => {
    const a = rig();
    a.rt.setAuth(guest);
    a.rt.setLocked(true);
    expect(a.rt.getSnapshot().ui.locked).toBe(true);
    expect(a.rt.getSnapshot().prefs.locked).toBe(true);
    const n = a.rt.getEvents().length;
    a.rt.ingestBatch([job(1)]);
    expect(a.rt.getEvents().length).toBeGreaterThan(n);
    const b = rig({ ls: a.ls });
    b.rt.setAuth(guest);
    expect(b.rt.getSnapshot().prefs.locked).toBe(true);
    expect(JSON.parse(a.ls.map.get("swayam.evo.boot") ?? "{}").locked).toBe(true);
  });

  it("cross-tab: a storage event for prefs reaches the other tab", () => {
    const a = rig();
    a.rt.setAuth(guest);
    const b = rig({ ls: a.ls });
    b.rt.setAuth(guest);
    a.rt.setLocked(true);
    expect(b.rt.getSnapshot().prefs.locked).toBe(false);
    b.win.dispatch("storage", { key: keyOf("guest", "prefs"), storageArea: a.ls });
    expect(b.rt.getSnapshot().prefs.locked).toBe(true);
  });

  it("recruiters and institutes keep stable navigation (the only use of profile type)", () => {
    const { rt } = rig();
    rt.setAuth({ profileId: "member-1", isMinor: false, stableNav: true });
    expect(rt.getSnapshot().ui.navMode).toBe("UNIVERSAL");
  });

  it("subscribers hear about committed changes and unsubscribe cleanly", () => {
    const { rt } = rig();
    let n = 0;
    const off = rt.subscribe(() => n++);
    rt.setAuth(guest);
    expect(n).toBeGreaterThan(0);
    off();
    const before = n;
    rt.setLocked(true);
    expect(n).toBe(before);
  });

  it("setAiStatus is merged, persisted and visible", () => {
    const { rt } = rig();
    rt.setAuth(guest);
    rt.setAiStatus({ kind: "held", detail: "held by stability rules", callsLeftToday: 4 });
    expect(rt.getSnapshot().ai).toMatchObject({ kind: "held", callsLeftToday: 4 });
  });

  it("undo with nothing to undo is a quiet no-op", () => {
    const { rt } = rig();
    rt.setAuth(guest);
    expect(() => rt.undo()).not.toThrow();
  });
});

describe("pagehide", () => {
  it("marks an AI analysis pending only when there is something to analyse", () => {
    const { rt, ls } = rig();
    rt.setAuth(guest);
    rt.onPageHide();
    const read = () =>
      JSON.parse(ls.map.get(keyOf("guest", "ai")) ?? '{"state":{}}').state.pendingAnalysis;
    expect(read()).toBeFalsy();
    rt.ingestBatch([job(1), job(2), job(3)]);
    rt.onPageHide();
    const meaningful = rt.getEngineState().profile.meaningfulCount;
    expect(Boolean(read())).toBe(meaningful > 0);
  });
});

describe("sandboxes", () => {
  it("preview is in-memory and read-only: no storage writes, tracking disabled, the real scope untouched", () => {
    const { rt, ls } = rig();
    const baseline = ls.writes; // the adapter's own probe write
    rt.enterSandbox("preview", "career-seeker");
    rt.setAuth(guest);
    rt.ingestBatch([job(1), job(2)]);
    rt.setLocked(true);
    expect(ls.writes).toBe(baseline);
    expect(ls.map.size).toBe(0);
    const s = rt.getSnapshot();
    expect(s.hydrated).toBe(true);
    expect(s.scope).toBe("preview_career-seeker");
    expect(s.status.demo).toBe("career-seeker");
  });

  it("exiting a preview returns to the user's real scope", () => {
    const { rt } = rig();
    rt.setAuth(member("member-1"));
    rt.enterSandbox("preview", "fast-user");
    expect(rt.getSnapshot().scope).toBe("preview_fast-user");
    rt.exitSandbox();
    expect(rt.getSnapshot().scope).toBe(scopeFor("member-1"));
    expect(rt.getSnapshot().status.demo).toBeNull();
  });

  it("the lab scope is persisted, reset on entry, ignores real tracking, and never touches the real scope", () => {
    const { rt, ls } = rig();
    rt.setAuth(member("member-1"));
    rt.ingestBatch([job(1)]);
    const acct = scopeFor("member-1");
    const real = ls.map.get(keyOf(acct, "behaviour"));

    rt.enterSandbox("lab", "learning-explorer");
    expect(rt.getSnapshot().scope).toBe("lab_main");
    expect(rt.getSnapshot().status.demo).toBe("learning-explorer");
    rt.ingestBatch([job(7)]); // real tracking is ignored while in the lab
    expect(rt.getEvents()).toHaveLength(0);
    rt.ingestNow(job(8), "persona");
    rt.newSession();
    expect(ls.map.get(keyOf(acct, "behaviour"))).toBe(real);
    // the lab never writes the boot hint
    expect(JSON.parse(ls.map.get("swayam.evo.boot") ?? "{}").scope).toBe(acct);

    rt.exitSandbox();
    expect(rt.getSnapshot().scope).toBe(acct);
  });
});

describe("disposal", () => {
  it("a disposed runtime ignores everything and does not throw", () => {
    const { rt } = rig();
    rt.setAuth(guest);
    rt.dispose();
    expect(() => {
      rt.ingestBatch([job(1)]);
      rt.setAuth(member());
      rt.resetExperience();
    }).not.toThrow();
  });
});
