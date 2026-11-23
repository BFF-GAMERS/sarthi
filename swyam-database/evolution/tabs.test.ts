// Adaptive tabs (lane B2): the plan is always a permutation, canonical unless adaptation is on and earned,
// a deep link always wins, at most two tabs move per change, and usage promotes only after real repeat use.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COURSE_GROUPS } from "@/data/mock";
import { BEHAVIOUR_MODES, EVOLUTION_STATES, TIERS } from "./config/ids";
import { TAB_PAGE_IDS, TAB_PLANS, type TabPageId } from "./config/tabs";
import {
  TAB_MAX_MOVES,
  TAB_PROMOTE_MIN,
  limitMoves,
  movesBetween,
  planTabs,
  type TabPlanInput,
} from "./core/tabs/plan";
import { bumpUsage, emptyStore, parseTabStore, withShownOrder } from "./core/tabs/usage";
import type { PageUsage } from "./core/tabs/usage";

const canonOf = (p: TabPageId) => [...TAB_PLANS[p].canonical];
const TODAY = 20000;
const use = (id: string, n: number, daysAgo = 0): PageUsage => ({
  [id]: { [String(TODAY - daysAgo)]: n },
});
const merge = (...u: PageUsage[]): PageUsage => Object.assign({}, ...u) as PageUsage;

const base = (pageId: TabPageId, over: Partial<TabPlanInput> = {}): TabPlanInput => ({
  pageId,
  canonical: canonOf(pageId),
  state: "CAREER_FIRST",
  tier: 3,
  mode: "CAREER_FOCUSED",
  usage: {},
  stableNav: false,
  today: TODAY,
  ...over,
});

const isPermutation = (order: readonly string[], canon: readonly string[]) =>
  order.length === canon.length &&
  new Set(order).size === order.length &&
  canon.every((id) => order.includes(id));

describe("TAB_PLANS", () => {
  it("covers the four pages, with every id inside the canonical list", () => {
    expect([...TAB_PAGE_IDS].sort()).toEqual([
      "community",
      "courses",
      "dashboard",
      "opportunities",
    ]);
    for (const page of TAB_PAGE_IDS) {
      const p = TAB_PLANS[page];
      expect(new Set(p.canonical).size).toBe(p.canonical.length);
      expect(p.canonical).toContain(p.defaultId);
      expect(Object.keys(p.states).sort()).toEqual([...EVOLUTION_STATES].sort());
      for (const s of EVOLUTION_STATES) {
        for (const id of p.states[s].order ?? []) expect(p.canonical).toContain(id);
        if (p.states[s].defaultId) expect(p.canonical).toContain(p.states[s].defaultId);
      }
    }
  });

  it("matches the lists the pages render (courses = All + COURSE_GROUPS)", () => {
    expect(TAB_PLANS.courses.canonical).toEqual(["All", ...COURSE_GROUPS]);
    expect(TAB_PLANS.dashboard.canonical).toEqual(["student", "recruiter", "institute"]);
  });

  it("leaves UNIVERSAL and EXPLORER without opinions", () => {
    for (const page of TAB_PAGE_IDS) {
      expect(TAB_PLANS[page].states.UNIVERSAL).toEqual({});
      expect(TAB_PLANS[page].states.EXPLORER).toEqual({});
    }
  });
});

