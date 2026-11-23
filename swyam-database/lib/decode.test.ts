import { describe, expect, it } from "vitest";
import type { Opportunity } from "./opportunities";
import type { Course } from "../data/mock";
import {
  NOT_STATED,
  clipQuote,
  decodeCourse,
  decodeOpportunity,
  type DecodedBullet,
} from "./decode";

const job = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: "o1",
  slug: "store-associate",
  title: "Store Associate",
  kind: "job",
  workMode: "onsite",
  location: "Pune, Maharashtra",
  region: null,
  summary: "Help customers find what they need and keep the shelves full.",
  description:
    "We run three grocery stores in Pune.\nThe salary is ₹18,000 to ₹24,000 per month plus overtime.\nShifts are 9 hours.",
  responsibilities: ["Greet customers and answer questions", "Restock shelves each morning"],
  eligibility: "Class 12 pass. Comfortable standing for long hours.",
  payPeriod: "month",
  applyUrl: null,
  applyUrlStatus: null,
  applyUrlCheckedAt: null,
  details: {
    experience: "No experience needed",
    benefits: ["Free lunch on shift days", "Uniform provided"],
  },
  skills: ["Customer service", "Billing"],
  openings: 4,
  applicationCount: 0,
  salaryMin: 18000,
  salaryMax: 24000,
  stipend: null,
  isPaid: true,
  durationWeeks: null,
  hoursPerWeek: 48,
  deadline: "2026-11-05",
  postedAt: null,
  updatedAt: null,
  employer: null,
  ...over,
});

const course = (over: Partial<Course> = {}): Course =>
  ({
    id: "c1",
    title: "Tailoring Basics",
    orgId: "org1",
    hero: "",
    gallery: [],
    overview:
      "Learn to measure, cut and stitch a simple kurta from scratch. No machine needed at first.",
    outcomes: ["Stitch a kurta on your own", "Take body measurements"],
    duration: "3 months · 6 hrs/week",
    fees: "Free",
    scholarship: false,
    difficulty: "Beginner",
    trainer: { name: "A", avatar: "", bio: "" },
    rating: 4,
    reviewCount: 0,
    reviews: [],
    curriculum: [],
    projects: [],
    certification: "Certificate of Completion",
    placementAssistance: true,
    category: "Craft",
    group: "Skills",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Gujarat",
    city: "Surat",
    ...over,
  }) as Course;

const sourceText = (o: Opportunity): string =>
  [
    o.summary,
    o.description,
    o.eligibility,
    o.location,
    o.region,
    ...o.responsibilities,
    o.details.experience,
    ...(o.details.benefits ?? []),
    ...(o.details.whatYouLearn ?? []),
    // Pay figures the listing shows as its own facts line.
    "₹18,000 – ₹24,000/month",
    "₹15,000/month",
    "Unpaid",
  ]
    .filter((s): s is string => typeof s === "string")
    .join("\n");

const stripEllipsis = (q: string) => q.replace(/…$/, "");

