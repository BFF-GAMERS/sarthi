import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/CareerPath";

export const Route = createFileRoute("/careers/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — career path | स्वYAM` },
      {
        name: "description",
        content:
          "The skills this career needs, how many of them you already hold, and the courses and swaps that close the gap.",
      },
    ],
  }),
  component: Page,
});
