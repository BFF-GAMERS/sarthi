import { describe, expect, it } from "vitest";
import { NAV_ITEM_IDS } from "@/evolution/config/ids";
import { NAV_REGISTRY } from "@/evolution/config/navigation";
import { UNIVERSAL_DECISION, compose } from "@/evolution/core/evolution/compose";
import type { ComposeContext, EvolutionDecision, EvolutionState, Tier } from "@/evolution/types";
import { NAV_BY_TYPE, stableBottomFor } from "@/lib/profile-type";
import {
  AVATAR_MENU_ITEMS,
  NAV_BREAKPOINTS,
  activeNavItem,
  bottomSlots,
  DOT_HIT_PX,
  chipText,
  confidencePct,
  dotLabel,
  dotTone,
  groupByDomain,
  islandInnerWidth,
  middleLinks,
  navFit,
  overflowOf,
  parseHref,
  shortStateLabel,
} from "./nav-model";

const member: ComposeContext = { signedIn: true, stableNav: false, locked: false };
const visitor: ComposeContext = { signedIn: false, stableNav: false, locked: false };

function ui(state: EvolutionState, tier: Tier, ctx = member) {
  const decision = {
    ...UNIVERSAL_DECISION,
    primaryState: state,
  } as EvolutionDecision;
  return compose(decision, tier, ctx);
}

const labels = (ids: readonly (typeof NAV_ITEM_IDS)[number][]) =>
  ids.map((id) => NAV_REGISTRY[id].label);

describe("navigation structure from compose()", () => {
  it("UNIVERSAL reads Home, Explore, Courses, Jobs, Community, Profile", () => {
    expect(labels(ui("UNIVERSAL", 0).navigation.top)).toEqual([
      "Home",
      "Explore",
      "Courses",
      "Jobs",
      "Community",
      "Profile",
    ]);
  });

  it("CAREER_FIRST at tier 2 puts Jobs, Applications, Courses, Community in the top bar", () => {
    expect(labels(middleLinks(ui("CAREER_FIRST", 2).navigation.top))).toEqual([
      "Jobs",
      "Applications",
      "Courses",
      "Community",
    ]);
  });

  it("LEARNING_FIRST at tier 2 puts Learn, My Courses, Practice, Community in the top bar", () => {
    expect(labels(middleLinks(ui("LEARNING_FIRST", 2).navigation.top))).toEqual([
      "Learn",
      "My Courses",
      "Practice",
      "Community",
    ]);
  });

  it("tier 1 does not change the navigation", () => {
    expect(ui("CAREER_FIRST", 1).navigation.top).toEqual(ui("UNIVERSAL", 0).navigation.top);
  });

  it("stable-nav accounts (recruiter, institute) keep the universal bar", () => {
    const stable = ui("CAREER_FIRST", 3, { ...member, stableNav: true });
    expect(stable.navigation.top).toEqual(ui("UNIVERSAL", 0).navigation.top);
  });

  it("the bottom bar is Home plus the four middle items", () => {
    const top = ui("CAREER_FIRST", 2).navigation.top;
    const slots = bottomSlots(top);
    expect(slots).toHaveLength(5);
    expect(slots[0]).toBe("HOME");
    expect(slots.slice(1)).toEqual(middleLinks(top));
  });

  it("visitors see Events where a member sees Messages", () => {
    const m = middleLinks(ui("COMMUNITY_FIRST", 2, member).navigation.top);
    const v = middleLinks(ui("COMMUNITY_FIRST", 2, visitor).navigation.top);
    expect(m).toContain("MESSAGES");
    expect(v).not.toContain("MESSAGES");
    expect(v).toContain("EVENTS");
  });
});

