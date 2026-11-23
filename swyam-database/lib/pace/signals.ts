/**
 * Behaviour-only signals: how fast, how steadily and how precisely someone uses the page.
 *
 * What is recorded: timestamps, pixel distances, and whether a tap landed on something interactive. What is never
 * read: text, values, element labels, or anything about the person such as an age or any other trait. Targets are
 * compared by identity for one comparison and then dropped. Nothing leaves the device and nothing here is
 * persisted: only the derived profile and coarse counts are (see store.ts).
 *
 * `SignalCollector` is pure (times and numbers in, numbers out) so it is unit-testable in node. `attachSignals`
 * is the thin DOM layer that feeds it.
 */

export const WINDOW = 60;
/** A tap this close to an interactive element, but not on it, is a near miss. */
export const NEAR_MISS_PX = 24;
/** A second tap this close to a first one that hit nothing means the first missed. */
export const RETAP_NEAR_PX = 48;
export const RETAP_MS = 1200;
/** Two taps on one target closer than this are a rapid repeat. */
export const REPEAT_MS = 400;
/** Leaving a page sooner than this after arriving is a quick back-out... */
export const BACKOUT_MS = 3000;
/** ...unless it was faster than a person could read it (a redirect). */
export const MIN_HUMAN_MS = 300;
/** A gap longer than this is the person looking away, not a pace. */
export const AWAY_MS = 20000;
/** Scroll bursts are separated by at least this much stillness. */
const BURST_GAP_MS = 300;
const MAX_VELOCITY = 15000;

export interface PaceSignals {
  /** Taps plus route changes plus scroll bursts seen in the window. */
  samples: number;
  taps: number;
  navs: number;
  nearMisses: number;
  repeatTaps: number;
  backOuts: number;
  /** Median ms between actions, or null with fewer than 3 gaps. */
  medianGapMs: number | null;
  /** Median px/s of scrolling, or null with fewer than 5 readings. */
  scrollVelocity: number | null;
  nearMissRate: number;
  repeatTapRate: number;
  backOutRate: number;
}

export interface TapInput {
  t: number;
  x: number;
  y: number;
  /** Opaque identity of what was tapped. Compared with `===` only. */
  target: unknown;
  onInteractive: boolean;
  nearInteractive: boolean;
}

/** Cumulative counts since the collector was created, for the store. */
export interface Totals {
  taps: number;
  scrolls: number;
  navs: number;
  nearMisses: number;
  repeatTaps: number;
  backOuts: number;
}

interface TapRec {
  t: number;
  x: number;
  y: number;
  onInteractive: boolean;
  near: boolean;
  repeat: boolean;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function push<T>(arr: T[], v: T): void {
  arr.push(v);
  if (arr.length > WINDOW) arr.shift();
}

const ZERO: Totals = { taps: 0, scrolls: 0, navs: 0, nearMisses: 0, repeatTaps: 0, backOuts: 0 };

export class SignalCollector {
  private taps: TapRec[] = [];
  private gaps: number[] = [];
  private vels: number[] = [];
  private navs: boolean[] = [];
  private bursts = 0;
  private lastTapTarget: unknown = null;
  private lastAction: number | null = null;
  private lastScroll: { t: number; y: number } | null = null;
  private muteScrollUntil = 0;
  private route: { path: string; t: number } | null = null;
  private total: Totals = { ...ZERO };
  /** Bumped on every recorded sample, so a poller can tell whether anything changed. */
  version = 0;

  private action(t: number): void {
    if (this.lastAction !== null) {
      const gap = t - this.lastAction;
      if (gap >= 30 && gap <= AWAY_MS) push(this.gaps, gap);
    }
    this.lastAction = t;
  }

  tap(e: TapInput): void {
    const prev = this.taps[this.taps.length - 1];
    const repeat = Boolean(prev && e.target === this.lastTapTarget && e.t - prev.t < REPEAT_MS);
    const near = !e.onInteractive && e.nearInteractive;
    if (
      prev &&
      !repeat &&
      !prev.onInteractive &&
      e.t - prev.t <= RETAP_MS &&
      Math.hypot(e.x - prev.x, e.y - prev.y) <= RETAP_NEAR_PX
    ) {
      // The previous tap hit nothing and the person tried again right next to it: it was a miss.
      if (!prev.near) this.total.nearMisses++;
      prev.near = true;
    }
    if (near) this.total.nearMisses++;
    if (repeat) this.total.repeatTaps++;
    if (this.taps.length >= WINDOW) this.taps.shift();
    this.taps.push({ t: e.t, x: e.x, y: e.y, onInteractive: e.onInteractive, near, repeat });
    this.lastTapTarget = e.target;
    this.total.taps++;
    this.action(e.t);
    this.version++;
  }

