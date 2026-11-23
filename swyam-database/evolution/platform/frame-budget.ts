/**
 * Frame-Budget Mode: the interface adapts to the device it is running on.
 *
 * Swayam already restructures itself around what a person does. This does the same
 * on a non-sensitive axis, what the *device* can afford. It reads only machine facts
 * (deviceMemory, hardwareConcurrency, saveData, effectiveType) and how many frames
 * the page itself dropped, never anything about the person, and sheds cost in tiers:
 *
 *   full    everything on.
 *   lite    no grain, no backdrop blur, no count-ups.
 *   static  lite, plus static hero art and short FLIP durations.
 *
 * It stamps `html[data-fx]` before first paint (FX_BOOTSTRAP_SCRIPT, inline in <head>),
 * keeps the measured tier in `swayam.fx.tier`, and tells everyone through `swayam:fx`.
 * The member's own override lives in `swayam.fx` (`auto` | `full`), written by the
 * Settings "Full effects" switch; `full` wins over every signal. Measurement only ever
 * sheds cost within a session: a slow device is not promoted back by one lucky window.
 *
 * Contracts (docs/evolution/council-decisions.md, section 5):
 *   html[data-fx="full|lite|static"], localStorage `swayam.fx`, event `swayam:fx`.
 *   After writing `swayam.fx` the Settings switch may dispatch `swayam:fx-pref`; this
 *   also re-reads on `storage`, click and change, so a missed dispatch costs nothing.
 */

export type FxTier = "full" | "lite" | "static";
export type FxPref = "auto" | "full";
export type FxReason = "default" | "pref" | "signals" | "saved" | "measured";

export interface FxSignals {
  /** GiB, rounded by the browser (0.25 .. 8). */
  deviceMemory?: number | undefined;
  hardwareConcurrency?: number | undefined;
  saveData?: boolean | undefined;
  /** "slow-2g" | "2g" | "3g" | "4g". */
  effectiveType?: string | undefined;
}

export interface FxDetail {
  tier: FxTier;
  pref: FxPref;
  reason: FxReason;
  /** The share of expected frames the page dropped in the last measured window. */
  dropRatio?: number;
}

export const FX_PREF_KEY = "swayam.fx";
export const FX_TIER_KEY = "swayam.fx.tier";
export const FX_EVENT = "swayam:fx";
export const FX_PREF_EVENT = "swayam:fx-pref";

const RANK: Record<FxTier, number> = { full: 0, lite: 1, static: 2 };
export const maxTier = (a: FxTier, b: FxTier): FxTier => (RANK[a] >= RANK[b] ? a : b);
const isTier = (v: unknown): v is FxTier => v === "full" || v === "lite" || v === "static";

// ─── Tiering (pure) ────────────────────────────────────────────────────────────────────────────────────

/**
 * The starting tier from what the device says about itself.
 * Mirrored by FX_BOOTSTRAP_SCRIPT (the test runs both over the same table).
 */
export function tierFromSignals(s: FxSignals): FxTier {
  const m = s.deviceMemory;
  const k = s.hardwareConcurrency;
  const e = s.effectiveType;
  const lowMem = m !== undefined && m <= 2;
  const lowCores = k !== undefined && k <= 2;
  if (e === "slow-2g" || e === "2g") return "static";
  if (m !== undefined && m <= 1) return "static";
  if (lowMem && lowCores) return "static";
  if (s.saveData === true || e === "3g" || lowMem || lowCores) return "lite";
  if (m !== undefined && m <= 4 && k !== undefined && k <= 4) return "lite";
  return "full";
}

/** A frame is "dropped" for every whole refresh interval a gap is longer than one. */
export const FRAME_MS = 1000 / 60;