describe("reachability", () => {
  it("every destination is in the top bar, the overflow or the avatar menu in every state", () => {
    const states: EvolutionState[] = [
      "UNIVERSAL",
      "LEARNING_FIRST",
      "CAREER_FIRST",
      "SKILL_EXCHANGE_FIRST",
      "COMMUNITY_FIRST",
      "EXPLORER",
    ];
    for (const state of states) {
      for (const ctx of [member, visitor]) {
        const nav = ui(state, 3, ctx).navigation;
        const reach = new Set([
          ...nav.top,
          ...nav.overflow.flatMap((g) => g.items),
          ...AVATAR_MENU_ITEMS,
        ]);
        // Visitors lose MESSAGES to EVENTS in the bar; MESSAGES stays in the overflow group.
        for (const id of NAV_ITEM_IDS) expect(reach.has(id), `${state} ${id}`).toBe(true);
      }
    }
  });

  it("/explore groups every id exactly once, including the Lab", () => {
    const groups = groupByDomain(NAV_ITEM_IDS);
    const all = groups.flatMap((g) => g.items);
    expect(all).toHaveLength(NAV_ITEM_IDS.length);
    expect(new Set(all).size).toBe(NAV_ITEM_IDS.length);
    expect(all).toContain("LAB");
    expect(groups.map((g) => g.domain)).toEqual([
      "LEARNING",
      "CAREER",
      "SKILL_EXCHANGE",
      "COMMUNITY",
      "PLATFORM",
      "ACCOUNT",
    ]);
  });

  it("overflowOf never lists account items or what is already shown", () => {
    const g = overflowOf(["HOME", "JOBS"]);
    const ids = g.flatMap((x) => x.items);
    expect(ids).not.toContain("JOBS");
    expect(ids).not.toContain("SETTINGS");
    expect(g.some((x) => x.domain === "ACCOUNT")).toBe(false);
  });
});

describe("active matching", () => {
  it("lights only the specific item when the href carries a query or hash", () => {
    const items = ["SKILLS", "MATCHES"] as const;
    expect(activeNavItem(items, { pathname: "/skillswap" })).toBe("SKILLS");
    expect(activeNavItem(items, { pathname: "/skillswap", searchStr: "?tab=matches" })).toBe(
      "MATCHES",
    );
    const learn = ["MY_COURSES", "PRACTICE"] as const;
    expect(activeNavItem(learn, { pathname: "/my-learning" })).toBe("MY_COURSES");
    expect(activeNavItem(learn, { pathname: "/my-learning", hash: "practice" })).toBe("PRACTICE");
  });

  it("uses the registry's also paths and prefers an own path over them", () => {
    expect(activeNavItem(["JOBS"], { pathname: "/internships/abc" })).toBe("JOBS");
    expect(activeNavItem(["JOBS", "INTERNSHIPS"], { pathname: "/internships" })).toBe(
      "INTERNSHIPS",
    );
    expect(activeNavItem(["HOME", "COURSES"], { pathname: "/courses/python" })).toBe("COURSES");
    expect(activeNavItem(["HOME", "COURSES"], { pathname: "/" })).toBe("HOME");
    expect(activeNavItem(["HOME"], { pathname: "/jobs" })).toBeNull();
  });
});

describe("parseHref", () => {
  it("splits path, search and hash for the router", () => {
    expect(parseHref("/skillswap?tab=matches")).toEqual({
      to: "/skillswap",
      search: { tab: "matches" },
    });
    expect(parseHref("/my-learning#practice")).toEqual({ to: "/my-learning", hash: "practice" });
    expect(parseHref("/auth?mode=login&next=%2Fmy-learning%23practice")).toEqual({
      to: "/auth",
      search: { mode: "login", next: "/my-learning#practice" },
    });
    expect(parseHref("/")).toEqual({ to: "/" });
  });
});

