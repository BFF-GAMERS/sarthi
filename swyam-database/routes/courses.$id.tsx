import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/mock";
import Page from "@/pages/CourseDetail";

export const Route = createFileRoute("/courses/$id")({
  /*
   * The title comes from the listing, not from a constant. Every one of
   * these shared a single preview title, so a link forwarded into a
   * WhatsApp group told the reader nothing about which one it was.
   *
   * Synchronous: the catalogue is an array in `data/mock.ts`, so this
   * needs no loader and costs the render nothing.
   */
  head: ({ params }) => {
    const found = courses.find((c) => c.id === params.id);
    // Some listings carry the brand in their own title; appending ours
    // to those produced it twice in one line.
    const name = found?.title.replace(/\s*[\u2014-]\s*\u0938\u094d\u0935YAM\s*$/u, "") ?? "";
    const title = found
      ? `${name} \u2014 course | \u0938\u094d\u0935YAM`
      : "Course \u2014 \u0938\u094d\u0935YAM";
    const description = found ? found.overview.slice(0, 155) : "Course on \u0938\u094d\u0935YAM.";
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
