import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNIVERSAL_DECISION } from "../../core/evolution/compose";
import type { EngineState } from "../../core/evolution/engine";
import { decide, engineWith, ev, type EngineOverrides } from "../../core/analyzer/testing";
import { IDLE_AI } from "../../state/defaults";
import type { EvolutionRuntimeApi } from "../../state/types";
import type { AiStatus, BehaviourEvent, EvolutionDecision } from "../../types";
import {
  ARM_DELAY_MS,
  MAX_CALLS_PER_DAY,
  UNAVAILABLE_TEXT,
  createAiController,
  requestAiAnalysis,
  startAiScheduler,
  type SchedulerDeps,
} from "./ai-scheduler";

const MIN = 60_000;

const BASE: EngineOverrides = {
  meaningful: 20,
  domains: { LEARNING: 8, CAREER: 12 },
  scores: { careerAffinity: 0.6, learningAffinity: 0.3 },
  countsByType: { job_viewed: 12, course_viewed: 8 },
  decision: { ...UNIVERSAL_DECISION, confidence: 0.4 },
};

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

function harness(over: { holdAdvice?: boolean } = {}) {
  const state = {
    scope: "guest",
    adaptive: "on" as "on" | "paused" | "off",
    locked: false,
    demo: null as string | null,
    engine: engineWith(BASE) as EngineState,
    events: [] as BehaviourEvent[],
    decision: UNIVERSAL_DECISION as EvolutionDecision,
    ai: IDLE_AI as AiStatus,
  };
  const listeners = new Set<() => void>();
  const applyAdvice = vi.fn(
    (a: { primaryState: never; behaviourMode: never; confidence: number }) => {
      if (!over.holdAdvice) state.decision = decide(a.primaryState, a.behaviourMode, a.confidence);
    },
  );
  const rt = {
    getSnapshot: () => ({
      scope: state.scope,
      prefs: { adaptive: state.adaptive, locked: state.locked },
      status: { demo: state.demo },
      decision: state.decision,
      ai: state.ai,
    }),
    getEngineState: () => state.engine,
    getEvents: () => state.events,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    applyAdvice,
    setAiStatus: vi.fn((p: Partial<AiStatus>) => {
      state.ai = { ...state.ai, ...p };
    }),
  } as unknown as EvolutionRuntimeApi;

  const storage = memoryStorage();
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  const hide: Array<() => void> = [];
  let killed = false;
  const deps: Partial<SchedulerDeps> = {
    storage: () => storage,
    fetchImpl: () => fetchMock as unknown as typeof fetch,
    isClient: () => true,
    onPageHide: (fn) => {
      hide.push(fn);
      return () => {};
    },
    killSwitch: () => killed,
  };

  const ai = (decision: unknown = decide("CAREER_FIRST", "RESEARCH", 0.9)) =>
    Response.json({ ok: true, source: "ai", decision });

  return {
    state,
    rt,
    storage,
    fetchMock,
    applyAdvice,
    deps,
    hide: () => hide.forEach((f) => f()),
    kill: (v: boolean) => (killed = v),
    controller: () => createAiController(rt, deps),
    notify: () => listeners.forEach((l) => l()),
    setEngine: (o: EngineOverrides = {}) => {
      state.engine = engineWith({ ...BASE, ...o });
    },
    /** A completed action: a trigger that does not depend on the event count. */
    complete(): void {
      state.events = [...state.events, ev("course_completed")];
      listeners.forEach((l) => l());
    },
    reply: ai,
    /** Distinct scores per i → distinct summary hashes. */
    variant: (i: number): EngineOverrides => ({
      scores: { careerAffinity: 0.6, learningAffinity: 0.05 * ((i % 6) + 1) },
      countsByType: { job_viewed: 12 + i, course_viewed: 8 },
    }),
  };
}

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
/** Long enough to arm (2 s) and for the idle callback (200 ms) to run. */
const ARMED = ARM_DELAY_MS + 400;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 6, 10, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("scheduler triggers and gates", () => {
  it("never calls on first paint, then calls once armed (threshold: 20 events from a 0 baseline)", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(h.reply());
    const stop = h.controller().start();
    h.notify();
    await tick(ARM_DELAY_MS - 100);
    expect(h.fetchMock).not.toHaveBeenCalled();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("sends aggregates only to /api/evolution", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(h.reply());
    h.controller().start();
    h.notify();
    await tick(ARMED);
    const [url, init] = h.fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/evolution");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        "current",
        "deterministic",
        "navPattern",
        "repeated",
        "scores",
        "session",
        "topActions",
        "trigger",
        "v",
      ].sort(),
    );
    expect(body["trigger"]).toBe("threshold");
    expect((init.headers as Record<string, string>)["x-evolution-fixture"]).toBeUndefined();
  });

  it("needs ≥ 12 meaningful events", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(h.reply());
    h.setEngine({ meaningful: 11 });
    h.controller().start();
    await tick(ARMED);
    h.complete();
    await tick(500);
    expect(h.fetchMock).not.toHaveBeenCalled();
    h.setEngine({ meaningful: 12 });
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("needs ≥ 2 domains", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(h.reply());
    h.setEngine({ domains: { CAREER: 20 } });
    h.controller().start();
    await tick(ARMED);
    h.complete();
    await tick(500);
    expect(h.fetchMock).not.toHaveBeenCalled();
    h.setEngine({ domains: { CAREER: 15, COMMUNITY: 5 } });
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is silent when adaptive is paused or off, when the kill switch is on, and during a Lab demo", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(h.reply());
    h.controller().start();
    await tick(ARMED);
    for (const adaptive of ["paused", "off"] as const) {
      h.state.adaptive = adaptive;
      h.complete();
      await tick(500);
    }
    h.state.adaptive = "on";
    h.kill(true);
    h.complete();
    await tick(500);
    h.kill(false);
    h.state.demo = "career-seeker";
    h.complete();
    await tick(500);
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("waits 3 minutes between calls and skips an unchanged summary hash", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(h.reply());
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    // Changed evidence, but only a minute later: the gap gate holds.
    h.setEngine(h.variant(1));
    await tick(MIN);
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    // Past three minutes, but nothing changed since the last analysis: skipped. (The first run saw BASE.)
    h.setEngine({});
    await tick(4 * MIN);
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    // Past three minutes and different evidence: a second call.
    h.setEngine(h.variant(2));
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("makes at most 6 calls a day per scope, and starts again tomorrow", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () => h.reply());
    h.controller().start();
    await tick(ARMED);
    for (let i = 0; i < MAX_CALLS_PER_DAY + 2; i++) {
      h.setEngine(h.variant(i));
      h.complete();
      await tick(4 * MIN);
    }
    expect(h.fetchMock).toHaveBeenCalledTimes(MAX_CALLS_PER_DAY);
    expect(h.state.ai.callsLeftToday).toBe(0);

    await tick(15 * 60 * MIN);
    h.setEngine(h.variant(40));
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(MAX_CALLS_PER_DAY + 1);
  });

  it("runs one request at a time", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    h.controller().start();
    h.notify();
    await tick(ARMED);
    h.setEngine(h.variant(3));
    await tick(5 * MIN);
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("other triggers: a repeated top action and a confidence shift", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () => h.reply());
    h.controller().start();
    await tick(ARMED);
    // Same event type five times in one session.
    h.state.events = Array.from({ length: 5 }, () => ev("job_viewed"));
    h.notify();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(h.fetchMock.mock.calls[0]![1].body))["trigger"]).toBe(
      "repeated_pattern",
    );

    // Confidence moves by 0.2 from the baseline.
    h.setEngine({ ...h.variant(1), decision: { ...UNIVERSAL_DECISION, confidence: 0.65 } });
    await tick(4 * MIN);
    h.notify();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(h.fetchMock.mock.calls[1]![1].body))["trigger"]).toBe(
      "confidence_shift",
    );
  });
});

