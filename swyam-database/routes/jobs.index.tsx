import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Jobs";

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — Skilled roles hiring now" },
      {
        name: "description",
        content: "Find skilled trade, technical and industry jobs matched to your certifications.",
      },
      { property: "og:title", content: "Jobs — Skilled roles hiring now" },
      {
        property: "og:description",
        content: "Find skilled trade, technical and industry jobs matched to your certifications.",
      },
    ],
  }),
  component: Page,
});