  scroll(t: number, y: number): void {
    if (t < this.muteScrollUntil) {
      this.lastScroll = null;
      return;
    }
    const last = this.lastScroll;
    this.lastScroll = { t, y };
    if (!last) {
      this.startBurst();
      return;
    }
    const dt = t - last.t;
    if (dt <= 0) return;
    if (dt >= BURST_GAP_MS) {
      this.startBurst();
      return;
    }
    const v = (Math.abs(y - last.y) / dt) * 1000;
    if (v > 0 && v <= MAX_VELOCITY) {
      push(this.vels, v);
      this.version++;
    }
  }

  private startBurst(): void {
    this.bursts = Math.min(this.bursts + 1, WINDOW);
    this.total.scrolls++;
    this.version++;
  }

  /** A route change. Called with the pathname only, never page content. */
  routeChange(path: string, t: number): void {
    const cur = this.route;
    if (!cur) {
      this.route = { path, t };
      return;
    }
    if (cur.path === path) return;
    const dwell = t - cur.t;
    this.route = { path, t };
    // Arriving on a page scrolls it to the top; that is not the person scrolling.
    this.muteScrollUntil = t + 500;
    this.lastScroll = null;
    if (dwell < MIN_HUMAN_MS) return;
    const quick = dwell < BACKOUT_MS;
    if (this.navs.length >= 20) this.navs.shift();
    this.navs.push(quick);
    this.total.navs++;
    if (quick) this.total.backOuts++;
    this.action(t);
    this.version++;
  }

  snapshot(): PaceSignals {
    const taps = this.taps.length;
    const nearMisses = this.taps.filter((x) => x.near).length;
    const repeatTaps = this.taps.filter((x) => x.repeat).length;
    const navs = this.navs.length;
    const backOuts = this.navs.filter(Boolean).length;
    return {
      samples: taps + navs + this.bursts,
      taps,
      navs,
      nearMisses,
      repeatTaps,
      backOuts,
      medianGapMs: this.gaps.length >= 3 ? median(this.gaps) : null,
      scrollVelocity: this.vels.length >= 5 ? median(this.vels) : null,
      nearMissRate: taps ? nearMisses / taps : 0,
      repeatTapRate: taps ? repeatTaps / taps : 0,
      backOutRate: navs ? backOuts / navs : 0,
    };
  }

  totals(): Totals {
    return { ...this.total };
  }

  reset(): void {
    this.taps = [];
    this.gaps = [];
    this.vels = [];
    this.navs = [];
    this.bursts = 0;
    this.lastTapTarget = null;
    this.lastAction = null;
    this.lastScroll = null;
    this.total = { ...ZERO };
    this.version++;
  }
}

// ── DOM layer ────────────────────────────────────────────────────────────────────────────────────────

export const INTERACTIVE_SELECTOR =
  'a[href],button,input,select,textarea,summary,label,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="switch"],[role="checkbox"],[role="radio"],[tabindex]:not([tabindex="-1"])';

const RING: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0.7, 0.7],
  [0, 1],
  [-0.7, 0.7],
  [-1, 0],
  [-0.7, -0.7],
  [0, -1],
  [0.7, -0.7],
];

function nearInteractive(x: number, y: number): boolean {
  for (const radius of [NEAR_MISS_PX / 2, NEAR_MISS_PX]) {
    for (const [dx, dy] of RING) {
      const el = document.elementFromPoint(x + dx * radius, y + dy * radius);
      if (el?.closest(INTERACTIVE_SELECTOR)) return true;
    }
  }
  return false;
}

/** Start listening. Returns a function that stops. Listeners are passive and in the capture phase. */
export function attachSignals(collector: SignalCollector): () => void {
  if (typeof window === "undefined") return () => {};
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  let lastScrollT = 0;

  const onPointer = (e: PointerEvent) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;
    const hit = el.closest(INTERACTIVE_SELECTOR);
    collector.tap({
      t: performance.now(),
      x: e.clientX,
      y: e.clientY,
      target: hit ?? el,
      onInteractive: Boolean(hit),
      nearInteractive: hit ? false : nearInteractive(e.clientX, e.clientY),
    });
  };
  const onScroll = (e: Event) => {
    if (e.target !== document) return;
    const t = performance.now();
    if (t - lastScrollT < 50) return;
    lastScrollT = t;
    collector.scroll(t, window.scrollY);
  };
  const onPop = () => collector.routeChange(window.location.pathname, performance.now());

  window.addEventListener("pointerdown", onPointer, opts);
  window.addEventListener("scroll", onScroll, opts);
  window.addEventListener("popstate", onPop, opts);
  return () => {
    window.removeEventListener("pointerdown", onPointer, opts);
    window.removeEventListener("scroll", onScroll, opts);
    window.removeEventListener("popstate", onPop, opts);
  };
}
