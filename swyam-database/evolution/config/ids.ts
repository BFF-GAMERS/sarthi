/**
 * Every enum the Evolution Engine knows, as frozen tuples.
 *
 * This file is the single source of truth for the TypeScript types, the
 * decision validator, the AI prompt allow-lists and response schema, and
 * the CHECK lists in db/025_evolution_profile.sql. Nothing here may be
 * invented at runtime: the AI can only *select* values from these lists.
 *
 * Pure: no react, no DOM, no clock.
 */

/** Canonical order. It is also the tie-break order everywhere. */
export const DOMAIN_IDS = ["LEARNING", "CAREER", "SKILL_EXCHANGE", "COMMUNITY"] as const;

export const EVOLUTION_STATES = [
  "UNIVERSAL",
  "LEARNING_FIRST",
  "CAREER_FIRST",
  "SKILL_EXCHANGE_FIRST",
  "COMMUNITY_FIRST",
  "EXPLORER",
] as const;

/** BALANCED is the internal neutral mode (D12). The AI may output it only with UNIVERSAL. */
export const BEHAVIOUR_MODES = [
  "BALANCED",
  "QUICK",
  "RESEARCH",
  "REPEAT",
  "EXPLORER",
  "CAREER_FOCUSED",
  "LEARNING_FOCUSED",
  "SKILL_FOCUSED",
  "MINIMAL",
] as const;

export const NAV_MODES = [
  "UNIVERSAL",
  "LEARNING_PRIORITY",
  "CAREER_PRIORITY",
  "SKILL_EXCHANGE_PRIORITY",
  "COMMUNITY_PRIORITY",
] as const;

export const HOME_LAYOUTS = [
  "UNIVERSAL",
  "LEARNING_HUB",
  "CAREER_DISCOVERY",
  "SKILL_EXCHANGE_HUB",
  "COMMUNITY_HUB",
  "DISCOVERY",
] as const;

export const DENSITIES = ["standard", "compact", "research", "discovery"] as const;

export const TIERS = [0, 1, 2, 3] as const;

/** The brief's 23 events plus the six its "such as" wording allows (plan §3.2). */
export const EVENT_TYPES = [
  // LEARNING
  "course_viewed",
  "course_started",
  "course_completed",
  "course_saved",
  "course_compared",
  "practice_completed",
  // CAREER
  "job_viewed",
  "job_saved",
  "job_applied",
  "internship_viewed",
  "internship_saved",
  "application_started",
  "career_launcher_opened",
  // SKILLS (LEARNING or SKILL_EXCHANGE by surface)
  "skill_viewed",
  "skill_searched",
  "skill_builder_opened",
  "skill_passport_opened",
  "skill_swap_requested",
  "mentor_viewed",
  // COMMUNITY
  "profile_viewed",
  "community_opened",
  "community_post_viewed",
  "community_post_created",
  // CROSS-CUTTING
  "search_performed",
  "filter_used",
  "list_filtered",
  "list_searched",
  "recommendation_clicked",
  "navigation_item_clicked",
  "dashboard_section_clicked",
  "page_viewed",
] as const;

/**
 * Named access to the event types, so call sites read `track(EV.COURSE_VIEWED, …)`.
 * A plain string literal works too: `track()` is typed against EventType.
 */
export const EV = {
  COURSE_VIEWED: "course_viewed",
  COURSE_STARTED: "course_started",
  COURSE_COMPLETED: "course_completed",
  COURSE_SAVED: "course_saved",
  COURSE_COMPARED: "course_compared",
  PRACTICE_COMPLETED: "practice_completed",
  JOB_VIEWED: "job_viewed",
  JOB_SAVED: "job_saved",
  JOB_APPLIED: "job_applied",
  INTERNSHIP_VIEWED: "internship_viewed",
  INTERNSHIP_SAVED: "internship_saved",
  APPLICATION_STARTED: "application_started",
  CAREER_LAUNCHER_OPENED: "career_launcher_opened",
  SKILL_VIEWED: "skill_viewed",
  SKILL_SEARCHED: "skill_searched",
  SKILL_BUILDER_OPENED: "skill_builder_opened",
  SKILL_PASSPORT_OPENED: "skill_passport_opened",
  SKILL_SWAP_REQUESTED: "skill_swap_requested",
  MENTOR_VIEWED: "mentor_viewed",
  PROFILE_VIEWED: "profile_viewed",
  COMMUNITY_OPENED: "community_opened",
  COMMUNITY_POST_VIEWED: "community_post_viewed",
  COMMUNITY_POST_CREATED: "community_post_created",
  SEARCH_PERFORMED: "search_performed",
  FILTER_USED: "filter_used",
  LIST_FILTERED: "list_filtered",
  LIST_SEARCHED: "list_searched",
  RECOMMENDATION_CLICKED: "recommendation_clicked",
  NAVIGATION_ITEM_CLICKED: "navigation_item_clicked",
  DASHBOARD_SECTION_CLICKED: "dashboard_section_clicked",
  PAGE_VIEWED: "page_viewed",
} as const satisfies Record<string, (typeof EVENT_TYPES)[number]>;

