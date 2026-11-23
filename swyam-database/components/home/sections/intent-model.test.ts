import { describe, expect, it } from "vitest";
import { SAMPLE_MIN_INTERNSHIPS, SAMPLE_MIN_JOBS, sampleOpenings } from "@/data/mock";
import { PERSONAS } from "@/evolution/core/fixtures/journeys";
import type { HomeLayout } from "@/evolution/types";
import { courseTeaches, coursesForTag, normTag } from "@/lib/skill-courses";
import { resolveEntity, type EntityView } from "../resolve";
import { buildIntentLane, rankByViews, tagUniverse, type IntentLane } from "./intent-model";

const OPENINGS = [...sampleOpenings];
const view = (id: string): EntityView => {
  const v = resolveEntity(id, OPENINGS);
  if (!v) throw new Error(`unresolved ${id}`);
  return v;
};
// Newest first, like the behaviour log.
const CAREER = [
  "opp_hr-assistant",
  "opp_content-intern",
  "opp_data-entry",
  "opp_design-intern",
  "opp_sales-trainee",
  "opp_marketing-intern",
  "opp_support-associate",
  "opp_junior-analyst",
].map(view);

const lane = (
  layout: HomeLayout,
  extra: Partial<Parameters<typeof buildIntentLane>[0]> = {},
): IntentLane =>
  buildIntentLane({
    views: CAREER,
    openings: OPENINGS,
    layout,
    signedIn: false,
    mySkills: [],
    ...extra,
  });

const ready = (l: IntentLane) => {
  if (l.status !== "ready") throw new Error("expected a ready lane");
  return l;
};

describe("sample openings", () => {
  const jobs = sampleOpenings.filter((o) => o.kind === "job");
  const internships = sampleOpenings.filter((o) => o.kind === "internship");

  it("seed at least 12 jobs and 8 internships, each with skill tags", () => {
    expect(jobs.length).toBeGreaterThanOrEqual(SAMPLE_MIN_JOBS);
    expect(internships.length).toBeGreaterThanOrEqual(SAMPLE_MIN_INTERNSHIPS);
    for (const o of sampleOpenings) expect(o.skills.length, o.slug).toBeGreaterThanOrEqual(3);
  });

  it("are labelled, unique, carry no invented pay or deadline, and name no real employer", () => {
    expect(new Set(sampleOpenings.map((o) => o.slug)).size).toBe(sampleOpenings.length);
    for (const o of sampleOpenings) {
      expect(o.id.startsWith("sample:")).toBe(true);
      expect(o.salaryMin ?? o.salaryMax ?? o.stipend ?? o.deadline).toBeNull();
      expect(o.employer?.name).toBe("Sample employer");
    }
  });

  it("cover every opening the Lab's career persona views, so that journey resolves", () => {
    const slugs = new Set(sampleOpenings.map((o) => o.slug));
    const viewed = (PERSONAS["career-seeker"].sessions.flat() as { entityId?: string }[])
      .map((e) => e.entityId)
      .filter((id): id is string => Boolean(id?.startsWith("opp_")))
      .map((id) => id.slice(4));
    for (const slug of viewed) expect(slugs.has(slug), slug).toBe(true);
  });

  it("a sample links to its list page, never to a detail page that does not exist", () => {
    const v = view("opp_junior-analyst");
    expect(v.href).toBe("/jobs#sample-junior-analyst");
    expect(view("opp_design-intern").href).toBe("/internships#sample-design-intern");
  });
});

describe("tags", () => {
  it("normalise the same skill spelled differently", () => {
    expect(normTag("MS Excel")).toBe("excel");
    expect(normTag("Customer Service")).toBe("customer support");
    expect(normTag("  SQL ")).toBe("sql");
  });

  it("find real courses for the skills the career journey asks for", () => {
    expect(coursesForTag("excel").length).toBeGreaterThan(0);
    expect(coursesForTag("sales").length).toBeGreaterThan(0);
    for (const c of coursesForTag("marketing")) expect(courseTeaches(c, "marketing")).toBe(true);
  });
});