/** Dropped frames over expected frames for a list of rAF timestamps. 0 when there is too little to judge. */
export function dropRatio(stamps: readonly number[], minFrames = 20): number {
  if (stamps.length < minFrames) return 0;
  let dropped = 0;
  for (let i = 1; i < stamps.length; i++) {
    const gap = stamps[i]! - stamps[i - 1]!;
    dropped += Math.max(0, Math.floor(gap / FRAME_MS + 0.25) - 1);
  }
  const span = stamps[stamps.length - 1]! - stamps[0]!;
  const expected = Math.max(1, span / FRAME_MS);
  return Math.min(1, dropped / expected);
}

/** One measured window can move the tier one rung, or two on heavy jank. It never moves it back. */
export const LITE_AT = 0.25;
export const STATIC_AT = 0.45;
export function tierFromFrames(ratio: number, current: FxTier): FxTier {
  if (ratio >= STATIC_AT) return "static";
  if (ratio >= LITE_AT) return maxTier(current, "lite");
  return current;
}

/** The one resolution order: the member's `full`, else the worst of signals and the saved measurement. */
export function resolveTier(input: { pref: FxPref; saved: FxTier | null; signals: FxSignals }): {
  tier: FxTier;
  reason: FxReason;
} {
  if (input.pref === "full") return { tier: "full", reason: "pref" };
  const fromSignals = tierFromSignals(input.signals);
  const saved = input.saved ?? "full";
  const tier = maxTier(fromSignals, saved);
  if (tier === "full") return { tier, reason: "default" };
  return { tier, reason: RANK[saved] >= RANK[fromSignals] ? "saved" : "signals" };
}

// ─── The pre-paint stamp ───────────────────────────────────────────────────────────────────────────────

/**
 * Runs inline in <head> before the stylesheet paints, so `html[data-fx]` is right on frame one.
 * Same rules as resolveTier(); written in ES5 because it is shipped as a string.
 */
export const FX_BOOTSTRAP_SCRIPT = `(function(){var d=document.documentElement;try{var n=navigator,c=n.connection||{},m=n.deviceMemory,k=n.hardwareConcurrency,e=c.effectiveType,p=null,t=null,r="full";try{p=localStorage.getItem("${FX_PREF_KEY}");t=localStorage.getItem("${FX_TIER_KEY}")}catch(x){}if(p!=="full"){var lm=m!==undefined&&m<=2,lc=k!==undefined&&k<=2;if(e==="slow-2g"||e==="2g"||(m!==undefined&&m<=1)||(lm&&lc))r="static";else if(c.saveData===true||e==="3g"||lm||lc||(m!==undefined&&m<=4&&k!==undefined&&k<=4))r="lite";if(t==="static"||(t==="lite"&&r==="full"))r=t}d.setAttribute("data-fx",r)}catch(x){d.setAttribute("data-fx","full")}})();`;

// ─── Browser side ──────────────────────────────────────────────────────────────────────────────────────

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

