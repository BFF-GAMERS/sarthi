import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Coach";

const TITLE = "AI Study Coach — understand your marks, build your plan | स्वYAM";
const DESC =
  "Enter or upload your marks and get a study plan, subject-wise next steps, career directions and courses matched to your goal, city and budget. Your marks stay on your device.";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      // A student's marks are theirs. Nothing on this page is for an index.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
