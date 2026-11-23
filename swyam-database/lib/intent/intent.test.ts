import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { NAV_REGISTRY } from "@/evolution/config/navigation";
import { confirmQuestion, describeMatch } from "./describe";
import { START, intentFlow, type IntentFlow } from "./flow";
import { matchKeywords, normalizePhrase } from "./keywords";
import { scrubPhrase } from "./phrase";
import { resolveIntent } from "./resolve";
import { INTENT_ROUTE_IDS, INTENT_SUGGESTIONS, hrefForMatch, type IntentMatch } from "./routes";
import { isAllowedHref, validateIntent } from "./validate";

const tx = (s: string) => s;
const m = (routeId: string, filters: Record<string, string> = {}) => ({ routeId, filters });

describe("allowlist", () => {
  it("is the registry's own ids minus the demo lab", () => {
    expect(INTENT_ROUTE_IDS).toContain("JOBS");
    expect(INTENT_ROUTE_IDS).not.toContain("LAB");
    for (const id of INTENT_ROUTE_IDS) expect(NAV_REGISTRY[id]).toBeTruthy();
  });

  it("every suggestion is itself valid", () => {
    for (const s of INTENT_SUGGESTIONS) expect(validateIntent(s)).toEqual(s);
  });
});

describe("keyword matcher", () => {
  const cases: Array<[string, string, Record<string, string>]> = [
    ["internships", "INTERNSHIPS", {}],
    ["I want a job", "JOBS", {}],
    ["naukri", "JOBS", {}],
    ["mujhe naukri chahiye", "JOBS", {}],
    ["kuch sikhna hai", "COURSES", {}],
    ["kursa", "COURSES", {}],
    ["free courses", "OPPORTUNITIES", { kind: "course", free: "1" }],
    ["muft kursa", "OPPORTUNITIES", { kind: "course", free: "1" }],
    ["remote internships", "OPPORTUNITIES", { kind: "internship", remote: "1" }],
    ["work from home jobs", "OPPORTUNITIES", { kind: "job", remote: "1" }],
    ["ghar se naukri", "OPPORTUNITIES", { kind: "job", remote: "1" }],
    ["remote", "OPPORTUNITIES", { remote: "1" }],
    ["free", "OPPORTUNITIES", { free: "1" }],
    ["mere skills", "SKILL_DIRECTORY", {}],
    ["swap", "SKILLS", {}],
    ["skill swap", "SKILLS", {}],
    ["my courses", "MY_COURSES", {}],
    ["job applications", "APPLICATIONS", {}],
    ["Dashboard!", "DASHBOARD", {}],
    ["सरकारी योजना", "SCHEMES", {}],
    ["नौकरी", "JOBS", {}],
    ["मुफ्त कोर्स", "OPPORTUNITIES", { kind: "course", free: "1" }],
    ["find plumber", "SEARCH", { q: "plumber" }],
    ["khojo electrician", "SEARCH", { q: "electrician" }],
  ];
  it.each(cases)("%s", (phrase, routeId, filters) => {
    expect(matchKeywords(phrase)).toEqual({ routeId, filters });
  });

  it("every keyword answer passes the validator", () => {
    for (const [phrase] of cases) {
      const hit = matchKeywords(phrase);
      expect(validateIntent(hit), phrase).toEqual(hit);
    }
  });

  it("returns null for nothing it knows", () => {
    expect(matchKeywords("")).toBeNull();
    expect(matchKeywords("zzzz qqqq")).toBeNull();
    expect(normalizePhrase("  Café—Résumé!! ")).toBe("cafe resume");
  });
});

