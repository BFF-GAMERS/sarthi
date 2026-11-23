import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Profile";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — स्वYAM" },
      {
        name: "description",
        content: "Manage your skills, certificates, resume and portfolio on स्वYAM.",
      },
      { property: "og:title", content: "Your profile — स्वYAM" },
      {
        property: "og:description",
        content: "Manage your skills, certificates, resume and portfolio on स्वYAM.",
      },
    ],
  }),
  component: Page,
});
