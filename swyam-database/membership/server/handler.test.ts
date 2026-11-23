// POST /api/membership as a plain function: lite models only, enum schema, strict validation, limits,
// kill switch, and nothing about models, keys or quota ever reaches the client.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LruCache } from "../../evolution/server/cache";
import { GeminiError } from "../../lib/gemini";
import { LIMITS, _resetBuckets } from "../../lib/rate-limit";
import { PLANS, PLAN_BY_TYPE } from "../config/plans";
import { fallbackChoice, validateChoice } from "../core/chooser";
import type { PlanChoice } from "../core/types";
import {
  MEMBERSHIP_CALL,
  MEMBERSHIP_MODELS,
  aiEnabled,
  handleMembership,
  methodNotAllowed,
  type HandlerDeps,
} from "./handler";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { MAX_BODY_BYTES, parseChooserRequest } from "./request";
import { buildResponseSchema } from "./schema";

const BODY = {
  profileType: "jobseeker",
  state: "CAREER_FIRST",
  mode: "BALANCED",
  tier: 2,
  domains: { LEARNING: 0.2, CAREER: 0.7, SKILL_EXCHANGE: 0.1, COMMUNITY: 0 },
};
const GOOD: PlanChoice = {
  planId: "LAUNCH",
  benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER", "INTERVIEW_COACH", "JOB_ALERTS"],
  headlineId: "H_CAREER_1",
  accentId: "PEACOCK",
  reasonKey: "R_CAREER_ACTIVITY",
};

