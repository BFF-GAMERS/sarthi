import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { answer } from "@/lib/sarthi-engine";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { cachedOpenings } from "@/lib/opportunities";
import { ask, keyFor, type Turn } from "@/lib/gemini";

/**
 * Sarthi answers a community question, live.
 *
 * The seeded questions in the feed shipped with their answers written. This is
 * the same thing happening for a question somebody asks today: post it, and
 * within a few seconds Sarthi replies underneath.
 *
 * TWO RULES SHAPE THE WHOLE FILE.
 *
 * 1. NO ROW-LEVEL-SECURITY BYPASS. `src/lib/supabase.ts` says the service_role
 *    key must never appear under `src/`, and it is right: one leak of that key
 *    and every table on the platform is readable. So this route does not hold
 *    one. It signs in as Sarthi's own account with the ordinary publishable
 *    key and writes under the same `comments_create` policy as everybody else,
 *    which requires `author_id = auth.uid()`. The worst a compromise of this
 *    route could do is make Sarthi post — not read anybody's messages.
 *
 * 2. THE CALLER NEVER SUPPLIES THE TEXT. The request carries a post id and
 *    nothing else. The route reads the post from the database itself and
 *    generates the reply here. If the body came from the client, anybody could
 *    put words in Sarthi's mouth and screenshot them, which on a platform
 *    whose whole argument is "nothing here claims what it cannot show" would
 *    be the worst possible thing to get wrong.
 *
 * Without `SARTHI_PASSWORD` the route returns 503 and the feed keeps its
 * seeded answers. Live replies are an enhancement, never a dependency.
 */

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"];
const PUBLISHABLE = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const SARTHI_EMAIL = process.env["SARTHI_EMAIL"] ?? "sarthi@assistant.swayam.local";
const SARTHI_PASSWORD = process.env["SARTHI_PASSWORD"];

/**
 * Community replies may run on their own Gemini key.
 *
 * The free tier meters per key, and the assistant's chat is the feature people
 * notice going quiet. Giving the community its own budget means a busy feed
 * cannot exhaust the chat, and vice versa. Falls back to the shared key so
 * nothing needs configuring for this to work at all.
 */
const communityKey = (): string | undefined => keyFor("community");

const SYSTEM = `You are Sarthi, the assistant on स्वYAM, an Indian skilling and
jobs platform. You are answering a question somebody posted in the community.

WHO YOU ARE ANSWERING. A 17-25 year old in India, often 10th or 12th pass or
ITI, reading on a cheap phone on paid mobile data, in their second or third
language. Short sentences. Plain words. Concrete over abstract.

WHAT YOU MAY SAY. Below is a retrieval from this platform's own catalog.
Everything factual in your answer must come from it — a course, a price, an
opening, a scheme, a feature of the site. You may rephrase it and you may
reason about it. You may not add a course, an employer, a fee, a statistic or
a government scheme that is not in it.

WHEN YOU DO NOT KNOW, SAY SO and say what would answer it. That is worth more
here than a confident guess, because the people reading this have been lied to
by platforms before and can rarely check.

NEVER claim स्वYAM is a government body or government certified. It is not,
and it says so on its own pages.

SHAPE. Two to four short paragraphs. No greeting, no sign-off, no markdown
headings. Write as one person answering another.`;

interface Body {
  postId?: unknown;
}

export const Route = createFileRoute("/api/community-reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.heavy);
        if (limited) return limited;

        const json = (l: unknown, status = 200) =>
          new Response(JSON.stringify(l), {
            status,
            headers: { "content-type": "application/json" },
          });

        if (!SUPABASE_URL || !PUBLISHABLE) return json({ error: "not configured" }, 503);

        /*
         * Two modes, and the difference is one credential.
         *
         * With SARTHI_PASSWORD the route signs in as Sarthi and writes a real
         * comment, which every member then sees — that is the finished
         * behaviour and nothing about it changes.
         *
         * Without it, this used to return 503 and the question sat at zero
         * replies forever. But the password only governs *writing as Sarthi*;
         * it has nothing to do with working out the answer. So the answer is
         * still produced and handed back to the asker, marked as theirs alone
         * to see. An answer only you can read is worth a great deal more than
         * no answer, and it is not a lie as long as the page says which it is.
         */
        const canPost = Boolean(SARTHI_PASSWORD);

        let postId = "";
        try {
          const body = (await request.json()) as Body;
          postId = typeof body.postId === "string" ? body.postId : "";
        } catch {
          return json({ error: "bad request" }, 400);
        }
        if (!/^[0-9a-f-]{36}$/i.test(postId)) return json({ error: "bad post id" }, 400);

        // A fresh client per request: this one carries Sarthi's session, and a
        // module-level client would leak that session between requests.
        const db = createClient(SUPABASE_URL, PUBLISHABLE, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        let sarthiId: string | null = null;
        if (canPost) {
          const auth = await db.auth.signInWithPassword({
            email: SARTHI_EMAIL,
            password: SARTHI_PASSWORD as string,
          });
          /* A wrong password is a misconfiguration, not a reason to leave the
             member without an answer: fall through and hand one back. */
          if (!auth.error) sarthiId = auth.data.user?.id ?? null;
        }

        // Read the question from the database, never from the request.
        const post = await db
          .from("posts")
          .select("id, title, body, kind, author_id")
          .eq("id", postId)
          .is("hidden_at", null)
          .maybeSingle();
        if (post.error || !post.data) return json({ error: "post not found" }, 404);

        if (sarthiId) {
          // One reply per question. Re-posting must not stack answers, and a
          // repeated request must not cost a second model call.
          const existing = await db
            .from("comments")
            .select("id")
            .eq("post_id", postId)
            .eq("author_id", sarthiId)
            .limit(1);
          if (existing.data && existing.data.length > 0) {
            return json({ skipped: "already answered" });
          }
          // Sarthi does not answer its own posts.
          if (post.data.author_id === sarthiId) return json({ skipped: "own post" });
        }

        // It does not butt into a showcase either — somebody sharing what they
        // made wants people, not a bot. True in both modes.
        if (post.data.kind === "showcase") return json({ skipped: "showcase" });

        const question = `${post.data.title}\n\n${post.data.body ?? ""}`.trim();

        // The local engine is the grounding: it can only ever name a course,
        // opening or scheme that exists in this platform's catalogue.
        const retrieved = answer(question, "en", "friend", await cachedOpenings());

        let reply = retrieved;
        try {
          const turns: Turn[] = [
            {
              role: "user",
              content: `A member posted this in the community:\n\n${question}\n\nRetrieved from the platform's catalog:\n\n${retrieved}\n\nAnswer them.`,
            },
          ];
          reply = await ask(turns, {
            system: SYSTEM,
            temperature: 0.3,
            maxTokens: 600,
            apiKey: communityKey(),
          });
        } catch {
          // Model unavailable or out of quota. The retrieval is already a
          // usable answer built only from real catalogue entries, so post it
          // rather than leaving the question sitting alone.
        }

        reply = reply.trim();
        if (!reply) return json({ error: "empty reply" }, 502);

        /* No account to write as: hand the answer to the asker instead. */
        if (!sarthiId) return json({ ok: false, answer: reply, posted: false });

        const inserted = await db
          .from("comments")
          .insert({ post_id: postId, author_id: sarthiId, body: reply })
          .select("id")
          .maybeSingle();
        if (inserted.error) return json({ error: inserted.error.message }, 500);

        await db.auth.signOut();
        return json({ ok: true, posted: true, commentId: inserted.data?.id ?? null });
      },
    },
  },
});
