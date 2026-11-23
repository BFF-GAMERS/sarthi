import { createFileRoute } from "@tanstack/react-router";

/**
 * The embeddable Skill Passport card.
 *
 * A learner can paste one `<iframe>` into their own site, a portfolio, or
 * anywhere that takes HTML, and it shows their verified skills and
 * certificates — live, so it is never a screenshot that has drifted out of
 * date. The whole point of the passport is that it can be checked; a copy that
 * cannot be is worth nothing.
 *
 * Rendered as plain HTML from the server rather than as a page of the app.
 * An embed has to work in one request, inside somebody else's page, with no
 * React and no shared stylesheet — and it must not carry the site's navigation
 * or its chat launcher into a stranger's layout.
 *
 * Privacy is not decided here. `get_shared_passport` returns nothing unless
 * the passport is public, and strips each section the owner has switched off,
 * exactly as the shared link does. A private passport embeds as "not
 * available", not as a leak.
 */

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const SUPABASE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

interface Snapshot {
  found?: boolean;
  headline?: string | null;
  summary?: string | null;
  passport?: {
    profile?: { display_name?: string; handle?: string; region?: string | null };
    // `skill`, not `name` — that is the key build_passport_snapshot emits.
    // Reading `name` yielded undefined, and every pill rendered empty.
    skills?: Array<{ skill?: string; verification?: string; level?: string }>;
    certificates?: Array<{ title?: string; serial?: string; issued_at?: string }>;
  };
}

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Only these two count as verified; the rest are still on their way. */
const isVerified = (v: unknown) => v === "verified" || v === "expert_verified";

function shell(body: string, origin: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Skill Passport</title>
<style>
  /* Self-contained: the host page's stylesheet is none of our business, and
     ours is not available here. */
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --paper:#f6f4ef; --ink:#1a1a1b; --mute:#6b6b70;
    --line:#e2ded4; --saffron:#c9330a; --green:#0f7a5a;
  }
  @media (prefers-color-scheme: dark){
    :root{--paper:#161617;--ink:#f2f0ea;--mute:#9a9aa0;--line:#2c2c30;--saffron:#ff7a4d;--green:#3fbe93}
  }
  body{
    font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:var(--paper); color:var(--ink); padding:16px;
  }
  a{color:inherit;text-decoration:none}
  .card{border:1px solid var(--line);border-radius:14px;padding:18px;background:var(--paper)}
  .name{font-size:17px;font-weight:600;letter-spacing:-.01em}
  .sub{color:var(--mute);font-size:12.5px;margin-top:2px}
  h2{font-size:10.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--mute);
     margin:16px 0 8px;font-weight:600}
  ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
  li.skill{border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:12.5px}
  li.skill.ok{border-color:transparent;background:var(--green);color:#fff}
  li.cert{width:100%;border-top:1px solid var(--line);padding:8px 0;font-size:13px}
  li.cert:first-child{border-top:0}
  .serial{color:var(--mute);font-size:11px;font-family:ui-monospace,monospace}
  .foot{margin-top:16px;padding-top:12px;border-top:1px solid var(--line);
        display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--mute)}
  .foot b{color:var(--saffron);font-weight:600}
  .empty{color:var(--mute);font-size:13px}
</style>
</head><body><div class="card">${body}
<div class="foot"><span>Verified on <b>स्वYAM</b></span><a href="${esc(origin)}" target="_blank" rel="noopener">${esc(origin.replace(/^https?:\/\//, ""))}</a></div>
</div></body></html>`;
}

export const Route = createFileRoute("/embed/passport/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { origin } = new URL(request.url);

        const headers: Record<string, string> = {
          "Content-Type": "text/html; charset=utf-8",
          // The entire purpose is to be framed by somebody else's page.
          "Content-Security-Policy": "frame-ancestors *",
          "Cache-Control": "public, max-age=300",
          // Never let an embed become a way to enumerate passports.
          "X-Robots-Tag": "noindex",
        };

        if (!SUPABASE_URL || !SUPABASE_KEY) {
          return new Response(shell('<p class="empty">Not configured.</p>', origin), {
            status: 503,
            headers,
          });
        }

        let snap: Snapshot = {};
        try {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_passport`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
            },
            // `source` marks the view as an embed, so the owner's view count
            // can tell a card on someone's blog from a link they sent.
            body: JSON.stringify({ p_slug: params.slug, p_source: "embed" }),
          });
          snap = (await res.json()) as Snapshot;
        } catch {
          snap = {};
        }

        if (!snap?.found) {
          return new Response(
            shell('<p class="empty">This Skill Passport is private or does not exist.</p>', origin),
            { status: 404, headers },
          );
        }

        const p = snap.passport ?? {};
        const profile = p.profile ?? {};
        const skills = (p.skills ?? []).slice(0, 14);
        const certs = (p.certificates ?? []).slice(0, 5);

        const skillList = skills.length
          ? `<h2>Skills</h2><ul>${skills
              .map(
                (s) =>
                  `<li class="skill${isVerified(s.verification) ? " ok" : ""}">${esc(s.skill)}</li>`,
              )
              .join("")}</ul>`
          : "";

        const certList = certs.length
          ? `<h2>Certificates</h2><ul>${certs
              .map(
                (c) =>
                  `<li class="cert">${esc(c.title)}<br><span class="serial">${esc(c.serial)}</span></li>`,
              )
              .join("")}</ul>`
          : "";

        const body = `
  <div class="name">${esc(profile.display_name ?? "Member")}</div>
  <div class="sub">${esc(snap.headline ?? profile.region ?? "")}</div>
  ${skillList}${certList}
  ${!skillList && !certList ? '<p class="empty">Nothing shared yet.</p>' : ""}`;

        return new Response(shell(body, origin), { headers });
      },
    },
  },
});
