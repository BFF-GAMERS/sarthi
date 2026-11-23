import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Notifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — स्वYAM" },
      {
        name: "description",
        content: "Application updates, course reminders and new opportunity alerts.",
      },
      { property: "og:title", content: "Notifications — स्वYAM" },
      {
        property: "og:description",
        content: "Application updates, course reminders and new opportunity alerts.",
      },
    ],
  }),
  component: Page,
});