describe("planTabs: permutation invariant", () => {
  const usages: PageUsage[] = [
    {},
    use("Business", 9),
    use("following", 4),
    merge(use("job", 5, 1), use("course", 4, 2), use("work", 3, 3)),
    merge(use("student", 9), use("institute", 7, 2)),
  ];
  for (const page of TAB_PAGE_IDS) {
    it(`${page}: every state x tier x mode x usage is a permutation with a present default`, () => {
      const canon = canonOf(page);
      for (const state of EVOLUTION_STATES) {
        for (const tier of TIERS) {
          for (const mode of BEHAVIOUR_MODES) {
            for (const usage of usages) {
              for (const previous of [undefined, [...canon].reverse()]) {
                const plan = planTabs(base(page, { state, tier, mode, usage, previous }));
                expect(isPermutation(plan.order, canon)).toBe(true);
                expect(plan.order).toContain(plan.defaultId);
                expect(plan.reasons.length).toBeGreaterThan(0);
              }
            }
          }
        }
      }
    });
  }

  it("dedupes a canonical list that repeats a tab, and survives an empty one", () => {
    const dup = planTabs(base("community", { canonical: ["all", "following", "all"] }));
    expect(isPermutation(dup.order, ["all", "following"])).toBe(true);
    const none = planTabs(base("community", { canonical: [] }));
    expect(none.order).toEqual([]);
  });

  it("works on a subset of the canonical list (a dashboard with two roles)", () => {
    const plan = planTabs(
      base("dashboard", { canonical: ["student", "recruiter"], usage: use("recruiter", 6) }),
    );
    expect(isPermutation(plan.order, ["student", "recruiter"])).toBe(true);
    expect(plan.order[0]).toBe("recruiter");
  });
});

describe("planTabs: canonical unless adaptation is on and earned", () => {
  const heavy = merge(use("job", 9), use("course", 6));
  const cases: Array<[string, Partial<TabPlanInput>]> = [
    ["tier 0", { tier: 0 }],
    ["tier 1", { tier: 1 }],
    ["adaptation off", { adaptive: "off" }],
    ["adaptation paused", { adaptive: "paused" }],
    ["keep my layout", { locked: true }],
    ["stable nav (recruiter or institute)", { stableNav: true }],
    ["UNIVERSAL state", { state: "UNIVERSAL" }],
    ["EXPLORER state", { state: "EXPLORER" }],
    ["EXPLORER mode", { mode: "EXPLORER" }],
  ];
  for (const page of TAB_PAGE_IDS) {
    for (const [label, over] of cases) {
      it(`${page}: ${label} keeps the canonical order and default, whatever the usage`, () => {
        const plan = planTabs(
          base(page, { ...over, usage: heavy, previous: canonOf(page).reverse() }),
        );
        expect(plan.order).toEqual(canonOf(page));
        expect(plan.defaultId).toBe(TAB_PLANS[page].defaultId);
        expect(plan.reasons).not.toContain("usage-default");
      });
    }
  }

  it("changes nothing for a guest-shaped input (tier 0, UNIVERSAL)", () => {
    for (const page of TAB_PAGE_IDS) {
      const plan = planTabs(base(page, { state: "UNIVERSAL", tier: 0, mode: "BALANCED" }));
      expect(plan.order).toEqual(canonOf(page));
      expect(plan.defaultId).toBe(TAB_PLANS[page].defaultId);
    }
  });

  it("does arrange when on, tier >= 2 and the state has an opinion", () => {
    const plan = planTabs(base("opportunities"));
    expect(plan.order).not.toEqual(canonOf("opportunities"));
    expect(plan.defaultId).toBe("work");
    expect(plan.reasons).toContain("state-order");
    expect(plan.reasons).toContain("state-default");
  });
});

describe("planTabs: a deep link always wins", () => {
  it("beats the state default, a promoted usage default and the canonical default", () => {
    const heavy = use("job", 9);
    expect(planTabs(base("opportunities", { explicit: "course" })).defaultId).toBe("course");
    expect(
      planTabs(base("opportunities", { explicit: "internship", usage: heavy })).defaultId,
    ).toBe("internship");
    expect(planTabs(base("opportunities", { explicit: "all", tier: 0 })).defaultId).toBe("all");
    expect(planTabs(base("opportunities", { explicit: "job", adaptive: "off" })).defaultId).toBe(
      "job",
    );
    expect(planTabs(base("opportunities", { explicit: "job" })).reasons).toContain("deep-link");
  });

  it("ignores an id that is not a tab", () => {
    const plan = planTabs(base("opportunities", { explicit: "nope" }));
    expect(plan.defaultId).toBe("work");
    expect(plan.reasons).not.toContain("deep-link");
  });
});

