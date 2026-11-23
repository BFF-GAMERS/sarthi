import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Explore";

const TITLE = "Explore — everything on स्वYAM";
const DESC =
  "Every part of स्वYAM in one place: courses, jobs, internships, skills, community and more.";

export const Route = createFileRoute("/explore")({
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
