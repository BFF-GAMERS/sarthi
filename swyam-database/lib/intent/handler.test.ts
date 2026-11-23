import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiError } from "@/lib/gemini";
import { _resetBuckets } from "@/lib/rate-limit";
import {
  INTENT_CALL,
  INTENT_MODELS,
  buildIntentSchema,
  handleIntent,
  methodNotAllowed,
  toMatch,
  type IntentDeps,
  type IntentResponse,
} from "./handler";
import { INTENT_KINDS, INTENT_ROUTE_IDS } from "./routes";

let callers = 0;
/** Each request is a different caller unless a test names one, so the per-caller budget never leaks between them. */
const post = (body: unknown, ip = `10.0.${Math.floor(++callers / 250)}.${callers % 250}`) =>
  new Request("http://localhost/api/intent", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const answer = (o: unknown) => vi.fn(async (..._args: unknown[]) => JSON.stringify(o));
const deps = (over: Partial<IntentDeps> = {}): Partial<IntentDeps> => ({
  env: () => ({}),
  apiKey: () => "test-key",
  now: () => 1_000_000,
  log: () => {},
  cache: new Map(),
  limits: () => ({
    burst: { name: "t-burst", max: 2, windowMs: 60_000 },
    day: { name: "t-day", max: 50, windowMs: 86_400_000 },
    global: { name: "t-global", max: 500, windowMs: 86_400_000 },
  }),
  ...over,
});
const json = async (r: Response) => (await r.json()) as IntentResponse;

beforeEach(() => _resetBuckets());

describe("model constraints", () => {
  it("the schema offers only allowlisted route ids (plus NONE) and the filter enums", () => {
    const s = buildIntentSchema() as {
      properties: Record<string, { enum: string[] }>;
      required: string[];
    };
    expect(s.properties["routeId"]!.enum).toEqual([...INTENT_ROUTE_IDS, "NONE"]);
    expect(s.properties["kind"]!.enum).toEqual([...INTENT_KINDS, "any"]);
    expect(s.properties["remote"]!.enum).toEqual(["yes", "no"]);
    expect(Object.keys(s.properties).sort()).toEqual(["free", "kind", "remote", "routeId"]);
    expect(s.properties["routeId"]!.enum).not.toContain("LAB");
  });

  it("calls lite models only, cold, with a 2 s ceiling", async () => {
    const ask = answer({ routeId: "EVENTS" });
    await handleIntent(post({ phrase: "xyzzy plugh" }), deps({ ask: ask as never }));
    expect(INTENT_MODELS.every((name) => name.includes("lite"))).toBe(true);
    const opts = ask.mock.calls[0]![1] as Record<string, unknown>;
    expect(opts["models"]).toEqual(INTENT_MODELS);
    expect(opts["json"]).toBe(true);
    expect(opts["responseSchema"]).toEqual(buildIntentSchema());
    expect(opts["temperature"]).toBe(0);
    expect(INTENT_CALL.deadlineMs).toBeLessThanOrEqual(2000);
    expect(opts["deadlineMs"]).toBe(INTENT_CALL.deadlineMs);
  });

  it("sends the model only the scrubbed phrase", async () => {
    const ask = answer({ routeId: "EVENTS" });
    await handleIntent(
      post({ phrase: "xyzzy plugh me@mail.com 9876543210 https://x.example" }),
      deps({ ask: ask as never }),
    );
    const content = (ask.mock.calls[0]![0] as Array<{ content: string }>)[0]!.content;
    expect(content).toBe('Phrase: "xyzzy plugh"');
  });
});

describe("answers", () => {
  it("returns a validated match from the model", async () => {
    const ask = answer({ routeId: "OPPORTUNITIES", kind: "internship", remote: "yes", free: "no" });
    const r = await json(
      await handleIntent(post({ phrase: "xyzzy plugh" }), deps({ ask: ask as never })),
    );
    expect(r).toEqual({
      ok: true,
      source: "ai",
      match: { routeId: "OPPORTUNITIES", filters: { kind: "internship", remote: "1" } },
    });
  });

  it("uses no model at all when a keyword hits", async () => {
    const ask = vi.fn();
    const r = await json(
      await handleIntent(post({ phrase: "remote naukri" }), deps({ ask: ask as never })),
    );
    expect(r).toEqual({
      ok: true,
      source: "keyword",
      match: { routeId: "OPPORTUNITIES", filters: { kind: "job", remote: "1" } },
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it("toMatch drops filters off OPPORTUNITIES and rejects NONE and anything off the list", () => {
    expect(toMatch({ routeId: "JOBS", kind: "job", remote: "yes" })).toEqual({
      routeId: "JOBS",
      filters: {},
    });
    expect(toMatch({ routeId: "NONE" })).toBeNull();
    expect(toMatch({ routeId: "LAB" })).toBeNull();
    expect(toMatch({ routeId: "OPPORTUNITIES", kind: "crime" })).toBeNull();
    expect(toMatch("JOBS")).toBeNull();
    expect(toMatch(null)).toBeNull();
  });

  it("caches a model answer so the same phrase costs one call", async () => {
    const ask = answer({ routeId: "EVENTS" });
    const d = deps({ ask: ask as never });
    await handleIntent(post({ phrase: "xyzzy plugh" }), d);
    const again = await json(await handleIntent(post({ phrase: "XYZZY  plugh!" }), d));
    expect(again.ok).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});

describe("fallbacks (always a 200 with no detail)", () => {
  const expectFallback = async (r: Response, fallback: string) => {
    expect(r.status).toBe(200);
    const body = await json(r);
    expect(body).toEqual({ ok: false, fallback });
    expect(JSON.stringify(body)).not.toMatch(/gemini|key|quota/i);
  };

  it("no key -> unconfigured, and no call", async () => {
    const ask = vi.fn();
    await expectFallback(
      await handleIntent(
        post({ phrase: "xyzzy plugh" }),
        deps({ apiKey: () => null, ask: ask as never }),
      ),
      "unconfigured",
    );
    expect(ask).not.toHaveBeenCalled();
  });

  it("kill switch -> off", async () => {
    const ask = vi.fn();
    await expectFallback(
      await handleIntent(
        post({ phrase: "xyzzy plugh" }),
        deps({ env: () => ({ INTENT_AI_MODE: "off" }), ask: ask as never }),
      ),
      "off",
    );
    expect(ask).not.toHaveBeenCalled();
  });

  it("model failure kinds map to a fallback", async () => {
    for (const [kind, fallback] of [
      ["timeout", "timeout"],
      ["rate_limited", "rate_limited"],
      ["invalid", "invalid"],
      ["upstream", "upstream"],
    ] as const) {
      const ask = vi.fn(async () => {
        throw new GeminiError("boom", kind);
      });
      await expectFallback(
        await handleIntent(post({ phrase: `xyzzy ${kind}` }), deps({ ask: ask as never })),
        fallback,
      );
    }
    const plain = vi.fn(async () => {
      throw new Error("network");
    });
    await expectFallback(
      await handleIntent(post({ phrase: "xyzzy plain" }), deps({ ask: plain as never })),
      "upstream",
    );
  });

  it("an answer that is not JSON, or names a place off the list, is no match", async () => {
    const junk = vi.fn(async () => "sure! go to /admin");
    await expectFallback(
      await handleIntent(post({ phrase: "xyzzy one" }), deps({ ask: junk as never })),
      "invalid",
    );
    for (const bad of [{ routeId: "NONE" }, { routeId: "LAB" }, { routeId: "/admin" }]) {
      await expectFallback(
        await handleIntent(
          post({ phrase: `xyzzy ${bad.routeId}` }),
          deps({ ask: answer(bad) as never }),
        ),
        "no_match",
      );
    }
  });

  it("is rate limited per caller, and keyword hits do not spend the budget", async () => {
    const ask = answer({ routeId: "EVENTS" });
    const d = deps({ ask: ask as never });
    const same = "9.9.9.9";
    expect((await json(await handleIntent(post({ phrase: "xyzzy a" }, same), d))).ok).toBe(true);
    expect((await json(await handleIntent(post({ phrase: "xyzzy b" }, same), d))).ok).toBe(true);
    await expectFallback(await handleIntent(post({ phrase: "xyzzy c" }, same), d), "rate_limited");
    expect(ask).toHaveBeenCalledTimes(2);
    // Another caller has their own budget; a keyword hit needs none.
    expect((await json(await handleIntent(post({ phrase: "xyzzy d" }, "8.8.8.8"), d))).ok).toBe(
      true,
    );
    expect((await json(await handleIntent(post({ phrase: "jobs" }, same), d))).ok).toBe(true);
  });

  it("the shared ceiling stops everyone", async () => {
    const ask = answer({ routeId: "EVENTS" });
    const d = deps({
      ask: ask as never,
      limits: () => ({
        burst: { name: "g-burst", max: 50, windowMs: 60_000 },
        day: { name: "g-day", max: 50, windowMs: 86_400_000 },
        global: { name: "g-global", max: 1, windowMs: 86_400_000 },
      }),
    });
    expect((await json(await handleIntent(post({ phrase: "xyzzy a" }, "1.1.1.1"), d))).ok).toBe(
      true,
    );
    await expectFallback(
      await handleIntent(post({ phrase: "xyzzy b" }, "2.2.2.2"), d),
      "rate_limited",
    );
  });

  it("a tiny phrase is no match without a call", async () => {
    const ask = vi.fn();
    await expectFallback(
      await handleIntent(post({ phrase: "x" }), deps({ ask: ask as never })),
      "no_match",
    );
    expect(ask).not.toHaveBeenCalled();
  });
});

describe("request handling", () => {
  it("400 for a malformed body, 413 for an oversize one, 405 for other methods", async () => {
    expect((await handleIntent(post("{nope"), deps())).status).toBe(400);
    expect((await handleIntent(post({ phrase: 5 }), deps())).status).toBe(400);
    expect((await handleIntent(post({ phrase: "a".repeat(5000) }), deps())).status).toBe(413);
    const m = methodNotAllowed();
    expect(m.status).toBe(405);
    expect(m.headers.get("allow")).toBe("POST");
  });
});
