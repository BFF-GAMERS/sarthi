// Golden journeys (plan §3.3 targets, §6.1 personas). A tuning change that breaks a journey fails here.
import { describe, expect, it } from "vitest";
import { EVOLUTION_CONFIG as C } from "../../config/evolution-config";
import { PERSONA_IDS, REASON_KEYS } from "../../config/ids";
import type { TrackInput } from "../../types";
import { decideLocal } from "../analyzer/local";
import { PERSONAS } from "../fixtures/journeys";
import { JOURNEY_T0, runPersona, runSessions } from "../fixtures/trace";
import { validateDecision } from "../ui-state/validate";
import { actionsFor, compose } from "./compose";
import {
  applyAdvice,
  createEngine,
  explainNext,
  ingest,
  renderReason,
  resetEngine,
  startSession,
  undoChange,
  type EngineState,
} from "./engine";
import { EVOLUTION_PARAMS as PR } from "./params";
import type { EngineInternal } from "./types";

const internal = (s: EngineState) => s.internal as EngineInternal;
const ctx = (i: number, sid = "s1") => ({ now: JOURNEY_T0 + i * 8_000, sessionId: sid });
const ui = (s: EngineState, signedIn = true) =>
  compose(s.decision, s.tier, { signedIn, stableNav: false, locked: false });

function feed(events: readonly TrackInput[], s: EngineState = createEngine("lab_t"), sid = "s1") {
  let i = 0;
  const changes: { k: number; to: ReturnType<typeof runSessions>["changes"][number]["to"] }[] = [];
  for (const input of events) {
    const r = ingest(s, input, ctx(i++, sid));
    s = r.state;
    if (r.change) changes.push({ k: s.profile.meaningfulCount, to: r.change.to });
  }
  return { s, changes };
}

describe("golden: focused personas (plan §3.3)", () => {
  it("a learning journey reaches LEARNING_FIRST tier 1 at meaningful action 5-6, tier 2 by 8-10, tier 3 only after 2 sessions", () => {
    const run = runPersona(PERSONAS["learning-explorer"]);
    const t1 = run.changes.find((c) => c.to.state === "LEARNING_FIRST" && c.to.tier === 1);
    const t2 = run.changes.find((c) => c.to.tier === 2);
    const t3 = run.changes.find((c) => c.to.tier === 3);
    expect(t1?.k).toBeGreaterThanOrEqual(5);
    expect(t1?.k).toBeLessThanOrEqual(6);
    expect(t2?.k).toBeGreaterThanOrEqual(8);
    expect(t2?.k).toBeLessThanOrEqual(10);
    expect(t2?.to.nav).toBe("LEARNING_PRIORITY");
    expect(t3).toBeDefined();
    const firstSession = run.rows.filter((r) => r.session === 1);
    expect(firstSession.every((r) => r.tier < 3)).toBe(true);
    expect(run.final.profile.sessionCount).toBe(2);
  });

  it("tier 2 shows the brief navigation Home, Learn, My Courses, Practice, Community, Profile", () => {
    const run = runPersona(PERSONAS["learning-explorer"]);
    const mid = runSessions([PERSONAS["learning-explorer"].sessions[0] ?? []]).final;
    expect(mid.tier).toBe(2);
    expect(ui(mid).navigation.top).toEqual([
      "HOME",
      "LEARN",
      "MY_COURSES",
      "PRACTICE",
      "COMMUNITY",
      "PROFILE",
    ]);
    expect(run.final.tier).toBe(3);
  });

  it("a career journey reaches CAREER_FIRST on the same thresholds", () => {
    const run = runPersona(PERSONAS["career-seeker"]);
    const t1 = run.changes.find((c) => c.to.state === "CAREER_FIRST" && c.to.tier === 1);
    const t2 = run.changes.find((c) => c.to.tier === 2);
    expect(t1?.k).toBeGreaterThanOrEqual(5);
    expect(t1?.k).toBeLessThanOrEqual(6);
    expect(t2?.k).toBeGreaterThanOrEqual(8);
    expect(t2?.k).toBeLessThanOrEqual(10);
    expect(t2?.to.nav).toBe("CAREER_PRIORITY");
    expect(run.rows.filter((r) => r.session === 1).every((r) => r.tier < 3)).toBe(true);
  });

  it("tier 1 changes the CTA and the first sections but leaves navigation alone", () => {
    const run = runPersona(PERSONAS["career-seeker"]);
    expect(run.changes[0]?.to.nav).toBe("UNIVERSAL");
    expect(run.changes[0]?.to.tier).toBe(1);
  });
});

