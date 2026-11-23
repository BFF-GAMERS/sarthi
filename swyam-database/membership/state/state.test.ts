// Local persistence, events and the browser-side client: nothing throws, nothing leaks, caps hold.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackChoice } from "../core/chooser";
import { SNOOZE_FIRST_MS } from "../core/plus-state";
import type { ChooserInput, PlanChoice } from "../core/types";
import { clientAiEnabled, requestChoice } from "./client";
import {
  EVENTS_KEY,
  MAX_EVENTS,
  _resetEventsForTests,
  onPlusEvent,
  readPlusEvents,
  recordPlusEvent,
} from "./events";
import {
  AI_MIN_GAP_MS,
  CACHE_TTL_MS,
  STORE_PREFIX,
  _resetStorageForTests,
  aiCallAllowed,
  getCachedChoice,
  markAiCall,
  noteRole,
  plusSnapshot,
  putCachedChoice,
  readBlob,
  recordDismiss,
  recordInterest,
  recordShown,
  subscribe,
} from "./storage";

const input = (over: Partial<ChooserInput> = {}): ChooserInput => ({
  profileType: "jobseeker",
  state: "CAREER_FIRST",
  mode: "BALANCED",
  tier: 2,
  domains: { LEARNING: 0.2, CAREER: 0.7, SKILL_EXCHANGE: 0.1, COMMUNITY: 0 },
  ...over,
});

class FakeStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const T0 = 1_800_000_000_000;
const DAY = 24 * 60 * 60_000;
let store: FakeStorage;

