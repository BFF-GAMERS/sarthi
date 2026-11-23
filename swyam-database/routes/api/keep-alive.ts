import { createFileRoute } from "@tanstack/react-router";

/**
 * Keeps the free Supabase project awake.
 *
 * Supabase pauses a free project after about a week with no activity, and a paused
 * database takes the whole site's data with it. A Vercel cron (vercel.json) calls this
 * once a day, and after a short random wait it reads one row from a random public table,
 * which counts as activity.
 *
 * Public on purpose: it uses only the publishable key, reads one id, and returns no data,
 * so calling it by hand is harmless. A failure is a 503, which shows up in the cron log.
 */
const TABLES = ["courses", "skills", "course_modules"];

export const Route = createFileRoute("/api/keep-alive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = process.env["VITE_SUPABASE_URL"];
        const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        const headers = { "cache-control": "no-store" };
        if (!url || !key) return Response.json({ ok: false }, { status: 503, headers });
        const table = TABLES[Math.floor(Math.random() * TABLES.length)]!;
        // A varied wait of 5 to 30 seconds, for the daily job only: a hand-made call
        // answers at once, so this URL cannot be used to hold a function open.
        if ((request.headers.get("user-agent") ?? "").includes("vercel-cron")) {
          const wait = 5_000 + Math.random() * 25_000;
          await new Promise((done) => setTimeout(done, wait));
        }
        try {
          const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
            headers: { apikey: key, authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(8000),
          });
          return Response.json({ ok: res.ok }, { status: res.ok ? 200 : 503, headers });
        } catch {
          return Response.json({ ok: false }, { status: 503, headers });
        }
      },
    },
  },
});
