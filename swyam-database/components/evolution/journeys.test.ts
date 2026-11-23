// Integration gate: engine -> compose -> navigation model + homepage plan, end to end.
// A learning journey and a career journey must end in different, validated structures;
// one click must leave the universal interface untouched.
import { afterEach, describe, expect, it } from "vitest";
import { compose } from "../../evolution/core/evolution/compose";
import { createEngine, ingest, type EngineState } from "../../evolution/core/evolution/engine";
import type { EntityId, TrackInput } from "../../evolution/types";
import { PERSONAS } from "../../evolution/core/fixtures/journeys";
import { JOURNEY_T0, runPersona } from "../../evolution/core/fixtures/trace";
import { homeOrder } from "../home/plan";
import { bottomSlots, middleLinks } from "./nav-model";
import { createLocalAdapter, type WindowLike } from "../../evolution/platform/storage/local";
import { createFakeWindow, FakeStorage } from "../../evolution/platform/testing/fake-window";
import { homePlanOf, navPlanOf, shownUi } from "../../evolution/react/hooks";
import { registerRuntime } from "../../evolution/state/commands";
import { previewTarget } from "../../evolution/state/preview";
import { createEvolutionRuntime, type EvolutionRuntimeHandle } from "../../evolution/state/runtime";
import type { SessionMarker, SessionPort } from "../../evolution/state/scope";
import { applyChipHold, buildStops, stopTitle } from "./TimeScrub";
import { confidencePct, whyCopy } from "./WhyPanel";

const ui = (s: EngineState) =>
  compose(s.decision, s.tier, { signedIn: true, stableNav: false, locked: false });

const view = (s: EngineState) => {
  const u = ui(s);
  return {
    state: u.state,
    top: middleLinks(u.navigation.top),
    bottom: bottomSlots(u.navigation.top),
    home: homeOrder(u.sections, true),
    cta: u.hero.cta,
  };
};

describe("integration: journeys reshape navigation and homepage", () => {
  const learning = view(runPersona(PERSONAS["learning-explorer"]).final);
  const career = view(runPersona(PERSONAS["career-seeker"]).final);
  const universal = view(createEngine("lab_gate"));

  it("a learning journey ends in LEARNING_FIRST and a career journey in CAREER_FIRST", () => {
    expect(learning.state).toBe("LEARNING_FIRST");
    expect(career.state).toBe("CAREER_FIRST");
  });

  it("the two journeys get different navigation and different homepage sections", () => {
    expect(learning.top).not.toEqual(career.top);
    expect(learning.bottom).not.toEqual(career.bottom);
    expect(learning.home.slice(0, 3)).not.toEqual(career.home.slice(0, 3));
    expect(learning.cta).not.toBe(career.cta);
    expect(learning.top).not.toEqual(universal.top);
    expect(career.home).not.toEqual(universal.home);
  });

  it("one click changes nothing", () => {
    const r = ingest(
      createEngine("lab_gate"),
      { type: "course_viewed", entityId: "crs_a" },
      { now: JOURNEY_T0, sessionId: "s1" },
    );
    expect(r.change ?? null).toBeNull();
    expect(view(r.state)).toEqual(universal);
  });
});

describe("integration: pacing, what a focused guest sees and when", () => {
  const universal = view(createEngine("lab_gate"));
  const viewsOf = (n: number): EngineState => {
    let s = createEngine("lab_gate");
    for (let i = 1; i <= n; i += 1) {
      const input: TrackInput = {
        type: "job_viewed",
        entityId: `opp_job-${i}` as EntityId,
        metadata: { source: "native" },
      };
      s = ingest(s, input, { now: JOURNEY_T0 + i * 8_000, sessionId: "s1" }).state;
    }
    return s;
  };

  it("the first four career actions leave the interface exactly as it was", () => {
    expect(view(viewsOf(4))).toEqual(universal);
  });

  it("by the 6th action the homepage leads with careers and the navigation has not moved", () => {
    const v = view(viewsOf(6));
    expect(v.state).toBe("CAREER_FIRST");
    expect(v.home.slice(0, 2)).not.toEqual(universal.home.slice(0, 2));
    expect(v.cta).not.toBe(universal.cta);
    expect(v.top).toEqual(universal.top);
    expect(v.bottom).toEqual(universal.bottom);
  });

  it("by the 10th action the navigation has followed", () => {
    const v = view(viewsOf(10));
    expect(v.top).not.toEqual(universal.top);
    expect(v.home.slice(0, 3)).not.toEqual(universal.home.slice(0, 3));
  });
});

// ─── Time-Scrub and Try-On, end to end on the real runtime ───────────────────────────────────────────────

class Port implements SessionPort {
  m: SessionMarker | null = null;
  read = () => this.m;
  write = (m: SessionMarker) => {
    this.m = m;
  };
}