/** Public-slug prefixes for BehaviourEvent.entityId. Never a person's id, handle or search text. */
export const ENTITY_PREFIXES = ["crs", "opp", "skl", "car", "com", "pst", "nba", "ext"] as const;
export const ENTITY_ID_RE = /^(crs|opp|skl|car|com|pst|nba|ext)_[a-z0-9:-]{1,64}$/;

/** Every navigation destination. Each resolves to a real route in config/navigation.ts. */
export const NAV_ITEM_IDS = [
  "HOME",
  "EXPLORE",
  "COURSES",
  "LEARN",
  "MY_COURSES",
  "PRACTICE",
  "SKILL_BUILDER",
  "JOBS",
  "INTERNSHIPS",
  "OPPORTUNITIES",
  "APPLICATIONS",
  "CAREER_LAUNCHER",
  "CV",
  "COACH",
  "SKILLS",
  "SKILL_DIRECTORY",
  "MATCHES",
  "PASSPORT",
  "COMMUNITY",
  "MESSAGES",
  "EVENTS",
  "PROFILE",
  "DASHBOARD",
  "SAVED",
  "SEARCH",
  "SCHEMES",
  "RESOURCES",
  "TRUST",
  "LAB",
  "SETTINGS",
  "NOTIFICATIONS",
  "REWARDS",
] as const;

/** Every Home section. HERO and PRIORITY_ACTIONS are pinned above the list and are not sections. */
export const SECTION_IDS = [
  // existing Home sections (UNIVERSAL)
  "TRUST_STRIP",
  "CONTINUE_LEARNING",
  "EXPLORE_COURSES",
  "JOBS",
  "SKILLS",
  "COMMUNITY",
  "RECENTLY_VIEWED",
  "METHOD",
  "VOICE",
  "PARTNERS",
  "CLOSING",
  // CAREER_DISCOVERY
  "RECOMMENDED_JOBS",
  "INTERNSHIPS",
  "APPLICATIONS",
  "CAREER_LAUNCHER",
  "RELEVANT_COURSES",
  // LEARNING_HUB
  "MY_COURSES",
  "PRACTICE",
  "RECOMMENDED_COURSES",
  "SKILL_BUILDER",
  // SKILL_EXCHANGE_HUB
  "FIND_A_SKILL",
  "TEACH_A_SKILL",
  "MATCHES",
  "SKILL_PASSPORT",
  // COMMUNITY_HUB
  "COMMUNITIES",
  "PEOPLE_TO_FOLLOW",
  "EVENTS",
  // DISCOVERY
  "CATEGORIES",
  // CROSS-SERVICE: Learn, Prove, Apply from the tags of what was repeatedly viewed
  "INTENT_LANE",
  // the folded remainder
  "MORE_FOR_YOU",
] as const;

export const PRIORITY_ACTION_IDS = [
  "EXPLORE_COURSES",
  "FIND_JOBS",
  "BUILD_A_SKILL",
  "JOIN_COMMUNITY",
  "EXPLORE_ALL",
  "JOBS",
  "INTERNSHIPS",
  "APPLICATIONS",
  "CAREER_LAUNCHER",
  "CONTINUE_LEARNING",
  "MY_COURSES",
  "PRACTICE",
  "SKILL_BUILDER",
  "FIND_A_SKILL",
  "TEACH_A_SKILL",
  "MATCHES",
  "SKILL_PASSPORT",
  "COMMUNITY_FEED",
  "MESSAGES",
  "EVENTS",
] as const;

export const CTA_IDS = [
  "EXPLORE_SWAYAM",
  "CONTINUE_LEARNING",
  "FIND_OPPORTUNITIES",
  "FIND_A_SKILL",
  "JOIN_COMMUNITY",
  "CONTINUE_WHERE_LEFT",
] as const;

export const DECISION_SOURCES = [
  "deterministic",
  "ai",
  "persona",
  "reset",
  "undo",
  "manual",
] as const;

/** Template keys for the user-facing reason. Text is rendered locally, never taken from the AI. */
export const REASON_KEYS = [
  "START",
  "DOMAIN_RISING",
  "DOMAIN_CONFIRMED",
  "DOMAIN_DEEPENED",
  "DOMAIN_SOFTENED",
  "RETURN_TO_BALANCED",
  "EXPLORER_BREADTH",
  "MODE_OVERLAY",
  "RESTORED",
  "AI_REFINED",
  "RESET",
  "UNDO",
  "PERSONA",
  "LOCKED",
] as const;

export const ANALYZER_TRIGGERS = [
  "threshold",
  "completed_action",
  "session_end",
  "confidence_shift",
  "repeated_pattern",
  "lab",
] as const;

/** `/api/evolution` never returns model names or quota text, only one of these. */
export const AI_FALLBACKS = [
  "unconfigured",
  "rate_limited",
  "timeout",
  "invalid",
  "upstream",
  "off",
] as const;

export const ADAPTIVE_SETTINGS = ["on", "paused", "off"] as const;

/** Lab personas (plan §6.1). Journeys live in core/fixtures/journeys.ts. */
export const PERSONA_IDS = [
  "learning-explorer",
  "career-seeker",
  "skill-builder",
  "community-explorer",
  "fast-user",
] as const;

/** Where a navigation_item_clicked came from. */
export const NAV_SURFACES = [
  "top",
  "bottom",
  "rail",
  "drawer",
  "more",
  "explore",
  "shortcut",
  "sarthi",
  "footer",
] as const;
