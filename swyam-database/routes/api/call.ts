import { createFileRoute } from "@tanstack/react-router";
import { isCallConfigured, normalisePhone, placeCall } from "@/lib/sarvam";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/**
 * "Call me" — Sarthi rings the member's phone.
 *
 * For the people this platform is for, a phone call is often the most usable
 * interface there is: it needs no data plan, no reading, and no app. The
 * member types their number, presses one button, and the Sarvam voice agent
 * calls them in their own language.
 *
 * GET reports availability so the button only appears when a call could
 * actually be placed. POST does the dialling, and is deliberately the only
 * side-effectful thing here: the number comes from the person themselves on
 * that request, never from stored data or a third party.
 */

type Body = { phone?: string; language?: string; context?: string };

export const Route = createFileRoute("/api/call")({
  server: {
    handlers: {
      GET: async () => Response.json({ available: isCallConfigured() }),

      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.call);
        if (limited) return limited;

        if (!isCallConfigured()) {
          return Response.json(
            {
              error:
                "Calling isn't switched on. It needs a Samvaad key plus the deployed agent's ids.",
            },
            { status: 503 },
          );
        }

        const { phone, language, context } = (await request.json()) as Body;
        if (!phone) {
          return Response.json({ error: "A phone number is required." }, { status: 400 });
        }

        const to = normalisePhone(phone);
        if (!to) {
          return Response.json(
            { error: "Enter a 10-digit Indian mobile number." },
            { status: 400 },
          );
        }

        try {
          const { attemptId } = await placeCall({
            toNumber: to,
            languageCode: language ?? "en",
            ...(context ? { context } : {}),
          });
          // The masked number is echoed back so the UI can confirm which
          // phone is about to ring without logging the whole thing.
          return Response.json({ ok: true, attemptId, to: `${to.slice(0, 6)}••••${to.slice(-2)}` });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Call failed.";
          console.error("sarvam call", message);
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
