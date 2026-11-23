import { createFileRoute } from "@tanstack/react-router";
import { Privacy } from "@/pages/Legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — स्वYAM" },
      {
        name: "description",
        content:
          "What स्वYAM keeps about you, who else sees it, and what you can make us do with it.",
      },
    ],
  }),
  component: Privacy,
});
