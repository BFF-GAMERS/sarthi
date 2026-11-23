import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Applications";

export const Route = createFileRoute("/applications")({
  head: () => ({
    meta: [{ title: "My applications — स्वYAM" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});
