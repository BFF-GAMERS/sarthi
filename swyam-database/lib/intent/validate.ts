/**
 * The gate between "something produced a destination" and "a link is built".
 *
 * Runs on the server for the model's answer, and again on the client for
 * whatever came back, so a bad server, a bad proxy or a bad model cannot send
 * anyone anywhere that is not on the allowlist in routes.ts.
 */
import { NAV_REGISTRY } from "@/evolution/config/navigation";
import {
  INTENT_ROUTE_IDS,
  filterAllowed,
  isIntentRouteId,
  splitHref,
  type IntentMatch,
} from "./routes";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A well-formed, fully allowlisted match, or null. Any unknown key or value rejects the whole thing. */
export function validateIntent(raw: unknown): IntentMatch | null {
  if (!isRecord(raw)) return null;
  const routeId = raw["routeId"];
  if (!isIntentRouteId(routeId)) return null;
  const given = raw["filters"] ?? {};
  if (!isRecord(given)) return null;
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(given)) {
    if (typeof value !== "string" || !filterAllowed(routeId, key, value)) return null;
    filters[key] = value;
  }
  return { routeId, filters };
}

const MAX_HREF = 400;

/**
 * Is this exact link one the allowlist could have produced?
 *
 * Same-site paths only: it must start with a single `/`, carry no scheme, backslash, space or control
 * character, match a registry path and hash, and add nothing to the registry's own query except allowed
 * filters for that destination, each once.
 */
export function isAllowedHref(href: unknown): href is string {
  if (typeof href !== "string" || href.length === 0 || href.length > MAX_HREF) return false;
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\\\s\u0000-\u001f\u007f]/.test(href)) return false;

  const want = splitHref(href);
  const params = new URLSearchParams(want.query);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) return false;

  for (const id of INTENT_ROUTE_IDS) {
    const dest = NAV_REGISTRY[id];
    for (const base of [dest.member, dest.visitor]) {
      if (base === href) return true;
      const b = splitHref(base);
      if (b.path !== want.path || b.hash !== want.hash || b.path === "/auth") continue;
      const own = new URLSearchParams(b.query);
      let ok = true;
      for (const [k, v] of own) if (params.get(k) !== v) ok = false;
      for (const [k, v] of params) if (!own.has(k) && !filterAllowed(id, k, v)) ok = false;
      if (ok) return true;
    }
  }
  return false;
}
