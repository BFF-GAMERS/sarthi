import { describe, expect, it } from "vitest";
import { SignalCollector, median, type TapInput } from "./signals";

const tap = (c: SignalCollector, t: number, o: Partial<TapInput> = {}) =>
  c.tap({ t, x: 100, y: 100, target: "a", onInteractive: true, nearInteractive: false, ...o });

describe("median", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("SignalCollector", () => {
  it("reports the median gap between actions, ignoring time spent away", () => {
    const c = new SignalCollector();
    [0, 1000, 2000, 3000, 4000, 60000].forEach((t, i) => tap(c, t, { target: `t${i}` }));
    expect(c.snapshot().medianGapMs).toBe(1000);
  });
  it("needs at least three gaps before it reports one", () => {
    const c = new SignalCollector();
    tap(c, 0, { target: "a" });
    tap(c, 1000, { target: "b" });
    expect(c.snapshot().medianGapMs).toBeNull();
  });
  it("counts two taps on one target under 400ms as a rapid repeat, not at 400ms", () => {
    const c = new SignalCollector();
    tap(c, 0);
    tap(c, 300);
    tap(c, 700);
    expect(c.snapshot().repeatTaps).toBe(1);
  });
  it("counts a tap beside a control, not on it, as a near miss", () => {
    const c = new SignalCollector();
    tap(c, 0, { target: "blank", onInteractive: false, nearInteractive: true });
    tap(c, 5000, { target: "blank2", onInteractive: false, nearInteractive: false });
    const s = c.snapshot();
    expect(s.nearMisses).toBe(1);
    expect(s.nearMissRate).toBe(0.5);
  });
  it("counts a tap that hit nothing and was repeated nearby within 1.2s as a miss", () => {
    const c = new SignalCollector();
    tap(c, 0, { target: "blank", onInteractive: false, x: 100, y: 100 });
    tap(c, 800, { target: "btn", onInteractive: true, x: 120, y: 110 });
    expect(c.snapshot().nearMisses).toBe(1);
  });
  it("does not call a deliberate second tap on a button a miss", () => {
    const c = new SignalCollector();
    tap(c, 0, { target: "next", onInteractive: true });
    tap(c, 800, { target: "next", onInteractive: true });
    expect(c.snapshot().nearMisses).toBe(0);
  });
  it("counts leaving a page within 3s as a quick back-out, but not a redirect", () => {
    const c = new SignalCollector();
    c.routeChange("/a", 0);
    c.routeChange("/b", 100); // a redirect: too fast to be a person
    c.routeChange("/c", 1500); // 1.4s on /b
    c.routeChange("/d", 10000); // 8.5s on /c
    const s = c.snapshot();
    expect(s.navs).toBe(2);
    expect(s.backOuts).toBe(1);
    expect(s.backOutRate).toBe(0.5);
  });
  it("measures scroll speed in px per second and ignores the jump to top after a route change", () => {
    const c = new SignalCollector();
    c.routeChange("/a", 0);
    c.routeChange("/b", 5000);
    c.scroll(5100, 0); // inside the post-navigation mute
    c.scroll(6000, 0);
    for (let i = 1; i <= 8; i++) c.scroll(6000 + i * 100, i * 100); // 1000 px/s
    expect(c.snapshot().scrollVelocity).toBe(1000);
  });
  it("reset forgets everything", () => {
    const c = new SignalCollector();
    tap(c, 0);
    c.reset();
    expect(c.snapshot().samples).toBe(0);
    expect(c.totals().taps).toBe(0);
  });
  it("keeps no more than a window of taps", () => {
    const c = new SignalCollector();
    for (let i = 0; i < 200; i++) tap(c, i * 1000, { target: i });
    expect(c.snapshot().taps).toBeLessThanOrEqual(60);
    expect(c.totals().taps).toBe(200);
  });
});