beforeEach(() => {
  store = new FakeStorage();
  vi.stubGlobal("localStorage", store);
  _resetStorageForTests();
  _resetEventsForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe("plus state", () => {
  it("starts empty and persists under swayam.plan.<scope>", () => {
    expect(plusSnapshot("acct_ab12cd34")).toMatchObject({
      shownCount: 0,
      never: false,
      interest: null,
    });
    recordShown("acct_ab12cd34", T0);
    expect(store.map.has(`${STORE_PREFIX}acct_ab12cd34`)).toBe(true);
    expect(plusSnapshot("acct_ab12cd34").shownCount).toBe(1);
    expect(plusSnapshot("guest").shownCount).toBe(0);
  });

  it("keeps a stable snapshot reference until the stored text changes", () => {
    const a = plusSnapshot("guest");
    expect(plusSnapshot("guest")).toBe(a);
    recordShown("guest", T0);
    expect(plusSnapshot("guest")).not.toBe(a);
  });

  it("runs the snooze ladder and stores the honest-CTA choice", () => {
    recordDismiss("guest", "not_now", T0);
    expect(plusSnapshot("guest").snoozeUntil).toBe(T0 + SNOOZE_FIRST_MS);
    recordInterest("guest", "notify");
    expect(plusSnapshot("guest").interest).toBe("notify");
    recordDismiss("guest", "never", T0);
    expect(plusSnapshot("guest").never).toBe(true);
  });

  it("notifies subscribers when it changes", () => {
    const l = vi.fn();
    const off = subscribe(l);
    recordShown("guest", T0);
    expect(l).toHaveBeenCalledTimes(1);
    off();
    recordShown("guest", T0);
    expect(l).toHaveBeenCalledTimes(1);
  });

  it("stamps signupAt once and resets the snooze when the role changes", () => {
    noteRole("acct_1", "jobseeker", T0);
    expect(plusSnapshot("acct_1").signupAt).toBe(T0);
    recordDismiss("acct_1", "not_now", T0 + 1);
    noteRole("acct_1", "jobseeker", T0 + 2 * DAY);
    expect(plusSnapshot("acct_1").signupAt).toBe(T0);
    expect(plusSnapshot("acct_1").snoozeUntil).not.toBeNull();
    noteRole("acct_1", "professional", T0 + 3 * DAY);
    expect(plusSnapshot("acct_1").snoozeUntil).toBeNull();
    expect(plusSnapshot("acct_1").dismissCount).toBe(0);
    expect(plusSnapshot("acct_1").signupAt).toBe(T0);
  });

  it("survives corrupt or hostile storage", () => {
    store.setItem(`${STORE_PREFIX}guest`, "{not json");
    expect(plusSnapshot("guest").shownCount).toBe(0);
    store.setItem(
      `${STORE_PREFIX}guest`,
      JSON.stringify({ plus: { shownCount: -5, never: "yes" }, cache: 7, lastAiAt: "x" }),
    );
    expect(readBlob("guest")).toMatchObject({ lastAiAt: null, cache: {} });
    expect(readBlob("guest").plus.shownCount).toBe(0);
  });

  it("works with no storage at all (a private window, blocked site data)", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    vi.stubGlobal("localStorage", broken);
    expect(() => recordShown("guest", T0)).not.toThrow();
    expect(plusSnapshot("guest").shownCount).toBe(1);
    vi.unstubAllGlobals();
    expect(() => recordShown("guest", T0)).not.toThrow();
  });
});

describe("cached choice", () => {
  const choice = (i: ChooserInput): PlanChoice => fallbackChoice(i);

  it("returns a fresh cached choice per (type, state, mode)", () => {
    const i = input();
    expect(getCachedChoice("guest", i, T0)).toBeNull();
    putCachedChoice("guest", i, choice(i), T0);
    expect(getCachedChoice("guest", i, T0 + DAY)).toEqual(choice(i));
    expect(getCachedChoice("guest", input({ state: "LEARNING_FIRST" }), T0)).toBeNull();
    expect(getCachedChoice("guest", input({ mode: "QUICK" }), T0)).toBeNull();
    // tier and the rounded domains are not part of the local key
    expect(getCachedChoice("guest", input({ tier: 3 }), T0)).toEqual(choice(i));
  });

  it("expires after 14 days", () => {
    const i = input();
    putCachedChoice("guest", i, choice(i), T0);
    expect(getCachedChoice("guest", i, T0 + CACHE_TTL_MS)).not.toBeNull();
    expect(getCachedChoice("guest", i, T0 + CACHE_TTL_MS + 1)).toBeNull();
  });

  it("never serves a cached choice to a different role, and re-validates whatever is stored", () => {
    const i = input();
    putCachedChoice("guest", i, choice(i), T0);
    // tamper: swap in another role's plan under the same key
    const blob = JSON.parse(store.getItem(`${STORE_PREFIX}guest`)!);
    blob.cache["jobseeker|CAREER_FIRST|BALANCED"].choice.planId = "HIRE";
    store.setItem(`${STORE_PREFIX}guest`, JSON.stringify(blob));
    expect(getCachedChoice("guest", i, T0)).toBeNull();
    expect(getCachedChoice("guest", input({ profileType: "recruiter" }), T0)).toBeNull();
  });

  it("caps the number of cached entries", () => {
    const states = [
      "LEARNING_FIRST",
      "CAREER_FIRST",
      "SKILL_EXCHANGE_FIRST",
      "COMMUNITY_FIRST",
    ] as const;
    const modes = ["BALANCED", "QUICK", "RESEARCH", "REPEAT", "CAREER_FOCUSED"] as const;
    let n = 0;
    for (const state of states) {
      for (const mode of modes) {
        const i = input({ state, mode });
        putCachedChoice("guest", i, choice(i), T0 + n++);
      }
    }
    expect(Object.keys(readBlob("guest").cache).length).toBeLessThanOrEqual(12);
  });
});

describe("one AI call per 7 days", () => {
  it("allows the first, then waits a week", () => {
    expect(aiCallAllowed("acct_1", T0)).toBe(true);
    markAiCall("acct_1", T0);
    expect(aiCallAllowed("acct_1", T0 + AI_MIN_GAP_MS - 1)).toBe(false);
    expect(aiCallAllowed("acct_1", T0 + AI_MIN_GAP_MS)).toBe(true);
    expect(aiCallAllowed("acct_2", T0 + 1)).toBe(true);
  });
});

describe("events", () => {
  it("records locally, newest last, and offers them to listeners", () => {
    const seen: string[] = [];
    const off = onPlusEvent((e) => seen.push(e.name));
    recordPlusEvent(
      "plus_shown",
      { moment: "course_completed", planId: "LAUNCH", source: "rules" },
      T0,
    );
    recordPlusEvent("plus_dismissed", { kind: "not_now" }, T0 + 1);
    off();
    recordPlusEvent("plus_cta_demo", {}, T0 + 2);
    expect(seen).toEqual(["plus_shown", "plus_dismissed"]);
    const all = readPlusEvents();
    expect(all.map((e) => e.name)).toEqual(["plus_shown", "plus_dismissed", "plus_cta_demo"]);
    expect(all[0]).toMatchObject({
      props: { moment: "course_completed", planId: "LAUNCH", source: "rules" },
      at: T0,
    });
  });

  it("drops free text and anything that is not a short id or number", () => {
    recordPlusEvent("plus_ai_fallback", { reason: "I am 14 and my email is a@b.com" }, T0);
    recordPlusEvent("plus_validation_rejected", { field: "benefitOrder" }, T0);
    const [a, b] = readPlusEvents();
    expect(a!.props).toEqual({});
    expect(b!.props).toEqual({ field: "benefitOrder" });
  });

  it("keeps a ring of at most 50 and never throws without storage", () => {
    for (let i = 0; i < MAX_EVENTS + 20; i++) recordPlusEvent("plus_eligible", {}, T0 + i);
    expect(readPlusEvents()).toHaveLength(MAX_EVENTS);
    expect(JSON.parse(store.getItem(EVENTS_KEY)!)).toHaveLength(MAX_EVENTS);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
    });
    expect(() => recordPlusEvent("plus_eligible", {}, T0)).not.toThrow();
  });

  it("a throwing listener cannot break the page", () => {
    onPlusEvent(() => {
      throw new Error("boom");
    });
    expect(() => recordPlusEvent("plus_eligible", {}, T0)).not.toThrow();
  });
});

