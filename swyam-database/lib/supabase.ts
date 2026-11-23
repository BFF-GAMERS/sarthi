import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Supabase browser client for the `skillswap` project.
 *
 * Both values below are public by design. The publishable key identifies the
 * project; it grants nothing on its own, because every table is protected by
 * Row Level Security keyed to `auth.uid()`. The service_role key must never
 * appear anywhere under `src/` — it bypasses RLS entirely.
 *
 * The app is server-rendered, so this module is evaluated on the server too.
 * Session persistence is therefore switched off outside the browser: there is
 * no localStorage to write to, and a server-held session would leak between
 * requests.
 *
 * The library itself arrives late. `@supabase/supabase-js` is about 210 kB
 * (46 kB brotli) and every page used to wait for it before it could hydrate,
 * although nothing is asked of it until the first query. `getSupabase()` still
 * returns a client synchronously, but until the library has loaded that client is
 * a thin stand-in: every property read and call is recorded and replayed on the
 * real client the moment it exists (a call goes out as soon as the library is
 * there, never later than it would have been; a builder only sends its request
 * when it is awaited, exactly as before). The stand-in and the real client are
 * the same object to callers, so a reference taken early stays valid, and once
 * the library is loaded the stand-in forwards straight to it.
 */

const url = import.meta.env["VITE_SUPABASE_URL"];
const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

/** True when the app has been given credentials to talk to Supabase at all. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

/**
 * Who signs people in. "firebase": Firebase Authentication, traded for a Supabase token per member
 * (src/lib/auth-bridge). Anything else: Supabase Auth, as before. The data is in Supabase either way.
 */
export const authBackend: "firebase" | "supabase" =
  import.meta.env["VITE_AUTH_BACKEND"] === "firebase" && import.meta.env["VITE_FIREBASE_API_KEY"]
    ? "firebase"
    : "supabase";

/** The Firebase-backed `auth` (supabase-js shaped), loaded only when it is the one in use. */
let bridgeAuth: unknown = null;

const isBrowser = typeof window !== "undefined";

type Client = SupabaseClient<Database>;

let real: Client | null = null;
let loading: Promise<Client> | null = null;

/** Loads the library and builds the one client. Safe to call any number of times. */
function load(): Promise<Client> {
  loading ??= (async () => {
    const { createClient } = await import("@supabase/supabase-js");
    if (authBackend === "firebase") {
      // Every request carries the member's Supabase token (from the Firebase sign-in);
      // `auth` is answered by the bridge instead of Supabase Auth.
      const bridge = await import("./auth-bridge/client");
      bridgeAuth = bridge.authApi;
      real = createClient<Database>(url, publishableKey, {
        accessToken: bridge.supabaseAccessToken,
      });
      return real;
    }
    real = createClient<Database>(url, publishableKey, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      },
    });
    return real;
  })();
  return loading;
}

/** A value and the object it was read from (a method needs its `this`). */
interface Box {
  v: unknown;
  self: unknown;
}

const NODE = Symbol("supabase.pending");

const isNode = (x: unknown): x is { [NODE]: Promise<Box> } =>
  (typeof x === "function" || typeof x === "object") && x !== null && NODE in (x as object);

/** Replaces any stand-in passed as an argument (`removeChannel(channel)`) with the real thing. */
function settle(args: unknown[]): Promise<unknown[]> {
  return Promise.all(args.map((a) => (isNode(a) ? a[NODE].then((b) => b.v) : a)));
}

/**
 * One recorded step: a promise of the real value at the end of a chain of reads and calls.
 * Reading a property extends the chain; calling it runs the call on the real object once it exists;
 * awaiting it hands over to the real value's own `then` (a query builder sends its request here).
 */
function pending(box: Promise<Box>): unknown {
  // A step nobody awaits (a fire-and-forget call) must not become an unhandled rejection of its own.
  box.catch(() => undefined);
  return new Proxy(function pendingStep() {}, {
    has: (_t, prop) => prop === NODE,
    get(_t, prop) {
      if (prop === NODE) return box;
      if (prop === "then") {
        return (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          box.then((b) => {
            const v = b.v as { then?: unknown } | null | undefined;
            if (v && typeof v.then === "function")
              return (v as PromiseLike<unknown>).then(res, rej);
            return res ? res(v) : v;
          }, rej);
      }
      // Symbol.toPrimitive, Symbol.iterator and friends: nothing to forward.
      if (typeof prop === "symbol") return undefined;
      return pending(box.then((b) => ({ v: (b.v as Record<string, unknown>)[prop], self: b.v })));
    },
    apply(_t, _this, args: unknown[]) {
      return pending(
        Promise.all([box, settle(args)]).then(([b, a]) => ({
          v: Reflect.apply(b.v as (...x: unknown[]) => unknown, b.self, a),
          self: undefined,
        })),
      );
    },
  });
}

/** The client everybody holds: forwards to the real one when it exists, records until then. */
const standIn = new Proxy({} as object, {
  get(_t, prop) {
    if (typeof prop === "symbol") return undefined;
    // With the Firebase bridge, supabase-js forbids `.auth`; the bridge answers in its place.
    if (prop === "auth" && authBackend === "firebase") {
      if (bridgeAuth) return bridgeAuth;
      return pending(load().then(() => ({ v: bridgeAuth, self: bridgeAuth })));
    }
    if (real) {
      const v = (real as unknown as Record<string, unknown>)[prop];
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
    }
    return pending(
      load().then((c) => ({ v: (c as unknown as Record<string, unknown>)[prop], self: c })),
    );
  },
}) as Client;

let kicked = false;
/** Fetch the library once the page has settled, so the first query is not a wait. */
function loadWhenIdle(): void {
  if (kicked || !isBrowser || !isSupabaseConfigured) return;
  kicked = true;
  const go = (): void => void load().catch(() => undefined);
  if (typeof window.requestIdleCallback === "function")
    window.requestIdleCallback(go, { timeout: 2500 });
  else setTimeout(go, 1500);
}

/**
 * The shared client, or `null` when no credentials are configured.
 *
 * Callers must handle `null` rather than assume a connection: a checkout of
 * this repo without a `.env` should degrade to the sample catalogue, not crash.
 */
export function getSupabase(): Client | null {
  if (!isSupabaseConfigured) return null;
  loadWhenIdle();
  return standIn;
}

/**
 * The client, throwing if it is missing.
 *
 * Use inside code paths that have already checked `isSupabaseConfigured` —
 * it turns a silent `null` deref into a clear message.
 */
export function requireSupabase(): Client {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return supabase;
}

export type { Database };
