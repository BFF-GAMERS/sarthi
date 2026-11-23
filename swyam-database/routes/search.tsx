import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Search";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" && search["q"] !== "" ? { q: search["q"] } : {},
  head: () => ({
    meta: [
      { title: "Search everything — स्वYAM" },
      {
        name: "description",
        content:
          "Search courses, jobs, internships, institutes, employers and mentors in one place.",
      },
      { property: "og:title", content: "Search everything — स्वYAM" },
      {
        property: "og:description",
        content:
          "Search courses, jobs, internships, institutes, employers and mentors in one place.",
      },
    ],
  }),
  component: Page,
});
