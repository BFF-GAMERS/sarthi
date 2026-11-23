import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Saved";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [{ title: "Saved — स्वYAM" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});
