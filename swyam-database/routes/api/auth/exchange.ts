import { createFileRoute } from "@tanstack/react-router";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import {
  BridgeError,
  bridgeConfigured,
  memberFor,
  supabaseTokenFor,
  verifyFirebaseToken,
} from "@/lib/auth-bridge/server";

/**
 * POST /api/auth/exchange  { idToken, profile?: { display_name, handle } }
 *   → { access_token, expires_at, user }
 *
 * Trades a Firebase ID token for a Supabase session for the same person
 * (src/lib/auth-bridge/server.ts). `profile` is only used the first time, to name a new member.
 */
const headers = { "cache-control": "no-store" };

export const Route = createFileRoute("/api/auth/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = rateLimit(request, LIMITS.auth);
        if (limited) return limited;
        if (!bridgeConfigured())
          return Response.json({ error: "Sign-in is not set up yet." }, { status: 503, headers });

        let body: { idToken?: unknown; profile?: { display_name?: unknown; handle?: unknown } };
        try {
          const text = await request.text();
          if (text.length > 6_000)
            return Response.json({ error: "Request too large." }, { status: 413, headers });
          body = JSON.parse(text) as typeof body;
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400, headers });
        }
        if (typeof body.idToken !== "string")
          return Response.json({ error: "Bad request." }, { status: 400, headers });

        let who;
        try {
          who = await verifyFirebaseToken(body.idToken);
        } catch {
          return Response.json(
            { error: "Your sign-in has expired. Sign in again." },
            { status: 401, headers },
          );
        }
        try {
          const str = (v: unknown) => (typeof v === "string" ? v : undefined);
          const user = await memberFor(who, {
            display_name: str(body.profile?.display_name),
            handle: str(body.profile?.handle),
          });
          const token = await supabaseTokenFor(user, who.exp);
          return Response.json({ ...token, user }, { headers });
        } catch (e) {
          if (e instanceof BridgeError)
            return Response.json({ error: e.message }, { status: e.status, headers });
          console.error("[auth/exchange]", e);
          return Response.json(
            { error: "Could not sign you in right now." },
            { status: 500, headers },
          );
        }
      },
    },
  },
});
