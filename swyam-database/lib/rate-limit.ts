/**
 * A cap on how often one caller can spend your money.
 *
 * Every endpoint under `src/routes/api/` that reaches a paid service — Gemini
 * for the assistant, Sarvam for the voice — was open to the internet with no
 * check on who was calling or how often. A loop from one laptop could empty
 * the day's Gemini quota in a couple of minutes, and the first people to
 * notice would be members watching Sarthi stop answering.
 *
 * Nothing here authenticates anybody. That is deliberate: the assistant
 * answers questions for people who have not signed up yet, and that is the
 * point of it. What this does is stop one caller doing it a thousand times.
 *
 * BEST-EFFORT, BY DESIGN. The counter lives in the memory of one server
 * instance. On Vercel that means it resets when an instance goes cold and is
 * not shared between instances, so a determined attacker spreading requests
 * (or one that makes the instance recycle) can still get through. It stops the
 * casual case — a script, a stuck retry loop, a curious visitor with curl —
 * which is the case that actually happens. Two things keep the damage bounded
 * even when it is bypassed: the per-instance `evoGlobal` ceiling, and the
 * bucket table below is capped so a flood of forged addresses cannot grow it
 * without limit. A hard, shared limit needs a store; the optional, not-applied
 * `supabase/rate-limit-counter.sql` ships the table and function for that.
 * When it is wanted, only `rateLimitKey` below changes.
 */

interface Window {
  /** Millisecond timestamps of this caller's hits inside the window. */
  hits: number[];
  /** The window this bucket was counted against; the sweep must honour it, not the caller's. */
  windowMs: number;
}

const buckets = new Map<string, Window>();

/**
 * Hard ceiling on tracked buckets. Forged or rotating addresses each open one;
 * past this the oldest-created are dropped (Map keeps insertion order), which
 * only ever forgets a caller, never refuses one.
 */
export const MAX_BUCKETS = 5_000;

/**
 * Stops the map growing without bound on a long-lived instance.
 *
 * Each bucket is judged by its OWN window. Judging every bucket by the window
 * of whichever request happened to trigger the sweep would let a ten-minute
 * limit delete a 24-hour bucket and quietly reset it.
 */
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of buckets) {
    if (w.hits.every((t) => now - t > w.windowMs)) buckets.delete(key);
  }
}

function capBuckets(): void {
  let over = buckets.size - MAX_BUCKETS;
  if (over <= 0) return;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (--over <= 0) break;
  }
}

/** Tests only. */
export const _bucketCount = (): number => buckets.size;
export const _resetBuckets = (): void => {
  buckets.clear();
  lastSweep = 0;
};

/** An address, not free text: IPv4, or IPv6 with an optional zone-free form. Anything else is not trusted. */
const ADDRESS = /^[0-9a-fA-F:.]{2,45}$/;
const clean = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t && ADDRESS.test(t) ? t : null;
};
/** The hop the NEAREST trusted proxy appended. Earlier entries are whatever the client claimed. */
const lastHop = (v: string | null): string | null => clean(v?.split(",").at(-1));

/**
 * Who is calling, as well as a server behind a proxy can know.
 *
 * Order of trust:
 *  1. `x-vercel-forwarded-for`: set by Vercel's edge itself, a client cannot supply it there.
 *  2. `x-forwarded-for`, LAST hop: a proxy appends the peer it actually saw, so the first entries are
 *     whatever the client wrote (`X-Forwarded-For: 1.2.3.4` must not mint a fresh bucket per request).
 *  3. `x-real-ip`, then "unknown" (one shared bucket for anything that is not an address).
 *
 * Still a courtesy limit, not a security control: with no proxy in front (a bare local server), a client can
 * write a single-entry header, and the per-instance `evoGlobal` ceiling is what bounds that case.
 */
export function callerOf(request: Request): string {
  const h = request.headers;
  return (
    clean(h.get("x-vercel-forwarded-for")?.split(",").at(-1)) ??
    lastHop(h.get("x-forwarded-for")) ??
    clean(h.get("x-real-ip")) ??
    "unknown"
  );
}

export interface Limit {
  /** How many requests one caller may make inside the window. */
  max: number;
  windowMs: number;
  /**
   * Names the budget. Callers that pass the same Limit share one counter per
   * caller; give a feature its own name (and Limit) to keep its budget apart.
   */
  name: string;
}

export interface KeyVerdict {
  allowed: boolean;
  /** Seconds until the oldest hit leaves the window; 0 when allowed. */
  retryAfterSeconds: number;
}

/**
 * Count one hit for an arbitrary key and say whether it fits the budget.
 *
 * `rateLimit()` is this keyed by caller address. It is exported on its own for
 * budgets that are not per-IP: a global ceiling for one instance, say, where
 * the key is a constant. An allowed call records its hit; a refused call does
 * not, so hammering a full bucket does not extend the wait.
 */
