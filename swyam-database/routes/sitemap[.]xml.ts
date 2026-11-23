import { createFileRoute } from "@tanstack/react-router";
import { courses, organizations } from "@/data/mock";
import { cachedOpenings } from "@/lib/opportunities";

/**
 * The sitemap.
 *
 * Served from a route rather than dropped in `public/` because the detail
 * pages — every course, job, internship and training partner — come from the
 * catalogue, and a hand-written file would start lying the first time somebody
 * adds a course. Generated on request, it cannot drift.
 *
 * The origin is read from the request, so the preview deployments and the
 * production domain each advertise their own URLs. A sitemap that names a
 * different host than the one serving it is ignored.
 *
 * Signed-in-only routes are deliberately absent: /dashboard, /messages,
 * /settings, /cart, /notifications, /admin and the rest render nothing to a
 * crawler and would be dead weight in the index.
 */

/** Public routes, with how strongly each should be crawled. */
const STATIC: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/courses", priority: "0.9", changefreq: "daily" },
  { path: "/jobs", priority: "0.9", changefreq: "daily" },
  { path: "/internships", priority: "0.9", changefreq: "daily" },
  { path: "/skillswap", priority: "0.9", changefreq: "weekly" },
  { path: "/opportunities", priority: "0.8", changefreq: "daily" },
  { path: "/schemes", priority: "0.8", changefreq: "weekly" },
  { path: "/skills", priority: "0.7", changefreq: "weekly" },
  // Public and useful to index: it answers "can I learn X here" for every
  // skill on the platform, including the ones with no course yet.
  { path: "/board", priority: "0.7", changefreq: "weekly" },
  { path: "/community", priority: "0.7", changefreq: "daily" },
  { path: "/events", priority: "0.7", changefreq: "weekly" },
  { path: "/resources", priority: "0.7", changefreq: "weekly" },
  { path: "/rewards", priority: "0.6", changefreq: "weekly" },
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
  { path: "/search", priority: "0.5", changefreq: "weekly" },
  { path: "/auth", priority: "0.4", changefreq: "monthly" },
];

/** `&` and friends are not legal raw in an XML text node. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function url(origin: string, path: string, priority: string, changefreq: string): string {
  return [
    "  <url>",
    `    <loc>${xmlEscape(origin + path)}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { origin } = new URL(request.url);

        // Only openings that exist. The sample catalogue put ninety URLs
        // here that answered "no longer listed" to every crawler.
        const openings = await cachedOpenings();

        const entries = [
          ...STATIC.map((s) => url(origin, s.path, s.priority, s.changefreq)),
          ...courses.map((c) => url(origin, `/courses/${c.id}`, "0.8", "weekly")),
          ...openings.map((o) =>
            url(
              origin,
              o.kind === "internship" ? `/internships/${o.slug}` : `/jobs/${o.slug}`,
              "0.7",
              "daily",
            ),
          ),
          ...organizations.map((o) => url(origin, `/orgs/${o.id}`, "0.6", "monthly")),
        ];

        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...entries,
          "</urlset>",
          "",
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            // Crawlers re-fetch this often; an hour of caching costs nothing
            // and keeps a bot sweep off the origin.
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
