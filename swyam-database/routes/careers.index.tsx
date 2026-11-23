import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Careers";

const TITLE = "Career paths — pick where you are going | स्वYAM";
const DESC =
  "Eight career paths, the skills each one needs, and a plan that closes the gap between where you are and where you want to work.";

export const Route = createFileRoute("/careers/")({
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
