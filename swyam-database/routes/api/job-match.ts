import { createFileRoute } from "@tanstack/react-router";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { findJobsFor, status } from "@/lib/jobs/job-match";
import { memberIdFromAccessToken } from "@/lib/auth-bridge/server";

const URL_ = process.env["VITE_SUPABASE_URL"];
const KEY = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const configured = () => Boolean(URL_ && KEY);

/** The member behind the request, and a client that acts as them (their own data only). */
async function caller(request: Request): Promise<{ uid: string; sb: SupabaseClient } | null> {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !URL_ || !KEY) return null;
  const sb = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Capital A: supabase-js sets its own "Authorization", and a lowercase copy is sent alongside it.
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  // A token from the Firebase sign-in bridge is checked here; Supabase's own tokens by Supabase.
  const bridged = await memberIdFromAccessToken(token);
  if (bridged) return { uid: bridged, sb };
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { uid: data.user.id, sb };
}

/**
 * "Jobs for me" (src/lib/jobs/job-match.ts).
 *   GET  → how many presses are left today, and the last result (free to show again)
 *   POST → spend one press: rank real openings for this member, Gemini picks and explains
 * Signed-in members only. The daily allowance lives on the server, not in the browser.
 */
const headers = { "cache-control": "no-store" };
const SUPPORTED = /^[a-z]{2,3}$/;

export const Route = createFileRoute("/api/job-match")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!configured())
          return Response.json({ error: "not configured" }, { status: 503, headers });
        const who = await caller(request);
        if (!who)
          return Response.json(
            { error: "Sign in to see jobs picked for you." },
            { status: 401, headers },
          );
        return Response.json(await status(who.sb, who.uid), { headers });
      },
      POST: async ({ request }) => {
        const limited = rateLimit(request, LIMITS.heavy);
        if (limited) return limited;
        if (!configured())
          return Response.json({ error: "not configured" }, { status: 503, headers });
        const who = await caller(request);
        if (!who)
          return Response.json(
            { error: "Sign in to see jobs picked for you." },
            { status: 401, headers },
          );
        let body: { recent?: unknown; locale?: unknown } = {};
        try {
          const text = await request.text();
          if (text.length > 8_000)
            return Response.json({ error: "Request too large." }, { status: 413, headers });
          body = text ? (JSON.parse(text) as typeof body) : {};
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400, headers });
        }
        // Titles of pages the member viewed: short strings only, never instructions to follow.
        const recent = Array.isArray(body.recent)
          ? body.recent
              .filter((x): x is string => typeof x === "string")
              .map((x) => x.slice(0, 80))
              .slice(0, 15)
          : [];
        const locale =
          typeof body.locale === "string" && SUPPORTED.test(body.locale) ? body.locale : "en";
        try {
          const out = await findJobsFor(who.sb, who.uid, recent, locale);
          if (!out.ok)
            return Response.json(
              {
                error: "You have used today's picks. They refresh at midnight.",
                remaining: 0,
                last: out.last,
              },
              { status: 429, headers },
            );
          return Response.json(out, { headers });
        } catch (e) {
          console.error("[job-match]", e);
          return Response.json(
            { error: "Could not pick jobs right now." },
            { status: 500, headers },
          );
        }
      },
    },
  },
});
