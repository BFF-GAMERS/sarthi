/**
 * planTabs: which order and which default a page's tabs open in (lane B2).
 *
 * Rules, in the order they are checked:
 *  1. Canonical, whatever else is true: recruiter/institute stable nav, adaptation paused or off, "keep my
 *     layout", tier below 2, the UNIVERSAL or EXPLORER state, or the EXPLORER mode.
 *  2. Otherwise the state's preferred order (config/tabs.ts); the member's own usage breaks ties among the
 *     tabs the state has no opinion about. A tab picked >= 3 times in the last 14 days becomes the default.
 *  3. At most TAB_MAX_MOVES tabs are moved per change, measured against the order last shown (or the
 *     canonical one), so the arrangement drifts gently and never reshuffles.
 *  4. The result is ALWAYS a permutation of the canonical tabs: nothing hidden, nothing duplicated.
 *  5. A deep link (hash, `?kind=`, initialTab) always wins the default over any adaptive one.
 *
 * Behaviour only: nothing here reads age, region or profile type (stableNav is a role flag, not a trait).
 * Pure: no react, no DOM, no clock; the caller supplies `today` as a day number.
 */
import { TAB_PLANS, type TabPageId } from "../../config/tabs";
import type { AdaptiveSetting, BehaviourMode, EvolutionState, Tier } from "../../types";
import { USAGE_WINDOW_DAYS, type PageUsage } from "./usage";

export const TAB_MIN_TIER = 2;
/** Uses within the window for a tab to become the default. */
export const TAB_PROMOTE_MIN = 3;
/** Uses within the window before usage may reorder a tab at all (one stray click does nothing). */
export const TAB_ORDER_MIN = 2;
export const TAB_MAX_MOVES = 2;
/** Older picks count for less: the weight halves every 7 days. */
const HALF_LIFE_DAYS = 7;

export type TabReason =
  | "canonical"
  | "stable-nav"
  | "adaptive-off"
  | "locked"
  | "low-tier"
  | "universal-state"
  | "state-order"
  | "usage-order"
  | "state-default"
  | "usage-default"
  | "move-cap"
  | "deep-link";

export interface TabPlanInput {
  pageId: TabPageId;
  canonical: readonly string[];
  state: EvolutionState;
  tier: Tier;
  mode: BehaviourMode;
  usage: PageUsage;
  stableNav: boolean;
  /** Defaults to "on". */
  adaptive?: AdaptiveSetting;
  locked?: boolean;
  /** A deep link, hash, `?kind=` or initialTab. Always wins the default. */
  explicit?: string | null;
  /** The order last shown on this page; the move cap is measured from it. */
  previous?: readonly string[] | null;
  /** Day number (days since the epoch). Defaults to the newest day in `usage`. */
  today?: number;
}

export interface TabPlan {
  order: string[];
  defaultId: string;
  reasons: TabReason[];
}

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

/** Longest strictly increasing subsequence length (n is at most a handful). */
function lisLength(seq: readonly number[]): number {
  const best: number[] = [];
  let top = 0;
  for (let i = 0; i < seq.length; i++) {
    best[i] = 1;
    for (let j = 0; j < i; j++) {
      if (seq[j]! < seq[i]! && best[j]! + 1 > best[i]!) best[i] = best[j]! + 1;
    }
    top = Math.max(top, best[i]!);
  }
  return top;
}

/** The fewest single-tab relocations that turn `a` into `b` (both permutations of the same tabs). */
export function movesBetween(a: readonly string[], b: readonly string[]): number {
  const pos = a.map((x) => b.indexOf(x));
  if (pos.includes(-1)) return a.length;
  return a.length - lisLength(pos);
}

const footrule = (a: readonly string[], b: readonly string[]): number =>
  a.reduce((sum, x, i) => sum + Math.abs(i - b.indexOf(x)), 0);

/** Walk from `reference` toward `target`, relocating at most `max` tabs. Each step is one relocation. */
export function limitMoves(
  reference: readonly string[],
  target: readonly string[],
  max: number,
): string[] {
  let cur = [...reference];
  for (let step = 0; step < max; step++) {
    const d = movesBetween(cur, target);
    if (d === 0) break;
    let best: string[] | null = null;
    let bestD = d;
    let bestF = Infinity;
    for (let i = 0; i < cur.length; i++) {
      for (let j = 0; j < cur.length; j++) {
        if (i === j) continue;
        const next = [...cur];
        const [x] = next.splice(i, 1);
        next.splice(j, 0, x!);
        const nd = movesBetween(next, target);
        const nf = footrule(next, target);
        if (nd < bestD || (nd === bestD && best !== null && nf < bestF)) {
          best = next;
          bestD = nd;
          bestF = nf;
        }
      }
    }
    if (!best) break;
    cur = best;
  }
  return cur;
}

