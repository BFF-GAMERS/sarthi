import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAREER_SLUGS, CAREER_TEST_DRIVE, DRIVE_LABELS } from "./career-test-drive";
import { courses } from "./mock";
import { clearDrive, loadDrive, saveDrive, summarise } from "../lib/learning/testdrive";

describe("career test drive seed data", () => {
  it("covers at least six careers, each a real slug, no repeats", () => {
    const slugs = CAREER_TEST_DRIVE.map((c) => c.slug);
    expect(slugs.length).toBeGreaterThanOrEqual(6);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(CAREER_SLUGS as readonly string[]).toContain(s);
  });

  it("has 2 or 3 tasks per career, 3 to 5 minutes each, with unique ids", () => {
    const ids = new Set<string>();
    for (const c of CAREER_TEST_DRIVE) {
      expect(c.tasks.length).toBeGreaterThanOrEqual(2);
      expect(c.tasks.length).toBeLessThanOrEqual(3);
      for (const t of c.tasks) {
        expect(ids.has(t.id)).toBe(false);
        ids.add(t.id);
        expect([3, 4, 5]).toContain(t.minutes);
        expect(t.scenario.length).toBeGreaterThan(20);
        expect(t.prompt.length).toBeGreaterThan(5);
      }
    }
  });

  it("choice tasks have a valid answer and a reason per option; self-checks have a model and rubric", () => {
    for (const c of CAREER_TEST_DRIVE) {
      for (const t of c.tasks) {
        if (t.kind === "choice") {
          expect(t.options?.length ?? 0).toBeGreaterThanOrEqual(2);
          expect(t.answer).toBeGreaterThanOrEqual(0);
          expect(t.answer).toBeLessThan(t.options?.length ?? 0);
          for (const o of t.options ?? []) expect(o.why.length).toBeGreaterThan(10);
        } else {
          expect(t.model?.length ?? 0).toBeGreaterThan(20);
          expect((t.rubric ?? []).length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("every next-step course exists in the catalogue, and each career has one", () => {
    const known = new Set(courses.map((c) => c.id));
    for (const c of CAREER_TEST_DRIVE) {
      expect(c.courses.length).toBeGreaterThan(0);
      for (const k of c.courses) expect(known.has(k.id)).toBe(true);
    }
  });

  it("carries the honest labels", () => {
    expect([...DRIVE_LABELS]).toEqual([
      "A taste, not a test of you",
      "Not a certificate",
      "No hiring signal",
      "Stays on this device",
    ]);
  });
});

describe("test drive store", () => {
  const m = new Map<string, string>();
  beforeEach(() => {
    m.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("saves per profile, summarises by feel, and a retake clears it", () => {
    const career = CAREER_TEST_DRIVE.find((c) => c.tasks.length === 3);
    if (!career) throw new Error("expected a career with three tasks");
    const [a, b, c] = career.tasks;
    const answers = {
      [a.id]: { feel: "enjoyed" as const, pick: 1 },
      [b.id]: { feel: "tricky" as const },
      [c.id]: { feel: "ok" as const },
    };
    expect(saveDrive("p1", career.slug, { ts: 1, answers })).toBe(true);
    expect(loadDrive("p2", career.slug)).toBeNull();
    const saved = loadDrive("p1", career.slug);
    expect(saved).not.toBeNull();
    const s = summarise(career, saved!);
    expect(s.enjoyed.map((t) => t.id)).toEqual([a.id]);
    expect(s.tricky.map((t) => t.id)).toEqual([b.id]);
    clearDrive("p1", career.slug);
    expect(loadDrive("p1", career.slug)).toBeNull();
    expect(m.size).toBe(0);
  });
});
