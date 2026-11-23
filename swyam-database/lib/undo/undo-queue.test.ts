import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUndoQueue, UNDO_WINDOW_MS, type UndoQueue } from "./undo-queue";

/* A document and a window that need no DOM: `EventTarget` is in Node. */
function fakeEnv() {
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const win = new EventTarget();
  const control = { closest: (s: string) => (s === "[data-undo-control]" ? control : null) };
  const outside = { closest: () => null };
  const fire = (target: EventTarget, type: string, props: Record<string, unknown> = {}) => {
    const ev = new Event(type);
    for (const [k, v] of Object.entries(props)) Object.defineProperty(ev, k, { value: v });
    target.dispatchEvent(ev);
  };
  return { doc, win, control, outside, fire };
}

describe("undo queue", () => {
  let env: ReturnType<typeof fakeEnv>;
  let q: UndoQueue;
  let commit: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    vi.useFakeTimers();
    env = fakeEnv();
    q = createUndoQueue({ doc: env.doc, win: env.win });
    commit = vi.fn<() => Promise<void>>(async () => undefined);
  });
  afterEach(() => {
    q.dispose();
    vi.useRealTimers();
  });

  const apply = (id = "apply:a", extra: Record<string, unknown> = {}) =>
    q.schedule({ id, label: "Application queued", commit, ...extra });

  it("undo before the window closes sends nothing, ever", async () => {
    const h = apply();
    expect(await h.undo()).toBe(true);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 3);
    expect(commit).not.toHaveBeenCalled();
    expect(h.phase).toBe("undone");
  });

  it("commits exactly once when the 10 s window lapses", async () => {
    const h = apply();
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(h.phase).toBe("committed");
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("undo after the commit is a no-op", async () => {
    const revert = vi.fn();
    const h = apply("apply:a", { revert });
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(await h.undo()).toBe(false);
    expect(revert).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("commits early on the next pointerdown elsewhere", async () => {
    apply();
    await vi.advanceTimersByTimeAsync(2000);
    env.fire(env.doc, "pointerdown", { target: env.outside });
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("commits early on a key press elsewhere, but not on Tab, modifiers or repeats", async () => {
    apply();
    env.fire(env.doc, "keydown", { target: env.outside, key: "Tab" });
    env.fire(env.doc, "keydown", { target: env.outside, key: "Shift" });
    env.fire(env.doc, "keydown", { target: env.outside, key: "Enter", repeat: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).not.toHaveBeenCalled();
    env.fire(env.doc, "keydown", { target: env.outside, key: "a" });
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Z is the undo gesture, so it does not end the window", async () => {
    apply();
    env.fire(env.doc, "keydown", { target: env.outside, key: "z", ctrlKey: true });
    env.fire(env.doc, "keydown", { target: env.outside, key: "Z", metaKey: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).not.toHaveBeenCalled();
  });

  it("an interaction with the Undo control does not end the window", async () => {
    apply();
    env.fire(env.doc, "pointerdown", { target: env.control });
    env.fire(env.doc, "keydown", { target: env.control, key: "Enter" });
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).not.toHaveBeenCalled();
  });

  it("pauses while held and resumes with the time that was left", async () => {
    apply();
    await vi.advanceTimersByTimeAsync(4000);
    q.hold("focus", true);
    expect(q.remainingMs("apply:a")).toBe(6000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(commit).not.toHaveBeenCalled();
    q.hold("focus", false);
    await vi.advanceTimersByTimeAsync(5999);
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("stays paused until every holder lets go", async () => {
    const h = apply();
    q.hold("hover", true);
    q.hold("focus", true);
    q.hold("hover", false);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(commit).not.toHaveBeenCalled();
    q.hold("focus", false);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(h.phase).toBe("committed");
  });

  it("handle pause and resume work on their own", async () => {
    const h = apply();
    await vi.advanceTimersByTimeAsync(1000);
    h.pause();
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(commit).not.toHaveBeenCalled();
    h.resume();
    await vi.advanceTimersByTimeAsync(9000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("flushes on pagehide and when the page becomes hidden", async () => {
    apply();
    env.fire(env.win, "pagehide");
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).toHaveBeenCalledTimes(1);

    const second = vi.fn<() => Promise<void>>(async () => undefined);
    q.schedule({ id: "apply:b", label: "x", commit: second });
    env.fire(env.doc, "visibilitychange");
    await vi.advanceTimersByTimeAsync(0);
    expect(second).not.toHaveBeenCalled(); // still visible
    env.doc.visibilityState = "hidden";
    env.fire(env.doc, "visibilitychange");
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("flushAll (a route change) commits what is open", async () => {
    apply();
    await q.flushAll();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("a double click never double-sends", async () => {
    const a = apply();
    const b = apply();
    expect(b).toBe(a);
    await Promise.all([a.flush(), b.flush(), q.flushAll()]);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("scheduling a second action commits the first rather than stacking windows", async () => {
    apply("apply:a");
    const second = vi.fn<() => Promise<void>>(async () => undefined);
    q.schedule({ id: "apply:b", label: "b", commit: second });
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("a reversible action applies at once and Undo reverts it", async () => {
    const state = { saved: false };
    const h = q.schedule({
      id: "save:x",
      label: "Saved",
      optimistic: () => {
        state.saved = true;
      },
      revert: () => {
        state.saved = false;
      },
      commit,
    });
    expect(state.saved).toBe(true);
    expect(await h.undo()).toBe(true);
    expect(state.saved).toBe(false);
  });

  it("revert waits for an async optimistic step to finish", async () => {
    const order: string[] = [];
    const h = q.schedule({
      id: "save:y",
      label: "Saved",
      optimistic: async () => {
        await new Promise((r) => setTimeout(r, 500));
        order.push("saved");
      },
      revert: async () => {
        order.push("reverted");
      },
      commit,
    });
    const undone = h.undo();
    await vi.advanceTimersByTimeAsync(600);
    await undone;
    expect(order).toEqual(["saved", "reverted"]);
  });

  it("a failing commit is reported, swallowed, and can be retried", async () => {
    const phases: string[] = [];
    const failing = vi.fn<() => Promise<void>>(async () => {
      throw new Error("offline");
    });
    q.schedule({ id: "apply:z", label: "z", commit: failing, onPhase: (p) => phases.push(p) });
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(phases).toEqual(["pending", "committing", "failed"]);
    // The failed run is gone, so a new tap schedules a fresh one.
    const again = q.schedule({ id: "apply:z", label: "z", commit });
    expect(again.phase).toBe("pending");
  });

  it("tells listeners how each action ended", async () => {
    const ended: string[] = [];
    q.onFinal((f) => ended.push(`${f.id}:${f.phase}`));
    await apply("apply:a").undo();
    apply("apply:b");
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(ended).toEqual(["apply:a:undone", "apply:b:committed"]);
  });

  it("publishes a view for the UI and clears it when the window closes", async () => {
    const seen: number[] = [];
    q.subscribe(() => seen.push(q.getView().length));
    apply();
    expect(q.getView()[0]).toMatchObject({
      id: "apply:a",
      announce: "Application queued. Undo available for 10 seconds",
      phase: "pending",
    });
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(q.getView()).toHaveLength(0);
    expect(seen.length).toBeGreaterThan(1);
  });
});
