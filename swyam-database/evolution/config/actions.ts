/**
 * Priority-action registry (plan §3.4). Each action is a large tile under the
 * hero that links to a real destination from config/navigation.ts.
 * Pure: no react.
 */
import type { NavItemId, PriorityActionId, ServiceId } from "../types";

export interface PriorityActionMeta {
  id: PriorityActionId;
  domain: ServiceId;
  label: string;
  /** One short line under the label (hidden in compact density). */
  hint: string;
  /** Destination; resolve with hrefFor(nav, signedIn). */
  nav: NavItemId;
  icon: string;
}

const a = (
  id: PriorityActionId,
  domain: ServiceId,
  label: string,
  hint: string,
  nav: NavItemId,
  icon: string,
): PriorityActionMeta => ({ id, domain, label, hint, nav, icon });

export const PRIORITY_ACTIONS: Readonly<Record<PriorityActionId, PriorityActionMeta>> =
  Object.freeze({
    EXPLORE_COURSES: a(
      "EXPLORE_COURSES",
      "LEARNING",
      "Explore Courses",
      "Free and paid, with certificates",
      "COURSES",
      "BookOpen",
    ),
    FIND_JOBS: a(
      "FIND_JOBS",
      "CAREER",
      "Find Jobs",
      "Jobs and internships near you",
      "JOBS",
      "Briefcase",
    ),
    BUILD_A_SKILL: a(
      "BUILD_A_SKILL",
      "LEARNING",
      "Build a Skill",
      "Step-by-step skill routes",
      "SKILL_BUILDER",
      "Hammer",
    ),
    JOIN_COMMUNITY: a(
      "JOIN_COMMUNITY",
      "COMMUNITY",
      "Join Community",
      "Learners helping learners",
      "COMMUNITY",
      "MessagesSquare",
    ),
    EXPLORE_ALL: a(
      "EXPLORE_ALL",
      "PLATFORM",
      "Explore everything",
      "Every part of Swayam",
      "EXPLORE",
      "Compass",
    ),
    JOBS: a("JOBS", "CAREER", "Jobs", "Openings that fit your skills", "JOBS", "Briefcase"),
    INTERNSHIPS: a(
      "INTERNSHIPS",
      "CAREER",
      "Internships",
      "Paid and unpaid",
      "INTERNSHIPS",
      "Backpack",
    ),
    APPLICATIONS: a(
      "APPLICATIONS",
      "CAREER",
      "Applications",
      "Track what you applied for",
      "APPLICATIONS",
      "ClipboardList",
    ),
    CAREER_LAUNCHER: a(
      "CAREER_LAUNCHER",
      "CAREER",
      "Career Launcher",
      "Paths, a plan and a CV check",
      "CAREER_LAUNCHER",
      "Rocket",
    ),
    CONTINUE_LEARNING: a(
      "CONTINUE_LEARNING",
      "LEARNING",
      "Continue Learning",
      "Your next lesson",
      "MY_COURSES",
      "PlayCircle",
    ),
    MY_COURSES: a(
      "MY_COURSES",
      "LEARNING",
      "My Courses",
      "Started and finished",
      "MY_COURSES",
      "Library",
    ),
    PRACTICE: a(
      "PRACTICE",
      "LEARNING",
      "Practice",
      "Lessons and skill checks",
      "PRACTICE",
      "Dumbbell",
    ),
    SKILL_BUILDER: a(
      "SKILL_BUILDER",
      "LEARNING",
      "Skill Builder",
      "Build a skill step by step",
      "SKILL_BUILDER",
      "Hammer",
    ),
    FIND_A_SKILL: a(
      "FIND_A_SKILL",
      "SKILL_EXCHANGE",
      "Find a Skill",
      "Learn from a real person",
      "SKILLS",
      "Search",
    ),
    TEACH_A_SKILL: a(
      "TEACH_A_SKILL",
      "SKILL_EXCHANGE",
      "Teach a Skill",
      "Share what you know",
      "SKILLS",
      "Presentation",
    ),
    MATCHES: a(
      "MATCHES",
      "SKILL_EXCHANGE",
      "Matches",
      "People whose skills fit yours",
      "MATCHES",
      "Users",
    ),
    SKILL_PASSPORT: a(
      "SKILL_PASSPORT",
      "SKILL_EXCHANGE",
      "Skill Passport",
      "Your verified skills",
      "PASSPORT",
      "BadgeCheck",
    ),
    COMMUNITY_FEED: a(
      "COMMUNITY_FEED",
      "COMMUNITY",
      "Community",
      "What learners are posting",
      "COMMUNITY",
      "MessagesSquare",
    ),
    MESSAGES: a("MESSAGES", "COMMUNITY", "Messages", "Your conversations", "MESSAGES", "Mail"),
    EVENTS: a("EVENTS", "COMMUNITY", "Events", "Workshops and meetups", "EVENTS", "CalendarDays"),
  });
