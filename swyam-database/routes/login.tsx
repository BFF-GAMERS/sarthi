import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /login → /auth?mode=login.
 *
 * The form has only ever lived at /auth with a search param, but /login is
 * what people type, what old links point at, and what a password manager
 * guesses. It was returning 404. Redirecting costs nothing and the canonical
 * URL is still the one that ends up in the address bar.
 */
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { mode: "login" } });
  },
});
