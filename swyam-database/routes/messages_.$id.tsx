import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Messages";

/**
 * `/messages/<conversation id>` — one thread, opened directly.
 *
 * The `notify_on_message` trigger has always written this link into every
 * "new message from …" notification, and until now nothing served it: the
 * bell sent people to a 404, which is the worst possible answer to "someone
 * replied to you".
 *
 * The trailing underscore on `messages_` keeps this out of `/messages` as a
 * child route, so the inbox stays a single flat page rather than gaining a
 * layout it does not need.
 */
export const Route = createFileRoute("/messages_/$id")({
  head: () => ({
    meta: [
      { title: "Messages — स्वYAM" },
      // Conversations are private; no crawler should index or follow one.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Conversation,
});

function Conversation() {
  const { id } = Route.useParams();
  return <Page conversationId={id} />;
}
