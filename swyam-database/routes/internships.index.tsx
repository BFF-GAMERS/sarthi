import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Internships";

export const Route = createFileRoute("/internships/")({
  head: () => ({
    meta: [
      { title: "Internships & apprenticeships — स्वYAM" },
      {
        name: "description",
        content: "Stipended internships and NAPS apprenticeships with real employers across India.",
      },
      { property: "og:title", content: "Internships & apprenticeships — स्वYAM" },
      {
        property: "og:description",
        content: "Stipended internships and NAPS apprenticeships with real employers across India.",
      },
    ],
  }),
  component: Page,
});
