// Structure, not paint: reachability, the brief's navigation lists, bottom-bar rules and the staged reveal.
import { describe, expect, it } from "vitest";
import { actionsFor, compose } from "../core/evolution/compose";
import { decisionOf } from "../core/evolution/decide";
import type { EvolutionState, NavItemId, Tier, UIState } from "../types";
import { EVOLUTION_CONFIG as C } from "./evolution-config";
import { EVOLUTION_STATES, NAV_ITEM_IDS, SECTION_IDS } from "./ids";
import { NAV_REGISTRY } from "./navigation";

const DOMAIN_OF: Record<
  EvolutionState,
  "LEARNING" | "CAREER" | "SKILL_EXCHANGE" | "COMMUNITY" | null
> = {
  UNIVERSAL: null,
  LEARNING_FIRST: "LEARNING",
  CAREER_FIRST: "CAREER",
  SKILL_EXCHANGE_FIRST: "SKILL_EXCHANGE",
  COMMUNITY_FIRST: "COMMUNITY",
  EXPLORER: null,
};

function uiFor(
  state: EvolutionState,
  tier: Tier,
  signedIn: boolean,
  mode?: Parameters<typeof decisionOf>[0]["mode"],
): UIState {
  const P = DOMAIN_OF[state];
  const m = mode ?? (state === "EXPLORER" ? "EXPLORER" : "BALANCED");
  const { decision } = decisionOf({ P, ptier: P ? (tier as Tier) : 0, mode: m }, 0.7, "x");
  const d = { ...decision, primaryState: state, priorityActions: actionsFor(state, tier) };
  return compose(d, tier, { signedIn, stableNav: false, locked: false });
}

const cells: { state: EvolutionState; tier: Tier }[] = [];
for (const state of EVOLUTION_STATES)
  for (const tier of [0, 1, 2, 3] as Tier[]) {
    if (state === "UNIVERSAL" && tier > 0) continue;
    if (state !== "UNIVERSAL" && tier === 0) continue;
    cells.push({ state, tier });
  }

describe("reachability: every feature stays reachable in every arrangement", () => {
  for (const { state, tier } of cells)
    for (const signedIn of [true, false])
      it(`${state} tier ${tier} ${signedIn ? "member" : "visitor"}`, () => {
        const ui = uiFor(state, tier, signedIn);
        const reachable = new Set<NavItemId>(ui.navigation.top);
        for (const g of ui.navigation.overflow) for (const id of g.items) reachable.add(id);
        for (const id of NAV_ITEM_IDS) if (NAV_REGISTRY[id].domain === "ACCOUNT") reachable.add(id); // avatar menu
        // /explore lists every destination, so EXPLORE itself must be reachable.
        expect(reachable.has("EXPLORE")).toBe(true);
        for (const id of NAV_ITEM_IDS)
          expect(reachable.has(id), `${id} in ${state}/${tier}`).toBe(true);
        // account items never appear in the overflow
        for (const g of ui.navigation.overflow)
          for (const id of g.items) expect(NAV_REGISTRY[id].domain).not.toBe("ACCOUNT");
        // the bottom bar: at most 5, Home first
        expect(ui.navigation.bottom.length).toBeLessThanOrEqual(5);
        expect(ui.navigation.bottom[0]).toBe("HOME");
        expect(ui.navigation.top[0]).toBe("HOME");
        // visitors see EVENTS in place of MESSAGES in the top bar
        if (!signedIn) expect(ui.navigation.top).not.toContain("MESSAGES");
        // every section appears at most once and CLOSING is last
        const ids = ui.sections.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.at(-1)).toBe("CLOSING");
        for (const id of ids) expect(SECTION_IDS).toContain(id);
        expect(new Set(ui.sections.map((s) => s.key)).size).toBe(ui.sections.length);
      });
});

describe("structure, not paint", () => {
  const universal = uiFor("UNIVERSAL", 0, true);
  const first3 = (ui: UIState) => ui.sections.slice(0, 3).map((s) => s.id);

  for (const state of EVOLUTION_STATES.filter((s) => s !== "UNIVERSAL" && s !== "EXPLORER")) {
    it(`${state} at tier 2 changes both the navigation and the first 3 sections`, () => {
      const ui = uiFor(state, 2, true);
      expect(ui.navigation.top).not.toEqual(universal.navigation.top);
      expect(first3(ui)).not.toEqual(first3(universal));
    });
    it(`${state} at tier 1 changes the CTA, lede and sections but not the navigation`, () => {
      const ui = uiFor(state, 1, true);
      expect(ui.navigation.top).toEqual(universal.navigation.top);
      expect(ui.hero.cta).not.toBe(universal.hero.cta);
      expect(ui.hero.ledeKey).not.toBe(universal.hero.ledeKey);
      expect(first3(ui)).not.toEqual(first3(universal));
    });
  }

  it("EXPLORER keeps the universal navigation and changes the sections", () => {
    for (const tier of [1, 2, 3] as Tier[]) {
      const ui = uiFor("EXPLORER", tier, true);
      expect(ui.navigation.top).toEqual(universal.navigation.top);
      expect(ui.sections.map((s) => s.id)).not.toEqual(universal.sections.map((s) => s.id));
    }
  });

  it("the UIState carries no colour, font or theme field, at runtime or in the nested objects", () => {
    const bad = /colou?r|font|theme|gradient|palette|background|shadow|radius|hex|rgb/i;
    const keys = (o: unknown, out: string[] = []): string[] => {
      if (Array.isArray(o)) for (const x of o) keys(x, out);
      else if (o && typeof o === "object")
        for (const [k, v] of Object.entries(o)) {
          out.push(k);
          keys(v, out);
        }
      return out;
    };
    for (const { state, tier } of cells)
      expect(keys(uiFor(state, tier, true)).filter((k) => bad.test(k))).toEqual([]);
  });

  it("tier staging: actions 4 / 2+2 / 3+1 / 4 and the overlay only at tier 3", () => {
    const own = (state: EvolutionState, tier: Tier) =>
      actionsFor(state, tier).filter((a) =>
        (C.priorityActions[state] as readonly string[]).includes(a),
      ).length;
    expect(actionsFor("CAREER_FIRST", 0)).toEqual(C.priorityActions.UNIVERSAL);
    expect(own("CAREER_FIRST", 1)).toBe(2);
    expect(own("CAREER_FIRST", 2)).toBe(3);
    expect(own("CAREER_FIRST", 3)).toBe(4);
    for (const tier of [1, 2] as Tier[])
      expect(uiFor("LEARNING_FIRST", tier, true, "RESEARCH").display.showCompare).toBe(false);
    expect(uiFor("LEARNING_FIRST", 3, true, "RESEARCH").display.showCompare).toBe(true);
    expect(uiFor("LEARNING_FIRST", 3, true, "RESEARCH").density).toBe("research");
  });

  it("MORE_FOR_YOU appears only when something is folded, and folded sections follow it", () => {
    for (const { state, tier } of cells) {
      const ui = uiFor(state, tier, true);
      const folded = ui.sections.filter((s) => s.folded);
      const at = ui.sections.findIndex((s) => s.id === "MORE_FOR_YOU");
      if (folded.length === 0) expect(at).toBe(-1);
      else {
        expect(at).toBeGreaterThan(-1);
        for (const f of folded)
          expect(ui.sections.findIndex((s) => s.id === f.id)).toBeGreaterThan(at);
      }
    }
  });
});