export function rateLimitKey(key: string, limit: Limit): KeyVerdict {
  const now = Date.now();
  sweep(now);

  const bucketKey = `${limit.name}:${key}`;
  const w = buckets.get(bucketKey) ?? { hits: [], windowMs: limit.windowMs };
  w.windowMs = limit.windowMs;
  w.hits = w.hits.filter((t) => now - t < limit.windowMs);

  if (w.hits.length >= limit.max) {
    const oldest = w.hits[0]!;
    buckets.set(bucketKey, w);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((limit.windowMs - (now - oldest)) / 1000)),
    };
  }

  w.hits.push(now);
  buckets.set(bucketKey, w);
  capBuckets();
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Returns a 429 to send back, or null to carry on.
 *
 * The message is written for the person who will read it, not for a log: it
 * says what happened and when to try again, and nothing about the limit's
 * shape that would help somebody work around it.
 */
export function rateLimit(request: Request, limit: Limit): Response | null {
  const verdict = rateLimitKey(callerOf(request), limit);
  if (verdict.allowed) return null;
  return new Response(
    JSON.stringify({
      error: "Too many requests just now. Give it a minute and try again.",
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(verdict.retryAfterSeconds),
      },
    },
  );
}

/**
 * The budgets.
 *
 * Set from what a person doing the thing properly would need, with room to
 * spare: a real conversation with Sarthi is a handful of questions over a few
 * minutes, not thirty. Voice and the phone line are lower because each one
 * costs more and takes longer.
 */
export const LIMITS = {
  chat: { name: "chat", max: 30, windowMs: 10 * 60_000 },
  heavy: { name: "heavy", max: 12, windowMs: 10 * 60_000 },
  /** Firebase → Supabase token exchange: once per sign-in and once an hour per open tab. */
  auth: { name: "auth", max: 60, windowMs: 10 * 60_000 },
  voice: { name: "voice", max: 20, windowMs: 10 * 60_000 },
  call: { name: "call", max: 3, windowMs: 30 * 60_000 },
  mail: { name: "mail", max: 5, windowMs: 30 * 60_000 },
  /**
   * The Evolution Engine's optional AI analysis. Aggregates only, one small
   * call, and the on-device engine has already decided — so these are tight.
   * Per caller: 3 in ten minutes, 10 a day. `evoGlobal` is one shared counter
   * (key it with a constant) so no crowd of callers can spend the day's free
   * Gemini allowance: 150 a day per server instance.
   */
  evoBurst: { name: "evoBurst", max: 3, windowMs: 10 * 60_000 },
  evoDay: { name: "evoDay", max: 10, windowMs: 24 * 60 * 60_000 },
  evoGlobal: { name: "evoGlobal", max: 150, windowMs: 24 * 60 * 60_000 },
  /**
   * The Swayam Plus card arranger (src/membership/server). Tiny on purpose: it shares the evolution
   * Gemini key, so it yields first. Per caller: 2 in ten minutes, 4 a day; `planGlobal` is one shared
   * counter (key it with a constant): 40 a day per server instance.
   */
  planBurst: { name: "planBurst", max: 2, windowMs: 10 * 60_000 },
  planDay: { name: "planDay", max: 4, windowMs: 24 * 60 * 60_000 },
  planGlobal: { name: "planGlobal", max: 40, windowMs: 24 * 60 * 60_000 },
  /**
   * Intent understanding (the "tell us what you want" box). Per caller: 5 in ten minutes, 20 a day;
   * `intentGlobal` is one shared counter: 40 a day per server instance.
   */
  intentBurst: { name: "intentBurst", max: 5, windowMs: 10 * 60_000 },
  intentDay: { name: "intentDay", max: 20, windowMs: 24 * 60 * 60_000 },
  intentGlobal: { name: "intentGlobal", max: 40, windowMs: 24 * 60 * 60_000 },
  /**
   * Sarthi's phone tool (/api/voice-tool), keyed by the caller's number. A call makes a few
   * tool calls a minute at most; 60 in ten minutes is a long call, not a loop.
   */
  voiceTool: { name: "voiceTool", max: 60, windowMs: 10 * 60_000 },
  /** Live page translation: a first visit to a page is a handful of batches; repeats are cached. */
  translate: { name: "translate", max: 400, windowMs: 10 * 60_000 },
  translateGlobal: { name: "translateGlobal", max: 5000, windowMs: 24 * 60 * 60_000 },
  voiceToolGlobal: { name: "voiceToolGlobal", max: 3000, windowMs: 24 * 60 * 60_000 },
} satisfies Record<string, Limit>;
