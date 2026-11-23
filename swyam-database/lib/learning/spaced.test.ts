import { describe, expect, it } from "vitest";
import {
  BOX_DAYS,
  DAY_MS,
  MAX_PER_SESSION,
  dueToday,
  freshState,
  isDue,
  pickSession,
  pruneMastered,
  review,
  type SpacedState,
} from "./spaced";

const NOW = new Date(2026, 9, 6, 10, 0, 0).getTime();
const item = (id: string, over: Partial<SpacedState> = {}) => ({
  id,
  ...freshState(NOW - 10 * DAY_MS),
  ...over,
});

describe("spaced scheduler", () => {
  it("uses boxes of 1, 3, 7 and 21 days", () => {
    expect([...BOX_DAYS]).toEqual([1, 3, 7, 21]);
    let s = freshState(NOW);
    expect(s).toMatchObject({ box: 1, dueAt: NOW + DAY_MS });
    s = review(s, true, NOW);
    expect(s).toMatchObject({ box: 2, dueAt: NOW + 3 * DAY_MS });
    s = review(s, true, NOW);
    expect(s).toMatchObject({ box: 3, dueAt: NOW + 7 * DAY_MS });
    s = review(s, true, NOW);
    expect(s).toMatchObject({ box: 4, dueAt: NOW + 21 * DAY_MS, mastered: false });
  });

  it("a wrong answer goes back to box 1 from anywhere", () => {
    const s = review({ box: 3, dueAt: 0, mastered: false }, false, NOW);
    expect(s).toMatchObject({ box: 1, dueAt: NOW + DAY_MS, mastered: false });
  });

  it("right in box 4 is mastered", () => {
    const s = review({ box: 4, dueAt: 0, mastered: false }, true, NOW);
    expect(s.mastered).toBe(true);
    expect(s.masteredAt).toBe(NOW);
  });

  it("lists due-today items soonest first and never mastered ones", () => {
    const items = [
      item("late", { dueAt: NOW + 20 * 3600_000 }),
      item("past", { dueAt: NOW - DAY_MS }),
      item("tomorrow", { dueAt: NOW + 2 * DAY_MS }),
      item("done", { dueAt: NOW - DAY_MS, mastered: true, masteredAt: NOW }),
    ];
    const ids = dueToday(items, NOW).map((i) => i.id);
    expect(ids).toContain("past");
    expect(ids).not.toContain("tomorrow");
    expect(ids).not.toContain("done");
    expect(ids[0]).toBe("past");
    expect(isDue(items[1], NOW)).toBe(true);
    expect(isDue(items[2], NOW)).toBe(false);
  });

  it("caps a session at 5 and only tops up with not-due items on request", () => {
    const due = Array.from({ length: 8 }, (_, n) => item(`d${n}`, { dueAt: NOW - n * 1000 }));
    expect(pickSession(due, NOW)).toHaveLength(MAX_PER_SESSION);
    expect(pickSession(due, NOW, { max: 99 })).toHaveLength(5);

    const few = [item("a", { dueAt: NOW - 1 }), item("b", { dueAt: NOW + DAY_MS })];
    expect(pickSession(few, NOW).map((i) => i.id)).toEqual(["a"]);
    expect(pickSession(few, NOW, { includeNotDue: true }).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("fades mastered items out after a month", () => {
    const old = item("old", { mastered: true, masteredAt: NOW - 31 * DAY_MS });
    const recent = item("recent", { mastered: true, masteredAt: NOW - 2 * DAY_MS });
    expect(pruneMastered([old, recent, item("open")], NOW).map((i) => i.id)).toEqual([
      "recent",
      "open",
    ]);
  });
});
