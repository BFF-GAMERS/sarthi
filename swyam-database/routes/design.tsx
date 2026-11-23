import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/DesignSystem";

export const Route = createFileRoute("/design")({
  head: () => ({
    meta: [
      { title: "Design system — स्वYAM" },
      // A workbench, not a page of the product.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
