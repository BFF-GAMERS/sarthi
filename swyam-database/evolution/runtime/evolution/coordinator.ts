/**
 * The coordinator: decides WHEN a committed change becomes the presented one (plan §4.1, §4.9).
 *
 * A structural change is released only at a safe point:
 *   - at least COOLDOWN_MS (20 s) since the last structural release, UNLESS the pending change stays in the
 *     domain the user was already shown (CAREER tier 1 -> CAREER tier 2 is a deepening, not a flip),
 *   - the tab is visible, no dialog/popover is open,
 *   - not while the user is typing, not while KEYBOARD focus is inside a moving region ([data-evo-region]),
 *     not mid-scroll,
 *   - on a fresh route arrival (any page: a held tier lands with the next route change or Home visit), or when
 *     the user has been idle.
 * "Keep my current layout", pause and Off hold structural changes (learning goes on).
 * Silent commits (reason / confidence only) and commands from elsewhere (reset, undo, persona) release at once.
 * Non-React; DOM state comes through the InteractionGuard port so tests run on fake timers and fake guards.
 */
import { INSTANT_SOURCES, structureKey, type Committed } from "../../state/committed";
import type { InteractionGuard } from "../../platform/quiet";
import type { Presenter } from "./presenter";

export const COOLDOWN_MS = 20_000;

export const RELEASE = Object.freeze({
  COOLDOWN_MS,
  /** No pointer movement, key, wheel or input for this long counts as idle. */
  QUIET_MS: 1500,
  /** On Home, an idle release also needs the page near the top. */
  SCROLL_Y_MAX: 240,
  /** Never within this long of the last scroll. */
  SCROLL_SETTLE_MS: 600,
  /** Route arrival: release this long after the page paints... */
  ARRIVAL_DELAY_MS: 300,
  /** ...while the arrival is still fresh. */
  ARRIVAL_WINDOW_MS: 2000,
  /** Poll cadence while something is pending. */
  TICK_MS: 250,
  /** Focus guard: re-check after the DOM update and after the reorder settles. */
  FOCUS_CHECKS_MS: [50, 700] as readonly number[],
});

const REGION_SELECTOR = "[data-evo-region]";
const HOME = "/";

export type BlockReason = "hidden" | "overlay" | "typing" | "keyboard-focus" | "scrolling";

export interface CoordinatorPorts {
  now(): number;
  every(ms: number, fn: () => void): () => void;
  later(ms: number, fn: () => void): () => void;
  startGuard(): InteractionGuard;
  isVisible(): boolean;
  onVisibilityChange(cb: () => void): () => void;
  /** The newest engine commit that is not yet presented (and not trivially the same), or null. */
  pending(): Committed | null;
  /** Locked, paused or off: the structure must not move. */
  frozen(): boolean;
  presenter: Pick<Presenter, "peek" | "release">;
  /** After an ANIMATED structural release: the runtime announces it (notice + aria-live). */
  onReleased(next: Committed, prev: Committed): void;
  focus: { capture(): string | null; restore(id: string): void };
}

export interface Coordinator {
  start(): () => void;
  /** The runtime reports every resolved route (a fresh arrival is a safe point). */
  setRoute(pathname: string): void;
  /** Something may be pending: start ticking. */
  poke(): void;
  /** One evaluation pass now (tests, and a final pass before pagehide). */
  tick(): void;
  /** Why the pending change is held right now (null = free to release at a safe point). */
  blockedBy(): BlockReason | null;
}

export function createCoordinator(ports: CoordinatorPorts): Coordinator {
  let started = 0;
  let guard: InteractionGuard | null = null;
  let stopTick: (() => void) | null = null;
  let offVisibility: (() => void) | null = null;
  let path: string | null = null;
  let arrivalAt: number | null = null;
  let lastReleaseAt: number | null = null;

  const hasWork = (): boolean => ports.pending() !== null;
  const ensureTicking = (): void => {
    if (started === 0 || stopTick || !hasWork()) return;
    stopTick = ports.every(RELEASE.TICK_MS, tick);
  };
  const stopTicking = (): void => {
    stopTick?.();
    stopTick = null;
  };

  function blockedBy(): BlockReason | null {
    if (!ports.isVisible()) return "hidden";
    if (!guard) return null;
    if (guard.overlayOpen()) return "overlay";
    if (guard.editableFocused()) return "typing";
    if (guard.keyboardFocusWithin(REGION_SELECTOR)) return "keyboard-focus";
    if (guard.msSinceScroll() < RELEASE.SCROLL_SETTLE_MS) return "scrolling";
    return null;
  }

  const cooledDown = (now: number): boolean =>
    lastReleaseAt === null || now - lastReleaseAt >= COOLDOWN_MS;
  /** A deepening within the shown domain (same primary state) does not wait out the cooldown. */
  const sameDomain = (c: Committed): boolean =>
    c.decision.primaryState === ports.presenter.peek().decision.primaryState;
  const arrivedFresh = (now: number): boolean =>
    arrivalAt !== null &&
    now - arrivalAt >= RELEASE.ARRIVAL_DELAY_MS &&
    now - arrivalAt <= RELEASE.ARRIVAL_WINDOW_MS;
  const idleNow = (): boolean =>
    guard !== null &&
    guard.msSinceInput() >= RELEASE.QUIET_MS &&
    (path !== HOME || guard.scrollY() < RELEASE.SCROLL_Y_MAX);

  function releaseStructural(c: Committed, now: number): void {
    const prev = ports.presenter.peek();
    const focusId = ports.focus.capture();
    ports.presenter.release(c, "animate");
    lastReleaseAt = now;
    arrivalAt = null;
    ports.onReleased(c, prev);
    if (focusId)
      for (const ms of RELEASE.FOCUS_CHECKS_MS) ports.later(ms, () => ports.focus.restore(focusId));
  }

  function tick(): void {
    const now = ports.now();
    if (arrivalAt !== null && now - arrivalAt > RELEASE.ARRIVAL_WINDOW_MS) arrivalAt = null;
    const c = ports.pending();
    if (c) {
      const shown = ports.presenter.peek();
      if (c.rev < shown.rev) {
        // Another tab reset the store below our rev: adopt it instantly.
        ports.presenter.release(c, "instant", { force: true });
      } else if (structureKey(c) === structureKey(shown)) {
        // Silent commit (reason or confidence only): presented instantly, no announcement.
        ports.presenter.release(c, "instant");
      } else if (INSTANT_SOURCES.has(c.source)) {
        // A user command issued elsewhere (another tab) or a Lab persona: instant, no notice here.
        ports.presenter.release(c, "instant");
      } else if (!ports.frozen() && (cooledDown(now) || sameDomain(c)) && blockedBy() === null) {
        if (arrivedFresh(now) || idleNow()) releaseStructural(c, now);
      }
    }
    if (!hasWork()) stopTicking();
  }

  return {
    start() {
      started++;
      if (started === 1) {
        guard = ports.startGuard();
        offVisibility = ports.onVisibilityChange(ensureTicking);
        ensureTicking();
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        started--;
        if (started > 0) return;
        stopTicking();
        offVisibility?.();
        guard?.stop();
        offVisibility = guard = null;
      };
    },
    setRoute(pathname) {
      const next = pathname.split(/[?#]/)[0] || HOME;
      if (next === path) return;
      path = next;
      arrivalAt = ports.now();
      if (started > 0) {
        ports.later(RELEASE.ARRIVAL_DELAY_MS, tick);
        ensureTicking();
      }
    },
    poke: ensureTicking,
    tick,
    blockedBy,
  };
}
