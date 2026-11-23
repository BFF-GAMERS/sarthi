/**
 * Pure helpers for the adaptive Home (plan §4.3). No react, no network: the
 * renderer and the unit test both call these, so the order a visitor sees is
 * the order that is tested.
 */
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { hrefFor } from "@/evolution/config/navigation";
import type {
  BehaviourProfile,
  CtaId,
  EvolutionState,
  SectionId,
  Tier,
  UISection,
} from "@/evolution/types";

/** Sections that keep their own full-bleed container (the pre-evolution Home sections). */
export const BLEED_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>([
  "TRUST_STRIP",
  "METHOD",
  "SKILLS",
  "EXPLORE_COURSES",
  "VOICE",
  "JOBS",
  "PARTNERS",
  "CLOSING",
]);

export interface SplitPlan {
  /** Rendered in order, never behind a fold. */
  main: UISection[];
  /** Rendered inside the MORE_FOR_YOU <details>. */
  folded: UISection[];
  /** Visitors only. */
  closing: UISection | null;
}

/** MORE_FOR_YOU is the fold itself; CLOSING is a sign-up band, so members never see it. */
export function splitSections(sections: ReadonlyArray<UISection>, signedIn: boolean): SplitPlan {
  const main: UISection[] = [];
  const folded: UISection[] = [];
  let closing: UISection | null = null;
  for (const s of sections) {
    if (s.id === "MORE_FOR_YOU") continue;
    if (s.id === "CLOSING") {
      closing = signedIn ? null : s;
      continue;
    }
    (s.folded ? folded : main).push(s);
  }
  return { main, folded, closing };
}

/** The section ids in the order a person scrolls past them (folded ones last). */
export function homeOrder(sections: ReadonlyArray<UISection>, signedIn: boolean): SectionId[] {
  const { main, folded, closing } = splitSections(sections, signedIn);
  return [...main, ...folded, ...(closing ? [closing] : [])].map((s) => s.id);
}

export type Row = { kind: "bleed"; items: UISection[] } | { kind: "grid"; items: UISection[] };

/** Consecutive padded sections share one grid row (halves pair up); bleed sections stand alone. */
export function groupRows(list: ReadonlyArray<UISection>): Row[] {
  const rows: Row[] = [];
  for (const s of list) {
    if (BLEED_SECTIONS.has(s.id)) {
      rows.push({ kind: "bleed", items: [s] });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last && last.kind === "grid") last.items.push(s);
    else rows.push({ kind: "grid", items: [s] });
  }
  return rows;
}

/* -- the flat flow ---------------------------------------------------- */

/**
 * Where one section sits in the flat Home grid. The grid has six inner tracks, so a section spans 6
 * (alone), 3 (a half) or 2 (a third). Which one depends on the breakpoint and on its neighbours, so
 * it is worked out here, once, and the stylesheet only maps the numbers to columns.
 */
export interface FlowCell {
  /** Full-bleed: keeps its own container and spans the whole width. */
  bleed: boolean;
  /** At tablet width this section takes a whole row. */
  tabletFull: boolean;
  /** 0 = left, 1 = right of a tablet pair. */
  tj: 0 | 1;
  /** At desktop width this section takes a whole row. */
  desktopFull: boolean;
  /** Columns its group uses on a wide desktop: 1, 2 or 3 (a small desktop never uses more than 2). */
  dc: 1 | 2 | 3;
  /** Position in a pair (j % 2) and in a triple (j % 3) within its run of half sections. */
  dj2: 0 | 1;
  dj3: 0 | 1 | 2;
  /** The last padded section before a bleed section or the end of the list. */
  last: boolean;
}

const BLEED_CELL: FlowCell = {
  bleed: true,
  tabletFull: true,
  tj: 0,
  desktopFull: true,
  dc: 1,
  dj2: 0,
  dj3: 0,
  last: false,
};

/** Index of each section inside its run of half-width sections (a full-width one ends a run). */
function runsOf(
  group: ReadonlyArray<UISection>,
  isFull: (s: UISection) => boolean,
): { j: number[]; longest: number } {
  const j: number[] = [];
  let run = 0;
  let longest = 0;
  for (const s of group) {
    if (isFull(s)) {
      j.push(0);
      run = 0;
    } else {
      j.push(run);
      run += 1;
      longest = Math.max(longest, run);
    }
  }
  return { j, longest };
}

