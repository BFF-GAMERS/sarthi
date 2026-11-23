import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Settings";

const TITLE = "Settings — language, accessibility and your details | स्वYAM";
const DESC =
  "Choose your interface style and language from all 22 scheduled languages, and set text size, contrast, motion and spoken navigation.";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Page,
});