let ipCounter = 0;
const nextIp = () => `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

function post(body: unknown, ip = nextIp(), headers: Record<string, string> = {}): Request {
  return new Request("https://swayam.test/api/membership", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

type AskFn = HandlerDeps["ask"];
const answering = (choice: unknown): AskFn =>
  vi.fn(async () => JSON.stringify(choice)) as unknown as AskFn;

function deps(
  over: Partial<HandlerDeps> = {},
  env: Record<string, string> = {},
): Partial<HandlerDeps> {
  return {
    env: () => ({ NODE_ENV: "test", ...env }),
    apiKey: () => "test-key",
    cache: new LruCache<PlanChoice>(),
    log: () => {},
    ask: answering(GOOD),
    ...over,
  };
}

const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

beforeEach(() => _resetBuckets());

describe("config", () => {
  it("uses the lite models only, never the full Flash model", () => {
    expect(MEMBERSHIP_MODELS.length).toBeGreaterThan(0);
    for (const m of MEMBERSHIP_MODELS) expect(m).toMatch(/lite/);
    expect(MEMBERSHIP_CALL.maxTokens).toBeLessThanOrEqual(300);
    expect(MEMBERSHIP_CALL.temperature).toBeLessThanOrEqual(0.2);
  });

  it("adds the plan and intent budgets", () => {
    expect(LIMITS.planBurst).toMatchObject({ max: 2, windowMs: 10 * 60_000 });
    expect(LIMITS.planDay).toMatchObject({ max: 4, windowMs: 24 * 60 * 60_000 });
    expect(LIMITS.planGlobal).toMatchObject({ max: 40, windowMs: 24 * 60 * 60_000 });
    expect(LIMITS.intentBurst).toMatchObject({ max: 5, windowMs: 10 * 60_000 });
    expect(LIMITS.intentDay).toMatchObject({ max: 20, windowMs: 24 * 60 * 60_000 });
    expect(LIMITS.intentGlobal).toMatchObject({ max: 40, windowMs: 24 * 60 * 60_000 });
    const names = Object.values(LIMITS).map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("request validation", () => {
  it("accepts the five-key request and rounds domains to one decimal", () => {
    const r = parseChooserRequest({ ...BODY, domains: { ...BODY.domains, CAREER: 0.7349 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.domains.CAREER).toBe(0.7);
  });

  it("refuses anything beyond the five keys (age, name, free text, price, user id)", () => {
    for (const extra of [
      { age: 15 },
      { name: "Asha" },
      { text: "hello" },
      { price: 1 },
      { userId: "u1" },
    ]) {
      expect(parseChooserRequest({ ...BODY, ...extra }).ok).toBe(false);
    }
    expect(parseChooserRequest({ ...BODY, domains: { ...BODY.domains, AGE: 0.3 } }).ok).toBe(false);
  });

  it("refuses bad enums and numbers", () => {
    const bad: unknown[] = [
      { ...BODY, profileType: "teacher" },
      { ...BODY, state: "RICH" },
      { ...BODY, mode: "x" },
      { ...BODY, tier: 4 },
      { ...BODY, tier: "2" },
      { ...BODY, domains: { ...BODY.domains, CAREER: 1.2 } },
      { ...BODY, domains: { ...BODY.domains, CAREER: -0.1 } },
      { ...BODY, domains: { ...BODY.domains, CAREER: "0.5" } },
      { ...BODY, domains: { LEARNING: 0, CAREER: 0, SKILL_EXCHANGE: 0 } },
      null,
      [],
      "x",
    ];
    for (const b of bad) expect(parseChooserRequest(b).ok).toBe(false);
  });
});

describe("schema and prompt", () => {
  it("narrows the plan to the one the profile type maps to, and has no price or text field", () => {
    for (const p of PLANS) {
      const s = buildResponseSchema(p) as {
        properties: Record<string, { enum?: string[]; items?: { enum: string[] } }>;
        required: string[];
      };
      expect(s.properties["planId"]!.enum).toEqual([p.id]);
      expect(s.properties["benefitOrder"]!.items!.enum).toEqual([...p.benefitIds]);
      expect(Object.keys(s.properties).sort()).toEqual([
        "accentId",
        "benefitOrder",
        "headlineId",
        "planId",
        "reasonKey",
      ]);
      expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
      expect(JSON.stringify(s)).not.toMatch(/price|₹|amount|label/i);
    }
  });

  it("tells the model no price, no age and no personal detail", () => {
    const input = parseChooserRequest(BODY);
    if (!input.ok) throw new Error("fixture");
    const user = buildUserPrompt(input.value, PLAN_BY_TYPE.jobseeker);
    for (const text of [user, SYSTEM_PROMPT]) {
      expect(text).not.toMatch(/₹|\bRs\b|rupee|\bprice\b.*\d|\bage\b.*\d|@/i);
    }
    expect(user).not.toMatch(/299|regular/i);
    expect(user).toContain("planId must be LAUNCH");
  });
});

describe("handleMembership", () => {
  it("returns a validated choice from the model", async () => {
    const ask = answering(GOOD);
    const res = await handleMembership(post(BODY), deps({ ask }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual({ ok: true, source: "ai", choice: GOOD });
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("calls Gemini with the lite models, a JSON enum schema and nothing sensitive", async () => {
    const ask = vi.fn(async () => JSON.stringify(GOOD)) as unknown as AskFn;
    await handleMembership(post(BODY), deps({ ask }));
    const [turns, opts] = (ask as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as Parameters<AskFn>;
    expect(opts?.models).toEqual(MEMBERSHIP_MODELS);
    expect(opts?.json).toBe(true);
    expect(opts?.apiKey).toBe("test-key");
    expect(opts?.responseSchema).toEqual(buildResponseSchema(PLAN_BY_TYPE.jobseeker));
    expect(opts?.maxTokens).toBe(MEMBERSHIP_CALL.maxTokens);
    expect(JSON.stringify(turns)).not.toMatch(/299|₹|price/i);
  });

  it("serves a repeat request from the cache without asking again or spending budget", async () => {
    const ask = answering(GOOD);
    const d = deps({ ask });
    await handleMembership(post(BODY), d);
    for (let i = 0; i < 6; i++) {
      const res = await handleMembership(post(BODY), d);
      expect(await json(res)).toEqual({ ok: true, source: "ai", choice: GOOD, cached: true });
    }
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("rejects a cross-role plan, unknown ids, duplicates and short or long lists (answer is `invalid`)", async () => {
    const bads: unknown[] = [
      { ...GOOD, planId: "HIRE" },
      { ...GOOD, benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER", "NOPE"] },
      { ...GOOD, benefitOrder: ["CV_GAP_REPORT", "CV_GAP_REPORT", "INTERVIEW_COACH"] },
      { ...GOOD, benefitOrder: ["CV_GAP_REPORT", "APPLICATION_TRACKER"] },
      { ...GOOD, benefitOrder: [...PLAN_BY_TYPE.jobseeker.benefitIds, "CV_GAP_REPORT"] },
      { ...GOOD, benefitOrder: ["JOB_ALERTS", "CV_GAP_REPORT", "APPLICATION_TRACKER"] },
      { ...GOOD, headlineId: "BUY_NOW" },
      { ...GOOD, accentId: "RED" },
      { ...GOOD, reasonKey: "R_X" },
      { ...GOOD, price: 1 },
      "not json object",
    ];
    for (const bad of bads) {
      const res = await handleMembership(
        post({ ...BODY, tier: 1 + (bads.indexOf(bad) % 3) }),
        deps({
          ask: (typeof bad === "string"
            ? vi.fn(async () => bad)
            : answering(bad)) as unknown as AskFn,
        }),
      );
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ ok: false, fallback: "invalid" });
    }
  });

  it("rejects fenced or padded JSON instead of repairing it", async () => {
    const ask = vi.fn(async () => "```json\n" + JSON.stringify(GOOD) + "\n```") as unknown as AskFn;
    expect(await json(await handleMembership(post(BODY), deps({ ask })))).toEqual({
      ok: false,
      fallback: "invalid",
    });
  });

  it("rate limits per caller: 2 in ten minutes", async () => {
    const ip = "10.9.9.9";
    const results: unknown[] = [];
    for (let tier = 0; tier < 3; tier++) {
      // distinct inputs so the cache never answers instead of the limiter
      const res = await handleMembership(post({ ...BODY, tier }, ip), deps());
      results.push((await json(res))["ok"]);
    }
    expect(results).toEqual([true, true, false]);
    const limited = await handleMembership(post({ ...BODY, tier: 3 }, ip), deps());
    expect(await json(limited)).toEqual({ ok: false, fallback: "rate_limited" });
    // someone else is unaffected
    const other = await handleMembership(post({ ...BODY, tier: 3 }, "10.9.9.10"), deps());
    expect((await json(other))["ok"]).toBe(true);
  });

  it("answers rate_limited once the instance-wide ceiling is spent", async () => {
    const ask = answering(GOOD);
    let ok = 0;
    for (let i = 0; i < LIMITS.planGlobal.max + 5; i++) {
      const body = {
        ...BODY,
        domains: { ...BODY.domains, CAREER: (i % 10) / 10, LEARNING: Math.floor(i / 10) / 10 },
      };
      const res = await handleMembership(
        post(body, `10.8.${Math.floor(i / 200)}.${(i % 200) + 1}`),
        deps({ ask }),
      );
      if ((await json(res))["ok"] === true) ok++;
    }
    expect(ok).toBeLessThanOrEqual(LIMITS.planGlobal.max);
    expect(ok).toBeGreaterThan(0);
  });

  it("kill switch VITE_MEMBERSHIP_AI=off answers `off` without asking, caching or spending budget", async () => {
    const ask = answering(GOOD);
    for (const v of ["off", "OFF", "0", "false"]) {
      const res = await handleMembership(
        post(BODY, "10.7.7.7"),
        deps({ ask }, { VITE_MEMBERSHIP_AI: v }),
      );
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ ok: false, fallback: "off" });
    }
    expect(ask).not.toHaveBeenCalled();
    // the off requests never touched the limiter: three live calls from the same caller still start fresh
    expect(aiEnabled({ VITE_MEMBERSHIP_AI: "off" })).toBe(false);
    expect(aiEnabled({})).toBe(true);
    const live = await handleMembership(post(BODY, "10.7.7.7"), deps({ ask }));
    expect((await json(live))["ok"]).toBe(true);
  });

  it("answers `unconfigured` with no key, and never calls Gemini", async () => {
    const ask = answering(GOOD);
    const res = await handleMembership(post(BODY), deps({ ask, apiKey: () => null }));
    expect(await json(res)).toEqual({ ok: false, fallback: "unconfigured" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("maps Gemini failures to enum fallbacks and leaks no model, key or quota text", async () => {
    const cases: Array<[unknown, string]> = [
      [
        new GeminiError("quota exceeded for gemini-3.5-flash-lite key AIza123", "rate_limited"),
        "rate_limited",
      ],
      [new GeminiError("timed out on gemini-flash-lite-latest", "timeout"), "timeout"],
      [new GeminiError("bad reply from models/gemini-3.5-flash-lite", "invalid"), "invalid"],
      [new GeminiError("503 model overloaded", "upstream"), "upstream"],
      [new Error("ECONNRESET api key=AIza123"), "upstream"],
    ];
    for (const [err, want] of cases) {
      const ask = vi.fn(async () => {
        throw err;
      }) as unknown as AskFn;
      const logs: string[] = [];
      const res = await handleMembership(
        post({ ...BODY, tier: 1 + (cases.findIndex((c) => c[0] === err) % 3) }),
        deps({ ask, log: (m) => logs.push(m) }),
      );
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ ok: false, fallback: want });
      expect(text).not.toMatch(/gemini|flash|lite|quota|AIza|key|model|503/i);
      expect(logs.join(" ")).not.toMatch(/AIza|quota exceeded/i);
    }
  });

  it("400 for a malformed request, 413 for an oversize one, 405 for any other method", async () => {
    expect((await handleMembership(post("not json"), deps())).status).toBe(400);
    expect((await handleMembership(post({ ...BODY, age: 14 }), deps())).status).toBe(400);
    expect((await handleMembership(post({ ...BODY, profileType: "teacher" }), deps())).status).toBe(
      400,
    );
    expect((await handleMembership(post(""), deps())).status).toBe(400);
    const big = post(JSON.stringify({ ...BODY, pad: "x".repeat(MAX_BODY_BYTES + 10) }));
    expect((await handleMembership(big, deps())).status).toBe(413);
    const m = methodNotAllowed();
    expect(m.status).toBe(405);
    expect(m.headers.get("allow")).toBe("POST");
  });

  it("the choice it returns always passes the shared validator", async () => {
    const res = await handleMembership(post(BODY), deps());
    const body = (await json(res)) as { choice: unknown };
    expect(validateChoice(body.choice, "jobseeker").ok).toBe(true);
    const parsed = parseChooserRequest(BODY);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(validateChoice(fallbackChoice(parsed.value), "jobseeker").ok).toBe(true);
  });
});