export function readSignals(): FxSignals {
  try {
    const n = navigator as unknown as NavigatorHints;
    return {
      deviceMemory: n.deviceMemory,
      hardwareConcurrency: n.hardwareConcurrency,
      saveData: n.connection?.saveData,
      effectiveType: n.connection?.effectiveType,
    };
  } catch {
    return {};
  }
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readPref(): FxPref {
  return readStore(FX_PREF_KEY) === "full" ? "full" : "auto";
}

/** The tier currently stamped on <html> ("full" on the server and when nothing is stamped). */
export function currentFx(): FxTier {
  try {
    const v = document.documentElement.getAttribute("data-fx");
    return isTier(v) ? v : "full";
  } catch {
    return "full";
  }
}

export function setFxPref(pref: FxPref): void {
  try {
    localStorage.setItem(FX_PREF_KEY, pref);
  } catch {
    /* the stamp still changes for this visit */
  }
  try {
    window.dispatchEvent(new Event(FX_PREF_EVENT));
  } catch {
    /* no window */
  }
}

/** Shorter transitions under `static` (FLIP, reveals). Safe on the server: returns the base value. */
export function fxDuration(base: number): number {
  return currentFx() === "static" ? Math.min(base, 0.18) : base;
}

const SAMPLE_DELAY_MS = 1200;
const WINDOW_MS = 3000;
const MIN_FRAMES = 20;
const MAX_WINDOWS = 2;

let started = false;

/**
 * Starts the watcher: applies the saved/pref tier, listens for pref changes, and measures dropped
 * frames in the seconds after load. Idempotent. Returns a stop function.
 */
export function startFrameBudget(): () => void {
  if (started || typeof window === "undefined" || typeof document === "undefined") return () => {};
  started = true;

  let last: FxDetail | null = null;
  let measured: FxTier = (() => {
    const s = readStore(FX_TIER_KEY);
    return isTier(s) ? s : "full";
  })();
  let lastRatio: number | undefined;

  const apply = (why?: FxReason): void => {
    const pref = readPref();
    const r = resolveTier({
      pref,
      saved: measured === "full" ? null : measured,
      signals: readSignals(),
    });
    const tier = r.tier;
    const detail: FxDetail = { tier, pref, reason: why && tier !== "full" ? why : r.reason };
    if (lastRatio !== undefined) detail.dropRatio = lastRatio;
    const prev = currentFx();
    if (prev !== tier) document.documentElement.setAttribute("data-fx", tier);
    if (!last || last.tier !== tier || last.pref !== pref || last.reason !== detail.reason) {
      last = detail;
      try {
        window.dispatchEvent(new CustomEvent<FxDetail>(FX_EVENT, { detail }));
      } catch {
        /* a hint, never a dependency */
      }
    }
  };
  apply();

  // The member's switch: storage (other tabs), our own event, and a cheap re-read after any click or change.
  const recheck = (): void => {
    if (readPref() !== (last?.pref ?? "auto")) apply();
  };
  const onPref = (): void => apply();
  const onStorage = (e: StorageEvent): void => {
    if (e.key === null || e.key === FX_PREF_KEY || e.key === FX_TIER_KEY) apply();
  };
  window.addEventListener(FX_PREF_EVENT, onPref);
  window.addEventListener("storage", onStorage);
  document.addEventListener("click", recheck, true);
  document.addEventListener("change", recheck, true);

  // The measurement: rAF gaps, ignored while hidden, never after the member chose `full`.
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const sample = (windowNo: number): void => {
    if (stopped) return;
    if (readPref() === "full") return;
    const stamps: number[] = [];
    let hidden = false;
    const onVis = (): void => {
      if (document.visibilityState !== "visible") hidden = true;
    };
    document.addEventListener("visibilitychange", onVis);
    const startedAt = performance.now();
    const tick = (t: number): void => {
      stamps.push(t);
      if (t - startedAt < WINDOW_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      document.removeEventListener("visibilitychange", onVis);
      if (stopped) return;
      if (hidden || stamps.length < MIN_FRAMES) {
        // A hidden tab proves nothing: try again later instead of judging it.
        if (windowNo < MAX_WINDOWS) timer = setTimeout(() => sample(windowNo + 1), 4000);
        return;
      }
      const ratio = dropRatio(stamps, MIN_FRAMES);
      lastRatio = ratio;
      const next = tierFromFrames(ratio, measured);
      if (next !== measured) {
        measured = next;
        try {
          localStorage.setItem(FX_TIER_KEY, next);
        } catch {
          /* kept for this visit only */
        }
        apply("measured");
        // Still janky after shedding the first rung: look once more before going static.
        if (next === "lite" && windowNo < MAX_WINDOWS)
          timer = setTimeout(() => sample(windowNo + 1), 2500);
      }
    };
    raf = requestAnimationFrame(tick);
  };

  const begin = (): void => {
    timer = setTimeout(() => sample(1), SAMPLE_DELAY_MS);
  };
  if (document.readyState === "complete") begin();
  else window.addEventListener("load", begin, { once: true });

  return () => {
    stopped = true;
    started = false;
    cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    window.removeEventListener("load", begin);
    window.removeEventListener(FX_PREF_EVENT, onPref);
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("click", recheck, true);
    document.removeEventListener("change", recheck, true);
  };
}