describe("scheduler failures", () => {
  it("a 429 switches the AI off until tomorrow", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.state.ai).toMatchObject({
      kind: "unavailable",
      fallback: "rate_limited",
      detail: UNAVAILABLE_TEXT,
    });

    for (let i = 1; i <= 3; i++) {
      h.setEngine(h.variant(i));
      h.complete();
      await tick(4 * MIN);
    }
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    await tick(15 * 60 * MIN);
    h.fetchMock.mockImplementation(async () => h.reply());
    h.setEngine(h.variant(9));
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a rate_limited answer from the route locks out the same way", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () =>
      Response.json({ ok: false, fallback: "rate_limited" }),
    );
    h.controller().start();
    h.notify();
    await tick(ARMED);
    h.setEngine(h.variant(1));
    h.complete();
    await tick(4 * MIN);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.state.ai.fallback).toBe("rate_limited");
  });

  it("three failures switch the AI off for the session", async () => {
    const h = harness();
    h.fetchMock.mockRejectedValue(new TypeError("network"));
    h.controller().start();
    h.notify();
    await tick(ARMED);
    for (let i = 1; i <= 5; i++) {
      h.setEngine(h.variant(i));
      h.complete();
      await tick(4 * MIN);
    }
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    expect(h.state.ai).toMatchObject({ kind: "unavailable", fallback: "upstream" });
    // Even tomorrow: it is the session that is off.
    await tick(30 * 60 * MIN);
    h.setEngine(h.variant(20));
    h.complete();
    await tick(500);
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
  });

  it("aborts at 8 seconds and reports a timeout", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(
      (_u, init) =>
        new Promise<Response>((_, reject) =>
          init.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.state.ai.kind).toBe("pending");
    await tick(7_000);
    expect(h.state.ai.kind).toBe("pending");
    await tick(1_500);
    expect(h.state.ai).toMatchObject({ kind: "unavailable", fallback: "timeout" });
  });

  it("an unconfigured or off answer stops further calls without counting as failures", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () =>
      Response.json({ ok: false, fallback: "unconfigured" }),
    );
    h.controller().start();
    h.notify();
    await tick(ARMED);
    for (let i = 1; i <= 3; i++) {
      h.setEngine(h.variant(i));
      h.complete();
      await tick(4 * MIN);
    }
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.state.ai.fallback).toBe("unconfigured");
  });

  it("an answer that fails validation is a failure and never reaches the engine", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () =>
      h.reply({ ...decide("CAREER_FIRST"), homepageLayout: "LEARNING_HUB" }),
    );
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.state.ai).toMatchObject({ kind: "unavailable", fallback: "invalid" });
    expect(h.applyAdvice).not.toHaveBeenCalled();
  });
});

