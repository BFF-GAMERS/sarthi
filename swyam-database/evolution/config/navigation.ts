/**
 * Destination registry (plan §3.4). Every NavItemId resolves to a real route,
 * for members and for visitors. Every navigation surface (top bar, bottom bar,
 * AppRail, drawer, Explore/More, /explore, Footer, shortcuts) renders from here,
 * so labels and routes are the same everywhere.
 *
 * A test reads routeTree.gen.ts and asserts each route's path exists.
 * Pure: no react; icons are lucide component names, mapped by the UI.
 */
import type { NavItemId, ServiceId } from "../types";

export type NavDomain = ServiceId | "ACCOUNT";

export interface NavDestination {
  id: NavItemId;
  /** Overflow grouping. ACCOUNT items stay in the avatar menu, never in Explore/More. */
  domain: NavDomain;
  label: string;
  /** Optional i18n key in src/lib/i18n Strings; the UI falls back to `label`. */
  labelKey: string | null;
  /** lucide-react component name. */
  icon: string;
  /** One line for /explore and the drawer. */
  purpose: string;
  member: string;
  visitor: string;
  requiresAuth: boolean;
  /** Other paths that should light this item as active. */
  also?: string[];
}

const login = (next: string) => `/auth?mode=login&next=${encodeURIComponent(next)}`;

