/**
 * THE central evolution configuration (brief §44, plan §3.4).
 *
 * One frozen object drives the real renderer (navigation, Home, CTA,
 * priority actions, density), the decision validator, the AI prompt
 * allow-lists, the Lab diagrams and the tests. Every state is predefined
 * here; nothing structural is ever generated at runtime or by the AI.
 *
 * Pure: no react, no DOM, no clock.
 */
import type {
  BehaviourMode,
  CtaId,
  Density,
  DomainId,
  EvolutionState,
  HomeLayout,
  NavItemId,
  NavMode,
  PriorityActionId,
  SectionId,
  Tier,
} from "../types";

export interface StateConfig {
  domain: DomainId | null;
  nav: NavMode;
  layout: HomeLayout;
  cta: CtaId;
  label: string;
}

export interface ModeOverlay {
  density: Density;
  /** Sections moved to the top of the list. */
  pin?: SectionId[];
  /** Sections inserted directly after the priority actions if absent. */
  addAfterHero?: SectionId[];
  /** Folds every non-pinned section after this index into MORE_FOR_YOU. */
  foldAfter?: number;
  cta?: CtaId;
  shortcutsRow?: boolean;
  showCompare?: boolean;
  showFilters?: boolean;
  itemsPerSection?: number;
}

export interface TierConfig {
  /** Tier ≥ 2 switches navigation to the domain-priority list. */
  navChanges: boolean;
  /** How many hub sections lead the Home list. */
  hubLead: number;
  /** How many domain priority actions show (the rest are universal). */
  actions: number;
  overlay: boolean;
  /** Non-hub sections fold into MORE_FOR_YOU. */
  foldRest: boolean;
}

