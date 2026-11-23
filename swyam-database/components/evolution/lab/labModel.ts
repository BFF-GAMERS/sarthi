/**
 * Pure helpers behind the Lab panels (kept out of the component files so they
 * hot-reload cleanly and can be tested without React).
 */
import type {
  AiStatus,
  BehaviourScores,
  ComposeContext,
  NavItemId,
  PersonaId,
  SectionId,
  UISection,
  UIState,
} from "@/evolution/types";
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { NAV_REGISTRY } from "@/evolution/config/navigation";
import { SECTION_META } from "@/evolution/config/sections";
import { PERSONA_IDS } from "@/evolution/config/ids";
import { actionsFor, compose, UNIVERSAL_DECISION } from "@/evolution/core/evolution/compose";
import { PERSONAS } from "@/evolution/core/fixtures/journeys";

export const AI_OFF_COPY = "AI unavailable — the on-device engine decided";

export function outcomeText(ai: AiStatus): string {
  switch (ai.kind) {
    case "applied":
      return "Applied";
    case "held":
      return "Held by stability rules";
    case "rejected":
      return `Rejected: ${ai.detail ?? "did not pass validation"}`;
    case "pending":
      return "Waiting for the AI. The layout does not wait.";
    case "unavailable":
      return AI_OFF_COPY;
    default:
      return "No AI check yet";
  }
}

/** The validated decision as pretty JSON TEXT, or null. Rendered inside <pre>, never as HTML. */
export function formatDecision(ai: AiStatus): string | null {
  if (!ai.lastDecision) return null;
  try {
    return JSON.stringify(ai.lastDecision, null, 2);
  } catch {
    return null;
  }
}

export const DOMAIN_BARS: ReadonlyArray<readonly [string, keyof BehaviourScores]> = [
  ["Learning", "learningAffinity"],
  ["Career", "careerAffinity"],
  ["Skills", "skillExchangeAffinity"],
  ["Community", "communityAffinity"],
];

/** Each domain's share of the four affinities (sums to 1; all zero before any signal). */
export function domainShares(scores: BehaviourScores): number[] {
  const raw = DOMAIN_BARS.map(([, key]) => Math.max(0, scores[key] || 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => (sum > 0 ? v / sum : 0));
}

export function traitValues(s: BehaviourScores): ReadonlyArray<readonly [string, number]> {
  return [
    ["Quick", s.quickUser],
    ["Research", s.researchUser],
    ["Repeat", s.repeatUser],
    ["Explorer", s.explorer],
    ["Focused", Math.max(s.careerFocused, s.learningFocused, s.skillFocused)],
    ["Minimal", s.minimalUser],
  ];
}

export const sourceLabel = (source: string): string => (source === "ai" ? "AI" : source);

export interface UiDiff {
  nav: NavItemId[];
  sections: SectionId[];
}

/** Items of `after` that sit somewhere different from `before`. */
export function diffUi(before: UIState, after: UIState): UiDiff {
  return {
    nav: after.navigation.top.filter((id, i) => before.navigation.top[i] !== id),
    sections: after.sections
      .filter((s, i) => before.sections[i]?.id !== s.id || before.sections[i]?.folded !== s.folded)
      .map((s) => s.id),
  };
}

/** T1/T2 = led the page from that tier on; "T3 folded" = tucked under More for you. */
export function tierMarker(ui: UIState, s: UISection, index: number): string | null {
  if (s.folded) return "T3 folded";
  if (ui.movedUp.includes(s.id)) return index < EVOLUTION_CONFIG.tiers[1].hubLead ? "T1" : "T2";
  return null;
}

export const previewSrc = (id: PersonaId): string => `/?evoPreview=${id}`;

// ─── ?play=<persona> (plan §6, council F3) ─────────────────────────────────────────────

/** Short names a link can use. Full persona ids always work too. */
const PLAY_ALIASES: Readonly<Record<string, PersonaId>> = {
  learning: "learning-explorer",
  learn: "learning-explorer",
  career: "career-seeker",
  jobs: "career-seeker",
  skills: "skill-builder",
  skill: "skill-builder",
  community: "community-explorer",
  fast: "fast-user",
  quick: "fast-user",
};

/** The persona a ?play= value names, or null (anything unknown or not a string). */
export function resolvePlayParam(raw: unknown): PersonaId | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if ((PERSONA_IDS as readonly string[]).includes(v)) return v as PersonaId;
  return Object.prototype.hasOwnProperty.call(PLAY_ALIASES, v) ? PLAY_ALIASES[v]! : null;
}

export const TIER_STEPS: ReadonlyArray<{ tier: number; label: string }> = [
  { tier: 0, label: "Universal" },
  { tier: 1, label: "Noticed" },
  { tier: 2, label: "Leaning" },
  { tier: 3, label: "Evolved" },
];

// ─── Compare (plan §6.2) ─────────────────────────────────────────────────────────────

/** The arrangement a persona's journey ends in (its expected state, mode and tier), composed from config. */
export function personaUi(id: PersonaId, ctx: ComposeContext): UIState {
  const { expected } = PERSONAS[id];
  const cfg = EVOLUTION_CONFIG.states[expected.state];
  return compose(
    {
      ...UNIVERSAL_DECISION,
      primaryState: expected.state,
      behaviourMode: expected.mode,
      navigationMode: cfg.nav,
      homepageLayout: cfg.layout,
      priorityActions: actionsFor(expected.state, expected.tier),
    },
    expected.tier,
    ctx,
  );
}

