// The chooser: plan lookup, strict validation of an AI answer, the deterministic fallback, and core purity.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BEHAVIOUR_MODES, EVOLUTION_STATES } from "../../evolution/config/ids";
import { BENEFIT_BY_ID, LIVE_TOP, PLANS, PLAN_BY_TYPE, type BenefitId } from "../config/plans";
import {
  buildChooserInput,
  cacheKeyOf,
  fallbackChoice,
  inputKeyOf,
  isAiEnabled,
  planForType,
  resolveChoice,
  roundDomain,
  validateChoice,
} from "./chooser";
import {
  SNOOZE_FIRST_MS,
  SNOOZE_REPEAT_MS,
  applyDismiss,
  applyShown,
  isSnoozed,
  parsePlusState,
  resetForRoleChange,
} from "./plus-state";
import { DEFAULT_PLUS_STATE, type ChooserInput, type PlanChoice } from "./types";

const input = (over: Partial<ChooserInput> = {}): ChooserInput => ({
  profileType: "jobseeker",
  state: "CAREER_FIRST",
  mode: "BALANCED",
  tier: 2,
  domains: { LEARNING: 0.2, CAREER: 0.7, SKILL_EXCHANGE: 0.1, COMMUNITY: 0 },
  ...over,
});

const valid = (): PlanChoice => ({
  planId: "LAUNCH",
  benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER", "INTERVIEW_COACH", "JOB_ALERTS"],
  headlineId: "H_CAREER_1",
  accentId: "PEACOCK",
  reasonKey: "R_CAREER_ACTIVITY",
});

const check = (v: unknown, type: Parameters<typeof validateChoice>[1] = "jobseeker") =>
  validateChoice(v, type);
const field = (v: unknown, type?: Parameters<typeof validateChoice>[1]) => {
  const r = check(v, type);
  return r.ok ? null : r.field;
};

describe("planForType", () => {
  it("maps every declared type to its plan and a guest to none", () => {
    expect(planForType("school")?.id).toBe("SCHOLAR");
    expect(planForType("college")?.id).toBe("CAMPUS");
    expect(planForType("jobseeker")?.id).toBe("LAUNCH");
    expect(planForType("professional")?.id).toBe("ASCEND");
    expect(planForType("institute")?.id).toBe("FACULTY");
    expect(planForType("recruiter")?.id).toBe("HIRE");
    expect(planForType(null)).toBeNull();
    expect(planForType(undefined)).toBeNull();
    expect(planForType("admin" as never)).toBeNull();
  });
});