/**
 * The flat grid placement for the main list. Consecutive padded sections form a group (a bleed
 * section ends it); inside a group, half-width sections pair up on tablets and go up to three
 * across on a wide desktop, the way the old per-group rows did. Pure, so the layout is testable.
 */
export function flowCells(list: ReadonlyArray<UISection>): Map<string, FlowCell> {
  const cells = new Map<string, FlowCell>();
  let i = 0;
  while (i < list.length) {
    if (BLEED_SECTIONS.has(list[i]!.id)) {
      cells.set(list[i]!.key, BLEED_CELL);
      i += 1;
      continue;
    }
    let end = i;
    while (end < list.length && !BLEED_SECTIONS.has(list[end]!.id)) end += 1;
    const group = list.slice(i, end);
    const tablet = runsOf(group, (s) => s.span.tablet === "full");
    const desktop = runsOf(group, (s) => s.span.desktop === "full");
    const dc = Math.min(3, Math.max(1, desktop.longest)) as 1 | 2 | 3;
    group.forEach((s, n) => {
      const dj = desktop.j[n] ?? 0;
      cells.set(s.key, {
        bleed: false,
        tabletFull: s.span.tablet === "full",
        tj: ((tablet.j[n] ?? 0) % 2) as 0 | 1,
        desktopFull: s.span.desktop === "full",
        dc,
        dj2: (dj % 2) as 0 | 1,
        dj3: (dj % 3) as 0 | 1 | 2,
        last: n === group.length - 1,
      });
    });
    i = end;
  }
  return cells;
}

/* ── hero CTA ──────────────────────────────────────────────────────── */

export interface ResolvedTarget {
  href: string;
  label: string;
}

type Recent = BehaviourProfile["recent"];

/** The newest recent entity that resolves to a real page. */
export function newestResolvable(
  recent: Recent,
  resolve: (entityId: string) => string | null,
): string | null {
  for (const r of recent) {
    const href = resolve(r.entityId);
    if (href) return href;
  }
  return null;
}

/**
 * The CTA for a state. `recent` links the newest real entity; with nothing
 * real to resume it falls back to Explore, never to an invented destination.
 */
export function resolveCta(
  cta: CtaId,
  signedIn: boolean,
  resolveRecent: (entityId: string) => string | null,
  recent: Recent,
): ResolvedTarget {
  const c = EVOLUTION_CONFIG.ctas[cta];
  if (c.to === "recent") {
    const href = newestResolvable(recent, resolveRecent);
    return href
      ? { href, label: c.label }
      : { href: hrefFor("EXPLORE", signedIn), label: EVOLUTION_CONFIG.ctas.EXPLORE_SWAYAM.label };
  }
  const to = typeof c.to === "string" ? c.to : signedIn ? c.to.member : c.to.visitor;
  return { href: to, label: c.label };
}

/* ── hero cockpit ──────────────────────────────────────────────────── */

/** Height of the one strip that replaces the stats row and the try-chips on a phone. */
export const PHONE_STRIP_PX = 44;

export interface HeroLayout {
  /** A learned state past tier 0: the headline, visual and lead strip are the state's own. */
  evolved: boolean;
  /** Phone only: stats and try-chips fold into one strip so the first promoted card sits above 844 px. */
  compactPhone: boolean;
  /** The three-item lead strip under the CTA. */
  leadStrip: boolean;
  /** UNIVERSAL only: the "Watch Swayam adapt" link takes the lead strip's slot. */
  watchAdapt: boolean;
  /** The proof row for visitors (members have their own numbers in the resume card). */
  stats: boolean;
}

/**
 * What the hero is made of. A pure function of the engine's state and tier (never of age, region or
 * profile type), so the Lab can compare two frames and the unit test can pin each one.
 */
export function heroLayout(state: EvolutionState, tier: Tier, signedIn: boolean): HeroLayout {
  const evolved = state !== "UNIVERSAL" && tier >= 1;
  return {
    evolved,
    compactPhone: evolved,
    leadStrip: evolved,
    watchAdapt: !evolved,
    stats: !signedIn,
  };
}
