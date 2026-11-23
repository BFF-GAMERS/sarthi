import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/AiMentor";

export const Route = createFileRoute("/mentor/$slug")({
  head: () => ({
    meta: [
      { title: "AI mentorship — learn it on your own | स्वYAM" },
      {
        name: "description",
        content:
          "A self-paced plan for any skill on स्वYAM: modules in the order they should be learnt, and a mentor that guides while you work rather than doing it for you.",
      },
    ],
  }),
  component: Page,
});
