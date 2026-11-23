import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonaJourney } from "../core/fixtures/journeys";
import type { EvolutionRuntimeApi } from "../state/types";
import type { TrackInput } from "../types";
import { DEFAULT_INTERVAL_MS, playJourney } from "./persona-player";

const ev = (type: TrackInput["type"]): TrackInput => ({ type });

const JOURNEY: PersonaJourney = {
  id: "career-seeker",
  label: "Career Seeker",
  description: "test",
  sessions: [[ev("job_viewed"), ev("job_saved")], [ev("internship_viewed")]],
  expected: { state: "CAREER_FIRST", mode: "RESEARCH", tier: 3 },
};

function fakeRuntime() {
  const log: string[] = [];
  const rt = {
    enterSandbox: vi.fn((kind: string, id: string | null) => log.push(`enter:${kind}:${id}`)),
    ingestNow: vi.fn((e: TrackInput, source?: string) => log.push(`ingest:${e.type}:${source}`)),
    newSession: vi.fn(() => log.push("session")),
    exitSandbox: vi.fn(),
  } as unknown as EvolutionRuntimeApi;
  return { rt, log };
}

describe("persona-player", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("enters the lab sandbox, streams in order with a session boundary and asks the lab AI last", async () => {
    const { rt, log } = fakeRuntime();
    const requestAi = vi.fn(async () => {
      log.push("ai");
    });
    const run = playJourney(rt, JOURNEY, { requestAi });

    expect(log).toEqual(["enter:lab:career-seeker", "ingest:job_viewed:persona"]);
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    expect(log.at(-1)).toBe("ingest:job_saved:persona");
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    await run.done;

    expect(log).toEqual([
      "enter:lab:career-seeker",
      "ingest:job_viewed:persona",
      "ingest:job_saved:persona",
      "session",
      "ingest:internship_viewed:persona",
      "ai",
    ]);
    expect(requestAi).toHaveBeenCalledTimes(1);
    expect(requestAi).toHaveBeenCalledWith(rt, "lab");
  });

  it("spaces events by the interval and reports progress", async () => {
    const { rt } = fakeRuntime();
    const onProgress = vi.fn();
    const run = playJourney(rt, JOURNEY, { intervalMs: 100, onProgress });
    expect(rt.ingestNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(rt.ingestNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(rt.ingestNow).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    await run.done;
    expect(onProgress).toHaveBeenLastCalledWith({ sent: 3, total: 3 });
  });

  it("cancel stops streaming, resolves done and skips the final AI call", async () => {
    const { rt } = fakeRuntime();
    const requestAi = vi.fn(async () => {});
    const run = playJourney(rt, JOURNEY, { requestAi });
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    run.cancel();
    await run.done;
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 10);

    expect(rt.ingestNow).toHaveBeenCalledTimes(2);
    expect(rt.newSession).not.toHaveBeenCalled();
    expect(requestAi).not.toHaveBeenCalled();
  });

  it("a failing or throwing AI call never rejects done", async () => {
    const { rt } = fakeRuntime();
    const run = playJourney(rt, JOURNEY, {
      intervalMs: 0,
      requestAi: () => {
        throw new Error("boom");
      },
    });
    await vi.runAllTimersAsync();
    await expect(run.done).resolves.toBeUndefined();

    const run2 = playJourney(rt, JOURNEY, {
      intervalMs: 0,
      requestAi: () => Promise.reject(new Error("nope")),
    });
    await vi.runAllTimersAsync();
    await expect(run2.done).resolves.toBeUndefined();
  });

  it("survives a runtime that throws", async () => {
    const { rt } = fakeRuntime();
    (rt.ingestNow as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("store gone");
    });
    const requestAi = vi.fn(async () => {});
    const run = playJourney(rt, JOURNEY, { requestAi });
    await expect(run.done).resolves.toBeUndefined();
    expect(requestAi).not.toHaveBeenCalled();
  });
});