describe("decodeOpportunity", () => {
  it("decodes a full job into do / pay / where / who / extra in order", () => {
    const b = decodeOpportunity(job());
    expect(b.map((x) => x.key)).toEqual(["do", "pay", "where", "who", "extra"]);
    expect(b.every((x) => !x.missing)).toBe(true);
    expect(b[0].text).toContain("Greet customers");
    expect(b[0].text).toContain("1 more listed");
    expect(b[1].text).toBe("Pays ₹18,000 to ₹24,000 a month");
    expect(b[1].quote).toBe("The salary is ₹18,000 to ₹24,000 per month plus overtime.");
    expect(b[2].text).toBe(
      "Works from Pune, Maharashtra (on-site) · about 48 hours a week · apply by 5 Nov 2026",
    );
    expect(b[3].text).toContain("Experience: No experience needed.");
    expect(b[3].text).toContain("Skills asked for: Customer service, Billing.");
    expect(b[4].text).toContain("Free lunch on shift days");
  });

  it("says pay is not stated when there is no figure and no wording", () => {
    const b = decodeOpportunity(
      job({
        salaryMin: null,
        salaryMax: null,
        description: "We run stores.",
        summary: null,
        details: {},
      }),
    );
    const pay = b.find((x) => x.key === "pay")!;
    expect(pay).toEqual({ key: "pay", label: "Pay", text: NOT_STATED, quote: null, missing: true });
  });

  it("says where is not stated for an on-site job with no location and no timing", () => {
    const b = decodeOpportunity(
      job({
        location: null,
        region: null,
        hoursPerWeek: null,
        deadline: null,
        durationWeeks: null,
      }),
    );
    const where = b.find((x) => x.key === "where")!;
    expect(where.missing).toBe(true);
    expect(where.text).toBe(NOT_STATED);
    expect(where.quote).toBeNull();
  });

  it("keeps a remote job with no location as known, not missing", () => {
    const b = decodeOpportunity(
      job({ workMode: "remote", location: null, hoursPerWeek: null, deadline: null }),
    );
    const where = b.find((x) => x.key === "where")!;
    expect(where.missing).toBe(false);
    expect(where.text).toBe("Works remotely");
  });

  it("reads an internship stipend and duration", () => {
    const b = decodeOpportunity(
      job({
        kind: "internship",
        salaryMin: null,
        salaryMax: null,
        stipend: 15000,
        durationWeeks: 12,
        hoursPerWeek: null,
        deadline: null,
        description: "A hands-on internship in our Pune office.",
        details: {},
      }),
    );
    const pay = b.find((x) => x.key === "pay")!;
    expect(pay.text).toBe("Pays a stipend of ₹15,000 a month");
    expect(pay.quote).toBe("₹15,000/month");
    expect(b.find((x) => x.key === "where")!.text).toContain("lasts 12 weeks");
  });

  it("calls an unpaid internship unpaid, and does not call a missing figure unpaid", () => {
    const unpaid = decodeOpportunity(
      job({
        kind: "internship",
        salaryMin: null,
        salaryMax: null,
        stipend: null,
        isPaid: false,
        description: null,
      }),
    ).find((x) => x.key === "pay")!;
    expect(unpaid.missing).toBe(false);
    expect(unpaid.text).toMatch(/^Unpaid/);

    const unknown = decodeOpportunity(
      job({
        kind: "internship",
        salaryMin: null,
        salaryMax: null,
        stipend: null,
        isPaid: true,
        description: null,
        summary: null,
      }),
    ).find((x) => x.key === "pay")!;
    expect(unknown.missing).toBe(true);
  });

  it("groups rupees the Indian way and uses the stored pay period", () => {
    const pay = decodeOpportunity(
      job({
        salaryMin: 1200000,
        salaryMax: 1800000,
        payPeriod: "year",
        description: null,
        summary: null,
      }),
    ).find((x) => x.key === "pay")!;
    expect(pay.text).toBe("Pays ₹12,00,000 to ₹18,00,000 a year");
  });

  it("returns 4 bullets when there is nothing extra to say", () => {
    const b = decodeOpportunity(job({ details: {}, openings: 1 }));
    expect(b.map((x) => x.key)).toEqual(["do", "pay", "where", "who"]);
  });

  it("never invents: an empty listing yields honest missing bullets", () => {
    const b = decodeOpportunity(
      job({
        summary: null,
        description: null,
        responsibilities: [],
        eligibility: null,
        location: null,
        workMode: "onsite",
        hoursPerWeek: null,
        deadline: null,
        salaryMin: null,
        salaryMax: null,
        skills: [],
        details: {},
        openings: 1,
      }),
    );
    expect(b).toHaveLength(4);
    expect(b.every((x) => x.missing && x.text === NOT_STATED && x.quote === null)).toBe(true);
  });
});