describe("validator", () => {
  it("accepts allowlisted routes and filters", () => {
    expect(validateIntent(m("OPPORTUNITIES", { kind: "job", remote: "1" }))).toEqual(
      m("OPPORTUNITIES", { kind: "job", remote: "1" }),
    );
    expect(validateIntent({ routeId: "JOBS" })).toEqual(m("JOBS"));
  });

  it("rejects an off-allowlist route", () => {
    for (const bad of [
      "ADMIN",
      "LAB",
      "none",
      "",
      "__proto__",
      "constructor",
      7,
      null,
      undefined,
    ]) {
      expect(validateIntent({ routeId: bad, filters: {} }), String(bad)).toBeNull();
    }
    expect(validateIntent("JOBS")).toBeNull();
    expect(validateIntent([m("JOBS")])).toBeNull();
  });

  it("rejects an off-allowlist param or value, and a filter on a route that has none", () => {
    expect(validateIntent(m("OPPORTUNITIES", { kind: "crime" }))).toBeNull();
    expect(validateIntent(m("OPPORTUNITIES", { next: "https://evil.example" }))).toBeNull();
    expect(validateIntent(m("OPPORTUNITIES", { remote: "yes" }))).toBeNull();
    expect(validateIntent(m("OPPORTUNITIES", { track: "Has Space" }))).toBeNull();
    expect(validateIntent(m("JOBS", { kind: "job" }))).toBeNull();
    expect(validateIntent(m("SEARCH", { q: "<script>" }))).toBeNull();
    expect(validateIntent(m("SEARCH", { q: "x".repeat(61) }))).toBeNull();
    expect(
      validateIntent({ routeId: "JOBS", filters: JSON.parse('{"__proto__":"x"}') }),
    ).toBeNull();
    expect(validateIntent({ routeId: "JOBS", filters: "kind=job" })).toBeNull();
  });

  it("never lets an unvalidated link through", () => {
    const ok = ["/", "/jobs", "/opportunities?kind=internship&remote=1", "/search?q=plumber"];
    for (const h of ok) expect(isAllowedHref(h), h).toBe(true);
    const registry = [NAV_REGISTRY.MATCHES.member, NAV_REGISTRY.PRACTICE.visitor];
    for (const h of registry) expect(isAllowedHref(h), h).toBe(true);
    const bad = [
      "//evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/\\evil.example",
      "/admin",
      "/jobs?kind=job",
      "/opportunities?kind=crime",
      "/opportunities?kind=job&kind=course",
      "/opportunities?next=/admin",
      "/opportunities#top",
      "/auth?mode=login&next=%2Fadmin",
      "/jobs\n",
      "/jobs x",
      "",
      "/" + "a".repeat(500),
    ];
    for (const h of bad) expect(isAllowedHref(h), h).toBe(false);
    expect(isAllowedHref(undefined)).toBe(false);
  });

  it("builds links only from validated matches, for members and visitors", () => {
    const match = validateIntent(m("OPPORTUNITIES", { kind: "internship", remote: "1" }))!;
    expect(hrefForMatch(match, true)).toBe("/opportunities?kind=internship&remote=1");
    expect(isAllowedHref(hrefForMatch(match, false))).toBe(true);
    const dash = validateIntent(m("DASHBOARD"))!;
    expect(hrefForMatch(dash, false)).toBe(NAV_REGISTRY.DASHBOARD.visitor);
    expect(hrefForMatch(validateIntent(m("MATCHES"))!, true)).toBe("/skillswap?tab=matches");
    for (const id of INTENT_ROUTE_IDS) {
      for (const signedIn of [true, false])
        expect(isAllowedHref(hrefForMatch({ routeId: id, filters: {} }, signedIn)), id).toBe(true);
    }
  });
});

describe("phrase scrubbing", () => {
  it("drops addresses, links and long numbers, and is capped at 120 characters", () => {
    const s = scrubPhrase(
      "jobs for me a.b@example.com call +91 98765 43210 https://x.example/y ok",
    );
    expect(s).toBe("jobs for me call ok");
    expect(scrubPhrase("a".repeat(500)).length).toBe(120);
    expect(scrubPhrase({} as never)).toBe("");
  });
});