describe("golden: nothing changes on weak signals", () => {
  const same = (s: EngineState) => {
    expect(s.decision.primaryState).toBe("UNIVERSAL");
    expect(s.tier).toBe(0);
  };

  it("one click", () => {
    const { s, changes } = feed([{ type: "course_viewed", entityId: "crs_a" }]);
    same(s);
    expect(changes).toEqual([]);
  });

  it("one commit", () => {
    for (const type of [
      "job_applied",
      "course_completed",
      "skill_swap_requested",
      "community_post_created",
    ] as const) {
      const { s, changes } = feed([{ type }]);
      same(s);
      expect(changes).toEqual([]);
    }
  });

  it("30 clicks on navigation tiles never adapt anything", () => {
    const items = ["JOBS", "COURSES", "COMMUNITY", "SKILLS", "HOME", "EXPLORE"] as const;
    const clicks: TrackInput[] = Array.from({ length: 30 }, (_, i) => ({
      type: "navigation_item_clicked" as const,
      metadata: { item: items[i % items.length], surface: "top" as const, position: i % 5 },
    }));
    const { s, changes } = feed(clicks);
    same(s);
    expect(changes).toEqual([]);
    expect(s.profile.meaningfulCount).toBe(0);
    // 30 section clicks too
    const secs: TrackInput[] = Array.from({ length: 30 }, () => ({
      type: "dashboard_section_clicked" as const,
      metadata: { section: "JOBS" as const, position: 2 },
    }));
    const r = feed(secs);
    same(r.s);
    expect(r.changes).toEqual([]);
  });

  it("30 repeated clicks on a single tile never adapt anything either", () => {
    const clicks: TrackInput[] = Array.from({ length: 30 }, () => ({
      type: "navigation_item_clicked" as const,
      metadata: { item: "JOBS" as const, surface: "top" as const },
    }));
    const { s, changes } = feed(clicks);
    same(s);
    expect(changes).toEqual([]);
  });

  it("10 mixed actions spread evenly over the 4 domains stay UNIVERSAL (or EXPLORER)", () => {
    const mix: TrackInput[] = [
      { type: "course_viewed", entityId: "crs_a" },
      { type: "job_viewed", entityId: "opp_a" },
      { type: "skill_viewed", entityId: "skl_a", metadata: { surface: "skillswap" } },
      { type: "community_post_viewed", entityId: "pst_a" },
      { type: "course_saved", entityId: "crs_a" },
      { type: "job_saved", entityId: "opp_a" },
      { type: "skill_passport_opened" },
      { type: "community_opened", entityId: "com_a" },
      { type: "course_viewed", entityId: "crs_b" },
      { type: "job_viewed", entityId: "opp_b" },
    ];
    const { s, changes } = feed(mix);
    expect(["UNIVERSAL", "EXPLORER"]).toContain(s.decision.primaryState);
    expect(changes.every((c) => c.to.state === "UNIVERSAL" || c.to.state === "EXPLORER")).toBe(
      true,
    );
  });

  it("no change in the first 4 meaningful actions even for a perfectly focused user", () => {
    const events: TrackInput[] = Array.from({ length: PR.MIN_TOTAL }, (_, i) => ({
      type: "course_started" as const,
      entityId: `crs_c${i}` as const,
    }));
    const { s, changes } = feed(events);
    expect(changes).toEqual([]);
    same(s);
  });
});

