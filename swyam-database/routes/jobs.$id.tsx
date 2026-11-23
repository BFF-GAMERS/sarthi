import { createFileRoute } from "@tanstack/react-router";
import { getOpportunity } from "@/lib/opportunities";
import Page from "@/pages/JobDetail";

export const Route = createFileRoute("/jobs/$id")({
  /*
   * The title comes from the listing, not from a constant. Every one of
   * these shared a single preview title, so a link forwarded into a
   * WhatsApp group told the reader nothing about which one it was.
   *
   * Read from the database, because that is where the listings are. This
   * used to look the id up in the sample catalogue, so a real posting — the
   * only kind that exists — got the generic title and a sample one got a
   * real-looking preview for a page that then said "no longer listed".
   */
  loader: async ({ params }) => {
    const found = await getOpportunity(params.id).catch(() => null);
    return {
      title: found?.title ?? null,
      summary: found?.summary ?? found?.description?.slice(0, 155) ?? null,
    };
  },
  head: ({ loaderData }) => {
    // Some listings carry the brand in their own title; appending ours
    // to those produced it twice in one line.
    const name = loaderData?.title?.replace(/\s*[—-]\s*स्वYAM\s*$/u, "") ?? "";
    const title = name ? `${name} — job | स्वYAM` : "Job — स्वYAM";
    const description = loaderData?.summary?.slice(0, 155) ?? "Job on स्वYAM.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: Page,
});
