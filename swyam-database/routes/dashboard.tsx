import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — स्वYAM" },
      {
        name: "description",
        content: "Track your courses, applications, skill progress and AI recommendations.",
      },
      { property: "og:title", content: "Your dashboard — स्वYAM" },
      {
        property: "og:description",
        content: "Track your courses, applications, skill progress and AI recommendations.",
      },
    ],
  }),
  component: Page,
});
