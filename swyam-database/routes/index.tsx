import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Learn a skill. Get hired. — स्वYAM" },
      {
        name: "description",
        content:
          "Courses, apprenticeships, government schemes and jobs for every Indian learner, from your district to your trade.",
      },
      { property: "og:title", content: "Learn a skill. Get hired. — स्वYAM" },
      {
        property: "og:description",
        content:
          "Courses, apprenticeships, government schemes and jobs for every Indian learner, from your district to your trade.",
      },
    ],
  }),
  component: Page,
});