describe("golden: personas reach their expected outcome", () => {
  for (const id of PERSONA_IDS) {
    for (const gapMs of [1_000, 8_000, 20_000]) {
      it(`${id} at ${gapMs / 1000}s pacing`, () => {
        const p = PERSONAS[id];
        expect(p.sessions.length).toBeGreaterThanOrEqual(2);
        const run = runPersona(p, { gapMs });
        expect({
          state: run.final.decision.primaryState,
          mode: run.final.decision.behaviourMode,
          tier: run.final.tier,
        }).toEqual(p.expected);
      });
    }
    it(`${id} also works when the player calls startSession between sessions`, () => {
      const p = PERSONAS[id];
      const run = runPersona(p, { callStartSession: true });
      expect(run.final.profile.sessionCount).toBe(p.sessions.length);
      expect(run.final.decision.primaryState).toBe(p.expected.state);
      expect(run.final.decision.behaviourMode).toBe(p.expected.mode);
      expect(run.final.tier).toBe(p.expected.tier);
    });
  }

  it("every persona stream contains only sanitiser-clean inputs (no free text, valid entity ids)", () => {
    for (const p of Object.values(PERSONAS))
      for (const session of p.sessions)
        for (const input of session) {
          const r = ingest(createEngine("lab_x"), input, ctx(0));
          expect(r.event).not.toBeNull();
          expect(r.event?.entityId ?? null).toBe(input.entityId ?? null);
        }
  });
});

describe("decisions are compose-consistent and valid", () => {
  it("every committed decision validates, its actions match actionsFor, and its reason is the local template", () => {
    for (const id of PERSONA_IDS) {
      const p = PERSONAS[id];
      let s = createEngine("lab_c");
      let t = JOURNEY_T0;
      p.sessions.forEach((events, si) => {
        for (const input of events) {
          t += si * 2_000_000 + 8_000;
          const r = ingest(s, input, { now: t, sessionId: `sess${si}` });
          s = r.state;
          expect(validateDecision(s.decision, "local").ok).toBe(true);
          expect(s.decision.priorityActions).toEqual(actionsFor(s.decision.primaryState, s.tier));
          expect(s.decision.reason.length).toBeLessThanOrEqual(160);
          if (r.change) expect(s.decision.reason).toBe(renderReason(r.change.reasonCode));
        }
      });
    }
  });

  it("tier staging: 2 domain + 2 universal at tier 1, 3 + 1 at tier 2, 4 at tier 3", () => {
    const run = runPersona(PERSONAS["career-seeker"]);
    const tiers = new Map<number, string[]>();
    let s = createEngine("lab_c");
    let t = JOURNEY_T0;
    PERSONAS["career-seeker"].sessions.forEach((events, si) => {
      for (const input of events) {
        t += si * 2_000_000 + 8_000;
        s = ingest(s, input, { now: t, sessionId: `sess${si}` }).state;
        tiers.set(s.tier, s.decision.priorityActions);
      }
    });
    const own = (ids: string[]) =>
      ids.filter((a) => (C.priorityActions.CAREER_FIRST as readonly string[]).includes(a)).length;
    expect(own(tiers.get(1) ?? [])).toBe(2);
    expect(own(tiers.get(2) ?? [])).toBe(3);
    expect(own(tiers.get(3) ?? [])).toBe(4);
    expect(run.final.tier).toBe(3);
  });

  it("decideLocal equals the committed decision once the engine has settled", () => {
    const run = runPersona(PERSONAS["learning-explorer"]);
    const d = decideLocal(run.final);
    expect(d.decision).toEqual(run.final.decision);
    expect(d.tier).toBe(run.final.tier);
  });
});

