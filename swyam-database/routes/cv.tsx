import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/CvReview";

const TITLE = "CV review — find out why applications get rejected | स्वYAM";
const DESC =
  "Paste your CV and see what would stop it passing an automatic screen, which lines to reword, and what the posting asks for that you have not said. Nothing is stored.";

export const Route = createFileRoute("/cv")({
  // `?for=<slug>` tailors the review to one posting, so the Apply page can
  // hand somebody straight here with the role already in hand.
  validateSearch: (search: Record<string, unknown>): { for?: string } => ({
    for: typeof search["for"] === "string" ? search["for"] : undefined,
  }),
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
