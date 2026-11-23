import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/MemberProfile";

/**
 * `/u/<username>` — a member's public page.
 *
 * Short prefix on purpose: this is the URL somebody types into WhatsApp when
 * they tell a friend who to swap with, and `/u/aarav_sharma` survives that
 * better than `/members/profile/aarav_sharma`.
 *
 * No `noindex`. A public profile is meant to be findable — that is what
 * "public" was chosen to mean. The other two visibility settings return a
 * card with no content to a stranger, crawler or otherwise, because
 * `profile_card` decides what to include on the server.
 */
export const Route = createFileRoute("/u/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} — स्वYAM` },
      {
        name: "description",
        content: `The स्वYAM profile of @${params.handle}: skills, what they can teach, and what they are learning.`,
      },
      { property: "og:title", content: `@${params.handle} — स्वYAM` },
    ],
  }),
  component: Page,
});