describe("decodeCourse", () => {
  it("decodes a free course", () => {
    const b = decodeCourse(course());
    expect(b.map((x) => x.key)).toEqual(["do", "pay", "where", "who", "extra"]);
    expect(b[1].text).toBe("Free: no fee to take this course");
    expect(b[1].quote).toBe("Free");
    expect(b[2].text).toBe(
      "In person in Surat, Gujarat · 3 months · 6 hrs/week · next batch: ask the institute",
    );
    expect(b[3].text).toBe("Beginner level · no prerequisites listed");
    expect(b[4].text).toContain("placement help offered");
  });

  it("reads a paid fee and a scholarship, and an online course as self-paced", () => {
    const b = decodeCourse(
      course({ fees: "₹4,999", free: false, scholarship: true, mode: "Online" }),
    );
    expect(b[1].text).toBe("Costs ₹4,999 (a scholarship is available)");
    expect(b[2].text).toContain("start any time, self-paced");
  });

  it("reads a self-paced duration mid-line without saying self-paced twice", () => {
    const b = decodeCourse(course({ mode: "Online", duration: "About 16 hours · self-paced" }));
    expect(b[2].text).toBe("Online · about 16 hours · start any time, self-paced");
  });

  it("states a real start date without touching the clock", () => {
    const b = decodeCourse(course({ startsOn: "2026-12-01" }));
    expect(b[2].text).toContain("next batch starts 1 Dec 2026");
  });

  it("is honest when the fee is blank", () => {
    const pay = decodeCourse(course({ fees: "", free: false }))[1];
    expect(pay).toEqual({ key: "pay", label: "Fee", text: NOT_STATED, quote: null, missing: true });
  });
});

describe("quote invariants", () => {
  it("every opportunity quote is a verbatim slice of the listing (ellipsis aside) and <= 90 chars", () => {
    const longTask =
      "Coordinate with the regional distribution team every single morning to confirm the delivery schedule and escalate any delays";
    const o = job({
      responsibilities: [longTask, "Restock shelves"],
      eligibility: `${longTask} and more.`,
    });
    const hay = `${sourceText(o)}\n${longTask}`;
    for (const b of decodeOpportunity(o)) {
      if (b.quote === null) continue;
      expect(b.quote.length).toBeLessThanOrEqual(90);
      expect(hay).toContain(stripEllipsis(b.quote));
    }
  });

  it("every course quote is a verbatim slice of a course field", () => {
    const c = course({
      prerequisites: ["Basic hand sewing", "Can read a tape measure"],
      language: "Gujarati and Hindi",
    });
    const hay = [
      c.overview,
      ...c.outcomes,
      c.duration,
      c.fees,
      c.certification,
      c.city,
      ...(c.prerequisites ?? []),
      c.language,
    ].join("\n");
    for (const b of decodeCourse(c)) {
      if (b.quote === null) continue;
      expect(b.quote.length).toBeLessThanOrEqual(90);
      expect(hay).toContain(stripEllipsis(b.quote));
    }
  });

  it("clipQuote cuts at a word boundary and marks the cut", () => {
    const s = "word ".repeat(40).trim();
    const q = clipQuote(s);
    expect(q.length).toBeLessThanOrEqual(90);
    expect(q.endsWith("…")).toBe(true);
    expect(s.startsWith(stripEllipsis(q))).toBe(true);
    expect(stripEllipsis(q).endsWith(" ")).toBe(false);
    expect(clipQuote("short one")).toBe("short one");
  });
});

describe("determinism and purity", () => {
  it("returns identical output for identical input", () => {
    const o = job();
    const c = course();
    expect(decodeOpportunity(o)).toEqual(decodeOpportunity(o));
    expect(decodeCourse(c)).toEqual(decodeCourse(c));
    expect(JSON.stringify(decodeOpportunity(job()))).toBe(JSON.stringify(decodeOpportunity(job())));
  });

  it("does not mutate its input", () => {
    const o = job();
    const c = course();
    const before = JSON.stringify([o, c]);
    decodeOpportunity(o);
    decodeCourse(c);
    expect(JSON.stringify([o, c])).toBe(before);
  });

  it("always returns 3 to 5 well-formed bullets", () => {
    const sets: DecodedBullet[][] = [
      decodeOpportunity(job()),
      decodeOpportunity(job({ details: {}, openings: 1 })),
      decodeCourse(course()),
      decodeCourse(course({ certification: "", placementAssistance: false })),
    ];
    for (const set of sets) {
      expect(set.length).toBeGreaterThanOrEqual(3);
      expect(set.length).toBeLessThanOrEqual(5);
      for (const b of set) {
        expect(b.text.length).toBeGreaterThan(0);
        expect(b.missing ? b.quote === null : true).toBe(true);
      }
    }
  });
});
