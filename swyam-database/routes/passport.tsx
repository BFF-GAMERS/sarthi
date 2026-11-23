import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Passport";

const TITLE = "Skill Passport — your verified record | स्वYAM";
const DESC =
  "One shareable page proving what you can do: skills, certificates, completed swaps, endorsements and badges, all drawn from your स्वYAM account.";

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
  component: Page,
});
