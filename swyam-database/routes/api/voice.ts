import { createFileRoute } from "@tanstack/react-router";
import { isSarvamConfigured, sarvamSpeaks, synthesizeSpeech } from "@/lib/sarvam";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/**
 * Sarthi's voice, in Indian languages.
 *
 * A proxy rather than a direct browser call, because the Sarvam key must stay
 * on the server. GET reports whether the voice is available at all, so the
 * client can fall back to the browser's own synthesis without a failed POST.
 */

type Body = { text?: string; language?: string; speaker?: string };

export const Route = createFileRoute("/api/voice")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const language = new URL(request.url).searchParams.get("language") ?? "en";
        return Response.json({
          configured: isSarvamConfigured(),
          supported: isSarvamConfigured() && sarvamSpeaks(language),
        });
      },

      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.voice);
        if (limited) return limited;

        if (!isSarvamConfigured()) {
          return Response.json({ error: "Sarvam is not configured." }, { status: 503 });
        }

        const { text, language, speaker } = (await request.json()) as Body;
        if (!text || !text.trim()) {
          return Response.json({ error: "Nothing to say." }, { status: 400 });
        }
        if (!sarvamSpeaks(language ?? "en")) {
          return Response.json({ error: "No Sarvam voice for that language." }, { status: 400 });
        }

        try {
          const { audioBase64 } = await synthesizeSpeech(
            text,
            language ?? "en",
            speaker || undefined,
          );
          return Response.json({ audio: audioBase64, mimeType: "audio/wav" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Speech failed.";
          console.error("sarvam tts", message);
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
