import { describe, expect, it, vi } from "vitest";
import { UNIVERSAL_DECISION } from "../../core/evolution/compose";
import type { Committed } from "../../state/committed";
import { createPresenter } from "./presenter";

const commit = (rev: number, over: Partial<Committed> = {}): Committed => ({
  rev,
  decision: UNIVERSAL_DECISION,
  tier: 0,
  reasonCode: { key: "START" },
  source: "deterministic",
  at: rev,
  ...over,
});

describe("presenter", () => {
  it("releases a newer rev to every subscriber exactly once, with the previous commit", () => {
    const p = createPresenter(commit(0), { prefersInstant: () => false });
    const a = vi.fn();
    const b = vi.fn();
    p.subscribe(a);
    p.subscribe(b);
    expect(p.release(commit(1), "animate")).toBe(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(
      expect.objectContaining({ rev: 1 }),
      "animate",
      expect.objectContaining({ rev: 0 }),
    );
    expect(b).toHaveBeenCalledTimes(1);
    expect(p.peek().rev).toBe(1);
  });

  it("ignores a same or stale rev unless forced", () => {
    const p = createPresenter(commit(3), { prefersInstant: () => false });
    const l = vi.fn();
    p.subscribe(l);
    expect(p.release(commit(3), "animate")).toBe(false);
    expect(p.release(commit(2), "animate")).toBe(false);
    expect(l).not.toHaveBeenCalled();
    expect(p.release(commit(2), "instant", { force: true })).toBe(true);
    expect(p.peek().rev).toBe(2);
  });

  it("reduced motion keeps the evolution but makes it instant", () => {
    const p = createPresenter(commit(0), { prefersInstant: () => true });
    const l = vi.fn();
    p.subscribe(l);
    p.release(commit(1), "animate");
    expect(l.mock.calls[0]?.[1]).toBe("instant");
    expect(p.peek().rev).toBe(1);
  });

  it("adopt() replaces what is shown without notifying (a restore is not a change)", () => {
    const p = createPresenter(commit(0), { prefersInstant: () => false });
    const l = vi.fn();
    p.subscribe(l);
    p.adopt(commit(9));
    expect(p.peek().rev).toBe(9);
    expect(l).not.toHaveBeenCalled();
  });

  it("a throwing subscriber cannot stop the others or the release", () => {
    const p = createPresenter(commit(0), { prefersInstant: () => false });
    const ok = vi.fn();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    p.subscribe(() => {
      throw new Error("boom");
    });
    p.subscribe(ok);
    expect(p.release(commit(1), "animate")).toBe(true);
    expect(ok).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });

  it("unsubscribe stops notifications", () => {
    const p = createPresenter(commit(0), { prefersInstant: () => false });
    const l = vi.fn();
    const off = p.subscribe(l);
    off();
    p.release(commit(1), "animate");
    expect(l).not.toHaveBeenCalled();
  });
});
