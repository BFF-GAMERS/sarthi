import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/SkillBoard";

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Skill board — who teaches what | स्वYAM" },
      {
        name: "description",
        content:
          "Every skill on स्वYAM: how many certified trainers can teach it, how many learners want it, and which courses cover it.",
      },
      { property: "og:title", content: "Skill board — who teaches what | स्वYAM" },
    ],
  }),
  component: Page,
});
