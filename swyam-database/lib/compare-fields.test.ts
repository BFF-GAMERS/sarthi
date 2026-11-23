import { describe, expect, it } from "vitest";
import type { Course } from "../data/mock";
import type { Opportunity } from "./opportunities";
import {
  compareHref,
  compareSearch,
  courseRows,
  feeNumber,
  groupOf,
  opportunityRows,
  parseCompareParams,
  valuesDiffer,
  type CourseFactHelpers,
} from "./compare-fields";

const tx = (s: string) => s;

describe("parseCompareParams", () => {
  it("accepts 2 and 3 ids, trims and de-duplicates", () => {
    expect(parseCompareParams({ kind: "job", ids: "a,b" })).toEqual({
      ok: true,
      kind: "job",
      ids: ["a", "b"],
    });
    expect(
      parseCompareParams({ kind: "course", ids: " course-a , course-b ,course-a,course-c," }),
    ).toEqual({
      ok: true,
      kind: "course",
      ids: ["course-a", "course-b", "course-c"],
    });
    expect(parseCompareParams({ kind: "internship", ids: ["a", "b,c"] })).toEqual({
      ok: true,
      kind: "internship",
      ids: ["a", "b", "c"],
    });
  });

  it("rejects an unknown or missing kind", () => {
    expect(parseCompareParams({ kind: "gig", ids: "a,b" })).toEqual({ ok: false, reason: "kind" });
    expect(parseCompareParams({ ids: "a,b" })).toEqual({ ok: false, reason: "kind" });
    expect(parseCompareParams({ kind: ["job"], ids: "a,b" })).toEqual({
      ok: false,
      reason: "kind",
    });
  });

  it("rejects bad ids", () => {
    for (const ids of ["a,B", "a,b c", "a,../x", "a,<b>", "a,b;c", `a,${"x".repeat(81)}`]) {
      expect(parseCompareParams({ kind: "job", ids }).ok).toBe(false);
    }
    expect(parseCompareParams({ kind: "job", ids: `a,${"x".repeat(80)}` }).ok).toBe(true);
    expect(parseCompareParams({ kind: "job", ids: ["a", { x: 1 }] }).ok).toBe(false);
  });

  it("rejects more than three and fewer than two", () => {
    expect(parseCompareParams({ kind: "job", ids: "a,b,c,d" })).toEqual({
      ok: false,
      reason: "too-many",
    });
    expect(parseCompareParams({ kind: "job", ids: "a" })).toEqual({ ok: false, reason: "too-few" });
    expect(parseCompareParams({ kind: "job", ids: "a,a" })).toEqual({
      ok: false,
      reason: "too-few",
    });
    expect(parseCompareParams({ kind: "job", ids: "" })).toEqual({ ok: false, reason: "too-few" });
    expect(parseCompareParams({ kind: "job" })).toEqual({ ok: false, reason: "too-few" });
  });

  it("can be lenient about the minimum, for a link removed down to one", () => {
    expect(parseCompareParams({ kind: "job", ids: "a" }, { min: 1 })).toEqual({
      ok: true,
      kind: "job",
      ids: ["a"],
    });
    // The router can hand back a lone numeric-looking id as a number.
    expect(parseCompareParams({ kind: "job", ids: 7 }, { min: 1 })).toEqual({
      ok: true,
      kind: "job",
      ids: ["7"],
    });
  });

  it("allows colons, underscores and digits in an id", () => {
    expect(parseCompareParams({ kind: "job", ids: "uuid:1_a-2,b" }).ok).toBe(true);
  });
});

describe("the route's validateSearch", () => {
  it("passes a good link through as strings", () => {
    expect(compareSearch({ kind: "job", ids: "a,b" })).toEqual({ kind: "job", ids: "a,b" });
    expect(compareSearch({ kind: "course", ids: "x" })).toEqual({ kind: "course", ids: "x" });
  });
  it("drops anything invalid", () => {
    expect(compareSearch({ kind: "nope", ids: "a,b" })).toEqual({});
    expect(compareSearch({ kind: "job", ids: "a,b,c,d" })).toEqual({});
    expect(compareSearch({})).toEqual({});
  });
});

describe("compareHref", () => {
  it("round-trips through the parser", () => {
    const href = compareHref("internship", ["a-1", "b:2"]);
    expect(href).toBe("/compare?kind=internship&ids=a-1,b:2");
    const q = new URL(href, "https://x.test").searchParams;
    expect(parseCompareParams({ kind: q.get("kind"), ids: q.get("ids") })).toEqual({
      ok: true,
      kind: "internship",
      ids: ["a-1", "b:2"],
    });
  });
});

describe("groups", () => {
  it("compares jobs with internships, courses with courses", () => {
    expect(groupOf("job")).toBe("opportunity");
    expect(groupOf("internship")).toBe("opportunity");
    expect(groupOf("course")).toBe("course");
  });
});

describe("valuesDiffer", () => {
  it("ignores case and spacing, notices real differences", () => {
    expect(valuesDiffer(["Remote", " remote "])).toBe(false);
    expect(valuesDiffer(["Remote", "Hybrid"])).toBe(true);
    expect(valuesDiffer(["—", "—", "—"])).toBe(false);
  });
});

const opp = (over: Partial<Opportunity>): Opportunity => ({
  id: over.slug ?? "x",
  slug: "x",
  title: "Role",
  kind: "job",
  workMode: "onsite",
  location: "Pune",
  region: null,
  summary: null,
  description: null,
  responsibilities: [],
  eligibility: null,
  payPeriod: "month",
  applyUrl: null,
  applyUrlStatus: null,
  applyUrlCheckedAt: null,
  details: {},
  skills: [],
  openings: 1,
  applicationCount: 0,
  salaryMin: null,
  salaryMax: null,
  stipend: null,
  isPaid: true,
  durationWeeks: null,
  hoursPerWeek: null,
  deadline: null,
  postedAt: null,
  updatedAt: null,
  employer: null,
  ...over,
});

