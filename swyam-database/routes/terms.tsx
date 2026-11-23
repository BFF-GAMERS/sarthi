import { createFileRoute } from "@tanstack/react-router";
import { Terms } from "@/pages/Legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of use — स्वYAM" },
      {
        name: "description",
        content: "The rules for using स्वYAM, and what the platform does not promise.",
      },
    ],
  }),
  component: Terms,
});
