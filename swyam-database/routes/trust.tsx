import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/TrustCentre";

const TITLE = "Trust center — what is checked, kept and promised | स्वYAM";
const DESC =
  "What “Verified” means on स्वYAM, how certificates are issued and checked, where the numbers come from, where AI is used, what is kept about you, and what is not promised.";

export const Route = createFileRoute("/trust")({
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
