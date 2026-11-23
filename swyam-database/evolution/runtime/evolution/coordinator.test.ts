// The coordinator on a fake clock and a fake interaction guard: safe points, the 20 s cooldown, instant bypasses.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNIVERSAL_DECISION, actionsFor } from "../../core/evolution/compose";
import type { InteractionGuard } from "../../platform/quiet";
import type { Committed } from "../../state/committed";
import type { DecisionSource, EvolutionDecision, Tier } from "../../types";
import { COOLDOWN_MS, RELEASE, createCoordinator, type CoordinatorPorts } from "./coordinator";
import { createPresenter, type Presenter } from "./presenter";

const career = (tier: Tier = 3): EvolutionDecision => ({
  primaryState: "CAREER_FIRST",
  behaviourMode: "CAREER_FOCUSED",
  navigationMode: "CAREER_PRIORITY",
  homepageLayout: "CAREER_DISCOVERY",
  priorityActions: actionsFor("CAREER_FIRST", tier),
  reason: "x",
  confidence: 0.8,
});
const learning = (): EvolutionDecision => ({
  ...career(),
  primaryState: "LEARNING_FIRST",
  behaviourMode: "LEARNING_FOCUSED",
  navigationMode: "LEARNING_PRIORITY",
  homepageLayout: "LEARNING_HUB",
  priorityActions: actionsFor("LEARNING_FIRST", 3),
});

const commit = (
  rev: number,
  decision: EvolutionDecision,
  tier: Tier,
  source: DecisionSource = "deterministic",
): Committed => ({
  rev,
  decision,
  tier,
  reasonCode: { key: "DOMAIN_CONFIRMED" },
  source,
  at: rev,
});
const UNIVERSAL = (rev = 0): Committed => commit(rev, UNIVERSAL_DECISION, 0);

class FakeGuard implements InteractionGuard {
  sinceInput = Number.POSITIVE_INFINITY;
  sinceScroll = Number.POSITIVE_INFINITY;
  y = 0;
  editable = false;
  focusInRegion = false;
  overlay = false;
  msSinceInput = () => this.sinceInput;
  msSinceScroll = () => this.sinceScroll;
  scrollY = () => this.y;
  editableFocused = () => this.editable;
  keyboardFocusWithin = (sel: string) => this.focusInRegion && sel === "[data-evo-region]";
  overlayOpen = () => this.overlay;
  stop = vi.fn();
}

interface Rig {
  c: ReturnType<typeof createCoordinator>;
  presenter: Presenter;
  guard: FakeGuard;
  state: { now: number; pending: Committed | null; frozen: boolean; visible: boolean };
  released: Array<[Committed, Committed]>;
}