describe("profile-type lists (D5)", () => {
  it("are registry ids and never repeat a destination", () => {
    for (const ids of Object.values(NAV_BY_TYPE)) {
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(NAV_ITEM_IDS).toContain(id);
    }
  });

  it("recruiter and institute bottom bars are five distinct slots starting at Home", () => {
    for (const type of ["recruiter", "institute"] as const) {
      const slots = stableBottomFor(type);
      expect(slots).toHaveLength(5);
      expect(slots[0]).toBe("HOME");
      expect(new Set(slots).size).toBe(5);
    }
  });
});

describe("adapting chip text", () => {
  const base = { adaptive: "on", learning: false, locked: false } as const;

  it("is the short domain plus a rounded percentage, with the full text kept for the tooltip", () => {
    const t = chipText({ ...base, label: "Career focused", confidence: 0.684 });
    expect(t.short).toBe("Career · 68%");
    expect(t.full).toBe("Adapting · Career focused · 68%");
  });

  it("uses the same rounding as the WhyPanel", () => {
    expect(confidencePct(0.675)).toBe(Math.round(0.675 * 100));
    expect(confidencePct(0.994)).toBe(99);
  });

  it("shortens every state label the engine can show, to at most 16 characters", () => {
    expect(shortStateLabel("Skill exchange focused")).toBe("Skills");
    for (const label of [
      "Learning focused",
      "Career focused",
      "Skill exchange focused",
      "Community focused",
      "Balanced",
      "Explorer",
    ]) {
      const t = chipText({ ...base, label, confidence: 1 });
      expect(t.short.length).toBeLessThanOrEqual(16);
      expect(t.short.endsWith("100%")).toBe(true);
    }
  });

  it("covers learning, paused, off and kept without a percentage", () => {
    expect(chipText({ ...base, learning: true, label: "Balanced", confidence: 0.2 }).full).toBe(
      "Learning how you use Swayam",
    );
    expect(chipText({ ...base, adaptive: "paused", label: "x", confidence: 1 }).short).toBe(
      "Paused",
    );
    expect(chipText({ ...base, adaptive: "off", label: "x", confidence: 1 }).full).toBe(
      "Adaptation is off",
    );
    const kept = chipText({ ...base, locked: true, label: "Career focused", confidence: 0.9 });
    expect(kept.short).toBe("Kept · Career");
    expect(kept.full).toBe("Layout kept · Career focused");
  });
});

describe("status dot: shape and accessible name", () => {
  const base = { adaptive: "on", learning: false, locked: false } as const;

  it("names an adapted state as one sentence with the WhyPanel's rounded percentage", () => {
    const i = { ...base, label: "Career focused", confidence: 0.684 };
    expect(dotLabel(i)).toBe("Your Swayam: Career focused, 68%");
    expect(dotTone(i)).toBe("adapted");
    expect(dotLabel({ ...i, label: "Skill exchange focused", confidence: 1 })).toBe(
      "Your Swayam: Skill exchange focused, 100%",
    );
  });

  it("says it is still learning, without a percentage", () => {
    const i = { ...base, learning: true, label: "Balanced", confidence: 0.2 };
    expect(dotLabel(i)).toBe("Your Swayam: still learning how you use it");
    expect(dotTone(i)).toBe("learning");
  });

  it("gives paused, off and kept their own tone and sentence", () => {
    expect(dotTone({ ...base, adaptive: "paused", label: "x", confidence: 1 })).toBe("paused");
    expect(dotLabel({ ...base, adaptive: "paused", label: "x", confidence: 1 })).toBe(
      "Your Swayam: adaptation paused",
    );
    expect(dotTone({ ...base, adaptive: "off", label: "x", confidence: 1 })).toBe("off");
    expect(dotLabel({ ...base, adaptive: "off", label: "x", confidence: 1 })).toBe(
      "Your Swayam: adaptation is off",
    );
    const kept = { ...base, locked: true, label: "Career focused", confidence: 0.9 };
    expect(dotTone(kept)).toBe("kept");
    expect(dotLabel(kept)).toBe("Your Swayam: layout kept, Career focused");
  });

  it("off and paused win over learning and kept, like the chip text", () => {
    expect(
      dotTone({
        ...base,
        adaptive: "off",
        learning: true,
        locked: true,
        label: "x",
        confidence: 0,
      }),
    ).toBe("off");
    expect(
      dotTone({ ...base, adaptive: "paused", learning: true, label: "x", confidence: 0 }),
    ).toBe("paused");
    expect(dotTone({ ...base, learning: true, locked: true, label: "x", confidence: 0 })).toBe(
      "learning",
    );
  });

  it("translates the fixed fragments and leaves the engine's state label alone", () => {
    const t = (s: string) => `[${s}]`;
    expect(dotLabel({ ...base, label: "Career focused", confidence: 0.5 }, t)).toBe(
      "[Your Swayam]: Career focused, 50%",
    );
    expect(dotLabel({ ...base, learning: true, label: "x", confidence: 0 }, t)).toBe(
      "[Your Swayam]: [still learning how you use it]",
    );
  });

  it("keeps the hit area at 44 px or more", () => {
    expect(DOT_HIT_PX).toBeGreaterThanOrEqual(44);
  });
});