describe("sessions and stale decay (D10)", () => {
  const DAY = 86_400_000;
  const learning = (PERSONAS["learning-explorer"].sessions[0] ?? []) as TrackInput[];

  it("startSession increments sessionCount and never double-counts with the first event", () => {
    let s = createEngine("lab_s");
    s = startSession(s, JOURNEY_T0);
    expect(s.profile.sessionCount).toBe(1);
    s = startSession(s, JOURNEY_T0 + 10);
    expect(s.profile.sessionCount).toBe(1);
    s = ingest(s, { type: "course_viewed", entityId: "crs_a" }, ctx(0, "a")).state;
    expect(s.profile.sessionCount).toBe(1);
    s = ingest(s, { type: "course_viewed", entityId: "crs_b" }, ctx(1, "b")).state;
    expect(s.profile.sessionCount).toBe(2);
  });

  it("a 30-minute idle gap inside the same sessionId starts a new session", () => {
    let s = ingest(
      createEngine("lab_s"),
      { type: "course_viewed", entityId: "crs_a" },
      { now: JOURNEY_T0, sessionId: "a" },
    ).state;
    s = ingest(
      s,
      { type: "course_viewed", entityId: "crs_b" },
      { now: JOURNEY_T0 + 1_800_001, sessionId: "a" },
    ).state;
    expect(s.profile.sessionCount).toBe(2);
  });

  it("applies 6 decay steps per 14 idle days as a loop (no Math.pow)", () => {
    const { s } = feed(learning);
    const before = internal(s).E.LEARNING;
    const after14 = internal(startSession(s, s.profile.lastSeen + 14 * DAY)).E.LEARNING;
    expect(after14 / before).toBeCloseTo(PR.LAMBDA_S ** 6, 12);
    const after28 = internal(startSession(s, s.profile.lastSeen + 28 * DAY)).E.LEARNING;
    expect(after28 / before).toBeCloseTo(PR.LAMBDA_S ** 12, 12);
    const none = internal(startSession(s, s.profile.lastSeen + 13 * DAY)).E.LEARNING;
    expect(none).toBe(before);
  });

  it("stale decay is capped, and softens a habit instead of snapping it", () => {
    const { s } = feed(learning);
    const e = internal(startSession(s, s.profile.lastSeen + 3650 * DAY)).E.LEARNING;
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThan(internal(s).E.LEARNING);
    expect(startSession(s, s.profile.lastSeen + 3650 * DAY).decision).toEqual(s.decision);
  });

  it("the stale decay of an implicit session boundary matches an explicit one", () => {
    const { s } = feed(learning);
    const later = s.profile.lastSeen + 20 * DAY;
    const implicit = ingest(
      s,
      { type: "page_viewed", metadata: { route: "/" } },
      { now: later, sessionId: "new" },
    ).state;
    const explicit = startSession(s, later);
    expect(internal(implicit).E.LEARNING).toBeCloseTo(internal(explicit).E.LEARNING, 12);
    expect(implicit.profile.sessionCount).toBe(explicit.profile.sessionCount);
  });
});

