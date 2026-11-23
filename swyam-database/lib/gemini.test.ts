import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiError, ask, keyFor, resolveKey } from "./gemini";

const ok = (text: string, finishReason = "STOP") =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), {
    status: 200,
  });
const status = (code: number) =>
  new Response(JSON.stringify({ error: { code } }), { status: code });

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function recorder(...responses: Array<Response | (() => Response | Promise<Response>)>) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    const next = responses[Math.min(i++, responses.length - 1)]!;
    return typeof next === "function" ? next() : next.clone();
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const turns = [{ role: "user" as const, content: "hi" }];
const model = (url: string) => /models\/([^:]+):/.exec(url)![1];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ask()", () => {
  it("tries the lite models first and steps down on 429, 404 and 503", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    const { calls, fetchImpl } = recorder(status(429), status(404), ok("fine"));
    await expect(ask(turns, { apiKey: "k", fetchImpl })).resolves.toBe("fine");
    expect(calls.map((c) => model(c.url))).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.5-flash",
    ]);
  });

  it("sends the key in x-goog-api-key and never in the URL", async () => {
    const { calls, fetchImpl } = recorder(ok("fine"));
    await ask(turns, { apiKey: "secret-key", fetchImpl });
    expect(calls[0]!.headers["x-goog-api-key"]).toBe("secret-key");
    expect(calls[0]!.url).not.toContain("secret-key");
    expect(calls[0]!.url).not.toContain("key=");
  });

  it("uses exactly options.models, ignoring GEMINI_MODEL", async () => {
    vi.stubEnv("GEMINI_MODEL", "some-other-model");
    const { calls, fetchImpl } = recorder(status(503));
    await expect(
      ask(turns, { apiKey: "k", fetchImpl, models: ["gemini-3.5-flash-lite"] }),
    ).rejects.toBeInstanceOf(GeminiError);
    expect(calls.map((c) => model(c.url))).toEqual(["gemini-3.5-flash-lite"]);
  });

  it("honours GEMINI_MODEL ahead of the defaults when no models are given", async () => {
    vi.stubEnv("GEMINI_MODEL", "custom-model");
    const { calls, fetchImpl } = recorder(ok("fine"));
    await ask(turns, { apiKey: "k", fetchImpl });
    expect(model(calls[0]!.url)).toBe("custom-model");
  });

  it("rejects a non-STOP finishReason in JSON mode and tries the next model", async () => {
    const { calls, fetchImpl } = recorder(ok('{"a":', "MAX_TOKENS"), ok('{"a":1}'));
    await expect(ask(turns, { apiKey: "k", fetchImpl, json: true })).resolves.toBe('{"a":1}');
    expect(calls).toHaveLength(2);
  });

  it("fails as invalid when every model stops early, and accepts the same text outside JSON mode", async () => {
    const { fetchImpl } = recorder(ok("cut off", "MAX_TOKENS"));
    await expect(ask(turns, { apiKey: "k", fetchImpl, json: true })).rejects.toMatchObject({
      kind: "invalid",
    });
    await expect(ask(turns, { apiKey: "k", fetchImpl })).resolves.toBe("cut off");
  });

  it("sends responseSchema with a JSON mime type", async () => {
    const { calls, fetchImpl } = recorder(ok("{}"));
    await ask(turns, { apiKey: "k", fetchImpl, responseSchema: { type: "OBJECT" } });
    const cfg = calls[0]!.body["generationConfig"] as Record<string, unknown>;
    expect(cfg["responseMimeType"]).toBe("application/json");
    expect(cfg["responseSchema"]).toEqual({ type: "OBJECT" });
  });

  it("catches a network error per model and moves on", async () => {
    const boom = () => {
      throw new TypeError("fetch failed");
    };
    const { calls, fetchImpl } = recorder(boom, ok("fine"));
    await expect(ask(turns, { apiKey: "k", fetchImpl })).resolves.toBe("fine");
    expect(calls).toHaveLength(2);
  });

  it("aborts each attempt at timeoutMs and reports a timeout", async () => {
    const hang = (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))),
      );
    const fetchImpl = vi.fn(hang) as unknown as typeof fetch;
    await expect(
      ask(turns, { apiKey: "k", fetchImpl, models: ["a", "b"], timeoutMs: 15 }),
    ).rejects.toMatchObject({ kind: "timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops starting attempts once deadlineMs is spent", async () => {
    const hang = (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))),
      );
    const spy = vi.fn(hang);
    await expect(
      ask(turns, {
        apiKey: "k",
        fetchImpl: spy as unknown as typeof fetch,
        models: ["a", "b", "c", "d"],
        timeoutMs: 30,
        deadlineMs: 45,
      }),
    ).rejects.toMatchObject({ kind: "timeout" });
    expect(spy.mock.calls.length).toBeLessThan(4);
  });

  it("stops on a 400 instead of repeating our own mistake", async () => {
    const { calls, fetchImpl } = recorder(status(400));
    await expect(ask(turns, { apiKey: "k", fetchImpl })).rejects.toMatchObject({
      kind: "upstream",
    });
    expect(calls).toHaveLength(1);
  });

  it("classifies an all-429 chain as rate_limited and keeps the old message shape", async () => {
    const { fetchImpl } = recorder(status(429));
    const e = await ask(turns, { apiKey: "k", fetchImpl }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(GeminiError);
    expect((e as GeminiError).kind).toBe("rate_limited");
    expect((e as GeminiError).message).toMatch(/^Gemini failed\. .*429/);
  });

  it("throws unconfigured with no key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(ask(turns, {})).rejects.toMatchObject({ kind: "unconfigured" });
  });
});

describe("evolution surface key", () => {
  it("reads GEMINI_KEY_EVOLUTION and falls back to GEMINI_API_KEY", () => {
    vi.stubEnv("GEMINI_KEY_EVOLUTION", "");
    vi.stubEnv("GEMINI_API_KEY", "shared");
    expect(keyFor("evolution")).toBeUndefined();
    expect(resolveKey("evolution")).toBe("shared");
    vi.stubEnv("GEMINI_KEY_EVOLUTION", "own");
    expect(keyFor("evolution")).toBe("own");
    expect(resolveKey("evolution")).toBe("own");
  });

  it("is null when nothing is configured", () => {
    vi.stubEnv("GEMINI_KEY_EVOLUTION", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(resolveKey("evolution")).toBeNull();
  });
});