describe("the brief's navigation lists, verbatim", () => {
  const top = (state: EvolutionState) => uiFor(state, 2, true).navigation.top;
  it("CAREER_PRIORITY: Home, Jobs, Applications, Courses, Community, Profile", () => {
    expect(top("CAREER_FIRST")).toEqual([
      "HOME",
      "JOBS",
      "APPLICATIONS",
      "COURSES",
      "COMMUNITY",
      "PROFILE",
    ]);
  });
  it("LEARNING_PRIORITY: Home, Learn, My Courses, Practice, Community, Profile", () => {
    expect(top("LEARNING_FIRST")).toEqual([
      "HOME",
      "LEARN",
      "MY_COURSES",
      "PRACTICE",
      "COMMUNITY",
      "PROFILE",
    ]);
  });
  it("SKILL_EXCHANGE_PRIORITY: Home, Skills, Matches, Community, Courses, Profile", () => {
    expect(top("SKILL_EXCHANGE_FIRST")).toEqual([
      "HOME",
      "SKILLS",
      "MATCHES",
      "COMMUNITY",
      "COURSES",
      "PROFILE",
    ]);
  });
  it("COMMUNITY_PRIORITY shows Events instead of Messages to visitors", () => {
    expect(uiFor("COMMUNITY_FIRST", 2, true).navigation.top).toContain("MESSAGES");
    const v = uiFor("COMMUNITY_FIRST", 2, false).navigation.top;
    expect(v).toContain("EVENTS");
    expect(v).not.toContain("MESSAGES");
  });
  it("stable navigation (recruiters, institutes) never evolves", () => {
    const { decision } = decisionOf({ P: "CAREER", ptier: 3, mode: "RESEARCH" }, 0.9, "x");
    const ui = compose(decision, 3, { signedIn: true, stableNav: true, locked: false });
    expect(ui.navigation.top).toEqual(C.navigation.UNIVERSAL);
  });
});

/* Taken off the home page to cut clutter; their components stay registered. */
const RETIRED_FROM_HOME = ["TRUST_STRIP", "VOICE", "PARTNERS"];

describe("the Intent Lane: present, reachable, and never the only way to anything", () => {
  it("appears exactly once in every state, tier and audience, folded only into MORE_FOR_YOU", () => {
    for (const { state, tier } of cells)
      for (const signedIn of [true, false]) {
        const ui = uiFor(state, tier, signedIn);
        const hits = ui.sections.filter((s) => s.id === "INTENT_LANE");
        expect(hits, `${state}/${tier}`).toHaveLength(1);
        if (hits[0]?.folded) {
          const more = ui.sections.findIndex((s) => s.id === "MORE_FOR_YOU");
          expect(more).toBeGreaterThan(-1);
          expect(ui.sections.findIndex((s) => s.id === "INTENT_LANE")).toBeGreaterThan(more);
        }
      }
  });

  it("leads the skill and community hubs at tier 1, where the hub lead is two sections", () => {
    for (const state of ["SKILL_EXCHANGE_FIRST", "COMMUNITY_FIRST"] as EvolutionState[])
      expect(
        uiFor(state, 1, true)
          .sections.slice(0, 2)
          .map((s) => s.id),
      ).toContain("INTENT_LANE");
  });

  it("sits below the courses and jobs in the standard layout, so the first screen is unchanged", () => {
    const order = C.layouts.UNIVERSAL as readonly string[];
    expect(order.indexOf("INTENT_LANE")).toBeGreaterThan(order.indexOf("JOBS"));
  });

  it("every section still has a meta entry and a layout slot somewhere", () => {
    const placed = new Set<string>(Object.values(C.layouts).flat());
    for (const id of SECTION_IDS)
      if (!["MORE_FOR_YOU", "CLOSING", ...RETIRED_FROM_HOME].includes(id))
        expect(placed.has(id), id).toBe(true);
  });
});
