import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Auth";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

const isMode = (v: unknown): v is AuthMode =>
  v === "login" || v === "signup" || v === "forgot" || v === "reset";

export const Route = createFileRoute("/auth")({
  // The URL is the single source of truth for which form is showing. Search
  // params are inherited from parent routes, so returning {} would let an
  // unrecognised ?mode= survive the merge — resolve it to a concrete value
  // instead, and the page never has to defend against a stray string.
  //
  // `next` is where to go afterwards — the page that sent somebody here to
  // sign in, or the thing a button promised ("Build my learning plan" →
  // /coach). Only a same-site path is accepted; anything else is dropped, so
  // a crafted link cannot bounce a fresh sign-in to another site.
  validateSearch: (search: Record<string, unknown>): { mode: AuthMode; next?: string } => {
    const next = search["next"];
    const safe =
      typeof next === "string" &&
      next.startsWith("/") &&
      !next.startsWith("//") &&
      next.length < 200
        ? next
        : undefined;
    return {
      mode: isMode(search["mode"]) ? search["mode"] : "login",
      ...(safe ? { next: safe } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Log in or join — स्वYAM" },
      {
        name: "description",
        content: "Create a free स्वYAM account as a student, recruiter or institute.",
      },
      { property: "og:title", content: "Log in or join — स्वYAM" },
      {
        property: "og:description",
        content: "Create a free स्वYAM account as a student, recruiter or institute.",
      },
    ],
  }),
  component: Page,
});
