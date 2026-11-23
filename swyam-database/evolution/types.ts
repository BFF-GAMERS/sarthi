/**
 * Public typed models of the Swayam Evolution Engine (brief §43, plan §3.1).
 *
 * Every enum type is derived from config/ids.ts, so the types, the validator,
 * the AI allow-lists and the SQL CHECK lists can never drift apart.
 *
 * UIState deliberately has no colour, font, gradient or theme field:
 * evolution changes structure, never paint (guardrail 4, brief §4).
 */
import type {
  ADAPTIVE_SETTINGS,
  AI_FALLBACKS,
  ANALYZER_TRIGGERS,
  BEHAVIOUR_MODES,
  CTA_IDS,
  DECISION_SOURCES,
  DENSITIES,
  DOMAIN_IDS,
  ENTITY_PREFIXES,
  EVENT_TYPES,
  EVOLUTION_STATES,
  HOME_LAYOUTS,
  NAV_ITEM_IDS,
  NAV_MODES,
  NAV_SURFACES,
  PERSONA_IDS,
  PRIORITY_ACTION_IDS,
  REASON_KEYS,
  SECTION_IDS,
  TIERS,
} from "./config/ids";

/* ── enum types ─────────────────────────────────────────────────────── */

export type DomainId = (typeof DOMAIN_IDS)[number];
export type ServiceId = DomainId | "PLATFORM";
export type EvolutionState = (typeof EVOLUTION_STATES)[number];
export type BehaviourMode = (typeof BEHAVIOUR_MODES)[number];
export type NavMode = (typeof NAV_MODES)[number];
export type HomeLayout = (typeof HOME_LAYOUTS)[number];
export type Density = (typeof DENSITIES)[number];
export type Tier = (typeof TIERS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type NavItemId = (typeof NAV_ITEM_IDS)[number];
export type SectionId = (typeof SECTION_IDS)[number];
export type PriorityActionId = (typeof PRIORITY_ACTION_IDS)[number];
export type CtaId = (typeof CTA_IDS)[number];
export type DecisionSource = (typeof DECISION_SOURCES)[number];
export type ReasonKey = (typeof REASON_KEYS)[number];
export type AnalyzerTrigger = (typeof ANALYZER_TRIGGERS)[number];
export type AiFallback = (typeof AI_FALLBACKS)[number];
export type AdaptiveSetting = (typeof ADAPTIVE_SETTINGS)[number];
export type PersonaId = (typeof PERSONA_IDS)[number];
export type NavSurface = (typeof NAV_SURFACES)[number];
export type EntityPrefix = (typeof ENTITY_PREFIXES)[number];

/** Public slugs only, e.g. `crs_python-basics`, `opp_123`, `ext_adzuna:987`. */
export type EntityId = `${EntityPrefix}_${string}`;

/** Storage / sync scope. `lab_*` and `preview_*` are never synced. */
export type Scope = "guest" | `acct_${string}` | `lab_${string}` | `preview_${string}`;

/* ── events ─────────────────────────────────────────────────────────── */

type Surface = string; // narrowed by the sanitiser's allow-list, never free text
type Bucket = "1" | "2-5" | "6+";

/** Per-type allow-listed metadata. Enum-like fields only; the sanitiser drops anything else. */
export interface EventMetadata {
  course_viewed: { group?: string; level?: string; free?: boolean };
  course_started: { via?: "enrol" | "cart" };
  course_completed: Record<string, never>;
  course_saved: Record<string, never>;
  course_compared: { count?: 1 | 2 | 3 };
  practice_completed: { surface?: "lesson" | "assessment" | "coach" };
  job_viewed: { source?: "native" | "external" };
  job_saved: Record<string, never>;
  job_applied: { kind?: "job" | "internship" };
  internship_viewed: { source?: "native" | "external" };
  internship_saved: Record<string, never>;
  application_started: {
    kind?: "job" | "internship";
    channel?: "native" | "external";
    signedIn?: boolean;
  };
  career_launcher_opened: {
    surface?: "careers" | "path" | "cv" | "coach";
    action?: "open" | "plan_built";
  };
  skill_viewed: { surface?: "board" | "skills" | "mentor" | "skillswap" };
  skill_searched: { surface?: "board" | "skills" | "mentor" | "skillswap" | "search" | "courses" };
  skill_builder_opened: { action?: "open" | "plan_built" };
  skill_passport_opened: { self?: boolean };
  skill_swap_requested: { role?: "learn" | "teach" };
  mentor_viewed: { trainerCount?: Bucket };
  profile_viewed: { self?: boolean };
  community_opened: Record<string, never>;
  community_post_viewed: Record<string, never>;
  community_post_created: Record<string, never>;
  search_performed: { surface?: Surface; suggestionKind?: string; domain?: ServiceId };
  filter_used: { surface?: Surface; filter?: string };
  /** Weak list-page signals (never meaningful): which control moved / that a search ran, never a value. */
  list_filtered: { surface?: Surface; filter?: string };
  list_searched: { surface?: Surface };
  recommendation_clicked: { surface?: Surface; rank?: number; via?: "adaptive" | "static" };
  navigation_item_clicked: {
    item?: NavItemId;
    surface?: NavSurface;
    position?: number;
    state?: EvolutionState;
  };
  dashboard_section_clicked: { section?: string; position?: number; layout?: HomeLayout };
  page_viewed: { route?: string }; // a route TEMPLATE, e.g. "/jobs/$id", never a filled-in path
}

/** What feature code hands to `track()`. The tracker stamps the rest at ingest. */
export interface TrackInput<T extends EventType = EventType> {
  type: T;
  entityId?: EntityId | null;
  metadata?: EventMetadata[T];
  /** Overrides the taxonomy's default service (e.g. skill_viewed on /skillswap → SKILL_EXCHANGE). */
  service?: ServiceId;
}

export interface BehaviourEvent<T extends EventType = EventType> {
  v: 1;
  /** Assigned at ingest, monotonic per scope. */
  seq: number;
  type: T;
  /** ms epoch, from the injected clock. */
  timestamp: number;
  /** New session after 30 min idle OR a fresh tab/browser session (D10); a refresh keeps it. */
  sessionId: string;
  /** The brief's "service". */
  service: ServiceId;
  entityId: EntityId | null;
  metadata: EventMetadata[T];
}

/* ── profile ────────────────────────────────────────────────────────── */

/** All 0..1 (brief §9 + minimalUser, since MINIMAL is a mode). */
export interface BehaviourScores {
  learningAffinity: number;
  careerAffinity: number;
  skillExchangeAffinity: number;
  communityAffinity: number;
  quickUser: number;
  researchUser: number;
  repeatUser: number;
  explorer: number;
  careerFocused: number;
  learningFocused: number;
  skillFocused: number;
  minimalUser: number;
}

/** Derived, persisted view; kept under 4 KB. */
export interface BehaviourProfile {
  scope: Scope;
  scores: BehaviourScores;
  countsByType: Partial<Record<EventType, number>>;
  countsByDomain: Record<DomainId, number>;
  meaningfulCount: number;
  sessionCount: number;
  lastSeen: number;
  /** ≤ 12, newest first; feeds Recently Viewed and "Continue where you left off". */
  recent: ReadonlyArray<{ entityId: EntityId; type: EventType; at: number }>;
}

/* ── decision ───────────────────────────────────────────────────────── */

/** EXACTLY these 7 keys: the AI output and the validated blueprint alike (brief §11). */
export interface EvolutionDecision {
  primaryState: EvolutionState;
  behaviourMode: BehaviourMode;
  navigationMode: NavMode;
  homepageLayout: HomeLayout;
  /** 1..4 unique, allow-listed, in scope for the state. */
  priorityActions: PriorityActionId[];
  /** ≤ 160 chars. Local template text; sanitised and Lab-only when it comes from the AI. */
  reason: string;
  /** 0..1 */
  confidence: number;
}

export const DECISION_KEYS = [
  "primaryState",
  "behaviourMode",
  "navigationMode",
  "homepageLayout",
  "priorityActions",
  "reason",
  "confidence",
] as const satisfies ReadonlyArray<keyof EvolutionDecision>;

export interface ReasonCode {
  key: ReasonKey;
  /** Enum-ish slot values only (domain, mode, count). Rendered by core/evolution/reasons.ts. */
  slots?: Readonly<Record<string, string | number>>;
}

export interface EvolutionSnapshotRef {
  state: EvolutionState;
  mode: BehaviourMode;
  nav: NavMode;
  layout: HomeLayout;
  tier: Tier;
}

export interface EvolutionHistoryEntry {
  id: string;
  at: number;
  seq: number;
  from: EvolutionSnapshotRef;
  to: EvolutionSnapshotRef;
  confidence: number;
  source: DecisionSource;
  reasonCode: ReasonCode;
}

/** Ring, ≤ 50 entries, oldest first. */
export type EvolutionHistory = readonly EvolutionHistoryEntry[];

/* ── compiled UI plan ───────────────────────────────────────────────── */

export interface SectionSpan {
  phone: "full";
  tablet: "half" | "full";
  desktop: "third" | "half" | "full";
}

export interface NavGroup {
  domain: ServiceId;
  items: NavItemId[];
}

export interface UISection {
  /** Stable React key (the section id). */
  key: string;
  id: SectionId;
  variant: Density;
  span: SectionSpan;
  /** Folded sections render inside the MORE_FOR_YOU <details>, one tap away. */
  folded: boolean;
}

/** Structural display switches from the tier-3 mode overlay (brief §17). Never paint. */
export interface UIDisplay {
  shortcutsRow: boolean;
  showCompare: boolean;
  showFilters: boolean;
  /** Items per rail/list; essentials (title, price/stipend, deadline, primary action) always render. */
  itemsPerSection: number;
}

/** The compiled plan the React UI renders: a pure function of decision + tier + context. */
export interface UIState {
  /** Ignores reason/confidence, so they never cause re-render churn. */
  renderKey: string;
  state: EvolutionState;
  mode: BehaviourMode;
  tier: Tier;
  density: Density;
  navMode: NavMode;
  layout: HomeLayout;
  navigation: {
    /** HOME first, PROFILE last; the middle 4 are the primary links. */
    top: NavItemId[];
    /** ≤ 5, HOME first (PROFILE lives in the island avatar). */
    bottom: NavItemId[];
    /** Everything else, grouped by domain (Explore/More). Account items stay in the avatar menu. */
    overflow: NavGroup[];
  };
  hero: { cta: CtaId; ledeKey: string };
  priorityActions: PriorityActionId[];
  sections: ReadonlyArray<UISection>;
  display: UIDisplay;
  /** For the "moved up for you" highlight. */
  movedUp: SectionId[];
  /** "Keep my current layout". */
  locked: boolean;
}

/** Everything compose() needs besides the decision and tier. Never profile type, age or region. */
export interface ComposeContext {
  signedIn: boolean;
  /** D5: recruiters and institutes keep their stable, profile-type navigation. */
  stableNav: boolean;
  locked: boolean;
}

/* ── runtime-facing ─────────────────────────────────────────────────── */

export interface EvolutionPrefs {
  adaptive: AdaptiveSetting;
  locked: boolean;
}

export type AiStatusKind = "idle" | "pending" | "applied" | "held" | "rejected" | "unavailable";

export interface AiStatus {
  kind: AiStatusKind;
  lastTrigger: AnalyzerTrigger | null;
  /** The validated AI decision, shown in the Lab only. */
  lastDecision: EvolutionDecision | null;
  /** "held by stability rules", "rejected: …", or the fallback reason. */
  detail: string | null;
  fallback: AiFallback | null;
  callsLeftToday: number;
  at: number | null;
}

/** What the indicator, WhyPanel and Lab read. */
export interface EvolutionStatus {
  scope: Scope;
  state: EvolutionState;
  mode: BehaviourMode;
  tier: Tier;
  confidence: number;
  /** "Career focused", "Balanced" … from EVOLUTION_CONFIG.states / modeLabels. */
  label: string;
  /** Local template text, never the AI's words. */
  reason: string;
  reasonCode: ReasonCode;
  /** True when the current arrangement was restored from a previous visit (not announced as a change). */
  restored: boolean;
  lastChangeAt: number | null;
  /** True while the experience is a Lab persona demo. */
  demo: PersonaId | null;
}

/** One immutable object per committed change; React reads only this. */
export interface EvolutionSnapshot {
  scope: Scope;
  prefs: EvolutionPrefs;
  profile: BehaviourProfile;
  decision: EvolutionDecision;
  tier: Tier;
  ui: UIState;
  history: EvolutionHistory;
  status: EvolutionStatus;
  ai: AiStatus;
  /** True after the client store has hydrated (the D3 gate lifts). */
  hydrated: boolean;
}
