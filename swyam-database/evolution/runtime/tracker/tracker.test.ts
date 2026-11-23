import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackInput } from "../../types";
import { _resetFlush, flush, isFlushScheduled } from "./flush";
import { BATCH_SIZE, QUEUE_CAP, clearQueue, queueSize } from "./queue";
import { _resetTrack, flushNow, setTrackSink, suspendTracking, track, trackOnce } from "./track";
import { entityId } from "./entity";
import { handleTrackTarget } from "./delegate";
import { parseTrackAttrs, trackAttrs } from "./track-attrs";

function stubBrowser(idle?: (cb: () => void) => number) {
  const win: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    requestIdleCallback?: ReturnType<typeof vi.fn>;
    cancelIdleCallback?: ReturnType<typeof vi.fn>;
  } = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  if (idle) {
    win.requestIdleCallback = vi.fn(idle);
    win.cancelIdleCallback = vi.fn();
  }
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    visibilityState: "visible",
  });
  return win;
}

beforeEach(() => {
  vi.useFakeTimers();
  _resetFlush();
  _resetTrack();
  clearQueue();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("track()", () => {
  it("is a no-op during SSR (no window) and never throws", () => {
    expect(() => track("course_saved")).not.toThrow();
    expect(queueSize()).toBe(0);
  });

  it("queues synchronously and delivers on the setTimeout fallback when there is no requestIdleCallback", () => {
    stubBrowser();
    const got: TrackInput[][] = [];
    setTrackSink((b) => got.push([...b]));
    track("course_viewed", { level: "beginner" }, { entityId: "crs_python" });
    expect(queueSize()).toBe(1);
    expect(got).toHaveLength(0); // never synchronous
    expect(isFlushScheduled()).toBe(true);
    vi.advanceTimersByTime(400);
    expect(got).toHaveLength(1);
    expect(got[0][0]).toMatchObject({ type: "course_viewed", entityId: "crs_python" });
    expect(queueSize()).toBe(0);
  });

  it("uses requestIdleCallback when available", () => {
    let run: (() => void) | undefined;
    const win = stubBrowser((cb) => {
      run = cb;
      return 1;
    });
    const sink = vi.fn();
    setTrackSink(sink);
    track("job_saved");
    expect(win.requestIdleCallback).toHaveBeenCalledTimes(1);
    track("job_saved"); // one scheduled flush covers the burst
    expect(win.requestIdleCallback).toHaveBeenCalledTimes(1);
    run?.();
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toHaveLength(2);
  });

  it("holds events until a sink exists, then drains them", () => {
    stubBrowser();
    track("skill_viewed", { surface: "skills" });
    vi.advanceTimersByTime(2000);
    expect(queueSize()).toBe(1);
    const sink = vi.fn();
    setTrackSink(sink);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(queueSize()).toBe(0);
  });

  it("bounds the queue and drops the OLDEST", () => {
    stubBrowser();
    for (let i = 0; i < QUEUE_CAP + 25; i++) track("filter_used", { filter: `f${i}` });
    expect(queueSize()).toBe(QUEUE_CAP);
    const seen: TrackInput[] = [];
    setTrackSink((b) => seen.push(...b));
    expect(seen).toHaveLength(QUEUE_CAP);
    expect((seen[0].metadata as { filter: string }).filter).toBe("f25");
  });

  it("flushes in batches of at most BATCH_SIZE", () => {
    stubBrowser();
    const sizes: number[] = [];
    for (let i = 0; i < 150; i++) track("page_viewed", { route: "/x" });
    setTrackSink((b) => sizes.push(b.length));
    expect(sizes.every((n) => n <= BATCH_SIZE)).toBe(true);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(150);
  });

  it("one idle slice delivers a batch and reschedules for the rest", () => {
    stubBrowser();
    const sizes: number[] = [];
    setTrackSink((b) => sizes.push(b.length));
    for (let i = 0; i < 100; i++) track("page_viewed", { route: "/x" });
    flush();
    expect(sizes).toEqual([BATCH_SIZE]);
    expect(isFlushScheduled()).toBe(true);
    vi.advanceTimersByTime(400);
    expect(sizes).toEqual([BATCH_SIZE, 100 - BATCH_SIZE]);
  });

  it("flushNow drains synchronously and swallows a throwing sink", () => {
    stubBrowser();
    const sink = vi.fn(() => {
      throw new Error("boom");
    });
    setTrackSink(sink);
    track("course_saved");
    expect(() => flushNow()).not.toThrow();
    expect(queueSize()).toBe(0);
  });

  it("pagehide drains the queue", () => {
    const win = stubBrowser();
    const sink = vi.fn();
    setTrackSink(sink);
    track("course_saved");
    const call = win.addEventListener.mock.calls.find((c) => c[0] === "pagehide");
    expect(call).toBeTruthy();
    (call?.[1] as () => void)();
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("drops entity ids that are not public slugs", () => {
    stubBrowser();
    track("profile_viewed", { self: false }, { entityId: "usr_ABC" as never });
    track("course_viewed", {}, { entityId: "crs_Has Space" as never });
    const seen: TrackInput[] = [];
    setTrackSink((b) => seen.push(...b));
    expect(seen.map((e) => e.entityId)).toEqual([null, null]);
  });
});

describe("suspendTracking", () => {
  it("drops events while suspended, resumes after, and nests", () => {
    stubBrowser();
    const resumeA = suspendTracking();
    const resumeB = suspendTracking();
    track("course_saved");
    expect(queueSize()).toBe(0);
    resumeA();
    resumeA(); // idempotent
    track("course_saved");
    expect(queueSize()).toBe(0);
    resumeB();
    track("course_saved");
    expect(queueSize()).toBe(1);
  });
});

describe("trackOnce", () => {
  it("counts the first call per key only", () => {
    stubBrowser();
    trackOnce("done:crs_a", "course_completed");
    trackOnce("done:crs_a", "course_completed");
    trackOnce("done:crs_b", "course_completed");
    expect(queueSize()).toBe(2);
  });
});

describe("entityId", () => {
  it("lowercases, normalises and matches the sanitiser regex", () => {
    expect(entityId("crs", "Python Basics")).toBe("crs_python-basics");
    expect(entityId("opp", "3F2A-9C")).toBe("opp_3f2a-9c");
    expect(entityId("ext", "adzuna:987")).toBe("ext_adzuna:987");
    expect(entityId("crs", "")).toBeNull();
    expect(entityId("crs", undefined)).toBeNull();
    expect(entityId("skl", "x".repeat(200))?.length).toBe(4 + 64);
  });
});

describe("data-track delegate", () => {
  const el = (attrs: Record<string, string>, extra: Record<string, unknown> = {}) => {
    const self = {
      ...extra,
      getAttribute: (k: string) => attrs[k] ?? null,
      getAttributeNames: () => Object.keys(attrs),
      closest: (sel: string) => (sel === "[data-track]" ? self : null),
    };
    return self as unknown as Element;
  };

  it("round-trips trackAttrs and queues one event", () => {
    stubBrowser();
    const attrs = trackAttrs("dashboard_section_clicked", {
      metadata: { section: "events", position: 2 },
    });
    expect(parseTrackAttrs(el(attrs))).toMatchObject({
      type: "dashboard_section_clicked",
      metadata: { section: "events", position: 2 },
    });
    expect(handleTrackTarget(el(attrs))).toBe(true);
    expect(queueSize()).toBe(1);
  });

  it("ignores unknown types, disabled controls and scope=off", () => {
    stubBrowser();
    expect(handleTrackTarget(el({ "data-track": "bogus" }))).toBe(false);
    expect(handleTrackTarget(el({ "data-track": "course_saved" }, { disabled: true }))).toBe(false);
    const off = el({ "data-track": "course_saved" });
    (off as unknown as { closest: (s: string) => unknown }).closest = (s) =>
      s === "[data-track]" ? off : s === '[data-track-scope="off"]' ? {} : null;
    expect(handleTrackTarget(off)).toBe(false);
    expect(queueSize()).toBe(0);
  });
});
