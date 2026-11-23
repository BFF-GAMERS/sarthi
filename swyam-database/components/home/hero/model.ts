/**
 * Hero Cockpit model: the pure half. Which visual, which headline pair and which three-item lead
 * strip each state gets. No React, no network, no profile data: the table is keyed by the engine's
 * `state` alone, so two people in the same state see the same hero (and the tests can pin it).
 */
import type { EvolutionState, NavItemId } from "@/evolution/types";

export type HeroVisualKind = "plate" | "pipeline" | "progress" | "swap" | "thread" | "doors";

/** One visual per state. Record, so adding a state without a visual fails the typecheck. */
export const HERO_VISUAL: Record<EvolutionState, HeroVisualKind> = {
  UNIVERSAL: "plate",
  CAREER_FIRST: "pipeline",
  LEARNING_FIRST: "progress",
  SKILL_EXCHANGE_FIRST: "swap",
  COMMUNITY_FIRST: "thread",
  EXPLORER: "doors",
};

export interface HeadlinePair {
  first: string;
  second: string;
}

/**
 * Two short lines per state (each fits one line at 390 px in the hero size). UNIVERSAL is null: it
 * keeps the visitor headline from the dictionary, which is translated.
 */
export const HEADLINES: Record<EvolutionState, HeadlinePair | null> = {
  UNIVERSAL: null,
  CAREER_FIRST: { first: "Your next role", second: "starts here." },
  LEARNING_FIRST: { first: "Keep learning.", second: "Keep growing." },
  SKILL_EXCHANGE_FIRST: { first: "Swap skills.", second: "Grow together." },
  COMMUNITY_FIRST: { first: "Your people,", second: "your स्वYAM." },
  EXPLORER: { first: "Explore it all.", second: "Pick a path." },
};

export interface LeadItem {
  /** Destination from the nav registry: signed-in and visitor routes both exist. */
  nav: NavItemId;
  label: string;
}

/** The three-item strip under the CTA. UNIVERSAL has none (it shows the "Watch Swayam adapt" link). */
export const LEAD_STRIPS: Record<EvolutionState, ReadonlyArray<LeadItem>> = {
  UNIVERSAL: [],
  CAREER_FIRST: [
    { nav: "JOBS", label: "Jobs" },
    { nav: "INTERNSHIPS", label: "Internships" },
    { nav: "APPLICATIONS", label: "Applications" },
  ],
  LEARNING_FIRST: [
    { nav: "MY_COURSES", label: "My courses" },
    { nav: "PRACTICE", label: "Practice" },
    { nav: "PASSPORT", label: "Certificates" },
  ],
  SKILL_EXCHANGE_FIRST: [
    { nav: "SKILL_BUILDER", label: "Board" },
    { nav: "MATCHES", label: "Matches" },
    { nav: "SKILLS", label: "Requests" },
  ],
  COMMUNITY_FIRST: [
    { nav: "COMMUNITY", label: "Threads" },
    { nav: "EVENTS", label: "Events" },
    { nav: "MESSAGES", label: "Messages" },
  ],
  EXPLORER: [
    { nav: "COURSES", label: "Courses" },
    { nav: "JOBS", label: "Jobs" },
    { nav: "COMMUNITY", label: "Community" },
  ],
};

/** The hero's one-line "Watch Swayam adapt" link, UNIVERSAL only. */
export const WATCH_ADAPT_HREF = "/lab?play=career";

/** Pre-hydration gate: the html stamp under which the server's UNIVERSAL hero must stay hidden. */
export const HERO_GATED_PARTS = [
  "hero-title",
  "hero-lede",
  "hero-cta",
  "hero-visual",
  "hero-lead",
] as const;
