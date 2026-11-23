import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TraceStep } from "../core/evolution/engine";
import { UNIVERSAL_DECISION } from "../core/evolution/compose";
import type { BehaviourEvent, EvolutionDecision, Tier } from "../types";
import { createReplayController, replayHistory } from "./replay-controller";

const event = (seq: number): BehaviourEvent => ({
  v: 1,
  seq,
  type: "job_viewed",
  timestamp: 1_000 * seq,
  sessionId: "s1",
  service: "CAREER",
  entityId: null,
  metadata: {},
});

const EVENTS = [1, 2, 3, 4].map(event);

const REF = (state: "UNIVERSAL" | "CAREER_FIRST", tier: Tier) => ({
  state,
  mode: "BALANCED" as const,
  nav: "UNIVERSAL" as const,
  layout: "UNIVERSAL" as const,
  tier,
});

/** A fake, deterministic trace: the 3rd event commits UNIVERSAL → CAREER_FIRST. */
const trace = (_scope: unknown, events: readonly BehaviourEvent[]): TraceStep[] =>
  events.map((e) => {
    const committed = e.seq === 3;
    const decision: EvolutionDecision = committed
      ? { ...UNIVERSAL_DECISION, primaryState: "CAREER_FIRST" }
      : UNIVERSAL_DECISION;
    return {
      seq: e.seq,
      event: e,
      tier: (committed ? 1 : 0) as Tier,
      decision,
      change: committed
        ? {
            from: REF("UNIVERSAL", 0),
            to: REF("CAREER_FIRST", 1),
            confidence: 0.6,
            source: "deterministic",
            reasonCode: { key: "START" },
          }
        : null,
    };
  });

describe("replay-controller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts paused at step 0 and steps one event at a time", () => {
    const c = createReplayController("guest", EVENTS, { trace });
    expect(c.getState()).toMatchObject({ index: 0, total: 4, playing: false, current: null });
    c.step();
    expect(c.getState().index).toBe(1);
    expect(c.getState().current?.seq).toBe(1);
    c.step();
    c.step();
    c.step();
    c.step(); // clamped
    expect(c.getState()).toMatchObject({ index: 4, playing: false });
  });

  it("plays on a timer, can pause and resume, and stops at the end", () => {
    const c = createReplayController("guest", EVENTS, { trace, intervalMs: 100 });
    c.play();
    expect(c.getState().playing).toBe(true);
    vi.advanceTimersByTime(250);
    expect(c.getState().index).toBe(2);
    c.pause();
    vi.advanceTimersByTime(1_000);
    expect(c.getState()).toMatchObject({ index: 2, playing: false });
    c.play();
    vi.advanceTimersByTime(1_000);
    expect(c.getState()).toMatchObject({ index: 4, playing: false });
  });

  it("play from the end restarts; seek and restart clamp and pause", () => {
    const c = createReplayController("guest", EVENTS, { trace, intervalMs: 10 });
    c.seek(99);
    expect(c.getState().index).toBe(4);
    c.play();
    expect(c.getState()).toMatchObject({ index: 0, playing: true });
    c.seek(-5);
    expect(c.getState()).toMatchObject({ index: 0, playing: false });
    c.restart();
    expect(c.getState().index).toBe(0);
  });

  it("notifies subscribers and stops after dispose", () => {
    const c = createReplayController("guest", EVENTS, { trace, intervalMs: 10 });
    const listener = vi.fn();
    const off = c.subscribe(listener);
    c.step();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    c.step();
    expect(listener).toHaveBeenCalledTimes(1);
    c.play();
    c.dispose();
    vi.advanceTimersByTime(1_000);
    expect(c.getState().index).toBe(2);
  });

  it("is deterministic and does not mutate the log", () => {
    const frozen = Object.freeze(EVENTS.map((e) => Object.freeze({ ...e })));
    const run = () => {
      const c = createReplayController("guest", frozen, { trace });
      for (let i = 0; i < 4; i++) c.step();
      return JSON.stringify(c.getState().steps);
    };
    expect(run()).toBe(run());
  });

  it("builds history only from committed changes up to the cursor", () => {
    const steps = trace("guest", EVENTS);
    expect(replayHistory(steps, 2)).toEqual([]);
    const h = replayHistory(steps, 4);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ id: "replay-3", at: 3_000, source: "deterministic" });
    expect(h[0].to.state).toBe("CAREER_FIRST");
  });

  it("an empty log is inert", () => {
    const c = createReplayController("guest", [], { trace });
    c.play();
    expect(c.getState()).toMatchObject({ total: 0, index: 0, playing: false });
  });

  it("folds a real engine log with the default trace, identically twice", () => {
    const a = createReplayController("guest", EVENTS);
    const b = createReplayController("guest", EVENTS);
    expect(a.getState().total).toBe(EVENTS.length);
    expect(JSON.stringify(a.getState().steps)).toBe(JSON.stringify(b.getState().steps));
  });
});