function rig(): Rig {
  const state = { now: 100_000, pending: null as Committed | null, frozen: false, visible: true };
  const guard = new FakeGuard();
  const presenter = createPresenter(UNIVERSAL(), { prefersInstant: () => false });
  const released: Rig["released"] = [];
  const ports: CoordinatorPorts = {
    now: () => state.now,
    every: (ms, fn) => {
      const t = setInterval(() => {
        state.now += ms;
        fn();
      }, ms);
      return () => clearInterval(t);
    },
    later: (ms, fn) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    startGuard: () => guard,
    isVisible: () => state.visible,
    onVisibilityChange: () => () => {},
    pending: () =>
      state.pending && state.pending.rev !== presenter.peek().rev ? state.pending : null,
    frozen: () => state.frozen,
    presenter,
    onReleased: (next, prev) => released.push([next, prev]),
    focus: { capture: () => null, restore: () => {} },
  };
  return { c: createCoordinator(ports), presenter, guard, state, released };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("safe points", () => {
  it("releases on arrival at Home, after the arrival delay, and announces it", () => {
    const r = rig();
    r.c.start();
    r.guard.sinceInput = 0; // the user is active: only arrival can release
    r.state.pending = commit(1, career(), 3);
    r.c.setRoute("/");
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(0); // too soon: the page has not painted
    r.state.now += RELEASE.ARRIVAL_DELAY_MS;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
    expect(r.released).toHaveLength(1);
  });

  it("an arrival on any other page is a safe point too: a held change lands with the next route change", () => {
    const r = rig();
    r.c.start();
    r.guard.sinceInput = 0; // the user is active: only an arrival can release
    r.state.pending = commit(1, career(), 3);
    r.c.setRoute("/jobs");
    r.state.now += RELEASE.ARRIVAL_DELAY_MS;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
  });

  it("an arrival that has gone stale is not a safe point", () => {
    const r = rig();
    r.c.start();
    r.guard.sinceInput = 0;
    r.c.setRoute("/jobs");
    r.state.now += RELEASE.ARRIVAL_WINDOW_MS + 1;
    r.state.pending = commit(1, career(), 3);
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(0);
  });

  it("releases when idle, but not while the user is active", () => {
    const r = rig();
    r.c.start();
    r.state.pending = commit(1, career(), 3);
    r.guard.sinceInput = RELEASE.QUIET_MS - 1;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(0);
    r.guard.sinceInput = RELEASE.QUIET_MS;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
  });

  it("on Home, an idle release also needs the page near the top", () => {
    const r = rig();
    r.c.start();
    r.c.setRoute("/");
    r.state.now += RELEASE.ARRIVAL_WINDOW_MS + 1000; // the arrival is no longer fresh
    r.state.pending = commit(1, career(), 3);
    r.guard.y = RELEASE.SCROLL_Y_MAX + 1;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(0);
    r.guard.y = 0;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
  });

  it.each([
    ["typing", (g: FakeGuard): void => void (g.editable = true)],
    ["keyboard-focus", (g: FakeGuard): void => void (g.focusInRegion = true)],
    ["scrolling", (g: FakeGuard): void => void (g.sinceScroll = RELEASE.SCROLL_SETTLE_MS - 1)],
    ["overlay", (g: FakeGuard): void => void (g.overlay = true)],
  ] as const)("is held while the user is %s, and released once they stop", (reason, block) => {
    const r = rig();
    r.c.start();
    r.state.pending = commit(1, career(), 3);
    block(r.guard);
    r.c.tick();
    expect(r.c.blockedBy()).toBe(reason);
    expect(r.presenter.peek().rev).toBe(0);
    r.guard.editable = false;
    r.guard.focusInRegion = false;
    r.guard.sinceScroll = Number.POSITIVE_INFINITY;
    r.guard.overlay = false;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
  });

  it("is held while the tab is hidden", () => {
    const r = rig();
    r.c.start();
    r.state.visible = false;
    r.state.pending = commit(1, career(), 3);
    r.c.tick();
    expect(r.c.blockedBy()).toBe("hidden");
    expect(r.presenter.peek().rev).toBe(0);
    r.state.visible = true;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
  });
});

describe("cooldown", () => {
  it("a second structural release waits COOLDOWN_MS (20 s) after the first", () => {
    expect(COOLDOWN_MS).toBe(20_000);
    const r = rig();
    r.c.start();
    r.state.pending = commit(1, career(2), 2);
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);

    r.state.pending = commit(2, learning(), 3);
    r.state.now += COOLDOWN_MS - 1;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
    r.state.now += 1;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(2);
    expect(r.released).toHaveLength(2);
  });

  it("a deepening in the SAME domain skips the cooldown: tier 1 -> tier 2 lands at the next safe point", () => {
    const r = rig();
    r.c.start();
    r.state.pending = commit(1, career(1), 1);
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);

    r.state.pending = commit(2, career(2), 2);
    r.state.now += 2_000; // far inside the 20 s cooldown
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(2);
    expect(r.released).toHaveLength(2);
  });

  it("a same-domain deepening is still held by every other guard", () => {
    const r = rig();
    r.c.start();
    r.state.pending = commit(1, career(1), 1);
    r.c.tick();
    r.state.pending = commit(2, career(2), 2);
    r.guard.editable = true;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
    r.guard.editable = false;
    r.state.frozen = true;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
    r.state.frozen = false;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(2);
  });

  it("the first release of a visit is never delayed by the cooldown", () => {
    const r = rig();
    r.c.start();
    r.state.pending = commit(1, career(), 3);
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
  });

  it("runs on fake timers by itself while something is pending", () => {
    const r = rig();
    r.c.start();
    r.state.pending = commit(1, career(), 3);
    r.c.poke();
    vi.advanceTimersByTime(RELEASE.TICK_MS * 2);
    expect(r.presenter.peek().rev).toBe(1);
  });
});

describe("holds and bypasses", () => {
  it("Keep my current layout (frozen) holds structural changes until it is lifted", () => {
    const r = rig();
    r.c.start();
    r.state.frozen = true;
    r.state.pending = commit(1, career(), 3);
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(0);
    r.state.frozen = false;
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(1);
  });

  it.each(["reset", "undo", "persona", "manual"] as const)(
    "a %s commit releases instantly even when frozen, blocked and in cooldown, with no announcement",
    (source) => {
      const r = rig();
      r.c.start();
      r.state.frozen = true;
      r.guard.editable = true;
      r.state.pending = commit(1, career(), 3, source);
      r.c.tick();
      expect(r.presenter.peek().rev).toBe(1);
      expect(r.released).toHaveLength(0);
    },
  );

  it("a silent commit (same structure, new reason) is presented at once, with no announcement", () => {
    const r = rig();
    r.c.start();
    r.presenter.adopt(commit(1, career(), 3));
    r.state.frozen = true;
    r.guard.editable = true;
    r.state.pending = commit(2, { ...career(), confidence: 0.95 }, 3);
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(2);
    expect(r.released).toHaveLength(0);
  });

  it("another tab resetting below our rev is adopted instantly", () => {
    const r = rig();
    r.c.start();
    r.presenter.adopt(commit(8, career(), 3));
    r.state.pending = commit(2, UNIVERSAL_DECISION, 0);
    r.c.tick();
    expect(r.presenter.peek().rev).toBe(2);
  });

  it("nothing pending: nothing happens and the ticker stops", () => {
    const r = rig();
    r.c.start();
    r.c.tick();
    expect(r.released).toHaveLength(0);
  });
});

describe("lifecycle", () => {
  it("stop() releases the guard once the last start is stopped", () => {
    const r = rig();
    const a = r.c.start();
    const b = r.c.start();
    a();
    expect(r.guard.stop).not.toHaveBeenCalled();
    b();
    expect(r.guard.stop).toHaveBeenCalledTimes(1);
    b();
    expect(r.guard.stop).toHaveBeenCalledTimes(1);
  });
});
