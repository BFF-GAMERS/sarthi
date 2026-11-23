import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/OrgProfile";

export const Route = createFileRoute("/orgs/$id")({
  head: () => ({
    meta: [
      { title: "Organization — स्वYAM" },
      {
        name: "description",
        content:
          "Explore institutes and employers: facilities, trainers, placement rates and reviews.",
      },
      { property: "og:title", content: "Organization — स्वYAM" },
      {
        property: "og:description",
        content:
          "Explore institutes and employers: facilities, trainers, placement rates and reviews.",
      },
    ],
  }),
  component: Page,
});
