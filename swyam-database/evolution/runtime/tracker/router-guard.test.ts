import { describe, expect, it, vi } from "vitest";
import type { AnyRouter } from "@tanstack/react-router";
import { guardPreloadRace } from "./router-guard";

function fakeRouter() {
  let release: () => void = () => {};
  const clear = vi.fn();
  const router = {
    clearExpiredCache: clear,
    preloadRoute: vi.fn(
      () =>
        new Promise<string>((res) => {
          release = () => res("matches");
        }),
    ),
  };
  return { router, clear, finish: () => release() };
}
const as = (r: object) => r as unknown as AnyRouter;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("guardPreloadRace", () => {
  it("sweeps at once when no preload is in flight", () => {
    const { router, clear } = fakeRouter();
    guardPreloadRace(as(router));
    (router.clearExpiredCache as () => void)();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("holds the sweep while a preload is in flight and pays it once, after the last one settles", async () => {
    const { router, clear, finish } = fakeRouter();
    guardPreloadRace(as(router));
    const p = (router.preloadRoute as (o: unknown) => Promise<unknown>)({ to: "/jobs" });
    // A navigation commits mid-preload (fast Back): the cache sweep must wait.
    router.clearExpiredCache();
    router.clearExpiredCache();
    expect(clear).not.toHaveBeenCalled();
    finish();
    await expect(p).resolves.toBe("matches");
    await tick();
    expect(clear).toHaveBeenCalledTimes(1);
    // Nothing owed any more: the next sweep is immediate.
    router.clearExpiredCache();
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it("pays the debt even when the preload rejects, and still rejects", async () => {
    const { router, clear } = fakeRouter();
    router.preloadRoute.mockImplementationOnce(() => Promise.reject(new Error("boom")));
    guardPreloadRace(as(router));
    const p = (router.preloadRoute as (o: unknown) => Promise<unknown>)({});
    router.clearExpiredCache();
    await expect(p).rejects.toThrow("boom");
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("is idempotent, restorable, and ignores routers without the methods", () => {
    const { router, clear } = fakeRouter();
    const original = router.clearExpiredCache;
    const off = guardPreloadRace(as(router));
    const wrapped = router.clearExpiredCache;
    const off2 = guardPreloadRace(as(router));
    expect(router.clearExpiredCache).toBe(wrapped);
    off(); // one user is still subscribed: the guard stays
    expect(router.clearExpiredCache).toBe(wrapped);
    off2();
    expect(router.clearExpiredCache).toBe(original);
    router.clearExpiredCache();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(() => guardPreloadRace(as({}))()).not.toThrow();
  });
});
