import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { GeminiError, ask as realAsk } from "@/lib/gemini";
import { summarize } from "../core/analyzer/summarize";
import { decide, engineWith, ev, validRequest as validRequestFor } from "../core/analyzer/testing";
import { validateDecision } from "../core/ui-state/validate";
import {
  BEHAVIOUR_MODES,
  EVOLUTION_STATES,
  HOME_LAYOUTS,
  NAV_MODES,
  PRIORITY_ACTION_IDS,
} from "../config/ids";
import { LruCache } from "./cache";
import {
  EVOLUTION_CALL,
  EVOLUTION_MODELS,
  handleEvolution,
  methodNotAllowed,
  type HandlerDeps,
} from "./handler";
import { REFERENCE, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { MAX_BODY_BYTES } from "./request";
import { buildResponseSchema } from "./schema";

/* ── fixtures ────────────────────────────────────────────────────── */

interface Envelope {
  status: number;
  body: {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
  };
}
const DIR = fileURLToPath(new URL("../__fixtures__/gemini/", import.meta.url));
const NAMES = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();
const load = (name: string): Envelope =>
  JSON.parse(readFileSync(`${DIR}${name}.json`, "utf8")) as Envelope;
const textOf = (e: Envelope): string | undefined =>
  e.body.candidates?.[0]?.content?.parts?.[0]?.text;

const fixtureFetch = (name: string): typeof fetch => {
  const e = load(name);
  return (async () => new Response(JSON.stringify(e.body), { status: e.status })) as typeof fetch;
};

/** What the model's reply is expected to do, by fixture name. */
const EXPECTED: Record<string, "valid" | "invalid" | "rate_limited" | "upstream"> = {
  "valid-learning-explorer": "valid",
  "valid-career-seeker": "valid",
  "valid-skill-builder": "valid",
  "valid-community-explorer": "valid",
  "valid-fast-user": "valid",
  "invalid-unknown-enum": "invalid",
  "invalid-extra-key": "invalid",
  "invalid-incoherent-nav": "invalid",
  "invalid-html-reason": "invalid",
  "invalid-confidence-high": "invalid",
  "prose-in-fence": "invalid",
  "truncated-max-tokens": "invalid",
  "empty-candidates": "invalid",
  "error-429": "rate_limited",
  "error-404": "upstream",
  "error-503": "upstream",
};

/* ── harness ─────────────────────────────────────────────────────── */

let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

function post(body: unknown, headers: Record<string, string> = {}, ip = nextIp()): Request {
  return new Request("https://swayam.test/api/evolution", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function deps(
  over: Partial<HandlerDeps> = {},
  env: Record<string, string> = {},
): Partial<HandlerDeps> {
  return {
    env: () => ({ NODE_ENV: "test", ...env }),
    apiKey: () => "test-key",
    cache: new LruCache<never>() as unknown as HandlerDeps["cache"],
    log: () => {},
    ...over,
  };
}

const withFixture = (name: string): Partial<HandlerDeps> => ({
  ask: (turns, opts) => realAsk(turns, { ...opts, fetchImpl: fixtureFetch(name) }),
});

const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const req1 = () => validRequestFor();

/* ── the validator over every fixture ────────────────────────────── */

describe("recorded fixtures", () => {
  it("every fixture file has an expectation, and vice versa", () => {
    expect(NAMES).toEqual(Object.keys(EXPECTED).sort());
    expect(NAMES.filter((n) => n.startsWith("valid-"))).toHaveLength(5);
  });

  for (const name of NAMES) {
    it(`validator verdict: ${name}`, () => {
      const e = load(name);
      const want = EXPECTED[name];
      if (want === "rate_limited" || want === "upstream") {
        expect(e.status).not.toBe(200);
        return;
      }
      const cand = e.body.candidates?.[0];
      if (name === "empty-candidates") return expect(cand).toBeUndefined();
      if (name === "truncated-max-tokens") return expect(cand?.finishReason).not.toBe("STOP");
      let parsed: unknown;
      try {
        parsed = JSON.parse(textOf(e) ?? "");
      } catch {
        parsed = undefined;
      }
      const verdict = validateDecision(parsed, "ai");
      expect(verdict.ok).toBe(want === "valid");
    });
  }
});

/* ── the route handler, fixtures through the real ask() ──────────── */

describe("handleEvolution through gemini.ts with recorded replies", () => {
  for (const name of NAMES) {
    it(`${name} → ${EXPECTED[name]}`, async () => {
      const res = await handleEvolution(post(req1()), deps(withFixture(name)));
      expect(res.status).toBe(200);
      const body = await json(res);
      const want = EXPECTED[name];
      if (want === "valid") {
        expect(body["ok"]).toBe(true);
        expect(body["source"]).toBe("ai");
        expect(body["decision"]).toEqual(JSON.parse(textOf(load(name))!));
      } else {
        expect(body).toEqual({ ok: false, fallback: want });
      }
    });
  }
});

describe("handleEvolution", () => {
  it("caches a valid answer: the second identical summary costs no call and no quota", async () => {
    const ask = vi.fn(async () => JSON.stringify(decide("CAREER_FIRST", "RESEARCH", 0.8)));
    const shared = deps({ ask: ask as unknown as HandlerDeps["ask"] });
    const first = await json(await handleEvolution(post(req1()), shared));
    const second = await json(await handleEvolution(post(req1()), shared));
    expect(first["ok"]).toBe(true);
    expect(first["cached"]).toBeUndefined();
    expect(second["cached"]).toBe(true);
    expect(second["decision"]).toEqual(first["decision"]);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const ask = vi.fn(async () => {
      throw new GeminiError("Gemini failed. x", "upstream");
    });
    const shared = deps({ ask: ask as unknown as HandlerDeps["ask"] });
    await handleEvolution(post(req1()), shared);
    await handleEvolution(post(req1()), shared);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("calls Gemini with lite models only, a generated enum schema and cold, short settings", async () => {
    const ask = vi.fn(async () => JSON.stringify(decide("CAREER_FIRST")));
    await handleEvolution(post(req1()), deps({ ask: ask as unknown as HandlerDeps["ask"] }));
    const [turns, opts] = ask.mock.calls[0] as unknown as Parameters<HandlerDeps["ask"]>;
    expect(opts).toMatchObject({
      json: true,
      apiKey: "test-key",
      models: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"],
      temperature: 0.1,
      maxTokens: 300,
      timeoutMs: 3500,
      deadlineMs: 6000,
    });
    expect(EVOLUTION_MODELS).toEqual(opts?.models);
    expect(EVOLUTION_CALL.maxTokens).toBe(300);
    expect(opts?.models).not.toContain("gemini-3.5-flash");
    expect(opts?.system).toBe(SYSTEM_PROMPT);
    expect(turns[0]!.content).toBe(buildUserPrompt(req1()));
    expect(opts?.responseSchema).toEqual(buildResponseSchema());
  });

  it("maps a Gemini timeout to the timeout fallback", async () => {
    const ask = vi.fn(async () => {
      throw new GeminiError("Gemini failed. timed out", "timeout");
    });
    const body = await json(
      await handleEvolution(post(req1()), deps({ ask: ask as unknown as HandlerDeps["ask"] })),
    );
    expect(body).toEqual({ ok: false, fallback: "timeout" });
  });

  it("never returns model names, quota text or the key, even on failure", async () => {
    for (const name of ["error-429", "error-503", "invalid-extra-key", "truncated-max-tokens"]) {
      const res = await handleEvolution(post(req1()), deps(withFixture(name)));
      const text = JSON.stringify(await res.json());
      expect(text).not.toMatch(/gemini|flash|lite|quota|exhausted|overloaded|test-key/i);
    }
  });

  it("answers unconfigured when there is no key", async () => {
    const body = await json(await handleEvolution(post(req1()), deps({ apiKey: () => null })));
    expect(body).toEqual({ ok: false, fallback: "unconfigured" });
  });

  it("answers off, and fails closed on an unknown mode", async () => {
    for (const mode of ["off", "OFF", "banana"]) {
      const ask = vi.fn();
      const body = await json(
        await handleEvolution(
          post(req1()),
          deps({ ask: ask as unknown as HandlerDeps["ask"] }, { EVOLUTION_AI_MODE: mode }),
        ),
      );
      expect(body).toEqual({ ok: false, fallback: "off" });
      expect(ask).not.toHaveBeenCalled();
    }
  });

  it("fixture mode answers a valid decision without touching Gemini", async () => {
    const ask = vi.fn();
    const career = validRequestFor({ scores: { careerAffinity: 0.7 } });
    const res = await handleEvolution(
      post(career),
      deps({ ask: ask as unknown as HandlerDeps["ask"] }, { EVOLUTION_AI_MODE: "fixture" }),
    );
    const body = await json(res);
    expect(body["ok"]).toBe(true);
    expect((body["decision"] as { primaryState: string }).primaryState).toBe("CAREER_FIRST");
    expect(validateDecision(body["decision"], "ai").ok).toBe(true);
    expect(ask).not.toHaveBeenCalled();
    // A request with no standout domain gets the quick-user sample.
    const flat = await json(
      await handleEvolution(
        post(validRequestFor({ scores: { careerAffinity: 0, learningAffinity: 0 } })),
        deps({}, { EVOLUTION_AI_MODE: "fixture" }),
      ),
    );
    expect((flat["decision"] as { behaviourMode: string }).behaviourMode).toBe("QUICK");
  });

  it("dev header drives each failure path, and is ignored in production", async () => {
    const cases = [
      ["timeout", "timeout"],
      ["invalid", "invalid"],
      ["rate_limited", "rate_limited"],
      ["unavailable", "upstream"],
    ] as const;
    for (const [header, fallback] of cases) {
      const ask = vi.fn();
      const body = await json(
        await handleEvolution(
          post(req1(), { "x-evolution-fixture": header }),
          deps({ ask: ask as unknown as HandlerDeps["ask"] }),
        ),
      );
      expect(body).toEqual({ ok: false, fallback });
      expect(ask).not.toHaveBeenCalled();
    }
    const prod = await json(
      await handleEvolution(
        post(req1(), { "x-evolution-fixture": "timeout" }),
        deps(
          { ask: (async () => JSON.stringify(decide("CAREER_FIRST"))) as HandlerDeps["ask"] },
          {
            NODE_ENV: "production",
          },
        ),
      ),
    );
    expect(prod["ok"]).toBe(true);
    // An unknown header value is ignored, not an error.
    const unknown = await json(
      await handleEvolution(
        post(req1(), { "x-evolution-fixture": "banana" }),
        deps({ ask: (async () => JSON.stringify(decide("CAREER_FIRST"))) as HandlerDeps["ask"] }),
      ),
    );
    expect(unknown["ok"]).toBe(true);
  });

  it("limits a caller to 3 live calls in ten minutes", async () => {
    const ip = nextIp();
    const ask = vi.fn(async () => JSON.stringify(decide("CAREER_FIRST")));
    const shared = deps({ ask: ask as unknown as HandlerDeps["ask"] });
    const results: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      // A different summary each time, so the cache cannot answer.
      const r = validRequestFor({ meaningful: 20 + i * 10 });
      results.push(await json(await handleEvolution(post(r, {}, ip), shared)));
    }
    expect(results.slice(0, 3).every((r) => (r as { ok: boolean }).ok)).toBe(true);
    expect(results[3]).toEqual({ ok: false, fallback: "rate_limited" });
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it("a forged first x-forwarded-for hop buys no extra calls: the last hop is the caller", async () => {
    const real = nextIp();
    const ask = vi.fn(async () => JSON.stringify(decide("CAREER_FIRST")));
    const shared = deps({ ask: ask as unknown as HandlerDeps["ask"] });
    const results: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      const r = validRequestFor({ meaningful: 20 + i * 10 });
      const forged = `203.0.113.${i + 1}, ${real}`;
      results.push(await json(await handleEvolution(post(r, {}, forged), shared)));
    }
    expect(results[3]).toEqual({ ok: false, fallback: "rate_limited" });
    expect(ask).toHaveBeenCalledTimes(3);
  });

  describe("bad requests are the only 400", () => {
    const good = () => JSON.parse(JSON.stringify(req1())) as Record<string, unknown>;
    const cases: Array<[string, () => unknown]> = [
      ["not JSON", () => "{nope"],
      ["an array", () => []],
      ["null", () => null],
      ["an unknown top-level key", () => ({ ...good(), userId: "u1" })],
      [
        "a missing key",
        () => {
          const g = good();
          delete g["navPattern"];
          return g;
        },
      ],
      ["free text smuggled in", () => ({ ...good(), note: "my name is Asha" })],
      ["a wrong version", () => ({ ...good(), v: 2 })],
      ["an unknown trigger", () => ({ ...good(), trigger: "now" })],
      [
        "a score out of range",
        () => ({ ...good(), scores: { ...(good()["scores"] as object), explorer: 1.5 } }),
      ],
      [
        "an extra score key",
        () => ({ ...good(), scores: { ...(good()["scores"] as object), age: 0.3 } }),
      ],
      [
        "an unknown event type",
        () => ({ ...good(), topActions: [{ type: "ssn_entered", count: 1 }] }),
      ],
      [
        "an extra key inside topActions",
        () => ({ ...good(), topActions: [{ type: "job_viewed", count: 1, id: "opp_1" }] }),
      ],
      [
        "too many topActions",
        () => ({
          ...good(),
          topActions: Array.from({ length: 9 }, () => ({ type: "job_viewed", count: 1 })),
        }),
      ],
      ["an unknown nav item", () => ({ ...good(), navPattern: ["ADMIN"] })],
      [
        "a long navPattern",
        () => ({ ...good(), navPattern: Array.from({ length: 11 }, () => "JOBS") }),
      ],
      [
        "a negative session count",
        () => ({ ...good(), session: { events: -1, minutes: 0, sessions: 1, completed: 0 } }),
      ],
      ["a bad tier", () => ({ ...good(), current: { ...(good()["current"] as object), tier: 7 } })],
      [
        "an incoherent deterministic decision",
        () => ({
          ...good(),
          deterministic: { ...decide("CAREER_FIRST"), navigationMode: "LEARNING_PRIORITY" },
        }),
      ],
    ];
    for (const [label, make] of cases) {
      it(`400 for ${label}`, async () => {
        const res = await handleEvolution(post(make()), deps());
        expect(res.status).toBe(400);
        expect(await json(res)).toEqual({ error: "Bad request." });
      });
    }
  });

  describe("size gate and methods", () => {
    /** A POST whose body is a lazy stream, so a test can see whether (and how much) it was read. */
    function streamed(headers: Record<string, string>, chunk = 1_000) {
      const seen = { pulled: 0, cancelled: false };
      const body = new ReadableStream<Uint8Array>(
        {
          pull(c) {
            seen.pulled++;
            c.enqueue(new Uint8Array(chunk).fill(120));
          },
          cancel() {
            seen.cancelled = true;
          },
        },
        { highWaterMark: 0 },
      );
      const request = new Request("https://swayam.test/api/evolution", {
        method: "POST",
        body,
        duplex: "half",
        headers: { "x-forwarded-for": nextIp(), ...headers },
      } as RequestInit);
      return { request, seen };
    }

    it("a body over the cap is a 413, not a 400", async () => {
      const res = await handleEvolution(post(JSON.stringify({ pad: "x".repeat(9_000) })), deps());
      expect(res.status).toBe(413);
      expect(await json(res)).toEqual({ error: "Request too large." });
    });

    it("an oversize content-length is refused before a single byte is read", async () => {
      const { request, seen } = streamed({ "content-length": String(MAX_BODY_BYTES + 1) });
      const res = await handleEvolution(request, deps());
      expect(res.status).toBe(413);
      expect(seen.pulled).toBe(0);
    });

    it("a body with no (or a lying) content-length is cut at the cap and the source cancelled", async () => {
      const { request, seen } = streamed({ "content-length": "10" });
      const res = await handleEvolution(request, deps());
      expect(res.status).toBe(413);
      expect(seen.cancelled).toBe(true);
      expect(seen.pulled).toBeLessThanOrEqual(Math.ceil(MAX_BODY_BYTES / 1_000) + 1);
    });

    it("a body exactly at the cap is read, then judged on its content", async () => {
      const res = await handleEvolution(post("x".repeat(MAX_BODY_BYTES)), deps());
      expect(res.status).toBe(400);
    });

    it("every method but POST is a 405 with Allow: POST", async () => {
      const res = methodNotAllowed();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await json(res)).toEqual({ error: "Method not allowed." });
    });
  });

  it("a valid request in the same shape the summariser produces is accepted", async () => {
    const engine = engineWith({
      meaningful: 30,
      domains: { CAREER: 20, LEARNING: 10 },
      countsByType: { job_viewed: 20 },
    });
    const r = summarize(engine, [ev("job_viewed")], "lab");
    const res = await handleEvolution(post(r), deps({}, { EVOLUTION_AI_MODE: "fixture" }));
    expect(res.status).toBe(200);
  });
});

/* ── prompt, schema, cache ───────────────────────────────────────── */

describe("prompt and schema", () => {
  it("the schema enums are exactly the ids.ts tuples", () => {
    const p = buildResponseSchema()["properties"] as Record<
      string,
      { enum?: string[]; items?: { enum: string[] } }
    >;
    expect(p["primaryState"]!.enum).toEqual([...EVOLUTION_STATES]);
    expect(p["behaviourMode"]!.enum).toEqual([...BEHAVIOUR_MODES]);
    expect(p["navigationMode"]!.enum).toEqual([...NAV_MODES]);
    expect(p["homepageLayout"]!.enum).toEqual([...HOME_LAYOUTS]);
    expect(p["priorityActions"]!.items!.enum).toEqual([...PRIORITY_ACTION_IDS]);
    expect(buildResponseSchema()["required"]).toHaveLength(7);
  });

  it("forbids code, markup, URLs and commands, and lists every state with its allowed modes", () => {
    expect(SYSTEM_PROMPT).toMatch(/never output code, markup, html, css, urls, commands/i);
    expect(SYSTEM_PROMPT).toMatch(/only from the listed values/i);
    for (const s of EVOLUTION_STATES) expect(REFERENCE).toContain(`${s}:`);
    // The prompt's promised modes come from the validator, so a promised pair always validates.
    expect(REFERENCE).toMatch(/UNIVERSAL: .*behaviourMode one of BALANCED,QUICK,MINIMAL/);
    expect(REFERENCE).toMatch(/EXPLORER: .*behaviourMode one of EXPLORER/);
  });

  it("the user prompt carries aggregates only, and not the client's local reason text", () => {
    const r = validRequestFor();
    r.deterministic = { ...r.deterministic, reason: "CLIENT-SUPPLIED-TEXT" };
    const prompt = buildUserPrompt(r);
    expect(prompt).not.toContain("CLIENT-SUPPLIED-TEXT");
    expect(prompt).toContain("onDeviceDecision");
  });
});

describe("LruCache", () => {
  it("evicts the least recently used past 200 entries", () => {
    const c = new LruCache<number>(200, 1_000);
    for (let i = 0; i < 200; i++) c.set(`k${i}`, i, 0);
    expect(c.get("k0", 1)).toBe(0); // touch k0
    c.set("new", 1, 2);
    expect(c.size).toBe(200);
    expect(c.get("k1", 3)).toBeUndefined();
    expect(c.get("k0", 3)).toBe(0);
  });

  it("expires entries after the TTL", () => {
    const c = new LruCache<number>(200, 24 * 60 * 60_000);
    c.set("a", 1, 0);
    expect(c.get("a", 24 * 60 * 60_000)).toBe(1);
    expect(c.get("a", 24 * 60 * 60_000 + 1)).toBeUndefined();
  });
});
