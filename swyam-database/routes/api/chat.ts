import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { answer } from "@/lib/sarthi-engine";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { cachedOpenings } from "@/lib/opportunities";
import { chat, isChatConfigured, type ChatTurn } from "@/lib/sarvam";
import { ask, isGeminiConfigured, keyFor } from "@/lib/gemini";
import { languageFor } from "@/lib/languages";

/**
 * Sarthi chat endpoint.
 *
 * Two layers, in this order:
 *
 *   1. The local engine retrieves from the platform's own catalogue. It can
 *      only ever name a course, employer, stipend or scheme that exists.
 *
 *   2. When a Sarvam key is present, that retrieval becomes the grounding for
 *      a real model, which answers conversationally and in the member's own
 *      language. The retrieved facts go in the system turn precisely so the
 *      model rephrases them rather than inventing a course.
 *
 * With no key the engine's own answer is returned unchanged, so the assistant
 * still works with no external call and no per-message cost. Either way the
 * response is a standard AI SDK UI message stream, so the client renders
 * progressive markdown without knowing which path produced it.
 */

type ChatRequestBody = { messages?: unknown; language?: string; userName?: string };

/** Flatten a UI message's parts into plain text. */
function textOf(m: UIMessage): string {
  return (m.parts ?? [])
    .map((p) => (p.type === "text" ? ((p as { text?: string }).text ?? "") : ""))
    .join(" ")
    .trim();
}

/** Last thing the user typed. */
function latestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return textOf(m);
  }
  return "";
}

/**
 * What to search the catalogue with.
 *
 * The latest message alone is not enough. "And what does it cost?" has no
 * subject in it, so retrieval found nothing and the model reported, honestly
 * and wrongly, that no such course existed — one turn after naming it.
 *
 * The latest message leads, so its words still drive intent detection; the
 * previous user turns follow, carrying the nouns the follow-up is about. Two
 * turns of history is enough for the pronoun case without dragging an old
 * subject into a genuine change of topic.
 */
function retrievalQuery(messages: UIMessage[], carry = 2): string {
  const said = messages
    .filter((m) => m.role === "user")
    .map(textOf)
    .filter(Boolean);
  if (said.length === 0) return "";
  const latest = said[said.length - 1]!;
  const earlier = said.slice(Math.max(0, said.length - 1 - carry), said.length - 1);
  return [latest, ...earlier.reverse()].join(" ");
}

/**
 * Recent turns, so a follow-up like "and the second one?" has something to
 * refer back to. Capped because the whole history would crowd out the
 * grounding facts, which matter more than distant small talk.
 */
function history(messages: UIMessage[], limit = 8): ChatTurn[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-limit)
    .map((m) => ({ role: m.role as "user" | "assistant", content: textOf(m) }))
    .filter((t) => t.content.length > 0);
}

/**
 * The system turn.
 *
 * `grounding` is the local engine's markdown answer — the real matches for
 * this question. The instructions below are deliberately strict about not
 * going beyond it, because a plausible invented course wastes a person's
 * time far more expensively than an honest "I don't have one".
 */
function systemPrompt(userName: string, language: string, grounding: string): string {
  const lang = languageFor(language);
  return [
    `You are Sarthi, the career guide on स्वYAM, an Indian skilling platform.`,
    `You are talking to ${userName}.`,
    ``,
    `Reply in ${lang.label}${lang.code === "en" ? " (Indian English)" : ""}.`,
    `Keep it short: 2-4 sentences, or a tight list. Warm, direct, no filler.`,
    `Rupee amounts stay in rupees. Course, employer and scheme names stay in their original form — never translate them.`,
    ``,
    `PLATFORM DATA FOR THIS QUESTION:`,
    grounding,
    ``,
    `Use only the data above for specifics. Never invent a course, employer, salary, stipend, deadline or scheme.`,
    `If it does not answer the question, say so plainly and suggest what the person could look at instead.`,
    `You may also help with SkillSwap (trading a skill you have for one you want), resumes and interview preparation from general knowledge.`,
  ].join("\n");
}

/** Split into chunks that keep markdown syntax intact while streaming. */
function chunk(text: string): string[] {
  return text.match(/\s*\S+/g) ?? [text];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.chat);
        if (limited) return limited;

        const { messages, language, userName } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        try {
          const turns = messages as UIMessage[];
          const question = latestUserText(turns);
          const lang = language ?? "en";
          const who = userName || "friend";

          // The local engine always runs: it is the retrieval step, and the
          // whole answer when there is no model behind it.
          const grounded = answer(retrievalQuery(turns), lang, who, await cachedOpenings());

          // Three tiers, each a fallback for the one before: Gemini phrases
          // best and has the most generous free allowance, Sarvam is the
          // Indian-language specialist, and the local engine is the answer
          // itself. Losing a provider costs phrasing, never the facts —
          // which is exactly what happened when Sarvam's credits ran out.
          let reply = grounded;
          if (question) {
            const prompt = systemPrompt(who, lang, grounded);
            const past = history(turns);

            if (isGeminiConfigured()) {
              try {
                reply = await ask(
                  past.map((t) => ({
                    role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
                    content: t.content,
                  })),
                  { system: prompt, apiKey: keyFor("chat") },
                );
              } catch (geminiError) {
                console.error("gemini unavailable, trying sarvam", geminiError);
              }
            }

            if (reply === grounded && isChatConfigured()) {
              try {
                reply = await chat([{ role: "system", content: prompt }, ...past]);
              } catch (modelError) {
                console.error("sarvam chat fell back to the local engine", modelError);
              }
            }
          }

          const stream = createUIMessageStream({
            originalMessages: messages as UIMessage[],
            execute: async ({ writer }) => {
              const id = "0";
              writer.write({ type: "start" });
              writer.write({ type: "text-start", id });
              for (const piece of chunk(reply)) {
                writer.write({ type: "text-delta", id, delta: piece });
                // Paced so the reply reads as it arrives rather than
                // appearing as one block.
                await sleep(14);
              }
              writer.write({ type: "text-end", id });
              writer.write({ type: "finish" });
            },
          });

          return createUIMessageStreamResponse({ stream });
        } catch (error) {
          console.error("chat error", error);
          const message = error instanceof Error ? error.message : "Unknown error";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
