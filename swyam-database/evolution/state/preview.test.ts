// The transient plan override (Time-Scrub, Try-On): precedence, auto-clear, non-persistence, commit.
// Node environment, fake storage, injected clock and a manual timer: no real time, no network.
import { afterEach, describe, expect, it, vi } from "vitest";
import { NAV_ITEM_IDS, PERSONA_IDS } from "../config/ids";
import { NAV_REGISTRY } from "../config/navigation";
import { composePersonaPlan } from "../runtime/evolution/sandbox";
import { createLocalAdapter, type WindowLike } from "../platform/storage/local";
import { createFakeWindow, FakeStorage } from "../platform/testing/fake-window";
import { homePlanOf, navPlanOf, shownUi } from "../react/hooks";
import type { PersonaId, TrackInput } from "../types";
import { noticeBus } from "./notice";
import { createEvolutionRuntime, type EvolutionRuntimeHandle } from "./runtime";
import type { SessionMarker, SessionPort } from "./scope";

const T0 = 1_800_000_000_000;
const FOUR: readonly PersonaId[] = [
  "learning-explorer",
  "career-seeker",
  "skill-builder",
  "community-explorer",
];

class Port implements SessionPort {
  m: SessionMarker | null = null;
  read = () => this.m;
  write = (m: SessionMarker) => {
    this.m = m;
  };
}

interface Timer {
  ms: number;
  fn: () => void;
  live: boolean;
}

const rigs: EvolutionRuntimeHandle[] = [];
afterEach(() => {
  for (const r of rigs.splice(0)) r.dispose();
  noticeBus.set(null);
});

function rig() {
  const ls = new FakeStorage();
  const timers: Timer[] = [];
  const rt = createEvolutionRuntime({
    adapter: createLocalAdapter(createFakeWindow(ls) as unknown as WindowLike),
    session: new Port(),
    now: () => T0,
    sync: null,
    presenterPorts: { prefersInstant: () => true },
    coordinatorPorts: {
      every: () => () => {},
      later: (ms, fn) => {
        const t: Timer = { ms, fn, live: true };
        timers.push(t);
        return () => {
          t.live = false;
        };
      },
    },
  });
  rigs.push(rt);
  rt.setAuth({ profileId: null, isMinor: false, stableNav: false });
  const fire = () => {
    for (const t of [...timers])
      if (t.live) {
        t.live = false;
        t.fn();
      }
  };
  return { rt, ls, timers, fire };
}

const job = (n: number): TrackInput => ({
  type: "job_viewed",
  entityId: `opp_${n}`,
  metadata: { source: "native" },
});

const evoSnapshot = (ls: FakeStorage) =>
  JSON.stringify([...ls.map.entries()].filter(([k]) => k.startsWith("swayam.evo.")).sort());

describe("override precedence", () => {
  it("returns the preview's plan while set, the live plan otherwise, and never touches the live snapshot", () => {
    const { rt } = rig();
    const live = rt.getSnapshot();
    expect(shownUi(live.ui, rt.getPreview())).toBe(live.ui);

    rt.previewPlan("career-seeker", { source: "tryon" });
    const p = rt.getPreview();
    expect(p?.persona).toBe("career-seeker");
    expect(p?.ui.state).toBe("CAREER_FIRST");
    expect(p?.ui.tier).toBe(3);
    expect(rt.getSnapshot()).toBe(live); // identity: the engine's world did not move
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL");

    const shown = shownUi(rt.getSnapshot().ui, rt.getPreview());
    expect(homePlanOf(shown).state).toBe("CAREER_FIRST");
    expect(navPlanOf(shown).navMode).toBe("CAREER_PRIORITY");

    rt.clearPreview();
    expect(rt.getPreview()).toBeNull();
    expect(shownUi(rt.getSnapshot().ui, rt.getPreview())).toBe(live.ui);
  });

  it("every persona morphs Home and the navigation, and every feature stays reachable", () => {
    const { rt } = rig();
    const live = rt.getSnapshot().ui;
    const tops = new Set<string>();
    for (const id of FOUR) {
      rt.previewPlan(id, { source: "tryon" });
      const ui = rt.getPreview()!.ui;
      expect(ui.state).not.toBe("UNIVERSAL");
      expect(ui.navigation.top).not.toEqual(live.navigation.top);
      expect(ui.sections.map((s) => s.id).slice(0, 3)).not.toEqual(
        live.sections.map((s) => s.id).slice(0, 3),
      );
      tops.add(ui.navigation.top.join());
      // Nothing is removed: the menu (top + overflow, account items live in the avatar menu) and every Home
      // section are all still there.
      const reachable = new Set([
        ...ui.navigation.top,
        ...ui.navigation.overflow.flatMap((g) => g.items),
      ]);
      for (const nav of NAV_ITEM_IDS)
        if (NAV_REGISTRY[nav].domain !== "ACCOUNT") expect(reachable.has(nav)).toBe(true);
      const sections = new Set(ui.sections.map((s) => s.id));
      for (const s of live.sections) expect(sections.has(s.id)).toBe(true);
    }
    expect(tops.size).toBe(FOUR.length); // four different menus
  });

  it("a stored structure (a scrub stop) previews too, and a persona's plan is the sandbox's composition", () => {
    const { rt } = rig();
    const ref = {
      state: "CAREER_FIRST",
      mode: "CAREER_FOCUSED",
      nav: "CAREER_PRIORITY",
      layout: "CAREER_DISCOVERY",
    } as const;
    rt.previewPlan({ ...ref, tier: 1 });
    const p = rt.getPreview()!;
    expect(p.source).toBe("scrub");
    expect(p.persona).toBeNull();
    expect(p.ui.tier).toBe(1);
    expect(p.ui.navMode).toBe("UNIVERSAL"); // step 1: Home leads, the menu has not moved yet
    rt.previewPlan({ ...ref, tier: 2 });
    expect(rt.getPreview()!.ui.navMode).toBe("CAREER_PRIORITY"); // step 2: the menu follows

    rt.previewPlan("skill-builder");
    const ctx = { signedIn: false, stableNav: false, locked: false };
    expect(rt.getPreview()!.ui.renderKey).toBe(composePersonaPlan("skill-builder", ctx).renderKey);
  });

  it("each new preview or moved stop has a new id, so the stage can tell them apart", () => {
    const { rt } = rig();
    rt.previewPlan("career-seeker");
    const a = rt.getPreview()!.id;
    rt.previewPlan("learning-explorer");
    expect(rt.getPreview()!.id).toBeGreaterThan(a);
  });

  it("is a no-op before the store hydrates", () => {
    const rt = createEvolutionRuntime({
      adapter: createLocalAdapter(createFakeWindow(new FakeStorage()) as unknown as WindowLike),
      session: new Port(),
      sync: null,
      coordinatorPorts: { every: () => () => {}, later: () => () => {} },
    });
    rigs.push(rt);
    rt.previewPlan("career-seeker");
    expect(rt.getPreview()).toBeNull();
  });
});