const live: EvolutionRuntimeHandle[] = [];
afterEach(() => {
  for (const r of live.splice(0)) r.dispose();
});

/** A real runtime that has lived through the career-seeker journey (every commit instant, like the Lab). */
function careerRuntime() {
  const ls = new FakeStorage();
  const rt = createEvolutionRuntime({
    adapter: createLocalAdapter(createFakeWindow(ls) as unknown as WindowLike),
    session: new Port(),
    now: () => JOURNEY_T0,
    sync: null,
    presenterPorts: { prefersInstant: () => true },
    coordinatorPorts: { every: () => () => {}, later: () => () => {} },
  });
  live.push(rt);
  rt.setAuth({ profileId: null, isMinor: false, stableNav: false });
  PERSONAS["career-seeker"].sessions.forEach((session, i) => {
    if (i > 0) rt.newSession();
    for (const input of session) rt.ingestNow(input, "persona");
  });
  return { rt, ls };
}

const evoKeys = (ls: FakeStorage) =>
  JSON.stringify([...ls.map.entries()].filter(([k]) => k.startsWith("swayam.evo.")).sort());

const liveOf = (rt: EvolutionRuntimeHandle) => {
  const s = rt.getSnapshot();
  return {
    ref: {
      state: s.status.state,
      mode: s.status.mode,
      nav: s.ui.navMode,
      layout: s.ui.layout,
      tier: s.status.tier,
    },
    reasonCode: s.status.reasonCode,
    confidence: s.status.confidence,
  };
};

describe("integration: Time-Scrub replays what Swayam really showed", () => {
  it("a career journey yields at least 3 stops, from the standard layout to now, each with a stored reason", () => {
    const { rt } = careerRuntime();
    const snap = rt.getSnapshot();
    expect(snap.ui.state).toBe("CAREER_FIRST");
    const stops = buildStops(snap.history, liveOf(rt));
    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[0]?.title).toBe("Standard layout");
    expect(stops[0]?.ref.tier).toBe(0);
    expect(stops.at(-1)?.live).toBe(true);
    expect(stops.at(-1)?.ref.tier).toBe(snap.ui.tier);
    expect(stops.filter((s) => s.live)).toHaveLength(1);
    for (const s of stops) {
      expect(s.reason.length).toBeGreaterThan(0);
      expect(s.reason.length).toBeLessThanOrEqual(160);
    }
    const tiers = stops.map((s) => s.ref.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b)); // a journey only ever deepens
    expect(stopTitle(stops.at(-1)!.ref)).toContain("Career focused");
  });

  it("scrubbing through every stop morphs Home and the menu, release returns to live, and nothing is stored", () => {
    const { rt, ls } = careerRuntime();
    const before = evoKeys(ls);
    const liveUi = rt.getSnapshot().ui;
    const stops = buildStops(rt.getSnapshot().history, liveOf(rt));
    const orders = new Set<string>();
    for (const stop of stops.slice(0, -1)) {
      rt.previewPlan(stop.ref, { source: "scrub", reasonCode: stop.reasonCode });
      const shown = shownUi(rt.getSnapshot().ui, rt.getPreview());
      expect(shown.tier).toBe(stop.ref.tier);
      orders.add(
        `${homePlanOf(shown)
          .sections.map((s) => s.id)
          .join()}|${navPlanOf(shown).top.join()}`,
      );
      expect(rt.getSnapshot().ui).toBe(liveUi); // the live plan never moved
    }
    expect(orders.size).toBeGreaterThanOrEqual(2); // different arrangements on screen along the way
    rt.clearPreview();
    expect(shownUi(rt.getSnapshot().ui, rt.getPreview())).toBe(liveUi);
    expect(evoKeys(ls)).toBe(before); // swayam.evo.* byte-identical after the scrub
  });

  it("Restore this layout keeps the stop through the Keep path", () => {
    const { rt } = careerRuntime();
    const stops = buildStops(rt.getSnapshot().history, liveOf(rt));
    const mid = stops[1]!;
    rt.previewPlan(mid.ref, {
      source: "scrub",
      reasonCode: mid.reasonCode,
      confidence: mid.confidence,
    });
    rt.commitPreview();
    const s = rt.getSnapshot();
    expect(rt.getPreview()).toBeNull();
    expect(s.prefs.locked).toBe(true);
    expect(s.ui.tier).toBe(mid.ref.tier);
    expect(s.ui.state).toBe(mid.ref.state);
  });

  it("press-and-hold on the chip peeks at the previous stop and snaps back on release", () => {
    const { rt } = careerRuntime();
    registerRuntime(rt);
    const stops = buildStops(rt.getSnapshot().history, liveOf(rt));
    applyChipHold("start", stops);
    const p = rt.getPreview();
    expect(p?.source).toBe("hold");
    expect(p?.ref).toEqual(stops.at(-2)?.ref);
    expect(p?.expiresAt).not.toBeNull(); // a lost release can never strand it
    applyChipHold("end", stops);
    expect(rt.getPreview()).toBeNull();
    // a release never ends somebody else's preview
    rt.previewPlan("career-seeker", { source: "tryon" });
    applyChipHold("end", stops);
    expect(rt.getPreview()?.source).toBe("tryon");
  });

  it("a history of one step is not scrubbable, and a confidence-only commit is not a stop", () => {
    const base = {
      state: "UNIVERSAL",
      mode: "BALANCED",
      nav: "UNIVERSAL",
      layout: "UNIVERSAL",
      tier: 0,
    } as const;
    const career = {
      state: "CAREER_FIRST",
      mode: "CAREER_FOCUSED",
      nav: "UNIVERSAL",
      layout: "CAREER_DISCOVERY",
      tier: 1,
    } as const;
    expect(buildStops([], { ref: base, reasonCode: { key: "START" }, confidence: 0 })).toHaveLength(
      1,
    );
    const entry = (
      n: number,
      from: typeof base | typeof career,
      to: typeof base | typeof career,
    ) => ({
      id: `h${n}`,
      at: n,
      seq: n,
      from,
      to,
      confidence: 0.5 + n / 10,
      source: "deterministic" as const,
      reasonCode: { key: "DOMAIN_RISING", slots: { domain: "CAREER" } } as const,
    });
    const stops = buildStops([entry(1, base, career), entry(2, career, career)], {
      ref: career,
      reasonCode: { key: "DOMAIN_RISING", slots: { domain: "CAREER" } },
      confidence: 0.7,
    });
    expect(stops.map((s) => s.ref.tier)).toEqual([0, 1]);
  });
});

