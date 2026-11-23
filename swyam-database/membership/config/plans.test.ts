// The catalogue is a product promise: one plan per role, honest prices, benefits that point at real routes.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAV_REGISTRY, pathOf } from "../../evolution/config/navigation";
import { PLUS_EVENTS } from "./events";
import {
  ACCENT_IDS,
  BENEFITS,
  BENEFIT_BY_ID,
  BENEFIT_IDS,
  HEADLINES,
  HEADLINE_IDS,
  LIVE_TOP,
  MAX_BENEFITS,
  MIN_BENEFITS,
  PLANS,
  PLAN_BY_ID,
  PLAN_BY_TYPE,
  PLAN_IDS,
  REASONS,
  REASON_KEYS,
} from "./plans";

/** The six declared profile types (src/lib/profile-type.ts), listed here so the test needs no browser module. */
const TYPE_IDS = [
  "school",
  "college",
  "jobseeker",
  "professional",
  "recruiter",
  "institute",
] as const;

const text = readFileSync(
  fileURLToPath(new URL("../../routeTree.gen.ts", import.meta.url)),
  "utf8",
);
const block = text.slice(text.indexOf("export interface FileRoutesByFullPath"));
const ROUTES = new Set(
  [...block.slice(0, block.indexOf("}")).matchAll(/^\s+'([^']+)':/gm)].flatMap((m) => {
    const p = m[1] as string;
    return [p, p.replace(/\/$/, "") || "/"];
  }),
);

describe("plans", () => {
  it("one plan per declared profile type, and no type without a plan", () => {
    expect(PLANS).toHaveLength(TYPE_IDS.length);
    for (const t of TYPE_IDS) expect(PLAN_BY_TYPE[t].profileType).toBe(t);
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length);
    expect(PLANS.map((p) => p.id)).toEqual([...PLAN_IDS]);
  });

  it("carries the approved prices: positive integers, one regular price per role", () => {
    const price = Object.fromEntries(PLANS.map((p) => [p.id, p.regularPrice]));
    expect(price).toEqual({
      SCHOLAR: 99,
      CAMPUS: 199,
      LAUNCH: 299,
      ASCEND: 399,
      FACULTY: 499,
      HIRE: 999,
    });
    for (const p of PLANS) {
      expect(Number.isInteger(p.regularPrice) && p.regularPrice > 0).toBe(true);
      expect(p.introPrice).toBe(1);
      expect(p.introMonths).toBe(1);
    }
  });

  it("is an honest demo: no payment taken on any plan", () => {
    for (const p of PLANS) {
      expect(p.demo).toBe(true);
      expect(p.paymentTaken).toBe(false);
      expect(PLAN_BY_ID[p.id]).toBe(p);
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(PLANS)).toBe(true);
    expect(Object.isFrozen(PLANS[0])).toBe(true);
    expect(Object.isFrozen(BENEFITS)).toBe(true);
    expect(Object.isFrozen(BENEFITS[0])).toBe(true);
  });

  for (const p of PLANS) {
    describe(p.id, () => {
      it("lists 3 to 6 unique, known benefits, each of which names this plan", () => {
        expect(p.benefitIds.length).toBeGreaterThanOrEqual(MIN_BENEFITS);
        expect(p.benefitIds.length).toBeLessThanOrEqual(MAX_BENEFITS);
        expect(new Set(p.benefitIds).size).toBe(p.benefitIds.length);
        for (const id of p.benefitIds) {
          expect(BENEFIT_IDS).toContain(id);
          expect(BENEFIT_BY_ID[id].planIds).toContain(p.id);
        }
      });

      it("has a live top three in canonical order", () => {
        for (const id of p.benefitIds.slice(0, LIVE_TOP)) {
          expect(BENEFIT_BY_ID[id].availability, id).toBe("live");
        }
      });
    });
  }
});

describe("benefit registry", () => {
  it("has a record per id, no strays, and every plan reference is real", () => {
    expect(BENEFITS.map((b) => b.id)).toEqual([...BENEFIT_IDS]);
    for (const b of BENEFITS) {
      for (const pid of b.planIds)
        expect(PLAN_BY_ID[pid].benefitIds, `${b.id} in ${pid}`).toContain(b.id);
      expect(b.weight).toBeGreaterThanOrEqual(1);
      expect(b.weight).toBeLessThanOrEqual(3);
      expect(b.label.length).toBeGreaterThan(3);
    }
  });

  it("feature registry: every benefit route is in the navigation registry and resolves to a real route", () => {
    for (const b of BENEFITS) {
      const dest = NAV_REGISTRY[b.route];
      expect(dest, `${b.id} -> ${b.route}`).toBeDefined();
      for (const href of [dest.member, dest.visitor]) {
        expect(ROUTES.has(pathOf(href)), `${b.id} -> ${href}`).toBe(true);
      }
    }
  });

  it("never puts a price in a benefit label", () => {
    for (const b of BENEFITS) expect(b.label).not.toMatch(/[₹$]|\bRs\b|\bfree\b/i);
  });
});

describe("headlines, accents, reasons", () => {
  it("has at most 12 headlines, each with text, none manipulative", () => {
    expect(HEADLINE_IDS.length).toBeLessThanOrEqual(12);
    for (const id of HEADLINE_IDS) {
      expect(HEADLINES[id].length).toBeGreaterThan(5);
      expect(HEADLINES[id]).not.toMatch(/[₹$!]|only today|last chance|hurry|miss out|don.t/i);
    }
  });

  it("has the four foil accents and a text for every reason", () => {
    expect([...ACCENT_IDS]).toEqual(["MARIGOLD", "PEACOCK", "RANI", "INDIGO"]);
    for (const k of REASON_KEYS) expect(REASONS[k].length).toBeGreaterThan(10);
  });

  it("lists the eight plus_* events", () => {
    expect(PLUS_EVENTS).toHaveLength(8);
    for (const e of PLUS_EVENTS) expect(e.startsWith("plus_")).toBe(true);
  });
});
