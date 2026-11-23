/**
 * Home section metadata (plan §3.4, §4.3). Data sources live in the section
 * components (src/components/home/sections/*); this file only says what a
 * section is for, which domain it serves and how wide it renders.
 * Pure: no react.
 */
import type { Density, SectionId, SectionSpan, ServiceId } from "../types";

export interface SectionMeta {
  id: SectionId;
  domain: ServiceId;
  title: string;
  /** Members get personal data; visitors get the honest fallback described in plan §4.3. */
  requiresAuth: boolean;
  span: SectionSpan;
  densityVariants: readonly Density[];
}

const FULL: SectionSpan = { phone: "full", tablet: "full", desktop: "full" };
const HALF: SectionSpan = { phone: "full", tablet: "half", desktop: "half" };
const ALL: readonly Density[] = ["standard", "compact", "research", "discovery"];

const s = (
  id: SectionId,
  domain: ServiceId,
  title: string,
  span: SectionSpan = FULL,
  requiresAuth = false,
): SectionMeta => ({ id, domain, title, requiresAuth, span, densityVariants: ALL });

export const SECTION_META: Readonly<Record<SectionId, SectionMeta>> = Object.freeze({
  TRUST_STRIP: s("TRUST_STRIP", "PLATFORM", "Why Swayam"),
  CONTINUE_LEARNING: s("CONTINUE_LEARNING", "LEARNING", "Continue learning", HALF),
  EXPLORE_COURSES: s("EXPLORE_COURSES", "LEARNING", "Explore courses"),
  JOBS: s("JOBS", "CAREER", "Jobs and internships"),
  SKILLS: s("SKILLS", "SKILL_EXCHANGE", "Skills"),
  COMMUNITY: s("COMMUNITY", "COMMUNITY", "Community", HALF),
  RECENTLY_VIEWED: s("RECENTLY_VIEWED", "PLATFORM", "Recently viewed", HALF),
  METHOD: s("METHOD", "PLATFORM", "How Swayam works"),
  VOICE: s("VOICE", "PLATFORM", "Voices"),
  PARTNERS: s("PARTNERS", "PLATFORM", "Partners"),
  CLOSING: s("CLOSING", "PLATFORM", "Start free"),
  RECOMMENDED_JOBS: s("RECOMMENDED_JOBS", "CAREER", "Recommended jobs"),
  INTERNSHIPS: s("INTERNSHIPS", "CAREER", "Internships", HALF),
  APPLICATIONS: s("APPLICATIONS", "CAREER", "Applications", HALF, true),
  CAREER_LAUNCHER: s("CAREER_LAUNCHER", "CAREER", "Career Launcher", HALF),
  RELEVANT_COURSES: s("RELEVANT_COURSES", "LEARNING", "Courses for these roles"),
  MY_COURSES: s("MY_COURSES", "LEARNING", "My courses", HALF, true),
  PRACTICE: s("PRACTICE", "LEARNING", "Practice", HALF),
  RECOMMENDED_COURSES: s("RECOMMENDED_COURSES", "LEARNING", "Recommended courses"),
  SKILL_BUILDER: s("SKILL_BUILDER", "LEARNING", "Skill Builder", HALF),
  FIND_A_SKILL: s("FIND_A_SKILL", "SKILL_EXCHANGE", "Find a skill", HALF),
  TEACH_A_SKILL: s("TEACH_A_SKILL", "SKILL_EXCHANGE", "Teach a skill", HALF),
  MATCHES: s("MATCHES", "SKILL_EXCHANGE", "Your matches", HALF, true),
  SKILL_PASSPORT: s("SKILL_PASSPORT", "SKILL_EXCHANGE", "Skill Passport", HALF, true),
  COMMUNITIES: s("COMMUNITIES", "COMMUNITY", "Communities", HALF),
  PEOPLE_TO_FOLLOW: s("PEOPLE_TO_FOLLOW", "COMMUNITY", "People to follow", HALF),
  EVENTS: s("EVENTS", "COMMUNITY", "Events", HALF),
  CATEGORIES: s("CATEGORIES", "PLATFORM", "Browse by category"),
  // PLATFORM: it crosses every service, so a click on it must not tilt any one domain.
  INTENT_LANE: s("INTENT_LANE", "PLATFORM", "Your path"),
  MORE_FOR_YOU: s("MORE_FOR_YOU", "PLATFORM", "More for you"),
});