export const NAV_REGISTRY: Readonly<Record<NavItemId, NavDestination>> = Object.freeze({
  HOME: {
    id: "HOME",
    domain: "PLATFORM",
    label: "Home",
    labelKey: null,
    icon: "Home",
    purpose: "Your Swayam, arranged around what you do.",
    member: "/",
    visitor: "/",
    requiresAuth: false,
  },
  EXPLORE: {
    id: "EXPLORE",
    domain: "PLATFORM",
    label: "Explore",
    labelKey: null,
    icon: "Compass",
    purpose: "Every part of Swayam in one place.",
    member: "/explore",
    visitor: "/explore",
    requiresAuth: false,
  },
  COURSES: {
    id: "COURSES",
    domain: "LEARNING",
    label: "Courses",
    labelKey: "courses",
    icon: "BookOpen",
    purpose: "Free and paid courses with certificates.",
    member: "/courses",
    visitor: "/courses",
    requiresAuth: false,
    also: ["/learn"],
  },
  LEARN: {
    id: "LEARN",
    domain: "LEARNING",
    label: "Learn",
    labelKey: null,
    icon: "GraduationCap",
    purpose: "Find your next course.",
    member: "/courses",
    visitor: "/courses",
    requiresAuth: false,
    also: ["/learn"],
  },
  MY_COURSES: {
    id: "MY_COURSES",
    domain: "LEARNING",
    label: "My Courses",
    labelKey: null,
    icon: "Library",
    purpose: "Courses you have started and finished.",
    member: "/my-learning",
    visitor: login("/my-learning"),
    requiresAuth: true,
  },
  PRACTICE: {
    id: "PRACTICE",
    domain: "LEARNING",
    label: "Practice",
    labelKey: null,
    icon: "Dumbbell",
    purpose: "Practice lessons and skill checks.",
    member: "/my-learning#practice",
    visitor: login("/my-learning#practice"),
    requiresAuth: true,
  },
  SKILL_BUILDER: {
    id: "SKILL_BUILDER",
    domain: "LEARNING",
    label: "Skill Builder",
    labelKey: null,
    icon: "Hammer",
    purpose: "Routes to build a skill step by step.",
    member: "/board",
    visitor: "/board",
    requiresAuth: false,
  },
  JOBS: {
    id: "JOBS",
    domain: "CAREER",
    label: "Jobs",
    labelKey: "jobs",
    icon: "Briefcase",
    purpose: "Open jobs from verified employers.",
    member: "/jobs",
    visitor: "/jobs",
    requiresAuth: false,
    also: ["/internships", "/opportunities"],
  },
  INTERNSHIPS: {
    id: "INTERNSHIPS",
    domain: "CAREER",
    label: "Internships",
    labelKey: null,
    icon: "Backpack",
    purpose: "Paid and unpaid internships.",
    member: "/internships",
    visitor: "/internships",
    requiresAuth: false,
  },
  OPPORTUNITIES: {
    id: "OPPORTUNITIES",
    domain: "CAREER",
    label: "All openings",
    labelKey: null,
    icon: "LayoutGrid",
    purpose: "Jobs and internships by kind and category.",
    member: "/opportunities",
    visitor: "/opportunities",
    requiresAuth: false,
  },
  APPLICATIONS: {
    id: "APPLICATIONS",
    domain: "CAREER",
    label: "Applications",
    labelKey: null,
    icon: "ClipboardList",
    purpose: "Track what you applied for.",
    member: "/applications",
    visitor: login("/applications"),
    requiresAuth: true,
  },
  CAREER_LAUNCHER: {
    id: "CAREER_LAUNCHER",
    domain: "CAREER",
    label: "Career Launcher",
    labelKey: null,
    icon: "Rocket",
    purpose: "Career paths, a plan and a CV check.",
    member: "/careers",
    visitor: "/careers",
    requiresAuth: false,
  },
  CV: {
    id: "CV",
    domain: "CAREER",
    label: "CV review",
    labelKey: null,
    icon: "FileText",
    purpose: "Feedback on your CV for a role.",
    member: "/cv",
    visitor: "/cv",
    requiresAuth: false,
  },
  COACH: {
    id: "COACH",
    domain: "CAREER",
    label: "Coach",
    labelKey: null,
    icon: "MessageCircle",
    purpose: "A coach for your path and practice.",
    member: "/coach",
    visitor: "/coach",
    requiresAuth: false,
  },
  SKILLS: {
    id: "SKILLS",
    domain: "SKILL_EXCHANGE",
    // The product's name, not a generic noun: "Skills" hid SkillSwap from anyone who had not met it.
    label: "SkillSwap",
    labelKey: null,
    icon: "Repeat",
    purpose: "SkillSwap: learn from people, teach back.",
    member: "/skillswap",
    // The SkillSwap itself (trainer or learner, live video sessions), not the public board.
    visitor: "/skillswap",
    requiresAuth: false,
  },
  SKILL_DIRECTORY: {
    id: "SKILL_DIRECTORY",
    domain: "SKILL_EXCHANGE",
    label: "Skill directory",
    labelKey: null,
    icon: "Shapes",
    purpose: "Every skill and who teaches it.",
    member: "/skills",
    visitor: "/skills",
    requiresAuth: false,
  },
  MATCHES: {
    id: "MATCHES",
    domain: "SKILL_EXCHANGE",
    label: "Matches",
    labelKey: null,
    icon: "Users",
    purpose: "People whose skills fit yours.",
    member: "/skillswap?tab=matches",
    visitor: `/auth?mode=signup&next=${encodeURIComponent("/skillswap?tab=matches")}`,
    requiresAuth: true,
  },
  PASSPORT: {
    id: "PASSPORT",
    domain: "SKILL_EXCHANGE",
    label: "Skill Passport",
    labelKey: null,
    icon: "BadgeCheck",
    purpose: "Your verified skills, shareable.",
    member: "/passport",
    visitor: login("/passport"),
    requiresAuth: true,
  },
  COMMUNITY: {
    id: "COMMUNITY",
    domain: "COMMUNITY",
    label: "Community",
    labelKey: "community",
    icon: "MessagesSquare",
    purpose: "Posts and groups from learners like you.",
    member: "/community",
    visitor: "/community",
    requiresAuth: false,
  },
  MESSAGES: {
    id: "MESSAGES",
    domain: "COMMUNITY",
    label: "Messages",
    labelKey: null,
    icon: "Mail",
    purpose: "Your conversations.",
    member: "/messages",
    visitor: login("/messages"),
    requiresAuth: true,
  },
  EVENTS: {
    id: "EVENTS",
    domain: "COMMUNITY",
    label: "Events",
    labelKey: null,
    icon: "CalendarDays",
    purpose: "Workshops, meetups and live sessions.",
    member: "/events",
    visitor: "/events",
    requiresAuth: false,
  },
  PROFILE: {
    id: "PROFILE",
    domain: "PLATFORM",
    label: "Profile",
    labelKey: null,
    icon: "UserRound",
    purpose: "Your profile.",
    member: "/profile",
    visitor: "/auth?mode=login",
    requiresAuth: true,
  },
  DASHBOARD: {
    id: "DASHBOARD",
    domain: "PLATFORM",
    label: "Dashboard",
    labelKey: null,
    icon: "LayoutDashboard",
    purpose: "Your work area: plans, applications, progress.",
    member: "/dashboard",
    visitor: login("/dashboard"),
    requiresAuth: true,
  },
  SAVED: {
    id: "SAVED",
    domain: "PLATFORM",
    label: "Saved",
    labelKey: null,
    icon: "Bookmark",
    purpose: "Courses and openings you saved.",
    member: "/saved",
    visitor: "/saved",
    requiresAuth: false,
  },
  SEARCH: {
    id: "SEARCH",
    domain: "PLATFORM",
    label: "Search",
    labelKey: null,
    icon: "Search",
    purpose: "Search courses, openings and skills.",
    member: "/search",
    visitor: "/search",
    requiresAuth: false,
  },
  SCHEMES: {
    id: "SCHEMES",
    domain: "PLATFORM",
    label: "Schemes",
    labelKey: null,
    icon: "Landmark",
    purpose: "Government schemes you may qualify for.",
    member: "/schemes",
    visitor: "/schemes",
    requiresAuth: false,
  },
  RESOURCES: {
    id: "RESOURCES",
    domain: "PLATFORM",
    label: "Resources",
    labelKey: null,
    icon: "LibraryBig",
    purpose: "Guides and free resources.",
    member: "/resources",
    visitor: "/resources",
    requiresAuth: false,
  },
  TRUST: {
    id: "TRUST",
    domain: "PLATFORM",
    label: "Trust center",
    labelKey: null,
    icon: "ShieldCheck",
    purpose: "How Swayam keeps you safe.",
    member: "/trust",
    visitor: "/trust",
    requiresAuth: false,
  },
  LAB: {
    id: "LAB",
    domain: "PLATFORM",
    label: "Evolution Lab",
    labelKey: null,
    icon: "FlaskConical",
    purpose: "See how Swayam adapts, and reset it.",
    member: "/lab",
    visitor: "/lab",
    requiresAuth: false,
    also: ["/lab/compare"],
  },
  SETTINGS: {
    id: "SETTINGS",
    domain: "ACCOUNT",
    label: "Settings",
    labelKey: null,
    icon: "Settings",
    purpose: "Account, theme and adaptation settings.",
    member: "/settings",
    visitor: login("/settings"),
    requiresAuth: true,
  },
  NOTIFICATIONS: {
    id: "NOTIFICATIONS",
    domain: "ACCOUNT",
    label: "Notifications",
    labelKey: null,
    icon: "Bell",
    purpose: "Updates on your applications and posts.",
    member: "/notifications",
    visitor: login("/notifications"),
    requiresAuth: true,
  },
  REWARDS: {
    id: "REWARDS",
    domain: "ACCOUNT",
    label: "Rewards",
    labelKey: null,
    icon: "Gift",
    purpose: "Rewards you have earned.",
    member: "/rewards",
    visitor: login("/rewards"),
    requiresAuth: true,
  },
});

/**
 * Routes that do not exist as files yet. Must stay EMPTY: /explore, /lab and
 * /lab/compare were registered by the Stage 2–5 contracts step.
 */
export const PENDING_ROUTES: readonly string[] = [];

/** Pure route resolution; strips nothing — callers pass the result to <Link to>/<a href>. */
export function hrefFor(id: NavItemId, signedIn: boolean): string {
  const d = NAV_REGISTRY[id];
  return signedIn ? d.member : d.visitor;
}

/** The route path without query or hash, for route-existence tests and active matching. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}
