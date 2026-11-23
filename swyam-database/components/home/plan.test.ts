import { describe, expect, it } from "vitest";
import { compose, UNIVERSAL_DECISION, actionsFor } from "@/evolution/core/evolution/compose";
import { EVOLUTION_CONFIG as C } from "@/evolution/config/evolution-config";
import type { EvolutionState, SectionId, Tier, UISection } from "@/evolution/types";
import {
  PHONE_STRIP_PX,
  flowCells,
  groupRows,
  heroLayout,
  homeOrder,
  resolveCta,
  splitSections,
} from "./plan";

const plan = (state: EvolutionState, tier: Tier, signedIn = true) =>
  compose(
    {
      ...UNIVERSAL_DECISION,
      primaryState: state,
      navigationMode: C.states[state].nav,
      homepageLayout: C.states[state].layout,
      priorityActions: actionsFor(state, tier),
    },
    tier,
    { signedIn, stableNav: false, locked: false },
  );

const lead = (ids: SectionId[], n = 5) => ids.slice(0, n);

describe("homeOrder", () => {
  it("CAREER_FIRST tier 3 leads with the career hub", () => {
    expect(lead(homeOrder(plan("CAREER_FIRST", 3).sections, true))).toEqual([
      "RECOMMENDED_JOBS",
      "INTERNSHIPS",
      "APPLICATIONS",
      "CAREER_LAUNCHER",
      "RELEVANT_COURSES",
    ]);
  });

  it("LEARNING_FIRST tier 3 leads with the learning hub", () => {
    expect(lead(homeOrder(plan("LEARNING_FIRST", 3).sections, true))).toEqual([
      "CONTINUE_LEARNING",
      "MY_COURSES",
      "PRACTICE",
      "RECOMMENDED_COURSES",
      "SKILL_BUILDER",
    ]);
  });

  it("UNIVERSAL keeps the universal order, and CLOSING is for visitors only", () => {
    const ui = plan("UNIVERSAL", 0, false);
    const universal = (C.layouts.UNIVERSAL as SectionId[]).filter((id) => id !== "CLOSING");
    expect(homeOrder(ui.sections, true)).toEqual(universal);
    expect(homeOrder(ui.sections, false)).toEqual([...universal, "CLOSING"]);
  });

  it("never renders the fold marker as a section, and folds come after the main list", () => {
    const ui = plan("CAREER_FIRST", 3);
    const { main, folded } = splitSections(ui.sections, true);
    expect(ui.sections.some((s) => s.id === "MORE_FOR_YOU")).toBe(folded.length > 0);
    expect([...main, ...folded].some((s) => s.id === "MORE_FOR_YOU")).toBe(false);
    expect(homeOrder(ui.sections, true)).toEqual([...main, ...folded].map((s) => s.id));
  });

  it("every section appears exactly once", () => {
    const ids = homeOrder(plan("COMMUNITY_FIRST", 3).sections, false);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("groupRows", () => {
  it("pairs consecutive padded sections and keeps bleed sections alone", () => {
    const rows = groupRows(plan("CAREER_FIRST", 3).sections.filter((s) => !s.folded));
    expect(rows[0]?.kind).toBe("grid");
    expect(rows[0]?.items.map((s) => s.id).slice(0, 2)).toEqual([
      "RECOMMENDED_JOBS",
      "INTERNSHIPS",
    ]);
    for (const r of rows) if (r.kind === "bleed") expect(r.items).toHaveLength(1);
  });
});

describe("resolveCta", () => {
  it("falls back to Explore when nothing real can be resumed", () => {
    const r = resolveCta("CONTINUE_WHERE_LEFT", true, () => null, []);
    expect(r.href).toBe("/explore");
  });
  it("links the newest resolvable entity", () => {
    const recent = [
      { entityId: "ext_x" as const, type: "job_viewed" as const, at: 2 },
      { entityId: "crs_a" as const, type: "course_viewed" as const, at: 1 },
    ];
    const r = resolveCta(
      "CONTINUE_WHERE_LEFT",
      false,
      (id) => (id === "crs_a" ? "/courses/a" : null),
      recent,
    );
    expect(r.href).toBe("/courses/a");
  });
  it("picks the visitor route for a member/visitor target", () => {
    expect(resolveCta("FIND_A_SKILL", false, () => null, []).href).toBe("/board");
    expect(resolveCta("FIND_A_SKILL", true, () => null, []).href).toBe("/skillswap");
  });
});

describe("flowCells", () => {
  const sec = (id: SectionId, span: "half" | "full" = "half") =>
    ({
      id,
      key: id,
      variant: "standard",
      folded: false,
      span: { phone: "full", tablet: span, desktop: span },
    }) as UISection;

  it("bleed sections span the whole width and end a group", () => {
    const cells = flowCells([sec("INTERNSHIPS"), sec("JOBS", "full"), sec("PRACTICE")]);
    expect(cells.get("JOBS")?.bleed).toBe(true);
    expect(cells.get("INTERNSHIPS")?.last).toBe(true);
    expect(cells.get("PRACTICE")?.last).toBe(true);
  });

  it("half sections alternate left and right, and a full one restarts the pairing", () => {
    const cells = flowCells([
      sec("INTERNSHIPS"),
      sec("APPLICATIONS"),
      sec("RECOMMENDED_JOBS", "full"),
      sec("PRACTICE"),
      sec("MY_COURSES"),
    ]);
    const tj = (id: string) => cells.get(id)?.tj;
    expect([tj("INTERNSHIPS"), tj("APPLICATIONS"), tj("PRACTICE"), tj("MY_COURSES")]).toEqual([
      0, 1, 0, 1,
    ]);
    expect(cells.get("RECOMMENDED_JOBS")?.tabletFull).toBe(true);
    expect(cells.get("RECOMMENDED_JOBS")?.desktopFull).toBe(true);
  });

  it("a group uses as many desktop columns as its longest run of halves, up to three", () => {
    const four = flowCells([
      sec("INTERNSHIPS"),
      sec("APPLICATIONS"),
      sec("PRACTICE"),
      sec("MY_COURSES"),
    ]);
    expect(four.get("INTERNSHIPS")?.dc).toBe(3);
    expect(
      ["INTERNSHIPS", "APPLICATIONS", "PRACTICE", "MY_COURSES"].map((id) => four.get(id)?.dj3),
    ).toEqual([0, 1, 2, 0]);
    const one = flowCells([sec("INTERNSHIPS")]);
    expect(one.get("INTERNSHIPS")?.dc).toBe(1);
    const two = flowCells([sec("INTERNSHIPS"), sec("APPLICATIONS")]);
    expect(two.get("APPLICATIONS")?.dc).toBe(2);
    expect(two.get("APPLICATIONS")?.dj2).toBe(1);
  });

  it("every section of a real layout gets a cell", () => {
    const ui = plan("CAREER_FIRST", 3);
    const { main } = splitSections(ui.sections, true);
    const cells = flowCells(main);
    expect(main.every((s) => cells.has(s.key))).toBe(true);
  });
});

describe("heroLayout (hero cockpit, compact mode)", () => {
  const learned: EvolutionState[] = [
    "CAREER_FIRST",
    "LEARNING_FIRST",
    "SKILL_EXCHANGE_FIRST",
    "COMMUNITY_FIRST",
    "EXPLORER",
  ];

  it("UNIVERSAL keeps the full hero: stats and try-chips stay, the Lab link takes the lead slot", () => {
    for (const tier of [0, 1, 2, 3] as Tier[]) {
      const l = heroLayout("UNIVERSAL", tier, false);
      expect(l).toEqual({
        evolved: false,
        compactPhone: false,
        leadStrip: false,
        watchAdapt: true,
        stats: true,
      });
    }
  });

  it.each(learned)("%s at tier >= 1 compacts the phone hero and shows the lead strip", (state) => {
    for (const tier of [1, 2, 3] as Tier[]) {
      const l = heroLayout(state, tier, false);
      expect(l.evolved).toBe(true);
      expect(l.compactPhone).toBe(true);
      expect(l.leadStrip).toBe(true);
      expect(l.watchAdapt).toBe(false);
    }
  });

  it("tier 0 is never compact, whatever the state says", () => {
    expect(heroLayout("CAREER_FIRST", 0, false).compactPhone).toBe(false);
  });

  it("the proof row follows sign-in only, never the state", () => {
    expect(heroLayout("CAREER_FIRST", 3, true).stats).toBe(false);
    expect(heroLayout("CAREER_FIRST", 3, false).stats).toBe(true);
  });

  it("the phone strip is one 44 px touch row", () => {
    expect(PHONE_STRIP_PX).toBe(44);
  });

  it("the layout is a pure function of state, tier and sign-in", () => {
    expect(heroLayout("COMMUNITY_FIRST", 2, true)).toEqual(heroLayout("COMMUNITY_FIRST", 2, true));
  });
});
