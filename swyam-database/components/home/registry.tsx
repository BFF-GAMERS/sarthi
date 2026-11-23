import type { ComponentType } from "react";
import type { SectionId } from "@/evolution/types";
import type { SectionProps } from "./types";
import TrustStrip from "./sections/TrustStrip";
import MethodSection from "./sections/MethodSection";
import FeaturedSkill from "./sections/FeaturedSkill";
import CourseRailSection from "./sections/CourseRailSection";
import VoiceSection from "./sections/VoiceSection";
import HiringSection from "./sections/HiringSection";
import PartnersSection from "./sections/PartnersSection";
import ClosingSection from "./sections/ClosingSection";
import Categories from "./sections/Categories";
import IntentLane from "./sections/IntentLane";
import { Applications, CareerLauncher, Internships, RecommendedJobs } from "./sections/career";
import {
  ContinueLearning,
  MyCourses,
  Practice,
  RecommendedCourses,
  RelevantCourses,
  SkillBuilder,
} from "./sections/learning";
import { FindASkill, Matches, SkillPassport, TeachASkill } from "./sections/exchange";
import {
  Communities,
  Community,
  Events,
  PeopleToFollow,
  RecentlyViewed,
} from "./sections/community";

/** The fold itself is drawn by HomeRenderer; its registry slot only keeps the record total. */
const Fold: ComponentType<SectionProps> = () => null;

/**
 * Every SectionId has a component. Typed as a total Record, so adding an id to
 * SECTION_IDS without a component here is a compile error.
 */
export const REGISTRY: Readonly<Record<SectionId, ComponentType<SectionProps>>> = {
  TRUST_STRIP: TrustStrip,
  CONTINUE_LEARNING: ContinueLearning,
  EXPLORE_COURSES: CourseRailSection,
  JOBS: HiringSection,
  SKILLS: FeaturedSkill,
  COMMUNITY: Community,
  RECENTLY_VIEWED: RecentlyViewed,
  METHOD: MethodSection,
  VOICE: VoiceSection,
  PARTNERS: PartnersSection,
  CLOSING: ClosingSection,
  RECOMMENDED_JOBS: RecommendedJobs,
  INTERNSHIPS: Internships,
  APPLICATIONS: Applications,
  CAREER_LAUNCHER: CareerLauncher,
  RELEVANT_COURSES: RelevantCourses,
  MY_COURSES: MyCourses,
  PRACTICE: Practice,
  RECOMMENDED_COURSES: RecommendedCourses,
  SKILL_BUILDER: SkillBuilder,
  FIND_A_SKILL: FindASkill,
  TEACH_A_SKILL: TeachASkill,
  MATCHES: Matches,
  SKILL_PASSPORT: SkillPassport,
  COMMUNITIES: Communities,
  PEOPLE_TO_FOLLOW: PeopleToFollow,
  EVENTS: Events,
  CATEGORIES: Categories,
  INTENT_LANE: IntentLane,
  MORE_FOR_YOU: Fold,
};
