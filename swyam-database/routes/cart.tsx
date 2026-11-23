import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Cart";

const TITLE = "Your cart — courses ready to start | स्वYAM";
const DESC = "Courses you've lined up. Enroll in all of them in one go.";

export const Route = createFileRoute("/cart")({
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