describe("planTabs: at most two tabs move per change", () => {
  it("stays within TAB_MAX_MOVES of canonical for every state and heavy usage", () => {
    for (const page of TAB_PAGE_IDS) {
      const canon = canonOf(page);
      const usage: PageUsage = Object.fromEntries(
        canon.map((id, i) => [id, { [String(TODAY)]: 3 + i * 2 }]),
      );
      for (const state of EVOLUTION_STATES) {
        const plan = planTabs(base(page, { state, usage }));
        expect(movesBetween(plan.order, canon)).toBeLessThanOrEqual(TAB_MAX_MOVES);
      }
    }
  });

  it("is measured from the order last shown, and converges on the target", () => {
    const usage = merge(use("Healthcare", 8), use("Hospitality", 6), use("Business", 4));
    const canon = canonOf("courses");
    let shown: string[] | undefined;
    const seen: string[][] = [];
    for (let step = 0; step < 5; step++) {
      const plan = planTabs(base("courses", { state: "COMMUNITY_FIRST", usage, previous: shown }));
      expect(movesBetween(plan.order, shown ?? canon)).toBeLessThanOrEqual(TAB_MAX_MOVES);
      seen.push(plan.order);
      shown = plan.order;
    }
    expect(seen[4]).toEqual(seen[3]); // settled
    expect(seen[0]).not.toEqual(seen[4]); // it took more than one change to get there
  });

  it("limitMoves and movesBetween agree on simple cases", () => {
    expect(movesBetween(["a", "b", "c"], ["a", "b", "c"])).toBe(0);
    expect(movesBetween(["a", "b", "c"], ["c", "a", "b"])).toBe(1);
    expect(movesBetween(["a", "b", "c"], ["c", "b", "a"])).toBe(2);
    const out = limitMoves(["a", "b", "c", "d", "e"], ["e", "d", "c", "b", "a"], 2);
    expect(movesBetween(out, ["a", "b", "c", "d", "e"])).toBeLessThanOrEqual(2);
    expect(isPermutation(out, ["a", "b", "c", "d", "e"])).toBe(true);
  });

  it("ignores a stale or foreign previous order", () => {
    const plan = planTabs(base("courses", { previous: ["x", "y"] }));
    expect(isPermutation(plan.order, canonOf("courses"))).toBe(true);
    expect(movesBetween(plan.order, canonOf("courses"))).toBeLessThanOrEqual(TAB_MAX_MOVES);
  });
});

describe("planTabs: usage", () => {
  it(`promotes a tab used ${TAB_PROMOTE_MIN}+ times in 14 days to the default`, () => {
    const plan = planTabs(
      base("courses", { state: "LEARNING_FIRST", usage: use("Healthcare", 3, 5) }),
    );
    expect(plan.defaultId).toBe("Healthcare");
    expect(plan.reasons).toContain("usage-default");
  });

  it("does not promote on 2 uses, or on uses older than 14 days", () => {
    expect(planTabs(base("courses", { usage: use("Healthcare", 2) })).defaultId).toBe("All");
    expect(planTabs(base("courses", { usage: use("Healthcare", 30, 14) })).defaultId).toBe("All");
    expect(planTabs(base("courses", { usage: use("Healthcare", 3, 13) })).defaultId).toBe(
      "Healthcare",
    );
  });

  it("the most used tab wins when several qualify", () => {
    const usage = merge(use("Business", 4), use("Healthcare", 7), use("Hospitality", 5));
    expect(planTabs(base("courses", { usage })).defaultId).toBe("Healthcare");
  });

  it("reorders by usage only after a repeat (a single click moves nothing)", () => {
    const none = planTabs(base("courses", { state: "LEARNING_FIRST" }));
    const once = planTabs(
      base("courses", { state: "LEARNING_FIRST", usage: use("Healthcare", 1) }),
    );
    const twice = planTabs(
      base("courses", { state: "LEARNING_FIRST", usage: use("Healthcare", 2) }),
    );
    expect(once.order).toEqual(none.order);
    expect(twice.order.indexOf("Healthcare")).toBeLessThan(none.order.indexOf("Healthcare"));
  });

  it("weights recent use above old use when breaking ties", () => {
    const usage = merge(use("Business", 4, 10), use("Healthcare", 4, 0));
    const plan = planTabs(base("courses", { state: "LEARNING_FIRST", usage }));
    expect(plan.order.indexOf("Healthcare")).toBeLessThan(plan.order.indexOf("Business"));
  });

  it("a state's own leading tabs are not displaced by usage", () => {
    const plan = planTabs(base("opportunities", { usage: use("course", 9) }));
    expect(plan.order.slice(0, 2)).toEqual(["all", "work"]);
  });
});

