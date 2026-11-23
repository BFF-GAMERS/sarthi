import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Messages";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — स्वYAM" },
      {
        name: "description",
        content: "Chat with recruiters, institutes and mentors about courses and openings.",
      },
      { property: "og:title", content: "Messages — स्वYAM" },
      {
        property: "og:description",
        content: "Chat with recruiters, institutes and mentors about courses and openings.",
      },
    ],
  }),
  component: Page,
});
