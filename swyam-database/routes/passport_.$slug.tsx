import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/SharedPassport";

/**
 * `/passport/<slug>` — the page the Copy link button has been pointing at all
 * along, with nothing behind it.
 *
 * The trailing underscore keeps it out of `/passport` as a child: the owner's
 * own passport is a signed-in workspace page, and this is a public record
 * shown to a stranger. They share a path and nothing else.
 *
 * Not indexed. The slug is a capability — whoever holds it can read the
 * passport — so letting a crawler collect them would turn "share this with an
 * employer" into "publish this to the web", which is not what the owner
 * agreed to when they pressed Publish.
 */
export const Route = createFileRoute("/passport_/$slug")({
  head: () => ({
    meta: [
      { title: "Skill Passport — स्वYAM" },
      {
        name: "description",
        content:
          "A स्वYAM Skill Passport: verified skills, certificates with serials anyone can check, and courses finished.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Skill Passport — स्वYAM" },
    ],
  }),
  component: Page,
});