describe("resolve", () => {
  const body = (match: unknown) =>
    vi.fn(async () => Response.json({ ok: true, match, source: "ai" }, { status: 200 }));

  it("makes no AI call when a keyword hits", async () => {
    const fetchImpl = vi.fn();
    const r = await resolveIntent("remote internships", { fetchImpl: fetchImpl as never });
    expect(r).toEqual({
      kind: "match",
      source: "keyword",
      match: m("OPPORTUNITIES", { kind: "internship", remote: "1" }),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks the server only after a keyword miss, with the scrubbed phrase", async () => {
    const fetchImpl = body(m("EVENTS"));
    const r = await resolveIntent("zzzz qqqq me@mail.com", { fetchImpl: fetchImpl as never });
    expect(r).toEqual({ kind: "match", source: "ai", match: m("EVENTS") });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/intent");
    expect(JSON.parse(init.body as string)).toEqual({ phrase: "zzzz qqqq" });
  });

  it("re-validates the server's answer and refuses anything off the allowlist", async () => {
    for (const bad of [m("ADMIN"), m("OPPORTUNITIES", { kind: "crime" }), { routeId: "/admin" }]) {
      const r = await resolveIntent("zzzz qqqq", { fetchImpl: body(bad) as never });
      expect(r.kind).toBe("none");
    }
  });

  it("falls back to suggestions on errors, timeouts and when AI is off", async () => {
    const boom = vi.fn(async () => {
      throw new Error("network");
    });
    expect((await resolveIntent("zzzz qqqq", { fetchImpl: boom as never })).kind).toBe("none");
    const refused = vi.fn(async () => new Response("no", { status: 500 }));
    expect((await resolveIntent("zzzz qqqq", { fetchImpl: refused as never })).kind).toBe("none");
    const slow = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init.signal?.addEventListener("abort", () => rej(new Error("aborted"))),
        ),
    );
    const t = await resolveIntent("zzzz qqqq", { fetchImpl: slow as never, timeoutMs: 20 });
    expect(t.kind).toBe("none");
    const off = vi.fn();
    expect((await resolveIntent("zzzz qqqq", { ai: false, fetchImpl: off as never })).kind).toBe(
      "none",
    );
    expect(off).not.toHaveBeenCalled();
    const none = await resolveIntent("zzzz qqqq", { fetchImpl: boom as never });
    expect(none.kind === "none" && none.suggestions.length).toBeGreaterThan(0);
  });

  it("does nothing for an empty phrase", async () => {
    const fetchImpl = vi.fn();
    expect((await resolveIntent("  ", { fetchImpl: fetchImpl as never })).kind).toBe("none");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("confirm is always required", () => {
  const match = m("OPPORTUNITIES", { kind: "internship", remote: "1" }) as IntentMatch;
  const go = { type: "go", signedIn: true } as const;

  it("a result, from keyword or AI or a suggestion, lands on confirm, never on going", () => {
    for (const source of ["keyword", "ai"] as const) {
      let s: IntentFlow = intentFlow(START, { type: "submit", phrase: "remote internships" });
      expect(s.step).toBe("resolving");
      s = intentFlow(s, { type: "resolved", result: { kind: "match", match, source } });
      expect(s.step).toBe("confirm");
    }
    let s: IntentFlow = intentFlow(START, { type: "submit", phrase: "zzzz" });
    s = intentFlow(s, {
      type: "resolved",
      result: { kind: "none", suggestions: [...INTENT_SUGGESTIONS] },
    });
    expect(s.step).toBe("none");
    s = intentFlow(s, { type: "pick", match: INTENT_SUGGESTIONS[0]! });
    expect(s.step).toBe("confirm");
  });

  it("go does nothing unless the flow is on confirm", () => {
    const early: IntentFlow[] = [
      START,
      { step: "resolving", phrase: "x" },
      { step: "none", suggestions: [] },
    ];
    for (const s of early) expect(intentFlow(s, go)).toBe(s);
  });

  it("only go from confirm yields a link, and it is an allowlisted one", () => {
    const confirm: IntentFlow = { step: "confirm", match, source: "keyword" };
    const next = intentFlow(confirm, go);
    expect(next).toEqual({ step: "going", href: "/opportunities?kind=internship&remote=1" });
    expect(intentFlow(confirm, { type: "change" })).toEqual(START);
    const tampered: IntentFlow = {
      step: "confirm",
      match: { routeId: "OPPORTUNITIES", filters: { next: "//evil.example" } },
      source: "ai",
    };
    expect(intentFlow(tampered, go)).toEqual(START);
  });

  it("a late answer after the person moved on is ignored", () => {
    expect(
      intentFlow(START, { type: "resolved", result: { kind: "match", match, source: "ai" } }),
    ).toBe(START);
  });

  it("the dialog follows a link from exactly one place", () => {
    const src = readFileSync(
      new URL("../../components/intent/SayItDialog.tsx", import.meta.url),
      "utf8",
    );
    expect(src.match(/navigate\(/g)).toHaveLength(1);
    expect(src).toContain('flow.step !== "going"');
    expect(src).not.toMatch(/window\.location|location\.href|\.assign\(/);
  });

  it("the confirm question names where it goes", () => {
    expect(confirmQuestion(match, tx)).toBe("Go to remote internships?");
    expect(describeMatch(m("JOBS") as IntentMatch, tx)).toBe("Jobs");
    expect(describeMatch(m("SEARCH", { q: "plumber" }) as IntentMatch, tx)).toBe(
      'search for "plumber"',
    );
  });
});
