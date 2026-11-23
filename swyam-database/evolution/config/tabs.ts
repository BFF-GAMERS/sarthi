/**
 * Adaptive tabs: the ONE table every page reads (lane B2).
 *
 * Per page: the canonical tab ids in canonical order, the canonical default, and for each EvolutionState a
 * preferred order and default. `order` is a priority list: the tabs it names lead, in that order; every
 * other tab keeps its canonical place unless the member's own usage breaks the tie. A tab is never hidden
 * (core/tabs/plan.ts always returns a permutation), and pages never branch on the state themselves.
 *
 * Only UNIVERSAL and EXPLORER stay canonical by rule; an empty entry means "no opinion", so usage alone decides.
 * Pure: no react, no DOM, no clock.
 */
import type { EvolutionState } from "../types";

export const TAB_PAGE_IDS = ["courses", "dashboard", "community", "opportunities"] as const;
export type TabPageId = (typeof TAB_PAGE_IDS)[number];

export interface StateTabPlan {
  /** Tabs that lead, best first. Unlisted tabs follow in canonical order (usage breaks ties). */
  order?: readonly string[];
  /** The tab shown first when nothing in the URL or the member's own history says otherwise. */
  defaultId?: string;
}

export interface PageTabPlan {
  canonical: readonly string[];
  defaultId: string;
  states: Readonly<Record<EvolutionState, StateTabPlan>>;
}

const NONE: StateTabPlan = {};

export const TAB_PLANS: Readonly<Record<TabPageId, PageTabPlan>> = {
  // Category tabs. Never default to a category from the state alone: "All" hides nothing.
  courses: {
    canonical: [
      "All",
      "Technology",
      "Skilled Trades",
      "Business",
      "Creative Arts",
      "Healthcare",
      "Hospitality",
      "Competitive Exams",
    ],
    defaultId: "All",
    states: {
      UNIVERSAL: NONE,
      EXPLORER: NONE,
      LEARNING_FIRST: { order: ["All", "Competitive Exams", "Technology"], defaultId: "All" },
      CAREER_FIRST: { order: ["All", "Skilled Trades", "Technology"], defaultId: "All" },
      SKILL_EXCHANGE_FIRST: { order: ["All", "Skilled Trades", "Creative Arts"], defaultId: "All" },
      COMMUNITY_FIRST: { order: ["All", "Creative Arts", "Hospitality"], defaultId: "All" },
    },
  },

  // The account's role views. They belong to the account, not the behaviour, so only the member's own
  // usage reorders them, and the page never takes `defaultId` from here (the current role stays selected).
  dashboard: {
    canonical: ["student", "recruiter", "institute"],
    defaultId: "student",
    states: {
      UNIVERSAL: NONE,
      EXPLORER: NONE,
      LEARNING_FIRST: NONE,
      CAREER_FIRST: NONE,
      SKILL_EXCHANGE_FIRST: NONE,
      COMMUNITY_FIRST: NONE,
    },
  },

  // The feed scope. "following" can be empty for a newcomer, so no state makes it the default;
  // a member who really uses it (>= 3 times in 14 days) gets it promoted by usage.
  community: {
    canonical: ["all", "following"],
    defaultId: "all",
    states: {
      UNIVERSAL: NONE,
      EXPLORER: NONE,
      LEARNING_FIRST: NONE,
      CAREER_FIRST: NONE,
      SKILL_EXCHANGE_FIRST: NONE,
      COMMUNITY_FIRST: NONE,
    },
  },

  // The kind filter: all, jobs + internships ("work"), courses, internships, jobs.
  opportunities: {
    canonical: ["all", "work", "course", "internship", "job"],
    defaultId: "all",
    states: {
      UNIVERSAL: NONE,
      EXPLORER: NONE,
      LEARNING_FIRST: { order: ["all", "course", "work"], defaultId: "all" },
      CAREER_FIRST: { order: ["all", "work", "job", "internship"], defaultId: "work" },
      SKILL_EXCHANGE_FIRST: NONE,
      COMMUNITY_FIRST: NONE,
    },
  },
};