describe("validateChoice", () => {
  it("accepts a well-formed choice and returns a copy", () => {
    const r = check(valid());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(valid());
  });

  it("rejects a plan from another role (the AI never crosses roles)", () => {
    expect(field({ ...valid(), planId: "HIRE" })).toBe("planId");
    expect(field({ ...valid(), planId: "launch" })).toBe("planId");
    expect(field(valid(), "recruiter")).toBe("planId");
  });

  it("rejects a guest or unknown profile type", () => {
    expect(field(valid(), null)).toBe("planId");
    expect(field(valid(), "admin" as never)).toBe("planId");
  });

  it("rejects unknown, foreign and duplicate benefit ids", () => {
    expect(
      field({ ...valid(), benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER", "FREE_LUNCH"] }),
    ).toBe("benefitOrder");
    expect(
      field({
        ...valid(),
        benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER", "MORE_POSTINGS"],
      }),
    ).toBe("benefitOrder");
    expect(
      field({ ...valid(), benefitOrder: ["CV_GAP_REPORT", "CV_GAP_REPORT", "INTERVIEW_COACH"] }),
    ).toBe("benefitOrder");
    expect(field({ ...valid(), benefitOrder: [1, 2, 3] })).toBe("benefitOrder");
    expect(field({ ...valid(), benefitOrder: "CV_GAP_REPORT" })).toBe("benefitOrder");
  });

  it("rejects fewer than 3 or more than 6 benefits", () => {
    expect(field({ ...valid(), benefitOrder: [] })).toBe("benefitOrder");
    expect(field({ ...valid(), benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER"] })).toBe(
      "benefitOrder",
    );
    const seven = [...PLAN_BY_TYPE.jobseeker.benefitIds, "CV_GAP_REPORT"];
    expect(field({ ...valid(), benefitOrder: seven })).toBe("benefitOrder");
    const six = [...PLAN_BY_TYPE.jobseeker.benefitIds];
    expect(check({ ...valid(), benefitOrder: six }).ok).toBe(true);
  });

  it("rejects a preview benefit in the top three", () => {
    expect(
      field({
        ...valid(),
        benefitOrder: ["JOB_ALERTS", "CV_GAP_REPORT", "APPLICATION_TRACKER", "INTERVIEW_COACH"],
      }),
    ).toBe("benefitOrder");
    expect(
      check({
        ...valid(),
        benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER", "INTERVIEW_COACH", "JOB_ALERTS"],
      }).ok,
    ).toBe(true);
  });

  it("rejects a headline, accent or reason that is not on the fixed lists", () => {
    expect(field({ ...valid(), headlineId: "H_BUY_NOW" })).toBe("headlineId");
    expect(field({ ...valid(), headlineId: "Make your next step easier" })).toBe("headlineId");
    expect(field({ ...valid(), accentId: "peacock" })).toBe("accentId");
    expect(field({ ...valid(), accentId: "#ff0000" })).toBe("accentId");
    expect(field({ ...valid(), reasonKey: "R_YOU_ARE_YOUNG" })).toBe("reasonKey");
    expect(field({ ...valid(), reasonKey: 3 })).toBe("reasonKey");
  });

  it("rejects extra keys (a price, a label, an age), missing keys and non-objects", () => {
    expect(field({ ...valid(), price: 1 })).toBe("shape");
    expect(field({ ...valid(), label: "Buy" })).toBe("shape");
    const { reasonKey: _drop, ...partial } = valid();
    expect(field(partial)).toBe("shape");
    for (const bad of [null, undefined, 7, "x", [], [valid()]]) expect(field(bad)).toBe("shape");
  });
});

describe("fallbackChoice", () => {
  it("is deterministic: identical across runs and input object order", () => {
    const a = JSON.stringify(fallbackChoice(input()));
    for (let i = 0; i < 5; i++) expect(JSON.stringify(fallbackChoice(input()))).toBe(a);
    const reordered: ChooserInput = {
      domains: { COMMUNITY: 0, SKILL_EXCHANGE: 0.1, CAREER: 0.7, LEARNING: 0.2 },
      tier: 2,
      mode: "BALANCED",
      state: "CAREER_FIRST",
      profileType: "jobseeker",
    };
    expect(JSON.stringify(fallbackChoice(reordered))).toBe(a);
  });

  it("always passes its own validator, for every type, state, mode and tier", () => {
    for (const p of PLANS) {
      for (const state of EVOLUTION_STATES) {
        for (const mode of BEHAVIOUR_MODES) {
          for (const tier of [0, 1, 3] as const) {
            for (const domains of [
              { LEARNING: 0, CAREER: 0, SKILL_EXCHANGE: 0, COMMUNITY: 0 },
              { LEARNING: 0.9, CAREER: 0.1, SKILL_EXCHANGE: 0, COMMUNITY: 0 },
              { LEARNING: 0, CAREER: 0, SKILL_EXCHANGE: 0.4, COMMUNITY: 0.9 },
            ]) {
              const i: ChooserInput = { profileType: p.profileType, state, mode, tier, domains };
              const c = fallbackChoice(i);
              expect(c.planId).toBe(p.id);
              const r = validateChoice(c, p.profileType);
              expect(r.ok, `${p.id} ${state} ${mode} ${tier}`).toBe(true);
              for (const id of c.benefitOrder.slice(0, LIVE_TOP)) {
                expect(BENEFIT_BY_ID[id].availability).toBe("live");
              }
            }
          }
        }
      }
    }
  });

  it("keeps the canonical order when nothing has been learned (UNIVERSAL, EXPLORER, tier 0)", () => {
    for (const p of PLANS) {
      for (const over of [{ state: "UNIVERSAL" }, { state: "EXPLORER" }, { tier: 0 }] as const) {
        const c = fallbackChoice(input({ profileType: p.profileType, ...over }));
        expect(c.benefitOrder).toEqual([...p.benefitIds]);
      }
    }
    expect(fallbackChoice(input({ state: "UNIVERSAL" })).reasonKey).toBe("R_ROLE_DEFAULT");
    expect(fallbackChoice(input({ state: "EXPLORER" })).reasonKey).toBe("R_BALANCED");
  });

  it("gives QUICK and MINIMAL the short list of three", () => {
    for (const mode of ["QUICK", "MINIMAL"] as const) {
      const c = fallbackChoice(input({ mode }));
      expect(c.benefitOrder).toHaveLength(3);
      expect(c.headlineId).toBe("H_QUICK_1");
      expect(c.reasonKey).toBe("R_QUICK");
    }
    expect(fallbackChoice(input()).benefitOrder).toHaveLength(6);
  });

  it("ranks by weight x domain score, ties by canonical order", () => {
    const skills = fallbackChoice(
      input({
        profileType: "college",
        state: "SKILL_EXCHANGE_FIRST",
        domains: { LEARNING: 0, CAREER: 0.1, SKILL_EXCHANGE: 0.9, COMMUNITY: 0 },
      }),
    );
    // SWAP_PRIORITY (skills, weight 3) outranks PASSPORT_SHARE (skills, 2) and both outrank the career items.
    expect(skills.benefitOrder.slice(0, 2)).toEqual(["SWAP_PRIORITY", "PASSPORT_SHARE"]);
    expect(skills.headlineId).toBe("H_SKILL_1");
    expect(skills.accentId).toBe("RANI");
    expect(skills.reasonKey).toBe("R_SKILL_EXCHANGE_ACTIVITY");

    const career = fallbackChoice(input({ profileType: "college" }));
    expect(career.benefitOrder[0]).toBe("CV_REVIEW");
    expect(career.accentId).toBe("PEACOCK");
  });

  it("promotes live benefits over a higher-scoring preview one", () => {
    // INTERNSHIP_ALERTS is a preview career benefit; with all weight on careers it must still not lead.
    const c = fallbackChoice(
      input({
        profileType: "college",
        domains: { LEARNING: 0, CAREER: 1, SKILL_EXCHANGE: 0, COMMUNITY: 0 },
      }),
    );
    expect(c.benefitOrder.indexOf("INTERNSHIP_ALERTS")).toBeGreaterThanOrEqual(LIVE_TOP);
  });

  it("never throws for a guest-less plan lookup but refuses a type without a plan", () => {
    expect(() => fallbackChoice(input({ profileType: "admin" as never }))).toThrow();
  });
});

describe("input shaping", () => {
  it("rounds domain affinities to one decimal and clamps them", () => {
    expect(roundDomain(0.349)).toBe(0.3);
    expect(roundDomain(0.35)).toBe(0.4);
    expect(roundDomain(-2)).toBe(0);
    expect(roundDomain(7)).toBe(1);
    expect(roundDomain(Number.NaN)).toBe(0);
    expect(roundDomain("0.5")).toBe(0);
  });

  it("builds an input that carries only the declared type and engine aggregates", () => {
    const i = buildChooserInput("professional", {
      state: "LEARNING_FIRST",
      mode: "RESEARCH",
      tier: 2,
      scores: {
        learningAffinity: 0.678,
        careerAffinity: 0.12,
        skillExchangeAffinity: 0,
        communityAffinity: 0.049,
      },
    });
    expect(i).toEqual({
      profileType: "professional",
      state: "LEARNING_FIRST",
      mode: "RESEARCH",
      tier: 2,
      domains: { LEARNING: 0.7, CAREER: 0.1, SKILL_EXCHANGE: 0, COMMUNITY: 0 },
    });
    expect(Object.keys(i).sort()).toEqual(["domains", "mode", "profileType", "state", "tier"]);
  });

  it("keys the local cache by (type, state, mode) and the server by the whole request", () => {
    expect(cacheKeyOf(input())).toBe("jobseeker|CAREER_FIRST|BALANCED");
    expect(inputKeyOf(input())).not.toBe(inputKeyOf(input({ tier: 3 })));
    expect(cacheKeyOf(input())).toBe(cacheKeyOf(input({ tier: 3 })));
  });

  it("resolves a choice to records and English source text", () => {
    const r = resolveChoice(fallbackChoice(input()));
    expect(r.benefits.map((b) => b.id)).toEqual(fallbackChoice(input()).benefitOrder);
    expect(r.headline.length).toBeGreaterThan(5);
    expect(r.reason).toMatch(/careers/);
  });

  it("reads the kill switch: unset or on is live, anything else is off", () => {
    for (const on of [undefined, null, "", "on", "ON", " live ", "true", "1"])
      expect(isAiEnabled(on)).toBe(true);
    for (const off of ["off", "OFF", "0", "false", "no", "disabled", "of"])
      expect(isAiEnabled(off)).toBe(false);
  });
});

describe("plus-state transitions", () => {
  it("counts shows", () => {
    const s = applyShown(DEFAULT_PLUS_STATE, 1_000);
    expect(s.shownCount).toBe(1);
    expect(s.lastShownAt).toBe(1_000);
  });

  it("runs the snooze ladder: 14 days, then 60, and never is permanent", () => {
    const t = 1_000_000;
    const first = applyDismiss(DEFAULT_PLUS_STATE, "not_now", t);
    expect(first.snoozeUntil).toBe(t + SNOOZE_FIRST_MS);
    expect(first.dismissCount).toBe(1);
    expect(isSnoozed(first, t + 1)).toBe(true);
    expect(isSnoozed(first, t + SNOOZE_FIRST_MS)).toBe(false);
    const second = applyDismiss(first, "esc", t + SNOOZE_FIRST_MS);
    expect(second.snoozeUntil).toBe(t + SNOOZE_FIRST_MS + SNOOZE_REPEAT_MS);
    const never = applyDismiss(second, "never", t);
    expect(never.never).toBe(true);
    expect(isSnoozed(never, t + 10 * SNOOZE_REPEAT_MS)).toBe(true);
  });

  it("a role change resets the snooze but not the 'never' or the lifetime count", () => {
    let s = applyShown(DEFAULT_PLUS_STATE, 5);
    s = applyDismiss(s, "not_now", 5);
    s = { ...s, never: true };
    const r = resetForRoleChange(s);
    expect(r.snoozeUntil).toBeNull();
    expect(r.dismissCount).toBe(0);
    expect(r.never).toBe(true);
    expect(r.shownCount).toBe(1);
  });

  it("parses defensively", () => {
    expect(parsePlusState(null)).toEqual(DEFAULT_PLUS_STATE);
    expect(parsePlusState({ shownCount: "x", interest: "paid", never: "yes", extra: 1 })).toEqual(
      DEFAULT_PLUS_STATE,
    );
    expect(parsePlusState({ shownCount: 2.7, interest: "notify", signupAt: 9 })).toMatchObject({
      shownCount: 2,
      interest: "notify",
      signupAt: 9,
    });
  });
});

describe("purity of src/membership/core", () => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const files = readdirSync(root).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f));
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const IMPORT =
    /from\s+["'](react|react-dom|react\/[^"']*|framer-motion|@tanstack\/[^"']*|@supabase\/[^"']*)["']/;
  const DOM = /\b(window|document|localStorage|sessionStorage|navigator|fetch)\b/;
  const NONDETERMINISTIC = /Math\.random\s*\(|Date\.now\s*\(|new\s+Date\s*\(|performance\.now\s*\(/;

  it("has files to check", () => expect(files.length).toBeGreaterThanOrEqual(3));
  for (const f of files) {
    it(`${f} imports no React and touches no DOM, storage, network or clock`, () => {
      const src = strip(readFileSync(`${root}${f}`, "utf8"));
      expect(src).not.toMatch(IMPORT);
      expect(src).not.toMatch(DOM);
      expect(src).not.toMatch(NONDETERMINISTIC);
    });
  }
});

describe("the AI never sets price or plan", () => {
  it("has no price field anywhere in a choice, and the plan is a lookup", () => {
    const c = fallbackChoice(input());
    expect(Object.keys(c).sort()).toEqual([
      "accentId",
      "benefitOrder",
      "headlineId",
      "planId",
      "reasonKey",
    ]);
    expect(c.planId).toBe(PLAN_BY_TYPE.jobseeker.id);
    expect(JSON.stringify(c)).not.toMatch(/\d{2,}/);
  });

  it("benefit ids stay plan-scoped", () => {
    for (const p of PLANS) {
      const c = fallbackChoice(input({ profileType: p.profileType }));
      for (const id of c.benefitOrder as readonly BenefitId[]) expect(p.benefitIds).toContain(id);
    }
  });
});
