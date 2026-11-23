import { createFileRoute } from "@tanstack/react-router";
import { answer } from "@/lib/sarthi-engine";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { cachedOpenings } from "@/lib/opportunities";
import { chat, isChatConfigured, type ChatTurn } from "@/lib/sarvam";
import { languageFor, SUPPORTED_LANGUAGES } from "@/lib/languages";

/**
 * The phone line.
 *
 * Most of the people this platform exists for do not have reliable data, a
 * smartphone they own outright, or the literacy in English that a web app
 * quietly assumes. They do have a phone that can make a call.
 *
 * This is the webhook a Sarvam voice agent calls on every turn of a live
 * conversation: it receives what the caller said, answers from the real
 * catalogue, and hands back a line to speak. Nothing about the answer depends
 * on the caller having a browser open — the whole platform is reachable by
 * voice, in their own language, over an ordinary phone call.
 *
 * Point your agent's webhook at `POST /api/agent`. Configure it there; there
 * is no key to paste into the site.
 */

interface AgentRequest {
  /** What the caller said, already transcribed by the telephony layer. */
  query?: string;
  transcript?: string;
  text?: string;
  /** Language of the call. Accepts our codes or Sarvam's "hi-IN" form. */
  language?: string;
  language_code?: string;
  /** The caller's turns so far, oldest first, if the agent tracks them. */
  history?: Array<{ role?: string; content?: string }>;
  /** Opaque id from the telephony provider, echoed back for their logs. */
  call_id?: string;
}

/** "hi-IN" and "hi" both mean Hindi here; "od-IN" is Sarvam's spelling of Odia. */
function normaliseLanguage(raw: string | undefined): string {
  if (!raw) return "en";
  const base = raw.toLowerCase().split(/[-_]/)[0] ?? "en";
  if (base === "od") return "or";
  return SUPPORTED_LANGUAGES.some((l) => l.code === base) ? base : "en";
}

/**
 * Voice needs shorter answers than a screen.
 *
 * A caller cannot skim, scroll back or re-read, so the reply is capped and
 * stripped of anything that only makes sense written down.
 */
function forSpeech(markdown: string, limit = 480): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= limit) return plain;
  // Cut at a sentence end so the caller never hears a severed clause.
  const cut = plain.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("!"));
  return lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trim()}…`;
}

function systemPrompt(language: string, grounding: string): string {
  const lang = languageFor(language);
  return [
    `You are Sarthi, answering a phone call for स्वYAM, an Indian skilling platform.`,
    `The caller may have no internet and may not read English. You are their whole interface.`,
    ``,
    `Speak ${lang.label}. Two or three short sentences, the way a person talks — not a list, no markdown, no URLs, no email addresses.`,
    `Numbers out loud: say "five thousand rupees", not "₹5,000".`,
    `End by offering the obvious next step, or by asking one short question.`,
    ``,
    `PLATFORM DATA FOR THIS QUESTION:`,
    grounding,
    ``,
    `Use only that data for course names, employers, fees, stipends and locations. Never invent one.`,
    `If it does not cover the question, say so simply and offer what you can help with instead.`,
    `If the caller wants to enrol or apply, tell them you have noted it and someone will call back — do not pretend it is done.`,
  ].join("\n");
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      // A health check the voice platform can poll before routing calls.
      GET: async () =>
        Response.json({
          ok: true,
          service: "swayam-voice-agent",
          model: isChatConfigured() ? "sarvam" : "local-engine",
          languages: SUPPORTED_LANGUAGES.map((l) => l.code),
        }),

      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.chat);
        if (limited) return limited;

        let body: AgentRequest;
        try {
          body = (await request.json()) as AgentRequest;
        } catch {
          return Response.json({ error: "Expected a JSON body." }, { status: 400 });
        }

        const said = (body.query ?? body.transcript ?? body.text ?? "").trim();
        const language = normaliseLanguage(body.language ?? body.language_code);

        if (!said) {
          // The opening line, before the caller has said anything.
          const greeting =
            language === "hi"
              ? "नमस्ते! मैं सारथी हूँ। मैं कोर्स, नौकरी और सरकारी योजनाओं में मदद कर सकता हूँ। आप क्या सीखना चाहते हैं?"
              : "Namaste! I am Sarthi. I can help you with courses, jobs and government schemes. What would you like to learn?";
          return Response.json({ reply: greeting, language, end_call: false });
        }

        try {
          // The same retrieval the website uses, so the phone and the screen
          // can never tell a caller two different things.
          const grounded = answer(said, language, "friend", await cachedOpenings());

          let reply = forSpeech(grounded);
          if (isChatConfigured()) {
            try {
              const turns: ChatTurn[] = [
                { role: "system", content: systemPrompt(language, grounded) },
                ...(body.history ?? [])
                  .filter((h) => h.content && (h.role === "user" || h.role === "assistant"))
                  .slice(-6)
                  .map((h) => ({
                    role: h.role as "user" | "assistant",
                    content: String(h.content).slice(0, 800),
                  })),
                { role: "user", content: said.slice(0, 800) },
              ];
              reply = forSpeech(await chat(turns, 300));
            } catch (modelError) {
              console.error("agent fell back to the local engine", modelError);
            }
          }

          // Let the caller hang up on their own terms.
          const wantsToEnd =
            /\b(bye|goodbye|thank you|thanks|that'?s all|nothing else)\b/i.test(said) ||
            /धन्यवाद|शुक्रिया|बस इतना/.test(said);

          return Response.json({
            reply,
            language,
            end_call: wantsToEnd,
            ...(body.call_id ? { call_id: body.call_id } : {}),
          });
        } catch (error) {
          console.error("agent error", error);
          // A caller must never hear silence, so even a failure has a line.
          return Response.json({
            reply:
              language === "hi"
                ? "माफ़ कीजिए, अभी कुछ दिक्कत आ रही है। थोड़ी देर बाद फिर कोशिश कीजिए।"
                : "Sorry, something went wrong just now. Please try again in a little while.",
            language,
            end_call: false,
          });
        }
      },
    },
  },
});
