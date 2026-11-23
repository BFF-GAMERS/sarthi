import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Rewards";

const TITLE = "Rewards — earn points, unlock paid courses | स्वYAM";
const DESC =
  "Students earn points for every lesson, course, assessment and completed swap, and trade them for discount codes on paid courses.";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Page,
});
