import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Admin";

const TITLE = "Admin — स्वYAM";
const DESC = "Platform administration: members, roles, courses, enrollments and certificates.";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      // Never index the control room.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});
