/**
 * The one polite announcement per committed change (plan §4.6), the bottom overlay queue and the WhyPanel's
 * open state. UI-only state: it never feeds back into the engine.
 */
import { NAV_REGISTRY } from "../config/navigation";
import { SECTION_META } from "../config/sections";
import type { NavItemId, SectionId, UIState } from "../types";
import { createBus, type Bus } from "./bus";

export type NoticeKind = "change" | "undo" | "reset";

export interface EvolutionNoticeModel {
  /** The commit rev it announces (a newer notice replaces an older one). */
  id: number;
  kind: NoticeKind;
  message: string;
  /** Undo is offered only for a live change, never on an undo/reset announcement. */
  undoable: boolean;
  /** Sections the change moved up, in plan order (change notices; attached by noticeBus). */
  moved?: readonly SectionId[];
  /** Whether the top navigation changed (visible on every route). */
  navChanged?: boolean;
  /** When it was published, ms since the epoch (a stale notice is never shown late). */
  at?: number;
}

/** What the last describeChange() found. The coordinator calls it right before it publishes the notice. */
let lastChange: { moved: SectionId[]; navChanged: boolean } | null = null;

const baseNoticeBus = createBus<EvolutionNoticeModel | null>(null);

/** A change notice is stamped with what moved, so the toast knows where it is relevant and what "Show me" shows. */
function stampNotice(v: EvolutionNoticeModel | null): EvolutionNoticeModel | null {
  if (!v || v.kind !== "change" || v.moved !== undefined) return v;
  const info = lastChange;
  lastChange = null;
  return {
    ...v,
    ...(info ? { moved: info.moved, navChanged: info.navChanged } : {}),
    at: v.at ?? Date.now(),
  };
}

export const noticeBus: Bus<EvolutionNoticeModel | null> = {
  get: baseNoticeBus.get,
  subscribe: baseNoticeBus.subscribe,
  set(next) {
    baseNoticeBus.set((prev) => stampNotice(typeof next === "function" ? next(prev) : next));
  },
};

/** How long a change announcement stays (EvolutionNotice). */
export const NOTICE_MS = 8000;

const names = (ids: readonly string[]): string => {
  const [a, b] = ids;
  return b ? `${a} and ${b}` : (a ?? "");
};

/** "Swayam moved Jobs and Applications up." Built from the compiled plans, never from AI text. */
export function describeChange(prev: UIState, next: UIState): string {
  const moved: SectionId[] = next.movedUp.filter((id) => !prev.movedUp.includes(id));
  const navChanged = prev.navigation.top.join() !== next.navigation.top.join();
  lastChange = { moved, navChanged };
  if (next.state === "UNIVERSAL" && next.tier === 0)
    return "Swayam went back to the standard layout.";
  const titles = moved.slice(0, 2).map((id) => SECTION_META[id].title);
  if (titles.length > 0) return `Swayam moved ${names(titles)} up.`;
  if (navChanged) return "Swayam updated your navigation.";
  return "Swayam rearranged things for you.";
}

/** Nav items and sections that differ from the standard layout (the WhyPanel's "What moved"). */
export function whatMoved(ui: UIState, universal: UIState): { sections: string[]; nav: string[] } {
  const sections = ui.movedUp.map((id) => SECTION_META[id].title);
  const base = new Set<NavItemId>(universal.navigation.top);
  const nav = ui.navigation.top.filter((id) => !base.has(id)).map((id) => NAV_REGISTRY[id].label);
  return { sections, nav };
}

// ─── Where a change announcement is worth showing ──────────────────────────────────────────────────────

/** A change notice for something nobody can see on this page is noise ("moved Jobs up" while on /cv). */
export const NOTICE_STALE_MS = 45_000;

/**
 * Whether the announcement belongs on this route. Undo and reset answers always show. A change shows
 * where it is visible: a navigation change on every route (the nav is everywhere), a Home section move
 * on Home only. A notice without move info (older callers) is shown as before.
 */
export function noticeVisibleOn(n: EvolutionNoticeModel, pathname: string, now?: number): boolean {
  if (n.kind !== "change") return true;
  if (now !== undefined && n.at !== undefined && now - n.at > NOTICE_STALE_MS) return false;
  if (n.moved === undefined) return true;
  if (n.navChanged) return true;
  return pathname === "/";
}

/** The first moved section, the anchor for "Show me"; null when the change was navigation only. */
export function showMeTarget(n: EvolutionNoticeModel): SectionId | null {
  return n.kind === "change" && n.moved && n.moved.length > 0 ? n.moved[0]! : null;
}

// ─── The bottom overlay queue ──────────────────────────────────────────────────────────────────────────

/**
 * One bottom overlay at a time. The adaptation notice is the answer to something the person just did, so
 * it goes first; the privacy bar waits behind it and takes the slot when it clears.
 */
