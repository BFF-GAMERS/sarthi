import { describe, expect, it, vi } from "vitest";
import {
  DOUBLE_TAP_MS,
  createClickGuard,
  isDoubleTap,
  isIrreversibleLabel,
  needsConfirm,
  type ControlLike,
} from "./steady-guard";

/** A control that answers `closest` the way the guard asks it. `skip` makes it sit inside an Undo control. */
function el(
  opts: { text?: string; attrs?: Record<string, string>; skip?: boolean } = {},
): ControlLike {
  const self: ControlLike = {
    textContent: opts.text ?? "",
    getAttribute: (n) => opts.attrs?.[n] ?? null,
    closest(sel: string) {
      if (sel.includes("data-undo-control")) return opts.skip ? self : null;
      return self;
    },
  };
  return self;
}

function click(target: ControlLike, detail = 1) {
  return {
    target,
    detail,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
}

describe("isDoubleTap", () => {
  it("ignores a second click on the same target inside 350ms only", () => {
    const a = {};
    expect(isDoubleTap({ target: a, t: 1000 }, a, 1000 + DOUBLE_TAP_MS - 1)).toBe(true);
    expect(isDoubleTap({ target: a, t: 1000 }, a, 1000 + DOUBLE_TAP_MS)).toBe(false);
    expect(isDoubleTap({ target: a, t: 1000 }, {}, 1100)).toBe(false);
    expect(isDoubleTap(null, a, 1100)).toBe(false);
  });
});

describe("irreversible labels", () => {
  it.each(["Delete", "Remove saved", "Withdraw application", "Clear all", "Sign out"])(
    "asks for %s",
    (label) => expect(isIrreversibleLabel(label)).toBe(true),
  );
  it.each(["Save", "Apply", "Open", ""])("does not ask for %s", (label) =>
    expect(isIrreversibleLabel(label)).toBe(false),
  );
  it("ignores long text that merely contains the word", () => {
    expect(
      isIrreversibleLabel("Read how we remove duplicate listings from your results feed"),
    ).toBe(false);
  });
  it("honours data-irreversible, and data-irreversible=false", () => {
    expect(needsConfirm(el({ text: "Go", attrs: { "data-irreversible": "" } }))).toBe(true);
    expect(needsConfirm(el({ text: "Delete", attrs: { "data-irreversible": "false" } }))).toBe(
      false,
    );
  });
});

describe("click guard", () => {
  const make = (active = true) => {
    let now = 0;
    const ask = vi.fn();
    const guard = createClickGuard({ isActive: () => active, now: () => now, ask });
    return { guard, ask, at: (t: number) => (now = t) };
  };

  it("blocks the second click within 350ms and lets the next one through after", () => {
    const { guard, at } = make();
    const b = el({ text: "Save" });
    at(0);
    expect(guard.handle(click(b), vi.fn())).toBe("pass");
    at(200);
    const second = click(b);
    expect(guard.handle(second, vi.fn())).toBe("blocked-double");
    expect(second.preventDefault).toHaveBeenCalled();
    expect(second.stopImmediatePropagation).toHaveBeenCalled();
    at(400);
    expect(guard.handle(click(b), vi.fn())).toBe("pass");
  });
  it("lets different controls through at once", () => {
    const { guard, at } = make();
    at(0);
    guard.handle(click(el({ text: "A" })), vi.fn());
    at(50);
    expect(guard.handle(click(el({ text: "B" })), vi.fn())).toBe("pass");
  });
  it("does nothing when steady hands is off", () => {
    const { guard, ask, at } = make(false);
    const b = el({ text: "Delete" });
    at(0);
    expect(guard.handle(click(b), vi.fn())).toBe("pass");
    at(10);
    expect(guard.handle(click(b), vi.fn())).toBe("pass");
    expect(ask).not.toHaveBeenCalled();
  });
  it("asks before an irreversible click and replays it once when confirmed", () => {
    const { guard, ask } = make();
    const b = el({ text: "Delete account" });
    const replay = vi.fn();
    const e = click(b);
    expect(guard.handle(e, replay)).toBe("blocked-confirm");
    expect(e.preventDefault).toHaveBeenCalled();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(replay).not.toHaveBeenCalled();
    // The person says yes: the dialog calls proceed, which replays the click on the control.
    const proceed = ask.mock.calls[0][2] as () => void;
    proceed();
    expect(replay).toHaveBeenCalledWith(b);
    // The replayed click passes untouched, and only once.
    expect(guard.handle(click(b, 0), vi.fn())).toBe("pass");
    expect(guard.handle(click(b, 0), vi.fn())).toBe("blocked-confirm");
  });
  it("never blocks the Undo control or anything marked undoable", () => {
    const { guard, ask, at } = make();
    const undo = el({ text: "Undo delete", skip: true });
    at(0);
    expect(guard.handle(click(undo), vi.fn())).toBe("pass");
    at(10);
    expect(guard.handle(click(undo), vi.fn())).toBe("pass");
    expect(ask).not.toHaveBeenCalled();
  });
  it("does not treat a keyboard or programmatic click (detail 0) as a double tap", () => {
    const { guard, at } = make();
    const b = el({ text: "Next" });
    at(0);
    guard.handle(click(b, 0), vi.fn());
    at(50);
    expect(guard.handle(click(b, 0), vi.fn())).toBe("pass");
  });
});
