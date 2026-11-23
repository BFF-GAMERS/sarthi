import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Community";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — स्वYAM" },
      {
        name: "description",
        content:
          "Share achievements, follow mentors and learn from other skilled workers across India.",
      },
      { property: "og:title", content: "Community — स्वYAM" },
      {
        property: "og:description",
        content:
          "Share achievements, follow mentors and learn from other skilled workers across India.",
      },
    ],
  }),
  component: Page,
});
