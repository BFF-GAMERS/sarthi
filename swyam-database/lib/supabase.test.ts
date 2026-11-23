import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The client is a stand-in until `@supabase/supabase-js` has loaded (supabase.ts). These tests give it a
 * fake library that logs every call, so they can say what the stand-in does and when.
 */

interface Log {
  creates: unknown[][];
  calls: string[];
  thens: number;
  unsubscribed: number;
  removed: unknown[];
}

function makeLib(log: Log) {
  const builder = (path: string): Record<string, unknown> => ({
    select: (...a: unknown[]) => {
      log.calls.push(`${path}.select(${a.join(",")})`);
      return builder(`${path}.select`);
    },
    eq: (...a: unknown[]) => {
      log.calls.push(`${path}.eq(${a.join(",")})`);
      return builder(`${path}.eq`);
    },
    // The request goes out here, and only here, as in the real PostgrestBuilder.
    then: (res: (v: unknown) => unknown) => {
      log.thens++;
      return Promise.resolve({ data: [{ id: 1 }], error: null }).then(res);
    },
  });
  const channel = { name: "inbox", on: () => channel, subscribe: () => channel };
  const client = {
    from: (t: string) => {
      log.calls.push(`from(${t})`);
      return builder(t);
    },
    rpc: async (fn: string) => ({ data: fn, error: null }),
    channel: () => channel,
    removeChannel: async (c: unknown) => {
      log.removed.push(c);
      return "ok";
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {
              log.unsubscribed++;
            },
          },
        },
      }),
    },
  };
  return {
    createClient: (...a: unknown[]) => {
      log.creates.push(a);
      return client;
    },
    channel,
  };
}

/* The typed client rejects the fake table names these tests use; they only care about the replay. */
/* eslint-disable @typescript-eslint/no-explicit-any */
interface Loose {
  from: (t: string) => any;
  rpc: (fn: string) => any;
  auth: any;
  channel: (name: string) => any;
  removeChannel: (c: unknown) => Promise<unknown>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
const loose = (c: unknown): Loose => c as Loose;

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const log: Log = { creates: [], calls: [], thens: 0, unsubscribed: 0, removed: [] };
  const lib = makeLib(log);
  vi.doMock("@supabase/supabase-js", () => ({ createClient: lib.createClient }));
  const mod = await import("./supabase");
  return { mod, log, lib };
}

const ENV = { VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "pk" };

beforeEach(() => {
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.doUnmock("@supabase/supabase-js");
  vi.unstubAllEnvs();
});

describe("getSupabase", () => {
  it("is null without credentials, and never loads the library", async () => {
    const { mod, log } = await load({ VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" });
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.getSupabase()).toBeNull();
    expect(() => mod.requireSupabase()).toThrow(/not configured/);
    expect(log.creates).toHaveLength(0);
  });

  it("returns the same client every time, before and after the library loads", async () => {
    const { mod } = await load(ENV);
    const a = loose(mod.getSupabase());
    expect(mod.getSupabase()).not.toBeNull();
    expect(loose(mod.getSupabase())).toBe(a);
    await a.auth.getSession();
    expect(loose(mod.getSupabase())).toBe(a);
  });

  it("builds nothing until something is asked of it", async () => {
    const { mod, log } = await load(ENV);
    mod.getSupabase();
    expect(log.creates).toHaveLength(0);
  });
});

describe("the stand-in before the library has loaded", () => {
  it("replays a query chain and sends the request only when it is awaited", async () => {
    const { mod, log } = await load(ENV);
    const query = loose(mod.getSupabase()).from("courses").select("id,slug").eq("slug", "a");
    // Built, not sent: no request until somebody awaits it.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(log.thens).toBe(0);
    expect(log.creates).toHaveLength(1);
    expect(log.creates[0]![0]).toBe("https://x.supabase.co");
    const res = await query;
    expect(res.data).toEqual([{ id: 1 }]);
    expect(log.thens).toBe(1);
    expect(log.calls).toEqual([
      "from(courses)",
      "courses.select(id,slug)",
      "courses.select.eq(slug,a)",
    ]);
  });

  it("works through Promise.all and .then", async () => {
    const { mod } = await load(ENV);
    const sb = loose(mod.getSupabase());
    const [a, b] = await Promise.all([sb.from("a").select("*"), sb.rpc("fn")]);
    expect(a.data).toHaveLength(1);
    expect(b.data).toBe("fn");
    const viaThen = await sb.auth
      .getSession()
      .then(({ data }: { data: { session: unknown } }) => data.session);
    expect(viaThen).toBeNull();
  });

  it("keeps onAuthStateChange destructuring and unsubscribe working", async () => {
    const { mod, log } = await load(ENV);
    const sb = loose(mod.getSupabase());
    const { data: sub } = sb.auth.onAuthStateChange(() => undefined);
    sub.subscription.unsubscribe();
    await new Promise((r) => setTimeout(r, 0));
    expect(log.unsubscribed).toBe(1);
  });

  it("hands the real channel to removeChannel when given the stand-in", async () => {
    const { mod, log, lib } = await load(ENV);
    const sb = loose(mod.getSupabase());
    const channel = sb.channel("inbox").on("postgres_changes", {}, () => undefined);
    await sb.removeChannel(channel);
    expect(log.removed).toEqual([lib.channel]);
  });

  it("builds the client once, with session handling off on the server", async () => {
    const { mod, log } = await load(ENV);
    const sb = loose(mod.getSupabase());
    await Promise.all([sb.auth.getSession(), sb.from("a").select("*"), sb.rpc("fn")]);
    expect(log.creates).toHaveLength(1);
    expect(log.creates[0]![2]).toMatchObject({ auth: { persistSession: false } });
  });
});

describe("after the library has loaded", () => {
  it("forwards straight to the real client, methods bound", async () => {
    const { mod, log } = await load(ENV);
    const sb = loose(mod.getSupabase());
    await sb.auth.getSession();
    const from = sb.from;
    const q = from("t").select("*");
    expect(log.calls).toContain("from(t)");
    expect(typeof q.then).toBe("function");
    // Real objects now, not stand-ins: a synchronous read returns the real value.
    expect(sb.auth).toBe(sb.auth);
  });
});