describe("scheduler results go through the merge", () => {
  it("applies advice with confidence capped at local + 0.15", async () => {
    const h = harness();
    h.fetchMock.mockResolvedValue(h.reply());
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.applyAdvice).toHaveBeenCalledTimes(1);
    expect(h.applyAdvice.mock.calls[0]![0]).toMatchObject({
      primaryState: "CAREER_FIRST",
      behaviourMode: "RESEARCH",
      epoch: 0,
    });
    expect(h.applyAdvice.mock.calls[0]![0].confidence).toBeCloseTo(0.55, 5);
    expect(h.state.ai).toMatchObject({ kind: "applied", lastTrigger: "threshold" });
    expect(h.state.ai.lastDecision?.primaryState).toBe("CAREER_FIRST");
  });

  it("reports held when the engine's stability rules keep the old decision", async () => {
    const h = harness({ holdAdvice: true });
    h.fetchMock.mockResolvedValue(h.reply());
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.state.ai).toMatchObject({ kind: "held", detail: "held by stability rules" });
  });

  it("rejects a state without local evidence and does not call applyAdvice", async () => {
    const h = harness();
    h.setEngine({ scores: { careerAffinity: 0.6, learningAffinity: 0.05 } });
    h.fetchMock.mockResolvedValue(h.reply(decide("LEARNING_FIRST", "RESEARCH", 0.9)));
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.applyAdvice).not.toHaveBeenCalled();
    expect(h.state.ai.kind).toBe("rejected");
    expect(h.state.ai.detail).toMatch(/not enough local evidence/);
  });

  it("respects the lock", async () => {
    const h = harness();
    h.state.locked = true;
    h.fetchMock.mockResolvedValue(h.reply());
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.applyAdvice).not.toHaveBeenCalled();
    expect(h.state.ai.kind).toBe("held");
  });

  it("drops an answer from before a reset (wrong epoch)", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () => {
      h.setEngine({ epoch: 1 });
      return h.reply();
    });
    h.controller().start();
    h.notify();
    await tick(ARMED);
    expect(h.applyAdvice).not.toHaveBeenCalled();
    expect(h.state.ai.detail).toMatch(/reset/);
  });
});

