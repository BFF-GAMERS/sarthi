import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/CourseCompare";

const TITLE = "Compare courses | स्वYAM";
const DESC =
  "Up to three courses side by side: fee, start, duration, mode, where, level, certificate and placement support.";

export const Route = createFileRoute("/courses/compare")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      // A personal shortlist; nothing here is for an index.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
