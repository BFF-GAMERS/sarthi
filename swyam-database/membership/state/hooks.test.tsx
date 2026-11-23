// First paint on the server (and the hydration pass): the rules fallback, no storage read, no network, and
// no plan at all for a guest. Effects (cache lookup, the one weekly AI call) only ever swap the order later.
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  type: null as string | null,
  snap: {
    scope: "guest",
    hydrated: false,
    ui: { state: "UNIVERSAL", mode: "BALANCED", tier: 0 },
    profile: {
      scores: {
        learningAffinity: 0,
        careerAffinity: 0,
        skillExchangeAffinity: 0,
        communityAffinity: 0,
      },
    },
  } as Record<string, unknown>,
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: h.type ? { email: "a@b.test", role: "student" } : null,
    profileId: null,
  }),
}));
vi.mock("../../lib/profile-type", () => ({ useProfileType: () => h.type }));
vi.mock("../../evolution/react/hooks", () => ({ useEvolutionSnapshot: () => h.snap }));

import { PLAN_BY_TYPE } from "../config/plans";
import { useMembership, usePlusState } from "./hooks";

function Probe() {
  const m = useMembership();
  const p = usePlusState();
  return (
    <p>
      {JSON.stringify({
        plan: m.plan?.id ?? null,
        benefits: m.benefits.map((b) => b.id),
        headline: m.headlineId,
        accent: m.accent,
        source: m.source,
        ready: m.ready,
        shown: p.state.shownCount,
        never: p.state.never,
      })}
    </p>
  );
}

const out = (): Record<string, unknown> => {
  const html = renderToString(<Probe />);
  const text = html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"');
  return JSON.parse(text) as Record<string, unknown>;
};

describe("useMembership on first paint", () => {
  it("gives a guest no plan, no benefits and no price", () => {
    h.type = null;
    expect(out()).toMatchObject({
      plan: null,
      benefits: [],
      headline: null,
      accent: null,
      source: "rules",
      shown: 0,
      never: false,
    });
  });

  it("gives a declared type its plan with the rules ordering, never waiting for the AI", () => {
    h.type = "jobseeker";
    const r = out();
    expect(r["plan"]).toBe("LAUNCH");
    expect(r["source"]).toBe("rules");
    expect(r["benefits"]).toEqual([...PLAN_BY_TYPE.jobseeker.benefitIds]);
    expect(r["headline"]).toBe("H_BALANCED_1");
    expect(r["ready"]).toBe(false);
  });

  it("orders by the engine's strongest domain from the first render", () => {
    h.type = "college";
    h.snap = {
      ...h.snap,
      hydrated: true,
      ui: { state: "SKILL_EXCHANGE_FIRST", mode: "BALANCED", tier: 2 },
      profile: {
        scores: {
          learningAffinity: 0,
          careerAffinity: 0.1,
          skillExchangeAffinity: 0.9,
          communityAffinity: 0,
        },
      },
    };
    const r = out();
    expect(r["plan"]).toBe("CAMPUS");
    expect((r["benefits"] as string[]).slice(0, 2)).toEqual(["SWAP_PRIORITY", "PASSPORT_SHARE"]);
    expect(r["accent"]).toBe("RANI");
    expect(r["source"]).toBe("rules");
  });
});
