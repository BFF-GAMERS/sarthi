/**
 * Pure navigation helpers shared by every nav surface (Navbar, BottomNav,
 * AppRail, Explore, NavItems). No React, no router: testable in node.
 *
 * Everything is derived from the central registry and the UIState the engine
 * composes, so labels, routes and order are the same on every surface.
 */
import { NAV_ITEM_IDS } from "@/evolution/config/ids";
import { NAV_REGISTRY, pathOf, type NavDomain } from "@/evolution/config/navigation";
import type { NavItemId } from "@/evolution/types";

/** HOME and PROFILE are anchors (wordmark / avatar); the four between them are the primary links. */
const ANCHORS: readonly NavItemId[] = ["HOME", "PROFILE"];
export const TOP_LINK_COUNT = 4;

/** The four primary links of the top bar, in the order the plan gives them. */
export function middleLinks(top: readonly NavItemId[]): NavItemId[] {
  return top.filter((id) => !ANCHORS.includes(id)).slice(0, TOP_LINK_COUNT);
}

/** Bottom bar: Home plus the four middle items (5 slots). */
export function bottomSlots(top: readonly NavItemId[]): NavItemId[] {
  return ["HOME", ...middleLinks(top)];
}

export interface NavHref {
  to: string;
  search?: Record<string, string>;
  hash?: string;
}

/** Splits a registry href into the pieces the router wants (path, search object, hash). */
export function parseHref(href: string): NavHref {
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href);
  const to = m?.[1] || "/";
  const out: NavHref = { to };
  if (m?.[2]) {
    const search: Record<string, string> = {};
    new URLSearchParams(m[2]).forEach((v, k) => {
      search[k] = v;
    });
    out.search = search;
  }
  if (m?.[3]) out.hash = m[3].slice(1);
  return out;
}

export interface NavLocation {
  pathname: string;
  /** e.g. "?tab=matches" */
  searchStr?: string;
  /** with or without the leading "#" */
  hash?: string;
}

function pathMatches(pathname: string, p: string): "exact" | "nested" | null {
  if (pathname === p || pathname === p + "/") return "exact";
  if (p !== "/" && pathname.startsWith(p + "/")) return "nested";
  return null;
}

/**
 * The one item of `items` that the location belongs to, or null. Items whose
 * registry href carries a query or hash (Matches, Practice) only match when it
 * is present, and then outrank their plain sibling on the same path.
 */