describe("auto-clear", () => {
  it("clears after its ttl, and notifies subscribers once each way", () => {
    const { rt, timers, fire } = rig();
    const l = vi.fn();
    rt.subscribePreview(l);
    rt.previewPlan("career-seeker", { source: "tryon", ttlMs: 8000 });
    expect(timers.at(-1)?.ms).toBe(8000);
    expect(rt.getPreview()?.expiresAt).toBe(T0 + 8000);
    expect(l).toHaveBeenCalledTimes(1);
    fire();
    expect(rt.getPreview()).toBeNull();
    expect(l).toHaveBeenCalledTimes(2);
  });

  it("a newer preview re-arms the timer: the old ttl never clears the new preview", () => {
    const { rt, timers } = rig();
    rt.previewPlan("career-seeker", { ttlMs: 8000 });
    const first = timers.at(-1)!;
    rt.previewPlan("skill-builder", { ttlMs: 8000 });
    expect(first.live).toBe(false);
    expect(rt.getPreview()?.persona).toBe("skill-builder");
  });

  it("a different route clears it; the same path (a hash change) does not", () => {
    const { rt } = rig();
    rt.setRoute("/");
    rt.previewPlan("career-seeker");
    rt.setRoute("/");
    expect(rt.getPreview()).not.toBeNull();
    rt.setRoute("/jobs");
    expect(rt.getPreview()).toBeNull();
  });

  it("any tracked event clears it, however it arrives", () => {
    const { rt } = rig();
    rt.previewPlan("career-seeker");
    rt.ingestBatch([job(1)]);
    expect(rt.getPreview()).toBeNull();
    rt.previewPlan("career-seeker");
    rt.ingestNow(job(2), "persona");
    expect(rt.getPreview()).toBeNull();
  });

  it("commands that change the experience end it, and a disposed runtime holds nothing", () => {
    const { rt } = rig();
    for (const cmd of [
      () => rt.setLocked(true),
      () => rt.setLocked(false),
      () => rt.resetEvolution(),
      () => rt.resetExperience(),
      () => rt.undo(),
      () => rt.setAdaptive("on"),
    ]) {
      rt.previewPlan("career-seeker");
      cmd();
      expect(rt.getPreview()).toBeNull();
    }
    rt.previewPlan("career-seeker");
    rt.dispose();
    expect(rt.getPreview()).toBeNull();
  });
});

describe("non-persistence", () => {
  it("previewing, scrubbing through all four personas and clearing leaves swayam.evo.* byte-identical", () => {
    const { rt, ls } = rig();
    rt.ingestNow(job(1), "persona"); // some real state to compare
    const before = evoSnapshot(ls);
    const keys = [...ls.map.keys()].sort();
    for (const id of PERSONA_IDS) rt.previewPlan(id, { source: "scrub" });
    rt.previewPlan("career-seeker", { source: "tryon", ttlMs: 8000 });
    expect(evoSnapshot(ls)).toBe(before);
    rt.clearPreview();
    expect(evoSnapshot(ls)).toBe(before);
    expect([...ls.map.keys()].sort()).toEqual(keys);
  });

  it("the live snapshot is exactly what it was once the preview is gone", () => {
    const { rt } = rig();
    rt.previewPlan("learning-explorer");
    rt.clearPreview();
    expect(rt.getSnapshot().ui.state).toBe("UNIVERSAL"); // nothing leaked into the live plan
  });
});

describe("commitPreview (Restore this layout / Make this mine)", () => {
  it("presents the previewed structure through the Keep path and ends the preview", () => {
    const { rt } = rig();
    rt.previewPlan("career-seeker", { source: "tryon", ttlMs: 8000 });
    rt.commitPreview();
    expect(rt.getPreview()).toBeNull();
    const snap = rt.getSnapshot();
    expect(snap.ui.state).toBe("CAREER_FIRST");
    expect(snap.ui.tier).toBe(3);
    expect(snap.prefs.locked).toBe(true);
    expect(snap.status.reasonCode.key).toBe("LOCKED");
  });

  it("does nothing without a preview", () => {
    const { rt } = rig();
    const before = rt.getSnapshot();
    rt.commitPreview();
    expect(rt.getSnapshot()).toBe(before);
    expect(rt.getSnapshot().prefs.locked).toBe(false);
  });
});
