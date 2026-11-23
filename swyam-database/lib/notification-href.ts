import type { useNavigate } from "@tanstack/react-router";

/**
 * Following the link a notification carries.
 *
 * Notification rows store a plain string — `/passport`, `/messages/<uuid>`,
 * `/skillswap?tab=requests` — written by database triggers, which have no
 * idea what the router's route table looks like. The bell used to hand that
 * whole string to `navigate({ to })`, which treats it as a pathname: a href
 * carrying a query string became a path with a literal `?` in it and matched
 * nothing.
 *
 * So split it the way a browser would, and navigate with the parts.
 */

type Navigate = ReturnType<typeof useNavigate>;

export interface HrefParts {
  to: string;
  search?: Record<string, string>;
  hash?: string;
}

/** `/skillswap?tab=requests#top` → `{ to, search: {tab}, hash: "top" }`. */
export function parseHref(href: string): HrefParts {
  const [beforeHash, hash] = href.split("#", 2);
  const [path, query] = (beforeHash ?? href).split("?", 2);
  const parts: HrefParts = { to: path || "/" };
  if (query) {
    const search: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(query)) search[k] = v;
    parts.search = search;
  }
  if (hash) parts.hash = hash;
  return parts;
}

/**
 * An external link is left to the browser. Nothing writes one today, but a
 * router asked to navigate to `https://…` silently produces a dead in-app
 * route rather than opening the page, and that failure is invisible.
 */
export function followHref(navigate: Navigate, href: string): void {
  if (/^[a-z]+:/i.test(href) || href.startsWith("//")) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  void navigate(parseHref(href) as Parameters<Navigate>[0]);
}