describe("undo, reset and AI advice", () => {
  const learning = (PERSONAS["learning-explorer"].sessions[0] ?? []) as TrackInput[];

  it("undoChange reverts the last visible change and vetoes it for 20 events and the rest of the session", () => {
    let { s } = feed(learning.slice(0, 7));
    expect(s.tier).toBe(1);
    const r = undoChange(s, JOURNEY_T0);
    expect(r.change?.source).toBe("undo");
    expect(r.change?.reasonCode.key).toBe("UNDO");
    s = r.state;
    expect(s.decision.primaryState).toBe("UNIVERSAL");
    expect(s.tier).toBe(0);
    // keep behaving the same way in the same session: the change must not come back
    for (let i = 0; i < 12; i++) {
      const rr = ingest(s, { type: "course_viewed", entityId: `crs_x${i}` }, ctx(100 + i));
      s = rr.state;
      expect(rr.change).toBeNull();
    }
    expect(s.decision.primaryState).toBe("UNIVERSAL");
    // nothing left to undo
    expect(undoChange(s, JOURNEY_T0).change).toBeNull();
  });

  it("undo with nothing to undo is a no-op", () => {
    const s = createEngine("lab_u");
    const r = undoChange(s, JOURNEY_T0);
    expect(r.state).toBe(s);
    expect(r.change).toBeNull();
  });

  it("resetEngine bumps the epoch, returns to UNIVERSAL and keeps the counts", () => {
    const run = runPersona(PERSONAS["career-seeker"]);
    const r = resetEngine(run.final);
    expect(r.epoch).toBe(run.final.epoch + 1);
    expect(r.decision.primaryState).toBe("UNIVERSAL");
    expect(r.tier).toBe(0);
    expect(r.profile.countsByType).toEqual(run.final.profile.countsByType);
    expect(r.profile.meaningfulCount).toBe(0);
    expect(r.seq).toBe(run.final.seq);
    const again = ingest(
      r,
      { type: "job_viewed", entityId: "opp_a" },
      { now: JOURNEY_T0 + 9e9, sessionId: "z" },
    );
    expect(again.change).toBeNull();
  });

  const advice = (s: EngineState, over: Partial<Parameters<typeof applyAdvice>[1]> = {}) => ({
    primaryState: "LEARNING_FIRST" as const,
    behaviourMode: "RESEARCH" as const,
    confidence: 0.8,
    epoch: s.epoch,
    meaningfulAt: s.profile.meaningfulCount,
    aiReason: "x",
    ...over,
  });

  it("drops advice from another epoch or older than 15 meaningful events", () => {
    const { s } = feed(learning.slice(0, 8));
    expect(internal(applyAdvice(s, advice(s, { epoch: s.epoch + 1 }), 0).state).advice).toBeNull();
    expect(
      internal(applyAdvice(s, advice(s, { meaningfulAt: s.profile.meaningfulCount - 16 }), 0).state)
        .advice,
    ).toBeNull();
    expect(internal(applyAdvice(s, advice(s), 0).state).advice).not.toBeNull();
  });

  it("advice changes only the mode target: navigation, layout and actions stay local", () => {
    // 8 learning events: LEARNING_FIRST, no RESEARCH signals, advice asks for RESEARCH.
    const events: TrackInput[] = Array.from({ length: 8 }, (_, i) => ({
      type: i % 2 ? ("course_started" as const) : ("course_saved" as const),
      entityId: `crs_a${i}` as const,
    }));
    let { s } = feed(events);
    expect(s.decision.primaryState).toBe("LEARNING_FIRST");
    const before = s.decision;
    s = applyAdvice(s, advice(s), 0).state;
    expect(s.decision).toEqual(before); // nothing at once: confirmations still apply
    let n = 100;
    for (let i = 0; i < 6; i++)
      s = ingest(
        s,
        { type: i % 2 ? "course_started" : "course_saved", entityId: `crs_n${i}` },
        ctx(n++),
      ).state;
    expect(s.decision.behaviourMode).toBe("RESEARCH");
    // the adopted advice holds while it is fresh, then local evidence takes over
    s = ingest(s, { type: "course_saved", entityId: "crs_hold" }, ctx(n++)).state;
    s = ingest(s, { type: "course_started", entityId: "crs_hold2" }, ctx(n++)).state;
    expect(s.decision.behaviourMode).toBe("RESEARCH");
    expect(s.decision.priorityActions).toEqual(actionsFor(s.decision.primaryState, s.tier));
    expect(["UNIVERSAL", C.states.LEARNING_FIRST.nav]).toContain(s.decision.navigationMode);
  });

  it("advice for another domain never causes a direct domain-to-domain switch", () => {
    let { s } = feed(learning.slice(0, 8));
    expect(s.decision.primaryState).toBe("LEARNING_FIRST");
    s = applyAdvice(
      s,
      advice(s, { primaryState: "CAREER_FIRST", behaviourMode: "BALANCED" }),
      0,
    ).state;
    let n = 200;
    for (let i = 0; i < 5; i++) {
      const r = ingest(s, { type: "course_viewed", entityId: `crs_k${i}` }, ctx(n++));
      s = r.state;
      expect(s.decision.primaryState).not.toBe("CAREER_FIRST");
    }
  });

  it("advice may enter a domain from neutral only with local evidence", () => {
    // 6 balanced events, then advice to go career-first: the local gates (domain events) refuse it.
    const mix: TrackInput[] = [
      { type: "course_viewed", entityId: "crs_a" },
      { type: "job_viewed", entityId: "opp_a" },
      { type: "skill_viewed", entityId: "skl_a", metadata: { surface: "skillswap" } },
      { type: "community_post_viewed", entityId: "pst_a" },
      { type: "course_saved", entityId: "crs_a" },
      { type: "job_saved", entityId: "opp_a" },
      { type: "community_opened", entityId: "com_a" },
    ];
    let { s } = feed(mix);
    s = applyAdvice(
      s,
      advice(s, { primaryState: "CAREER_FIRST", behaviourMode: "BALANCED" }),
      0,
    ).state;
    for (let i = 0; i < 3; i++) s = ingest(s, { type: "page_viewed" }, ctx(300 + i)).state;
    expect(s.decision.primaryState).toBe("UNIVERSAL");
  });
});