const byId = (rows: ReturnType<typeof opportunityRows>, id: string) =>
  rows.find((r) => r.id === id);
const NOW = Date.parse("2026-10-01T00:00:00Z");

describe("opportunityRows", () => {
  const a = opp({
    slug: "a",
    location: "Pune",
    workMode: "onsite",
    salaryMin: 20000,
    salaryMax: 30000,
    openings: 2,
    skills: ["Python", "SQL"],
    deadline: "2026-10-11T00:00:00Z",
    employer: {
      id: "1",
      slug: "e1",
      name: "Acme",
      logoUrl: null,
      industry: null,
      headquarters: null,
      isVerified: true,
    },
  });
  const b = opp({
    slug: "b",
    location: "Pune",
    workMode: "remote",
    salaryMin: 40000,
    salaryMax: 50000,
    openings: 5,
    skills: ["sql", "Excel"],
    deadline: "2026-10-31T00:00:00Z",
    employer: {
      id: "2",
      slug: "e2",
      name: "Beta",
      logoUrl: null,
      industry: null,
      headquarters: null,
      isVerified: false,
    },
  });
  const rows = opportunityRows([a, b], tx, NOW);

  it("flags rows that differ and not rows that do not", () => {
    expect(byId(rows, "location")?.differs).toBe(false);
    expect(byId(rows, "mode")?.differs).toBe(true);
    expect(byId(rows, "employer")?.differs).toBe(true);
    expect(byId(rows, "type")?.differs).toBe(false);
  });

  it("gives one value per item, in order", () => {
    expect(byId(rows, "employer")?.values).toEqual(["Acme", "Beta"]);
    expect(byId(rows, "pay")?.values[0]).toContain("20,000");
  });

  it("hints the best only where numbers are comparable", () => {
    const pay = byId(rows, "pay")!;
    expect(pay.best).toEqual([1]);
    expect(pay.bestHint).toBe("Highest pay");
    expect(byId(rows, "openings")?.best).toEqual([1]);
    expect(byId(rows, "deadline")?.best).toEqual([1]);
    expect(byId(rows, "deadline")?.values[0]).toContain("10 days left");
  });

  it("does not rank pay across different periods or when one is unstated", () => {
    const yearly = opp({ slug: "c", payPeriod: "year", salaryMin: 600000, salaryMax: 900000 });
    expect(byId(opportunityRows([a, yearly], tx, NOW), "pay")?.best).toBeUndefined();
    const none = opp({ slug: "d" });
    const r = byId(opportunityRows([a, none], tx, NOW), "pay")!;
    expect(r.best).toBeUndefined();
    expect(r.values[1]).toBe("Not stated");
  });

  it("finds the skills the listings share, case-insensitively", () => {
    expect(byId(rows, "skills-common")?.span).toBe("SQL");
    const none = opportunityRows([a, opp({ slug: "e", skills: ["Welding"] })], tx, NOW);
    expect(byId(none, "skills-common")?.span).toBe("None in common");
  });

  it("drops a row nobody has a value for", () => {
    expect(byId(rows, "experience")).toBeUndefined();
    expect(byId(rows, "duration")).toBeUndefined();
  });

  it("marks a closed deadline", () => {
    const old = opp({ slug: "f", deadline: "2026-09-01T00:00:00Z" });
    expect(byId(opportunityRows([old, a], tx, NOW), "deadline")?.values[0]).toContain("closed");
  });
});

describe("courseRows", () => {
  const facts: CourseFactHelpers = {
    feeLine: (c) => (c.free ? "Free" : c.fees),
    startLine: () => "Any time",
    hoursPerWeek: () => null,
    orgName: (id) => `Org ${id}`,
  };
  const course = (over: Partial<Course>): Course =>
    ({
      id: "c1",
      title: "C",
      orgId: "o1",
      duration: "4 months",
      fees: "₹2,999",
      free: false,
      scholarship: false,
      difficulty: "Beginner",
      placementAssistance: true,
      category: "Tech",
      mode: "Online",
      state: "MH",
      city: "Pune",
      outcomes: ["One", "Two"],
      ...over,
    }) as Course;

  it("reads fees as numbers, free as zero", () => {
    expect(feeNumber(course({ free: true, fees: "Free" }))).toBe(0);
    expect(feeNumber(course({ fees: "₹12,500" }))).toBe(12500);
    expect(feeNumber(course({ fees: "On request" }))).toBeNull();
  });

  it("flags differences and hints the lowest fee in words", () => {
    const rows = courseRows(
      [course({ id: "a", fees: "₹2,999" }), course({ id: "b", free: true, fees: "Free" })],
      tx,
      facts,
    );
    const fee = rows.find((r) => r.id === "fee")!;
    expect(fee.differs).toBe(true);
    expect(fee.best).toEqual([1]);
    expect(fee.bestHint).toBe("Lowest fee");
    expect(rows.find((r) => r.id === "mode")!.differs).toBe(false);
    expect(rows.find((r) => r.id === "cert")!.values).toEqual(["Org o1", "Org o1"]);
  });

  it("gives no hint when the fees are the same", () => {
    const rows = courseRows([course({ id: "a" }), course({ id: "b" })], tx, facts);
    expect(rows.find((r) => r.id === "fee")!.best).toBeUndefined();
  });
});