describe("client", () => {
  const ok = (choice: unknown) =>
    vi.fn(async () => Response.json({ ok: true, source: "ai", choice })) as unknown as typeof fetch;

  it("sends exactly the five aggregate keys and nothing else", async () => {
    const f = ok(fallbackChoice(input()));
    await requestChoice(input(), f);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/membership");
    expect(init.method).toBe("POST");
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual([
      "domains",
      "mode",
      "profileType",
      "state",
      "tier",
    ]);
    expect(init.body as string).not.toMatch(/299|price|age|email/i);
  });

  it("returns a validated choice, and validates again on the client", async () => {
    const c = fallbackChoice(input());
    expect(await requestChoice(input(), ok(c))).toEqual({ ok: true, choice: c });
    const cross = await requestChoice(input(), ok({ ...c, planId: "HIRE" }));
    expect(cross).toEqual({ ok: false, reason: "rejected", field: "planId" });
  });

  it("turns every failure into a reason, never a throw", async () => {
    const reasons = async (f: typeof fetch) =>
      (await requestChoice(input(), f)) as { ok: false; reason: string };
    expect(
      (
        await reasons(
          vi.fn(async () =>
            Response.json({ ok: false, fallback: "off" }),
          ) as unknown as typeof fetch,
        )
      ).reason,
    ).toBe("off");
    expect(
      (
        await reasons(
          vi.fn(async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
        )
      ).reason,
    ).toBe("http_500");
    expect(
      (await reasons(vi.fn(async () => new Response("not json")) as unknown as typeof fetch))
        .reason,
    ).toBe("network");
    expect(
      (
        await reasons(
          vi.fn(async () => {
            throw new TypeError("offline");
          }) as unknown as typeof fetch,
        )
      ).reason,
    ).toBe("network");
  });

  it("reads the client kill switch from VITE_MEMBERSHIP_AI", () => {
    expect(clientAiEnabled()).toBe(true);
    vi.stubEnv("VITE_MEMBERSHIP_AI", "off");
    expect(clientAiEnabled()).toBe(false);
    vi.stubEnv("VITE_MEMBERSHIP_AI", "on");
    expect(clientAiEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});
