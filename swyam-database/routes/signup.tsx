import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /signup → /auth?mode=signup. See the note on /login: same reason, and this
 * is the one people are likelier to type, because it is the link everyone
 * else's site uses.
 */
export const Route = createFileRoute("/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { mode: "signup" } });
  },
});