describe("the nav island fits on one row", () => {
  const evolved = [
    "CAREER_FIRST",
    "LEARNING_FIRST",
    "SKILL_EXCHANGE_FIRST",
    "COMMUNITY_FIRST",
  ] as const;
  for (const state of evolved) {
    for (const viewport of [1280, 1366, 1440, 1920]) {
      for (const signedIn of [false, true]) {
        it(`${state} at ${viewport}px, ${signedIn ? "member" : "visitor"}`, () => {
          const top = ui(state, 3, signedIn ? member : visitor).navigation.top;
          const middle = middleLinks(top);
          const fit = navFit({
            viewport,
            labels: labels(middle),
            hasExplore: middle.includes("EXPLORE"),
            signedIn,
          });
          expect(fit.fits, `${Math.round(fit.needed)} needed of ${fit.available}`).toBe(true);
        });
      }
    }
  }

  it("still fits at 1280 with a cart badge and a member's avatar", () => {
    for (const state of evolved) {
      const middle = middleLinks(ui(state, 3).navigation.top);
      const fit = navFit({
        viewport: 1280,
        labels: labels(middle),
        hasExplore: middle.includes("EXPLORE"),
        signedIn: true,
        cart: true,
      });
      expect(fit.fits, `${state}: ${Math.round(fit.needed)} of ${fit.available}`).toBe(true);
    }
  });

  it("collapses More to an icon and drops the language control below xl, and fits there too", () => {
    for (const viewport of [1024, 1100, 1200, 1279]) {
      for (const state of evolved) {
        for (const signedIn of [false, true]) {
          const middle = middleLinks(ui(state, 3, signedIn ? member : visitor).navigation.top);
          const fit = navFit({
            viewport,
            labels: labels(middle),
            hasExplore: middle.includes("EXPLORE"),
            signedIn,
          });
          expect(fit.moreAsIcon).toBe(true);
          expect(fit.languageShown).toBe(false);
          expect(fit.themeToggleShown).toBe(false);
          expect(
            fit.fits,
            `${state} ${viewport}: ${Math.round(fit.needed)} of ${fit.available}`,
          ).toBe(true);
        }
      }
    }
  });

  it("draws the language name only from 1500px", () => {
    const at = (viewport: number) =>
      navFit({
        viewport,
        labels: ["Jobs"],
        hasExplore: false,
        signedIn: false,
      });
    expect(at(1440).languageLabel).toBe(false);
    expect(at(NAV_BREAKPOINTS.languageLabel).languageLabel).toBe(true);
    expect(at(1920).languageLabel).toBe(true);
  });

  it("the island is capped by the 80rem container", () => {
    expect(islandInnerWidth(1920)).toBe(islandInnerWidth(1280));
    expect(islandInnerWidth(1280)).toBe(1180);
  });
});
