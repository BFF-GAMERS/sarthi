import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Courses";

export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "Courses — learn a trade, prove it with an assessment" },
      {
        name: "description",
        content:
          "Browse courses in the trades people are hired for, many of them free, filtered by trade, mode and district.",
      },
      { property: "og:title", content: "Courses — learn a trade, prove it with an assessment" },
      {
        property: "og:description",
        content:
          "Browse courses in the trades people are hired for, many of them free, filtered by trade, mode and district.",
      },
    ],
  }),
  component: Page,
});