describe("usage store", () => {
  it("bumps a count, prunes days outside the window and keeps counts only", () => {
    let s = emptyStore();
    s = bumpUsage(s, "courses", "Business", 100);
    s = bumpUsage(s, "courses", "Business", 100);
    s = bumpUsage(s, "courses", "Business", 50);
    s = bumpUsage(s, "courses", "Healthcare", 100);
    expect(s.u["courses"]?.["Business"]).toEqual({ "100": 2 });
    expect(s.u["courses"]?.["Healthcare"]).toEqual({ "100": 1 });
    expect(Object.keys(s)).toEqual(["v", "u", "o"]);
  });

  it("round-trips through JSON and remembers the order last shown", () => {
    const s = withShownOrder(bumpUsage(emptyStore(), "community", "following", 7), "community", [
      "following",
      "all",
    ]);
    expect(parseTabStore(JSON.stringify(s))).toEqual(s);
  });

  it("treats garbage as empty and drops bad entries", () => {
    expect(parseTabStore(null)).toEqual(emptyStore());
    expect(parseTabStore("not json")).toEqual(emptyStore());
    expect(parseTabStore('{"v":2}')).toEqual(emptyStore());
    expect(parseTabStore('["x"]')).toEqual(emptyStore());
    const s = parseTabStore(
      JSON.stringify({
        v: 1,
        u: { courses: { All: { "5": -3, x: 2, "6": "4", "7": 2.9 }, Bad: 7 }, other: "no" },
        o: { courses: ["All", 4, null], other: "no" },
      }),
    );
    expect(s.u["courses"]).toEqual({ All: { "7": 2 } });
    expect(s.o["courses"]).toEqual(["All"]);
    expect(s.o["other"]).toBeUndefined();
  });
});

describe("no config scatter", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const read = (rel: string) => readFileSync(`${root}${rel}`, "utf8");
  const pages = [
    "pages/Courses.tsx",
    "pages/Dashboard.tsx",
    "pages/Community.tsx",
    "routes/opportunities.tsx",
  ];

  for (const rel of pages) {
    it(`${rel} reads the central plan and has no per-state tab branching`, () => {
      const src = read(rel);
      expect(src).toContain('from "@/evolution/react/use-tab-plan"');
      expect(src).toMatch(/useTabPlan\("(courses|dashboard|community|opportunities)"/);
      expect(src).not.toMatch(/state\s*[!=]==?\s*["'](UNIVERSAL|EXPLORER|\w+_FIRST)["']/);
    });
  }

  it("Courses no longer paints selected pills with the dark-mode-flipped bg-ink", () => {
    expect(read("pages/Courses.tsx")).not.toMatch(/bg-ink[^"]*text-paper|text-paper[^"]*bg-ink/);
  });
});
