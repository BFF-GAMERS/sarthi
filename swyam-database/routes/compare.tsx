import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Compare";
import { compareSearch } from "@/lib/compare-fields";

const TITLE = "Compare | स्वYAM";
const DESC = "Two or three jobs, internships or courses side by side, with the differences marked.";

export const Route = createFileRoute("/compare")({
  // `?kind=job|internship|course&ids=a,b,c`: anything invalid is dropped, and
  // the page falls back to the shortlist on this device.
  validateSearch: compareSearch,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      // A personal shortlist; nothing here is for an index.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