describe("explainNext and reasons", () => {
  it("names the next step in words, and stops at the top tier", () => {
    const events = PERSONAS["career-seeker"].sessions[0] ?? [];
    const { s } = feed(events.slice(0, 3));
    expect(explainNext(s)).toMatch(/^\d+ more career actions? to move it up on Home$/);
    const mid = runSessions([events]).final;
    expect(mid.tier).toBe(2);
    expect(explainNext(mid)).toMatch(/another visit|more career action/);
    expect(explainNext(createEngine("lab_x"))).toBeNull();
    expect(explainNext(runPersona(PERSONAS["career-seeker"]).final)).toBeNull();
  });

  it("every reason key renders plain text of at most 160 characters", () => {
    for (const key of REASON_KEYS) {
      const variants: (Record<string, string | number> | undefined)[] = [
        undefined,
        { domain: "CAREER" },
        { mode: "RESEARCH" },
        { count: 3 },
      ];
      for (const slots of variants) {
        const text = renderReason({ key, ...(slots ? { slots } : {}) });
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(160);
        expect(text).not.toMatch(/[<>{}`]|https?:/);
      }
    }
  });
});

describe("golden: the Intent Lane has a place in every state", () => {
  const LAYOUTS = Object.keys(C.layouts) as (keyof typeof C.layouts)[];

  it("every layout lists INTENT_LANE exactly once", () => {
    for (const layout of LAYOUTS)
      expect(
        (C.layouts[layout] as readonly string[]).filter((id) => id === "INTENT_LANE"),
        layout,
      ).toHaveLength(1);
  });

  it("the career and learning hubs keep their own five sections first; the lane follows them", () => {
    expect((C.layouts.CAREER_DISCOVERY as readonly string[]).indexOf("INTENT_LANE")).toBe(5);
    expect((C.layouts.LEARNING_HUB as readonly string[]).indexOf("INTENT_LANE")).toBe(5);
  });

  it("the skill and community hubs lift it to second place, so the lane reaches tier 1", () => {
    for (const layout of ["SKILL_EXCHANGE_HUB", "COMMUNITY_HUB"] as const)
      expect((C.layouts[layout] as readonly string[]).indexOf("INTENT_LANE")).toBe(1);
  });

  it("every journey ends with the lane on the page, once, never folded away from MORE_FOR_YOU", () => {
    for (const persona of PERSONA_IDS) {
      const final = runPersona(PERSONAS[persona]).final;
      const sections = ui(final).sections;
      expect(
        sections.filter((s) => s.id === "INTENT_LANE"),
        persona,
      ).toHaveLength(1);
    }
  });

  it("the lane is a PLATFORM section: a click on it never tilts one domain", async () => {
    const { SECTION_META } = await import("../../config/sections");
    expect(SECTION_META.INTENT_LANE.domain).toBe("PLATFORM");
  });
});

describe("golden: guest copy until real progress exists", () => {
  it("a visitor sees Start learning and Keep exploring courses, a learner with progress sees Continue Learning", async () => {
    const { ctaFor, ledeFor } = await import("../../config/evolution-config");
    expect(ctaFor("CONTINUE_LEARNING", false).label).toBe("Start learning");
    expect(ctaFor("CONTINUE_LEARNING", false).to).toBe("/courses");
    expect(ctaFor("CONTINUE_LEARNING", true).label).toBe("Continue Learning");
    expect(ledeFor("evo.lede.learning_first", false)).toMatch(/^Keep exploring courses/);
    expect(ledeFor("evo.lede.learning_first", true)).toBe(C.ledes["evo.lede.learning_first"]);
    // CTAs without a starter are unchanged for everyone
    expect(ctaFor("FIND_OPPORTUNITIES", false).label).toBe("Find Opportunities");
  });
});
