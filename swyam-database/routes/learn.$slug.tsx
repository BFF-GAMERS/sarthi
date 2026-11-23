import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Learn";

export const Route = createFileRoute("/learn/$slug")({
  head: () => ({
    meta: [{ title: "Learning — स्वYAM" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});