export interface CtaTarget {
  labelKey: string;
  label: string;
  /** "recent" = the last real entity from the local behaviour log. */
  to: string | { member: string; visitor: string } | "recent";
  /**
   * Used in place of the label above until real progress exists. "Continue Learning" promises
   * something to continue; a visitor, or a member who has not started a course, has nothing.
   */
  starter?: { labelKey: string; label: string; to: string };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

export const EVOLUTION_CONFIG = deepFreeze({
  states: {
    UNIVERSAL: {
      domain: null,
      nav: "UNIVERSAL",
      layout: "UNIVERSAL",
      cta: "EXPLORE_SWAYAM",
      label: "Balanced",
    },
    LEARNING_FIRST: {
      domain: "LEARNING",
      nav: "LEARNING_PRIORITY",
      layout: "LEARNING_HUB",
      cta: "CONTINUE_LEARNING",
      label: "Learning focused",
    },
    CAREER_FIRST: {
      domain: "CAREER",
      nav: "CAREER_PRIORITY",
      layout: "CAREER_DISCOVERY",
      cta: "FIND_OPPORTUNITIES",
      label: "Career focused",
    },
    SKILL_EXCHANGE_FIRST: {
      domain: "SKILL_EXCHANGE",
      nav: "SKILL_EXCHANGE_PRIORITY",
      layout: "SKILL_EXCHANGE_HUB",
      cta: "FIND_A_SKILL",
      label: "Skill exchange focused",
    },
    COMMUNITY_FIRST: {
      domain: "COMMUNITY",
      nav: "COMMUNITY_PRIORITY",
      layout: "COMMUNITY_HUB",
      cta: "JOIN_COMMUNITY",
      label: "Community focused",
    },
    EXPLORER: {
      domain: null,
      nav: "UNIVERSAL",
      layout: "DISCOVERY",
      cta: "EXPLORE_SWAYAM",
      label: "Explorer",
    },
  } satisfies Record<EvolutionState, StateConfig>,

  /**
   * Brief §4 / §15, verbatim. HOME and PROFILE are anchors; the middle four are the primary links.
   * COMMUNITY_PRIORITY is a proposal (the brief is silent). Visitors get EVENTS in place of MESSAGES.
   */
  navigation: {
    UNIVERSAL: ["HOME", "EXPLORE", "COURSES", "JOBS", "COMMUNITY", "PROFILE"],
    CAREER_PRIORITY: ["HOME", "JOBS", "APPLICATIONS", "COURSES", "COMMUNITY", "PROFILE"],
    LEARNING_PRIORITY: ["HOME", "LEARN", "MY_COURSES", "PRACTICE", "COMMUNITY", "PROFILE"],
    SKILL_EXCHANGE_PRIORITY: ["HOME", "SKILLS", "MATCHES", "COMMUNITY", "COURSES", "PROFILE"],
    COMMUNITY_PRIORITY: ["HOME", "COMMUNITY", "MESSAGES", "SKILLS", "COURSES", "PROFILE"],
  } satisfies Record<NavMode, NavItemId[]>,

  /**
   * Brief §6 / §14. Hero + priority actions are pinned above every list.
   * INTENT_LANE (Learn, Prove, Apply from what was repeatedly viewed) is in every layout. It follows
   * the five hub sections in the career and learning hubs, which already carry their own Learn and
   * Apply sections, and sits second in the skill, community and discovery hubs, which lack that bridge.
   * Anything a hub does not list folds into MORE_FOR_YOU at tier 3.
   */
  layouts: {
    UNIVERSAL: [
      "CONTINUE_LEARNING",
      "METHOD",
      "EXPLORE_COURSES",
      "JOBS",
      "INTENT_LANE",
      "RECENTLY_VIEWED",
      "CLOSING",
    ],
    CAREER_DISCOVERY: [
      "RECOMMENDED_JOBS",
      "INTERNSHIPS",
      "APPLICATIONS",
      "CAREER_LAUNCHER",
      "RELEVANT_COURSES",
      "INTENT_LANE",
      "RECENTLY_VIEWED",
      "MORE_FOR_YOU",
      "CLOSING",
    ],
    LEARNING_HUB: [
      "CONTINUE_LEARNING",
      "MY_COURSES",
      "PRACTICE",
      "RECOMMENDED_COURSES",
      "SKILL_BUILDER",
      "INTENT_LANE",
      "RECENTLY_VIEWED",
      "MORE_FOR_YOU",
      "CLOSING",
    ],
    SKILL_EXCHANGE_HUB: [
      "FIND_A_SKILL",
      "INTENT_LANE",
      "TEACH_A_SKILL",
      "MATCHES",
      "SKILL_PASSPORT",
      "COMMUNITY",
      "RECENTLY_VIEWED",
      "MORE_FOR_YOU",
      "CLOSING",
    ],
    COMMUNITY_HUB: [
      "COMMUNITY",
      "INTENT_LANE",
      "COMMUNITIES",
      "PEOPLE_TO_FOLLOW",
      "EVENTS",
      "FIND_A_SKILL",
      "RECENTLY_VIEWED",
      "MORE_FOR_YOU",
      "CLOSING",
    ],
    DISCOVERY: [
      "CATEGORIES",
      "EXPLORE_COURSES",
      "INTENT_LANE",
      "JOBS",
      "SKILLS",
      "COMMUNITY",
      "RECENTLY_VIEWED",
      "MORE_FOR_YOU",
      "CLOSING",
    ],
  } satisfies Record<HomeLayout, SectionId[]>,

  /** Order = priority. Tier 1 shows 2 + 2 universal, tier 2 shows 3 + 1, tier 3 shows 4. */
  priorityActions: {
    UNIVERSAL: ["EXPLORE_COURSES", "FIND_JOBS", "BUILD_A_SKILL", "JOIN_COMMUNITY"],
    CAREER_FIRST: ["JOBS", "INTERNSHIPS", "APPLICATIONS", "CAREER_LAUNCHER"],
    LEARNING_FIRST: ["CONTINUE_LEARNING", "MY_COURSES", "PRACTICE", "SKILL_BUILDER"],
    SKILL_EXCHANGE_FIRST: ["FIND_A_SKILL", "TEACH_A_SKILL", "MATCHES", "SKILL_PASSPORT"],
    COMMUNITY_FIRST: ["COMMUNITY_FEED", "JOIN_COMMUNITY", "MESSAGES", "EVENTS"],
    EXPLORER: ["EXPLORE_COURSES", "FIND_JOBS", "BUILD_A_SKILL", "EXPLORE_ALL"],
  } satisfies Record<EvolutionState, PriorityActionId[]>,

  /** Brief §16. REPEAT mode (tier 3) overrides the domain CTA. */
  ctas: {
    EXPLORE_SWAYAM: { labelKey: "evo.cta.explore", label: "Explore Swayam", to: "/explore" },
    CONTINUE_LEARNING: {
      labelKey: "evo.cta.continue",
      label: "Continue Learning",
      to: "/my-learning",
      starter: { labelKey: "evo.cta.startLearning", label: "Start learning", to: "/courses" },
    },
    FIND_OPPORTUNITIES: { labelKey: "evo.cta.findOpps", label: "Find Opportunities", to: "/jobs" },
    FIND_A_SKILL: {
      labelKey: "evo.cta.findSkill",
      label: "Find a Skill",
      to: { member: "/skillswap", visitor: "/board" },
    },
    JOIN_COMMUNITY: {
      labelKey: "evo.cta.community",
      label: "Join the Community",
      to: "/community",
    },
    CONTINUE_WHERE_LEFT: {
      labelKey: "evo.cta.resume",
      label: "Continue where you left off",
      to: "recent",
    },
  } satisfies Record<CtaId, CtaTarget>,

  /** Hero ledes. The visitor headline stays (D11); each state swaps only the lede and CTA. */
  ledes: {
    "evo.lede.universal": "Build skills. Find opportunities. Grow.",
    "evo.lede.learning_first": "Pick up where you left off and keep learning.",
    "evo.lede.learning_first.starter":
      "Keep exploring courses. Your progress shows up here once you start one.",
    "evo.lede.career_first": "Jobs, internships and the skills that get you hired.",
    "evo.lede.skill_exchange_first": "Learn a skill from someone, teach one back.",
    "evo.lede.community_first": "Your people, your conversations, your events.",
    "evo.lede.explorer": "Everything Swayam offers, side by side.",
  } as Record<string, string>,

  /** Brief §17, tier 3 only. Never hides essentials (title, price/stipend, deadline, primary action). */
  modeOverlays: {
    QUICK: { density: "compact", pin: ["RECENTLY_VIEWED"], shortcutsRow: true, itemsPerSection: 3 },
    RESEARCH: { density: "research", showCompare: true, showFilters: true, itemsPerSection: 6 },
    REPEAT: { density: "standard", cta: "CONTINUE_WHERE_LEFT", pin: ["RECENTLY_VIEWED"] },
    EXPLORER: { density: "discovery", addAfterHero: ["CATEGORIES"] },
    MINIMAL: { density: "compact", foldAfter: 3, itemsPerSection: 3 },
    CAREER_FOCUSED: { density: "standard", pin: ["APPLICATIONS"] },
    LEARNING_FOCUSED: { density: "standard", pin: ["CONTINUE_LEARNING"] },
    SKILL_FOCUSED: { density: "standard", pin: ["MATCHES"] },
    BALANCED: { density: "standard" },
  } satisfies Record<BehaviourMode, ModeOverlay>,

  modeLabels: {
    BALANCED: "Balanced",
    QUICK: "Quick",
    RESEARCH: "Research",
    REPEAT: "Repeat",
    EXPLORER: "Explorer",
    CAREER_FOCUSED: "Career focused",
    LEARNING_FOCUSED: "Learning focused",
    SKILL_FOCUSED: "Skill focused",
    MINIMAL: "Minimal",
  } satisfies Record<BehaviourMode, string>,

  /** Staged reveal per tier: never switch everything at once (brief §10). */
  tiers: {
    0: { navChanges: false, hubLead: 0, actions: 0, overlay: false, foldRest: false },
    1: { navChanges: false, hubLead: 2, actions: 2, overlay: false, foldRest: false },
    2: { navChanges: true, hubLead: 5, actions: 3, overlay: false, foldRest: false },
    3: { navChanges: true, hubLead: 5, actions: 4, overlay: true, foldRest: true },
  } satisfies Record<Tier, TierConfig>,

  /** Default display switches when no overlay applies. */
  display: { shortcutsRow: false, showCompare: false, showFilters: false, itemsPerSection: 4 },

  /** *_FOCUSED modes require their matching primary state (validator R4). */
  focusedModeState: {
    CAREER_FOCUSED: "CAREER_FIRST",
    LEARNING_FOCUSED: "LEARNING_FIRST",
    SKILL_FOCUSED: "SKILL_EXCHANGE_FIRST",
  } as Partial<Record<BehaviourMode, EvolutionState>>,

  /** Modes allowed with a UNIVERSAL primary (validator R4). */
  universalModes: ["BALANCED", "QUICK", "MINIMAL"] as BehaviourMode[],
});

export type EvolutionConfig = typeof EVOLUTION_CONFIG;

/**
 * The CTA to show. `hasProgress` is true only for a signed-in member with a course actually under
 * way; everyone else gets the starter wording where the config defines one ("Start learning").
 */
export function ctaFor(
  id: CtaId,
  hasProgress: boolean,
): { labelKey: string; label: string; to: CtaTarget["to"] } {
  const c = EVOLUTION_CONFIG.ctas[id] as CtaTarget;
  return c.starter && !hasProgress ? c.starter : c;
}

/** The hero lede for a key, with the starter wording ("Keep exploring courses") until progress exists. */
export function ledeFor(key: string, hasProgress: boolean): string | undefined {
  const ledes = EVOLUTION_CONFIG.ledes;
  return (!hasProgress ? ledes[`${key}.starter`] : undefined) ?? ledes[key];
}