export type OverlayKind = "adaptation" | "privacy";
export const OVERLAY_ORDER: readonly OverlayKind[] = ["adaptation", "privacy"];

/** The overlay that owns the bottom of the screen, given everything that is asking for it. */
export function pickOverlay(wants: readonly OverlayKind[]): OverlayKind | null {
  for (const k of OVERLAY_ORDER) if (wants.includes(k)) return k;
  return null;
}

const wanted = new Map<OverlayKind, number>();
export const overlayBus = createBus<readonly OverlayKind[]>([]);

const publishWants = (): void => {
  const next = OVERLAY_ORDER.filter((k) => (wanted.get(k) ?? 0) > 0);
  const cur = overlayBus.get();
  if (next.length !== cur.length || next.some((k, i) => k !== cur[i])) overlayBus.set(next);
};

/** Ask for the slot. Returns the release; asking twice for the same kind is counted, not duplicated. */
export function requestOverlay(kind: OverlayKind): () => void {
  wanted.set(kind, (wanted.get(kind) ?? 0) + 1);
  publishWants();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const n = (wanted.get(kind) ?? 1) - 1;
    if (n <= 0) wanted.delete(kind);
    else wanted.set(kind, n);
    publishWants();
  };
}

export const activeOverlay = (): OverlayKind | null => pickOverlay(overlayBus.get());

/** Test hook: forget every request. */
export function resetOverlays(): void {
  wanted.clear();
  overlayBus.set([]);
}

// ─── The privacy bar's rules ───────────────────────────────────────────────────────────────────────────

/** The evolved Home reveals itself in the first moments after load; nothing may sit on top of that. */
export const REVEAL_MS = 2400;
/** Least time the bar stays up before a first interaction may collapse it, and the most. */
export const PRIVACY_MIN_MS = 2500;
export const PRIVACY_MAX_MS = 8000;

export function isReveal(o: { pathname: string; state: string; sinceMountMs: number }): boolean {
  return o.pathname === "/" && o.state !== "UNIVERSAL" && o.sinceMountMs < REVEAL_MS;
}

/** Never on the Lab and its compare frames, never on the page that says it all, never over the evolved-Home reveal. */
export function privacyBarAllowed(o: { pathname: string; reveal: boolean }): boolean {
  if (o.pathname === "/lab" || o.pathname.startsWith("/lab/")) return false;
  if (o.pathname === "/privacy") return false;
  return !o.reveal;
}

/**
 * Milliseconds until the bar collapses itself, given how long it has been visible and when (if ever) the
 * first interaction came. An interaction collapses it, but never before PRIVACY_MIN_MS.
 */
export function privacyCollapseIn(visibleMs: number, firstInteractionAt: number | null): number {
  const byTime = PRIVACY_MAX_MS - visibleMs;
  if (firstInteractionAt === null) return Math.max(0, byTime);
  const byTouch = Math.max(PRIVACY_MIN_MS, firstInteractionAt) - visibleMs;
  return Math.max(0, Math.min(byTime, byTouch));
}

/**
 * Keeps the Sarthi button clear of whichever overlay is up: publishes its height as `--overlay-h` and the
 * kind as `html[data-overlay]`. Returns the cleanup.
 */
export function mountOverlayBox(kind: OverlayKind, el: HTMLElement): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const apply = (): void => {
    try {
      root.style.setProperty("--overlay-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
      root.setAttribute("data-overlay", kind);
    } catch {
      /* a hint, never a dependency */
    }
  };
  apply();
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(apply);
    ro.observe(el);
  }
  return () => {
    ro?.disconnect();
    try {
      root.style.removeProperty("--overlay-h");
      root.removeAttribute("data-overlay");
    } catch {
      /* ignore */
    }
  };
}

// ─── WhyPanel open state ───────────────────────────────────────────────────────────────────────────────

export interface WhyPanelState {
  open: boolean;
  /** The trigger's bounding box, for the ≥ 1024px popover. */
  anchor: { top: number; left: number; right: number; bottom: number } | null;
  /** Focus returns here on close. */
  returnTo: HTMLElement | null;
}

export const whyBus = createBus<WhyPanelState>({ open: false, anchor: null, returnTo: null });

export function openWhy(trigger?: HTMLElement | null): void {
  const el =
    trigger ??
    (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null));
  let anchor: WhyPanelState["anchor"] = null;
  try {
    const r = el?.getBoundingClientRect();
    if (r) anchor = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  } catch {
    /* no anchor: the panel centres */
  }
  whyBus.set({ open: true, anchor, returnTo: el && el !== document.body ? el : null });
}

export function closeWhy(): void {
  whyBus.set((s) => (s.open ? { ...s, open: false } : s));
}
