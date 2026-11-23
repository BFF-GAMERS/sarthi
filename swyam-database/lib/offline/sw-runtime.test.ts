import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * Runs public/sw.js against a small fake of the service worker runtime, to
 * check what it does with a request rather than only how it classifies one.
 */

const src = readFileSync(fileURLToPath(new URL("../../../public/sw.js", import.meta.url)), "utf8");
const ORIGIN = "https://www.swyam.online";

type Res = {
  ok: boolean;
  type: string;
  body: string;
  headers: { get: (k: string) => string | null };
  clone: () => Res;
};
const res = (body: string, over: Partial<Res> = {}): Res => {
  const r: Res = {
    ok: true,
    type: "basic",
    body,
    headers: { get: () => null },
    clone: () => r,
    ...over,
  };
  return r;
};

function runtime(fetchImpl: (url: string) => Promise<Res>) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Map<string, Res>>();
  const bucket = (n: string) => {
    if (!store.has(n)) store.set(n, new Map());
    return store.get(n)!;
  };
  const caches = {
    open: async (n: string) => {
      const b = bucket(n);
      return {
        match: async (k: string) => b.get(k),
        put: async (k: string, v: Res) => void b.set(k, v),
        keys: async () => [...b.keys()],
        delete: async (k: string) => b.delete(k),
      };
    },
    keys: async () => [...store.keys()],
    delete: async (n: string) => store.delete(n),
  };
  const fetched: string[] = [];
  const ctx = {
    URL,
    Promise,
    setTimeout,
    Response: { error: () => ({ error: true }) },
    caches,
    fetch: (req: { url: string }) => {
      fetched.push(req.url);
      return fetchImpl(req.url);
    },
    self: {
      location: { origin: ORIGIN },
      addEventListener: (t: string, f: (e: unknown) => void) => void (listeners[t] = f),
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined },
    },
  };
  vm.runInNewContext(src, ctx);

  const request = (method: string, path: string, mode = "navigate") => ({
    method,
    mode,
    url: path.startsWith("http") ? path : ORIGIN + path,
  });
  const dispatch = async (req: ReturnType<typeof request>) => {
    let responded: Promise<unknown> | null = null;
    listeners["fetch"]!({ request: req, respondWith: (p: Promise<unknown>) => (responded = p) });
    return responded ? await responded : "passed-through";
  };
  return { listeners, store, dispatch, request, fetched };
}

describe("service worker behaviour", () => {
  it("caches a lesson page when online and serves it when the network is gone", async () => {
    let online = true;
    const rt = runtime(async () => {
      if (!online) throw new TypeError("Failed to fetch");
      return res("<html>lesson</html>");
    });
    const first = (await rt.dispatch(rt.request("GET", "/learn/ui-ux"))) as unknown as Res;
    expect(first.body).toBe("<html>lesson</html>");
    expect([...rt.store.values()][0]!.has(`${ORIGIN}/learn/ui-ux`)).toBe(true);

    online = false;
    const again = (await rt.dispatch(rt.request("GET", "/learn/ui-ux?utm=1"))) as unknown as Res;
    expect(again.body).toBe("<html>lesson</html>");
  });

  it("fails the way the browser would when offline with nothing stored", async () => {
    const rt = runtime(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await rt.dispatch(rt.request("GET", "/learn/never-opened"))).toEqual({ error: true });
  });

  it("does not cache a response that asks not to be stored", async () => {
    const rt = runtime(async () => res("secret", { headers: { get: () => "private, no-store" } }));
    await rt.dispatch(rt.request("GET", "/learn/x"));
    expect([...rt.store.values()].every((b) => b.size === 0)).toBe(true);
  });

  it("never intercepts a mutation, an API call or another origin", async () => {
    const rt = runtime(async () => res("x"));
    for (const [m, p, mode] of [
      ["POST", "/learn/x", "navigate"],
      ["PATCH", "/rest/v1/lesson_progress", "cors"],
      ["GET", "/api/evolution/track", "cors"],
      ["GET", "/", "navigate"],
      ["GET", "/auth", "navigate"],
      ["GET", "https://abc.supabase.co/rest/v1/lessons", "cors"],
    ] as const) {
      expect(await rt.dispatch(rt.request(m, p, mode))).toBe("passed-through");
    }
    expect(rt.fetched).toEqual([]);
  });

  it("deletes older versions of its own cache on activate, and only its own", async () => {
    const rt = runtime(async () => res("x"));
    rt.store.set("swayam-offline-v0", new Map());
    rt.store.set("someone-elses-cache", new Map());
    await new Promise<void>((done) => {
      rt.listeners["activate"]!({ waitUntil: (p: Promise<unknown>) => void p.then(() => done()) });
    });
    expect(rt.store.has("swayam-offline-v0")).toBe(false);
    expect(rt.store.has("someone-elses-cache")).toBe(true);
  });
});