describe("requestAiAnalysis and the frozen exports", () => {
  it("bypasses the count and 3-minute gates only", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () => h.reply());
    h.setEngine({ meaningful: 2, domains: { CAREER: 2 } });
    const c = h.controller();
    const a = await c.request("lab");
    expect(a.kind).toBe("applied");
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    // Straight away again with different evidence: still no 3-minute wait.
    h.setEngine({ ...h.variant(1), meaningful: 2, domains: { CAREER: 2 } });
    await c.request("lab");
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("replays the cached decision for an unchanged summary without a call", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () => h.reply());
    const c = h.controller();
    await c.request("lab");
    h.state.decision = UNIVERSAL_DECISION;
    const again = await c.request("lab");
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(again.lastDecision?.primaryState).toBe("CAREER_FIRST");
  });

  it("still respects the daily cap and tells the Lab plainly", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () => h.reply());
    const c = h.controller();
    for (let i = 0; i < MAX_CALLS_PER_DAY; i++) {
      h.setEngine(h.variant(i));
      await c.request("lab");
    }
    h.setEngine(h.variant(30));
    const capped = await c.request("lab");
    expect(h.fetchMock).toHaveBeenCalledTimes(MAX_CALLS_PER_DAY);
    expect(capped).toMatchObject({
      kind: "unavailable",
      fallback: "rate_limited",
      detail: UNAVAILABLE_TEXT,
    });
  });

  it("says so plainly when adaptation is off, and never rejects", async () => {
    const h = harness();
    h.state.adaptive = "off";
    const r = await h.controller().request("lab");
    expect(r).toMatchObject({ kind: "unavailable", fallback: "off", detail: UNAVAILABLE_TEXT });
    h.fetchMock.mockRejectedValue(new Error("boom"));
    h.state.adaptive = "on";
    await expect(h.controller().request("lab")).resolves.toMatchObject({ kind: "unavailable" });
  });

  it("the module exports are safe without a browser (server render, tests)", async () => {
    const h = harness();
    const stop = startAiScheduler(h.rt);
    expect(typeof stop).toBe("function");
    stop();
    const status = await requestAiAnalysis(h.rt, "lab");
    expect(status.kind).toBe("unavailable");
  });
});

describe("end of session", () => {
  it("marks pendingAnalysis on pagehide and runs it in idle time on the next visit", async () => {
    const h = harness();
    h.fetchMock.mockImplementation(async () => h.reply());
    // Visit 1: enough activity, but nothing has been analysed yet when the page is hidden.
    h.setEngine({ meaningful: 14 });
    h.controller().start();
    h.hide();
    expect(JSON.parse(h.storage.getItem("swayam.evo.guest.ai")!)).toMatchObject({
      pendingAnalysis: true,
    });
    expect(h.fetchMock).not.toHaveBeenCalled();

    // Visit 2: a fresh controller on the same storage. Not before first paint; after arming, in idle time.
    h.setEngine({ meaningful: 14 });
    h.controller().start();
    await tick(ARM_DELAY_MS - 100);
    expect(h.fetchMock).not.toHaveBeenCalled();
    await tick(600);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(h.fetchMock.mock.calls[0]![1].body))["trigger"]).toBe("session_end");
    expect(JSON.parse(h.storage.getItem("swayam.evo.guest.ai")!).pendingAnalysis).toBe(false);
  });

  it("does not mark pending when the session was too thin", () => {
    const h = harness();
    h.setEngine({ meaningful: 5 });
    h.controller().start();
    h.hide();
    expect(h.storage.getItem("swayam.evo.guest.ai")).toBeNull();
  });
});