describe("the lane", () => {
  it("builds Learn, Prove and Apply from the tags that recur, each with a receipt", () => {
    const l = ready(lane("CAREER_DISCOVERY"));
    expect(l.steps.map((s) => s.kind)).toEqual(["learn", "prove", "apply"]);
    for (const s of l.steps) {
      expect(s.receipt.length).toBeGreaterThan(10);
      expect(s.href).toMatch(/^\//);
      expect(s.cta.length).toBeGreaterThan(0);
    }
    expect(l.tags.length).toBeGreaterThanOrEqual(2);
  });

  it("puts a specific gap ahead of an everyday skill, and the receipt counts the roles viewed", () => {
    const l = ready(lane("CAREER_DISCOVERY"));
    expect(l.focus.tag).toBe("excel");
    expect(l.steps[0]?.receipt).toMatch(/^Asked for in \d+ jobs? .*you viewed$/);
    expect(l.tags.map((t) => t.tag)).toContain("communication");
  });

  it("adds a Swap step in the skill-exchange layout and an Ask step in the community layout", () => {
    expect(ready(lane("SKILL_EXCHANGE_HUB")).steps.map((s) => s.kind)).toEqual([
      "learn",
      "swap",
      "prove",
      "apply",
    ]);
    expect(ready(lane("COMMUNITY_HUB")).steps.map((s) => s.kind)).toEqual([
      "learn",
      "ask",
      "prove",
      "apply",
    ]);
  });

  it("renders with at least 2 steps and receipts in every layout", () => {
    for (const layout of [
      "UNIVERSAL",
      "LEARNING_HUB",
      "CAREER_DISCOVERY",
      "SKILL_EXCHANGE_HUB",
      "COMMUNITY_HUB",
      "DISCOVERY",
    ] as HomeLayout[]) {
      const l = ready(lane(layout));
      expect(l.steps.length, layout).toBeGreaterThanOrEqual(2);
      for (const s of l.steps) expect(s.receipt, `${layout} ${s.kind}`).toBeTruthy();
    }
  });

  it("never offers back something the visitor already viewed", () => {
    const l = ready(lane("CAREER_DISCOVERY"));
    const apply = l.steps.find((s) => s.kind === "apply");
    const viewed = CAREER.map((v) => v.id);
    expect(apply).toBeDefined();
    for (const id of viewed) expect(apply?.href).not.toContain(id);
    expect(apply?.sample).toBe(true);
  });

  it("shows no percentage to a visitor, anywhere", () => {
    for (const layout of [
      "CAREER_DISCOVERY",
      "SKILL_EXCHANGE_HUB",
      "COMMUNITY_HUB",
    ] as HomeLayout[])
      expect(JSON.stringify(lane(layout))).not.toMatch(/\d\s?%|\bmatch\b/i);
  });

  it("counts a signed-in member's own skills, and treats the ones they hold as already learned", () => {
    const member = ready(
      lane("CAREER_DISCOVERY", { signedIn: true, mySkills: ["Excel", "Communication"] }),
    );
    expect(member.focus.tag).not.toBe("excel");
    // held skills rank last, so they fall out of the four shown
    expect(member.tags.every((t) => !t.held)).toBe(true);
    const apply = member.steps.find((s) => s.kind === "apply");
    expect(apply?.receipt).toMatch(/^You list \d+ of the \d+ skills it asks for$/);
  });

  it("is empty until two tags recur, and says how many it has", () => {
    expect(lane("CAREER_DISCOVERY", { views: [] }).status).toBe("empty");
    expect(lane("CAREER_DISCOVERY", { views: [view("opp_junior-analyst")] }).status).toBe("empty");
    // two roles that share exactly one skill (communication) are still not a pattern
    const one = lane("CAREER_DISCOVERY", {
      views: [view("opp_design-intern"), view("opp_support-associate")],
    });
    expect(one.status).toBe("empty");
    if (one.status === "empty") expect(one.recurring).toBeLessThan(2);
  });

  it("is deterministic: the same views give the same lane whatever order the catalogue arrives in", () => {
    const a = JSON.stringify(lane("CAREER_DISCOVERY"));
    expect(JSON.stringify(lane("CAREER_DISCOVERY"))).toBe(a);
    expect(JSON.stringify(lane("CAREER_DISCOVERY", { openings: [...OPENINGS].reverse() }))).toBe(a);
  });

  it("still gives a Learn step when no course teaches the tag", () => {
    const odd = sampleOpenings.map((o) => ({ ...o, skills: ["Zymurgy", "Quillwork"] }));
    const l = ready(
      buildIntentLane({
        views: [view("opp_junior-analyst"), view("opp_design-intern")].map((v) => ({
          ...v,
          opening: { ...(v as { opening: object }).opening, skills: ["Zymurgy", "Quillwork"] },
        })) as EntityView[],
        openings: odd,
        layout: "CAREER_DISCOVERY",
        signedIn: false,
        mySkills: [],
      }),
    );
    expect(l.steps[0]?.title).toMatch(/^No course covers /);
    expect(l.steps[0]?.href).toBe("/coach#path");
    expect(l.steps.length).toBeGreaterThanOrEqual(2);
  });
});

describe("recommended jobs", () => {
  it("leave out everything already viewed and say what each came from", () => {
    const views = [view("opp_junior-analyst"), view("opp_data-entry")];
    const ranked = rankByViews(OPENINGS, views);
    const slugs = ranked.map((r) => r.o.slug);
    expect(slugs).not.toContain("junior-analyst");
    expect(slugs).not.toContain("data-entry");
    expect(ranked[0]?.because).not.toBeNull();
    expect(ranked[0]?.because?.title).toMatch(/Junior Data Analyst|Data Entry Operator/);
    expect(ranked[0]?.because?.shared.length).toBeGreaterThan(0);
  });

  it("order by shared tags, with no score field to render as a match", () => {
    const ranked = rankByViews(OPENINGS, [view("opp_junior-analyst")]);
    expect(Object.keys(ranked[0] ?? {}).sort()).toEqual(["because", "o"]);
    expect(ranked[0]?.o.skills.some((s) => ["Excel", "SQL", "Data analysis"].includes(s))).toBe(
      true,
    );
  });

  it("share one vocabulary with the lane", () => {
    expect(tagUniverse(OPENINGS)).toContain("excel");
  });
});
