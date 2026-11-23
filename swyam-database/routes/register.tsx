import { createFileRoute, redirect } from "@tanstack/react-router";

/** /register → /auth?mode=signup. The third spelling people try. */
export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { mode: "signup" } });
  },
});
