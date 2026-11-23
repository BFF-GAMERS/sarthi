import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWrongEntries } from "./capture";
import {
  MISTAKE_CAP,
  MISTAKES_KEY,
  applyReview,
  clearAllMistakes,
  clearScope,
  exportMistakes,
  loadMistakes,
  recordWrong,
  remindersOn,
  removeMistake,
  scopeFor,
  setRemindersOn,
  type WrongEntry,
} from "./mistakes";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const entry = (n: number, over: Partial<WrongEntry> = {}): WrongEntry => ({
  assessmentId: "a1",
  questionId: `q${n}`,
  question: `Question ${n}?`,
  options: ["x", "y", "z"],
  chosenIndex: 1,
  chosen: "y",
  source: "Test check",
  ...over,
});

beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("capture", () => {
  const questions = [
    { id: "q1", prompt: "One?", options: ["a", "b", "c"] },
    { id: "q2", prompt: "Two?", options: ["a", "b", "c"] },
    { id: "q3", prompt: "Three?", options: ["a", "b", "c"] },
    { id: "q4", prompt: "Four?", options: [] },
  ];
  const base = { assessmentId: "as", source: "S", questions };

  it("keeps only answered questions the server marked wrong", () => {
    const out = buildWrongEntries({
      ...base,
      answers: { q1: 0, q2: 2, q4: 0 },
      correctness: { q1: true, q2: false, q3: false, q4: false },
    });
    expect(out.map((e) => e.questionId)).toEqual(["q2"]);
    expect(out[0]).toMatchObject({ chosen: "c", chosenIndex: 2 });
  });

  it("saves nothing without verdicts, and the correct option only when exposed", () => {
    expect(buildWrongEntries({ ...base, answers: { q1: 0 }, correctness: {} })).toEqual([]);
    expect(
      buildWrongEntries({ ...base, answers: { q1: 0 }, correctness: { q1: false } })[0],
    ).not.toHaveProperty("correct");
    expect(
      buildWrongEntries({
        ...base,
        answers: { q1: 0 },
        correctness: { q1: false },
        correctOptions: { q1: 2 },
      })[0]?.correct,
    ).toBe("c");
  });

  it("never stores a score or a pass flag", () => {
    recordWrong(
      "p1",
      buildWrongEntries({ ...base, answers: { q1: 0 }, correctness: { q1: false } }),
    );
    const raw = localStorage.getItem(MISTAKES_KEY) ?? "";
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).not.toMatch(/score|passed/i);
  });
});

describe("store", () => {
  it("scopes per profile and falls back to guest", () => {
    expect(scopeFor(null)).toBe("guest");
    recordWrong("p1", [entry(1)]);
    recordWrong("p2", [entry(2)]);
    expect(loadMistakes("p1").map((i) => i.questionId)).toEqual(["q1"]);
    expect(loadMistakes("p2").map((i) => i.questionId)).toEqual(["q2"]);
  });

  it("a repeat miss resets to box 1 instead of duplicating", () => {
    const t = 1_000_000;
    recordWrong("p1", [entry(1)], t);
    applyReview("p1", "a1:q1", true, t);
    expect(loadMistakes("p1", t)[0]?.box).toBe(2);
    recordWrong("p1", [entry(1)], t + 10);
    const list = loadMistakes("p1", t + 10);
    expect(list).toHaveLength(1);
    expect(list[0]?.box).toBe(1);
  });

  it("caps at 200, dropping the oldest first", () => {
    const t = 5_000_000;
    for (let n = 0; n < MISTAKE_CAP + 15; n++) recordWrong("p1", [entry(n)], t + n);
    const list = loadMistakes("p1", t + 1000);
    expect(list).toHaveLength(MISTAKE_CAP);
    expect(list.some((i) => i.questionId === "q0")).toBe(false);
    expect(list.some((i) => i.questionId === `q${MISTAKE_CAP + 14}`)).toBe(true);
  });

  it("removes one, clears a profile, clears everything, and exports without internal ids", () => {
    recordWrong("p1", [entry(1), entry(2)]);
    recordWrong("p2", [entry(3)]);
    removeMistake("p1", "a1:q1");
    expect(loadMistakes("p1")).toHaveLength(1);
    const out = JSON.parse(exportMistakes("p1")) as { notebook: Array<Record<string, string>> };
    expect(out.notebook[0]).toMatchObject({ question: "Question 2?", yourAnswer: "y" });
    expect(JSON.stringify(out)).not.toContain("a1:q2");
    clearScope("p1");
    expect(loadMistakes("p1")).toEqual([]);
    expect(loadMistakes("p2")).toHaveLength(1);
    clearAllMistakes();
    expect(loadMistakes("p2")).toEqual([]);
    expect(localStorage.getItem(MISTAKES_KEY)).toBeNull();
  });

  it("reminders are off by default", () => {
    expect(remindersOn()).toBe(false);
    setRemindersOn(true);
    expect(remindersOn()).toBe(true);
    setRemindersOn(false);
    expect(remindersOn()).toBe(false);
  });

  it("survives corrupt or blocked storage", () => {
    localStorage.setItem(MISTAKES_KEY, "{not json");
    expect(loadMistakes("p1")).toEqual([]);
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(loadMistakes("p1")).toEqual([]);
    expect(recordWrong("p1", [entry(1)])).toBe(0);
    expect(() => clearAllMistakes()).not.toThrow();
  });
});
