import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIMITS,
  MAX_BUCKETS,
  _bucketCount,
  _resetBuckets,
  callerOf,
  rateLimit,
  rateLimitKey,
  type Limit,
} from "./rate-limit";

const req = (ip: string) => new Request("https://x.test/", { headers: { "x-forwarded-for": ip } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimitKey", () => {
  const limit: Limit = { name: "t-key", max: 2, windowMs: 60_000 };

  it("allows up to max, then refuses with a retry time, per key", () => {
    expect(rateLimitKey("a", limit).allowed).toBe(true);
    expect(rateLimitKey("a", limit).allowed).toBe(true);
    const third = rateLimitKey("a", limit);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBe(60);
    expect(rateLimitKey("b", limit).allowed).toBe(true);
  });

  it("frees the budget when the window passes", () => {
    rateLimitKey("w", limit);
    rateLimitKey("w", limit);
    expect(rateLimitKey("w", limit).allowed).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimitKey("w", limit).allowed).toBe(true);
  });

  it("a refused call does not extend the wait", () => {
    rateLimitKey("x", limit);
    rateLimitKey("x", limit);
    vi.advanceTimersByTime(30_000);
    rateLimitKey("x", limit);
    expect(rateLimitKey("x", limit).retryAfterSeconds).toBe(30);
  });

  it("a short-window sweep never evicts a 24 hour bucket", () => {
    const day: Limit = { name: "t-day", max: 1, windowMs: 24 * 60 * 60_000 };
    const brief: Limit = { name: "t-brief", max: 5, windowMs: 60_000 };
    expect(rateLimitKey("z", day).allowed).toBe(true);
    vi.advanceTimersByTime(2 * 60 * 60_000);
    rateLimitKey("other", brief); // triggers the sweep with a one-minute window
    expect(rateLimitKey("z", day).allowed).toBe(false);
  });
});

describe("rateLimit (per caller address)", () => {
  it("returns a 429 Response past the budget and null before it", () => {
    const limit: Limit = { name: "t-ip", max: 1, windowMs: 60_000 };
    expect(rateLimit(req("1.1.1.1"), limit)).toBeNull();
    const refused = rateLimit(req("1.1.1.1"), limit);
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("retry-after")).toBe("60");
    expect(rateLimit(req("2.2.2.2"), limit)).toBeNull();
  });
});

describe("evolution budgets", () => {
  it("are 3 per 10 minutes, 10 per day per caller and 150 per day per instance", () => {
    expect(LIMITS.evoBurst).toEqual({ name: "evoBurst", max: 3, windowMs: 600_000 });
    expect(LIMITS.evoDay).toEqual({ name: "evoDay", max: 10, windowMs: 86_400_000 });
    expect(LIMITS.evoGlobal).toEqual({ name: "evoGlobal", max: 150, windowMs: 86_400_000 });
  });
});

describe("callerOf", () => {
  const withHeaders = (h: Record<string, string>) => new Request("https://x.test/", { headers: h });

  it("trusts the platform header over anything the client wrote", () => {
    const r = withHeaders({
      "x-vercel-forwarded-for": "203.0.113.9",
      "x-forwarded-for": "1.2.3.4",
    });
    expect(callerOf(r)).toBe("203.0.113.9");
  });

  it("takes the LAST x-forwarded-for hop, so a forged first entry buys no new bucket", () => {
    const a = withHeaders({ "x-forwarded-for": "6.6.6.6, 198.51.100.7" });
    const b = withHeaders({ "x-forwarded-for": "7.7.7.7, 198.51.100.7" });
    expect(callerOf(a)).toBe("198.51.100.7");
    expect(callerOf(b)).toBe(callerOf(a));
  });

  it("a spoofed first hop cannot dodge a limit", () => {
    const limit: Limit = { name: "t-spoof", max: 2, windowMs: 60_000 };
    const results = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"].map((fake) =>
      rateLimit(withHeaders({ "x-forwarded-for": `${fake}, 198.51.100.8` }), limit),
    );
    expect(results.map((r) => r === null)).toEqual([true, true, false, false]);
  });

  it("falls back to x-real-ip, then to one shared 'unknown' for anything that is not an address", () => {
    expect(callerOf(withHeaders({ "x-real-ip": "192.0.2.4" }))).toBe("192.0.2.4");
    expect(callerOf(withHeaders({}))).toBe("unknown");
    expect(callerOf(withHeaders({ "x-forwarded-for": "not an address <script>" }))).toBe("unknown");
    expect(callerOf(withHeaders({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});

describe("bucket table", () => {
  it("is capped, so forged addresses cannot grow memory without limit", () => {
    _resetBuckets();
    const limit: Limit = { name: "t-cap", max: 1, windowMs: 60_000 };
    for (let i = 0; i < MAX_BUCKETS + 50; i++) rateLimitKey(`k${i}`, limit);
    expect(_bucketCount()).toBeLessThanOrEqual(MAX_BUCKETS);
    _resetBuckets();
  });
});
