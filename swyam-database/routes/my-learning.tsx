import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/MyLearning";

export const Route = createFileRoute("/my-learning")({
  head: () => ({
    meta: [{ title: "My learning — स्वYAM" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});