describe("integration: Try-On composes a real persona structure at tier 3", () => {
  it("each of the four chips is the tier-3 structure its journey ends in, and differs from the others", () => {
    const ctx = { signedIn: false, stableNav: false, locked: false };
    const uis = (
      ["learning-explorer", "career-seeker", "skill-builder", "community-explorer"] as const
    ).map((p) => previewTarget(p, ctx).ui);
    expect(uis.map((u) => u.state)).toEqual([
      "LEARNING_FIRST",
      "CAREER_FIRST",
      "SKILL_EXCHANGE_FIRST",
      "COMMUNITY_FIRST",
    ]);
    expect(uis.every((u) => u.tier === 3)).toBe(true);
    expect(new Set(uis.map((u) => u.navigation.top.join())).size).toBe(4);
  });
});

describe("WhyPanel copy", () => {
  const career = {
    state: "CAREER_FIRST",
    mode: "CAREER_FOCUSED",
    tier: 3,
    label: "Career focused",
    confidence: 0.684,
    restored: false,
  } as const;

  it("names the domain as a noun and says where the arrangement came from", () => {
    const now = whyCopy(career);
    expect(now.learning).toBe(false);
    expect(now.arranged).toBe("Arranged for career");
    expect(now.provenance).toBe("from this visit");
    expect(whyCopy({ ...career, restored: true }).provenance).toBe("from your last visit");
    const nouns = {
      LEARNING_FIRST: "Arranged for learning",
      CAREER_FIRST: "Arranged for career",
      SKILL_EXCHANGE_FIRST: "Arranged for skill exchange",
      COMMUNITY_FIRST: "Arranged for community",
    } as const;
    for (const [state, text] of Object.entries(nouns))
      expect(whyCopy({ ...career, state: state as keyof typeof nouns }).arranged).toBe(text);
    // never "for your career focused"
    expect(JSON.stringify(now)).not.toMatch(/your career focused/i);
  });

  it("shows the confidence once, with the same expression as the chip", () => {
    for (const c of [0, 0.004, 0.5, 0.684, 0.685, 0.995, 1])
      expect(whyCopy({ ...career, confidence: c }).pct).toBe(Math.round(c * 100));
    expect(confidencePct(0.684)).toBe(68);
  });

  it("says nothing is arranged while Swayam is still learning", () => {
    const universal = {
      ...career,
      state: "UNIVERSAL",
      mode: "BALANCED",
      tier: 0,
      label: "Balanced",
    } as const;
    expect(whyCopy(universal)).toMatchObject({ learning: true, arranged: null });
    expect(whyCopy({ ...career, tier: 0 }).arranged).toBeNull();
    expect(whyCopy({ ...career, state: "EXPLORER", mode: "EXPLORER" }).arranged).toBe(
      "Arranged for exploring",
    );
  });

  it("says Swayam lightened itself when the frame budget stepped in, for this phone or this device", () => {
    expect(whyCopy(career).fx).toBeNull();
    expect(whyCopy(career, { lightened: true, phone: true }).fx).toBe(
      "Swayam lightened itself for this phone.",
    );
    expect(whyCopy(career, { lightened: true, phone: false }).fx).toBe(
      "Swayam lightened itself for this device.",
    );
  });
});