/** Index of the first position where two ordered lists differ, or -1 when they match. */
export function firstDivergence(a: readonly string[], b: readonly string[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return -1;
}

export const openSections = (ui: UIState): SectionId[] =>
  ui.sections.filter((s) => !s.folded).map((s) => s.id);

export interface CompareRow {
  label: string;
  a: string;
  b: string;
  differs: boolean;
}

export interface CompareModel {
  rows: CompareRow[];
  /** Position in the open Home order where the two first differ, or -1. */
  firstIndex: number;
  /** The section each frame should scroll to (null when there is no difference to show). */
  targetA: SectionId | null;
  targetB: SectionId | null;
}

/**
 * A config label as the Lab shows it. The config keeps its own strings (they are ids for
 * tests and translation); on screen they follow the site's style: sentence case
 * ("Continue Learning" -> "Continue learning"), the brand as स्वYAM, and the "… focused"
 * compounds hyphenated ("Skill exchange focused" -> "Skill-exchange-focused").
 * Acronyms and mixed-case words are left as written.
 */
export function displayLabel(label: string): string {
  const words = label
    .replace(/\bSwayam\b/g, "स्वYAM")
    .split(" ")
    .map((w, i) => (i > 0 && /^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w));
  const out = words.join(" ");
  return / focused$/.test(out) ? out.replace(/ /g, "-") : out;
}

/** "State · mode", without saying the same word twice ("Balanced · Balanced"). */
export function experienceLabel(state: string, mode: string): string {
  const a = displayLabel(state);
  const b = displayLabel(mode);
  return a === b ? a : `${a} · ${b}`;
}

const navLabels = (ui: UIState): string =>
  ui.navigation.top.map((id) => NAV_REGISTRY[id].label).join(" · ");

/**
 * The "What differs" list: experience, hero button, top bar, then the first Home sections in order.
 * `rendered` is the order the two frames really drew (read from their DOM once both settled). Home
 * leaves out sections that have nothing to show a guest, so it can differ from the compiled plan;
 * when given, it wins, so the list and the scroll target always match what is on screen.
 */
export function compareUis(
  a: UIState,
  b: UIState,
  homeRows = 6,
  rendered?: { a: readonly SectionId[]; b: readonly SectionId[] } | null,
): CompareModel {
  const useDom = !!rendered && rendered.a.length > 0 && rendered.b.length > 0;
  const oa: readonly SectionId[] = useDom ? rendered!.a : openSections(a);
  const ob: readonly SectionId[] = useDom ? rendered!.b : openSections(b);
  const firstIndex = firstDivergence(oa, ob);
  const rows: CompareRow[] = [];
  const add = (label: string, x: string, y: string) =>
    rows.push({ label, a: x, b: y, differs: x !== y });
  const exp = (ui: UIState) =>
    experienceLabel(EVOLUTION_CONFIG.states[ui.state].label, EVOLUTION_CONFIG.modeLabels[ui.mode]);
  add("Experience", exp(a), exp(b));
  add(
    "Hero button",
    displayLabel(EVOLUTION_CONFIG.ctas[a.hero.cta].label),
    displayLabel(EVOLUTION_CONFIG.ctas[b.hero.cta].label),
  );
  add("Top bar", navLabels(a), navLabels(b));
  const title = (id: SectionId | undefined) => (id ? SECTION_META[id].title : "—");
  for (let i = 0; i < Math.min(homeRows, Math.max(oa.length, ob.length)); i++) {
    add(`Home ${i + 1}`, title(oa[i]), title(ob[i]));
  }
  return {
    rows,
    firstIndex,
    targetA: firstIndex >= 0 ? (oa[firstIndex] ?? null) : null,
    targetB: firstIndex >= 0 ? (ob[firstIndex] ?? null) : null,
  };
}

// ─── Live status line (Lab, above the fold) ────────────────────────────────────────────

export interface LabStatusInput {
  demo: PersonaId | null;
  running: PersonaId | null;
  replayStep: { index: number; total: number } | null;
  state: UIState["state"];
  tier: number;
}

/** One plain sentence about what the Lab is doing right now. Read aloud politely. */
export function labStatusLine(i: LabStatusInput): string {
  if (i.replayStep) return `Replaying step ${i.replayStep.index} of ${i.replayStep.total}.`;
  if (i.running)
    return `${PERSONAS[i.running].label} is playing · ${displayLabel(EVOLUTION_CONFIG.states[i.state].label)} · tier ${i.tier} of 3`;
  if (i.demo) {
    const who = PERSONAS[i.demo].label;
    return i.tier >= 3
      ? `Reached tier 3: ${displayLabel(EVOLUTION_CONFIG.states[i.state].label)}. Home and the top bar now follow what ${who} does.`
      : `${who} finished at tier ${i.tier}: ${displayLabel(EVOLUTION_CONFIG.states[i.state].label)}.`;
  }
  return "Pick a persona to watch स्वYAM adapt.";
}