export function activeNavItem(items: readonly NavItemId[], loc: NavLocation): NavItemId | null {
  const params = new URLSearchParams(loc.searchStr ?? "");
  const hash = (loc.hash ?? "").replace(/^#/, "");
  let best: NavItemId | null = null;
  let bestScore = -1;
  for (const id of items) {
    const d = NAV_REGISTRY[id];
    const own = parseHref(d.member);
    const visitorPath = pathOf(d.visitor);
    const candidates: { path: string; own: boolean }[] = [{ path: own.to, own: true }];
    for (const p of d.also ?? []) candidates.push({ path: p, own: false });
    if (visitorPath !== "/auth" && visitorPath !== own.to) {
      candidates.push({ path: visitorPath, own: false });
    }
    for (const c of candidates) {
      const hit = pathMatches(loc.pathname, c.path);
      if (!hit) continue;
      let quals = 0;
      if (c.own) {
        let ok = true;
        for (const [k, v] of Object.entries(own.search ?? {})) {
          if (params.get(k) !== v) ok = false;
          else quals++;
        }
        if (own.hash !== undefined) {
          if (hash !== own.hash) ok = false;
          else quals++;
        }
        if (!ok) continue;
      }
      const score = c.path.length * 10 + (hit === "exact" ? 5 : 0) + quals * 1000 - (c.own ? 0 : 1);
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
  }
  return best;
}

/** Overflow / Explore grouping order. ACCOUNT is last and only appears on /explore. */
export const DOMAIN_ORDER: readonly NavDomain[] = [
  "LEARNING",
  "CAREER",
  "SKILL_EXCHANGE",
  "COMMUNITY",
  "PLATFORM",
  "ACCOUNT",
];

export const DOMAIN_HEADING: Record<NavDomain, string> = {
  LEARNING: "Learn",
  CAREER: "Careers",
  SKILL_EXCHANGE: "Skill exchange",
  COMMUNITY: "Community",
  PLATFORM: "Platform",
  ACCOUNT: "Your account",
};

export interface NavGroupView {
  domain: NavDomain;
  heading: string;
  items: NavItemId[];
}

/** Groups ids by domain in DOMAIN_ORDER, keeping the registry order inside a group. */
export function groupByDomain(ids: readonly NavItemId[]): NavGroupView[] {
  const want = new Set(ids);
  return DOMAIN_ORDER.map((domain) => ({
    domain,
    heading: DOMAIN_HEADING[domain],
    items: NAV_ITEM_IDS.filter((id) => want.has(id) && NAV_REGISTRY[id].domain === domain),
  })).filter((g) => g.items.length > 0);
}

/** Everything not already on screen, minus account items, grouped by domain. */
export function overflowOf(shown: readonly NavItemId[]): NavGroupView[] {
  const on = new Set(shown);
  return groupByDomain(
    NAV_ITEM_IDS.filter((id) => !on.has(id) && NAV_REGISTRY[id].domain !== "ACCOUNT"),
  );
}

/** The avatar menu: account items and the member's own places. */
export const AVATAR_MENU_ITEMS: readonly NavItemId[] = [
  "DASHBOARD",
  "PROFILE",
  "SKILLS",
  "PASSPORT",
  "SAVED",
  "REWARDS",
  "NOTIFICATIONS",
  "SETTINGS",
];

/* ── The adapting chip text (still used by the Lab and tests): short label, full text ─────────────────────────────────────────────────────── */

export interface ChipInput {
  adaptive: "on" | "paused" | "off";
  /** True while the engine is still in UNIVERSAL / tier 0. */
  learning: boolean;
  /** The member kept this layout. */
  locked: boolean;
  /** EVOLUTION_CONFIG label: "Career focused", "Skill exchange focused", "Balanced"… */
  label: string;
  /** 0..1 */
  confidence: number;
}

/** "Career focused" becomes "Career"; "Skill exchange focused" becomes "Skills". */
export function shortStateLabel(label: string): string {
  const base = label.replace(/\s+focused$/i, "").trim();
  return /^skill exchange$/i.test(base) ? "Skills" : base;
}

/** The same expression the WhyPanel uses (council §5), so the chip and the panel never disagree. */
export const confidencePct = (confidence: number): number => Math.round(confidence * 100);

/**
 * `short` is what is drawn (never ellipsised); `full` is the tooltip and the accessible name.
 * Short is at most 14 characters for every state the engine can reach.
 */
export function chipText(i: ChipInput): { short: string; full: string } {
  if (i.adaptive === "off") return { short: "Adapting off", full: "Adaptation is off" };
  if (i.adaptive === "paused") return { short: "Paused", full: "Adaptation paused" };
  if (i.learning) return { short: "Tuning in", full: "Learning how you use Swayam" };
  const short = shortStateLabel(i.label);
  if (i.locked) return { short: `Kept · ${short}`, full: `Layout kept · ${i.label}` };
  const pct = `${confidencePct(i.confidence)}%`;
  return { short: `${short} · ${pct}`, full: `Adapting · ${i.label} · ${pct}` };
}

/* ── The status dot: shape + accessible name ───────────────────────────────────────────────────────── */

/** What the status dot is drawn as. Every tone has its own shape, so colour is never the only cue. */
export type DotTone = "learning" | "adapted" | "kept" | "paused" | "off";

/** learning = hollow ring, adapted = filled gold + check, kept = filled gold + lock, paused = ring + bars, off = dashed slashed ring. */
export function dotTone(i: ChipInput): DotTone {
  if (i.adaptive === "off") return "off";
  if (i.adaptive === "paused") return "paused";
  if (i.learning) return "learning";
  return i.locked ? "kept" : "adapted";
}

/**
 * The status dot's accessible name and tooltip, one full sentence: "Your Swayam: Career focused, 68%".
 * The percentage is the WhyPanel's own expression (`confidencePct`). `t` translates the fixed fragments
 * (pass the page's `tx`); the engine's state label is passed through untouched, like the WhyPanel does.
 */
export function dotLabel(i: ChipInput, t: (english: string) => string = (s) => s): string {
  const lead = `${t("Your Swayam")}:`;
  switch (dotTone(i)) {
    case "off":
      return `${lead} ${t("adaptation is off")}`;
    case "paused":
      return `${lead} ${t("adaptation paused")}`;
    case "learning":
      return `${lead} ${t("still learning how you use it")}`;
    case "kept":
      return `${lead} ${t("layout kept")}, ${i.label}`;
    default:
      return `${lead} ${i.label}, ${confidencePct(i.confidence)}%`;
  }
}

/** Width the dot's 44 px hit area takes in the island (the visible mark is about 14 px inside it). */
export const DOT_HIT_PX = 44;

/* ── Does the island fit on one row? ───────────────────────────────────────────────────────────────── */
/*
 * The island's width is a pure function of the viewport (.container-x: max 80rem, 20/32/40 px gutters),
 * so one row can be proven without a browser. Text widths are estimated at 0.53 em per character
 * (Instrument Sans Medium averages about 0.50 em), so the answer errs on the side of "too tight".
 * The thresholds below are the same ones evo-nav.css and Navbar.tsx use: change them together.
 */
export const NAV_BREAKPOINTS = {
  /** Primary links appear (Tailwind lg). */
  links: 1024,
  /**
   * Language control appears as a globe; the Explore/More label returns; the top-bar theme toggle,
   * the visitor's "Log in" link, the Messages shortcut and the member's first name return (xl).
   * Below it they stay one tap away in the menu drawer, the avatar menu or /auth.
   */
  xl: 1280,
  /** The language name is drawn beside the globe. */
  languageLabel: 1500,
} as const;

const EM = 0.53;
const textPx = (text: string, size: number) => Math.ceil(text.length * size * EM);

/** Width of the nav island's content box (inside its own 12 + 8 px padding) at a viewport width. */
export function islandInnerWidth(viewport: number): number {
  const gutter = viewport >= 1024 ? 40 : viewport >= 640 ? 32 : 20;
  const container = Math.min(viewport, 1280);
  return container - gutter * 2 - 20;
}

export interface NavFitInput {
  viewport: number;
  /** Labels of the four middle links, in order. */
  labels: readonly string[];
  /** EXPLORE is one of the four (it carries its own chevron instead of a More button). */
  hasExplore: boolean;
  /** @deprecated The chip is a 44 px status dot now; the text no longer takes width. Kept so callers compile. */
  chip?: string;
  signedIn: boolean;
  /** A cart badge is showing. */
  cart?: boolean;
}

export interface NavFit {
  needed: number;
  available: number;
  fits: boolean;
  moreAsIcon: boolean;
  languageShown: boolean;
  languageLabel: boolean;
  themeToggleShown: boolean;
}

export function navFit(i: NavFitInput): NavFit {
  const v = i.viewport;
  const xl = v >= NAV_BREAKPOINTS.xl;
  const languageShown = xl;
  const languageLabel = v >= NAV_BREAKPOINTS.languageLabel;
  const themeToggleShown = xl;
  const compactAccount = !xl;
  const moreAsIcon = !xl;
  const linkPad = xl ? 28 : 24;

  const left = 44 + 2 + 106 + 8; // menu button, wordmark, group gap
  let middle = 0;
  for (const l of i.labels) middle += textPx(l, 14) + linkPad + 2;
  if (i.hasExplore) middle += 26;
  else middle += moreAsIcon ? 44 + 2 : textPx("More", 14) + 4 + 14 + linkPad + 2;

  let right = 0;
  if (languageShown) right += languageLabel ? 36 + textPx("Português", 12.5) + 12 : 44;
  right += DOT_HIT_PX; // the status dot's hit area (no label)
  if (themeToggleShown) right += 44;
  right += 44; // search
  if (i.cart) right += 44;
  if (i.signedIn) {
    right += 44 + 4 + 4 + 32 + 4 + 2; // bell, gap, avatar
    if (!compactAccount) right += 44 + 8 + textPx("Priyanka", 13) + 8; // messages, first name
  } else {
    right += 4 + (textPx("Join free", 13) + 32);
    if (!compactAccount) right += textPx("Log in", 13.5) + 28 + 6;
  }
  right += 8 * 2; // gap-0.5 between the controls

  const needed = left + middle + right + 8 * 2; // two group gaps
  const available = islandInnerWidth(v);
  return {
    needed,
    available,
    fits: needed <= available,
    moreAsIcon,
    languageShown,
    languageLabel,
    themeToggleShown,
  };
}