interface Stat {
  recent: number;
  score: number;
}

function statsFor(id: string, usage: PageUsage, today: number): Stat {
  let recent = 0;
  let score = 0;
  for (const [d, n] of Object.entries(usage[id] ?? {})) {
    const age = today - Number(d);
    if (!Number.isFinite(age) || age < 0 || age >= USAGE_WINDOW_DAYS) continue;
    recent += n;
    score += n * Math.pow(0.5, age / HALF_LIFE_DAYS);
  }
  return { recent, score };
}

function newestDay(usage: PageUsage): number {
  let top = 0;
  for (const days of Object.values(usage)) {
    for (const d of Object.keys(days)) top = Math.max(top, Number(d) || 0);
  }
  return top;
}

function canonicalBlocker(input: TabPlanInput): TabReason | null {
  if (input.stableNav) return "stable-nav";
  if ((input.adaptive ?? "on") !== "on") return "adaptive-off";
  if (input.locked) return "locked";
  if (input.tier < TAB_MIN_TIER) return "low-tier";
  if (input.state === "UNIVERSAL" || input.state === "EXPLORER" || input.mode === "EXPLORER") {
    return "universal-state";
  }
  return null;
}

export function planTabs(input: TabPlanInput): TabPlan {
  const canon = unique(input.canonical);
  const spec = TAB_PLANS[input.pageId];
  const canonDefault = canon.includes(spec.defaultId) ? spec.defaultId : (canon[0] ?? "");
  const explicit = input.explicit && canon.includes(input.explicit) ? input.explicit : null;
  const finish = (order: string[], defaultId: string, reasons: TabReason[]): TabPlan =>
    explicit
      ? { order, defaultId: explicit, reasons: [...reasons, "deep-link"] }
      : { order, defaultId, reasons };

  const blocker = canonicalBlocker(input);
  if (blocker) return finish(canon, canonDefault, [blocker]);

  const today = input.today ?? newestDay(input.usage);
  const stat = new Map(canon.map((id) => [id, statsFor(id, input.usage, today)]));
  const weight = (id: string) => {
    const s = stat.get(id)!;
    return s.recent >= TAB_ORDER_MIN ? s.score : 0;
  };

  const stateSpec = spec.states[input.state];
  const lead = unique((stateSpec.order ?? []).filter((id) => canon.includes(id)));
  const rank = (id: string) => {
    const i = lead.indexOf(id);
    return i >= 0 ? i : lead.length;
  };
  const target = [...canon].sort(
    (a, b) => rank(a) - rank(b) || weight(b) - weight(a) || canon.indexOf(a) - canon.indexOf(b),
  );

  const prev = input.previous ? unique(input.previous) : [];
  const reference =
    prev.length === canon.length && prev.every((id) => canon.includes(id)) ? prev : canon;
  const order = limitMoves(reference, target, TAB_MAX_MOVES);

  const stateDefault =
    stateSpec.defaultId && canon.includes(stateSpec.defaultId) ? stateSpec.defaultId : canonDefault;
  const promoted = canon
    .filter((id) => stat.get(id)!.recent >= TAB_PROMOTE_MIN)
    .sort(
      (a, b) =>
        stat.get(b)!.recent - stat.get(a)!.recent ||
        stat.get(b)!.score - stat.get(a)!.score ||
        canon.indexOf(a) - canon.indexOf(b),
    )[0];

  const reasons: TabReason[] = [];
  if (lead.length > 0) reasons.push("state-order");
  if (canon.some((id) => weight(id) > 0)) reasons.push("usage-order");
  if (movesBetween(order, target) > 0) reasons.push("move-cap");
  if (promoted) reasons.push("usage-default");
  else if (stateDefault !== canonDefault) reasons.push("state-default");
  if (reasons.length === 0) reasons.push("canonical");
  return finish(order, promoted ?? stateDefault, reasons);
}
