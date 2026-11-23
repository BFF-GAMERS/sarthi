/**
 * Capture-time sanitiser (plan §3.2). Pure and total: it never throws.
 *
 * - unknown types are dropped; only allow-listed metadata keys with allow-listed values survive,
 *   so search text, dob, age, gender, region or a profile type can never pass through;
 * - entityId must match ENTITY_ID_RE; types that may not carry an entity never keep one;
 * - the service (domain) comes from the taxonomy; an explicit one is honoured only when the
 *   type allows it;
 * - /schemes emits a bare page_viewed: only `route` is ever kept for it.
 */
import { DOMAIN_IDS, ENTITY_ID_RE, EVENT_TYPES } from "../../config/ids";
import type { BehaviourEvent, DomainId, EntityId, EventType, ServiceId } from "../../types";
import {
  EVENT_SPEC,
  navItemDomain,
  sectionDomain,
  surfaceDomain,
  type EventSpec,
} from "./taxonomy";

const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const isDomain = (x: unknown): x is DomainId =>
  typeof x === "string" && (DOMAIN_IDS as readonly string[]).includes(x);
const isType = (x: unknown): x is EventType =>
  typeof x === "string" && (EVENT_TYPES as readonly string[]).includes(x);

function cleanMeta(spec: EventSpec, raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isRecord(raw)) return out;
  for (const key of Object.keys(spec.meta)) {
    if (!Object.hasOwn(raw, key)) continue;
    const v = raw[key];
    if (spec.meta[key]?.(v)) out[key] = v;
  }
  return out;
}

function resolveDomain(
  spec: EventSpec,
  explicit: unknown,
  meta: Record<string, unknown>,
): ServiceId {
  const r = spec.domain;
  if ("fixed" in r) return r.fixed;
  if ("platform" in r) return "PLATFORM";
  if ("nav" in r) {
    const item = meta["item"];
    return typeof item === "string" ? navItemDomain(item as never) : "PLATFORM";
  }
  if ("section" in r) {
    const sec = meta["section"];
    return typeof sec === "string" ? sectionDomain(sec as never) : "PLATFORM";
  }
  if ("bySurface" in r) {
    if (isDomain(explicit) && r.oneOf.includes(explicit)) return explicit;
    const sd = surfaceDomain(meta["surface"]);
    if (sd && r.oneOf.includes(sd)) return sd;
    return meta["surface"] === "courses" ? "LEARNING" : r.fallback;
  }
  // inferred: explicit domain, metadata domain, the surface's domain, else PLATFORM.
  if (isDomain(explicit)) return explicit;
  if (explicit === "PLATFORM") return "PLATFORM";
  const md = meta["domain"];
  if (isDomain(md)) return md;
  return surfaceDomain(meta["surface"]) ?? "PLATFORM";
}

export interface SanitizeContext {
  now: number;
  sessionId: string;
}

/** Any tracker input or an already-stamped event (re-sanitising is idempotent). */
export function sanitize(input: unknown, ctx: SanitizeContext, seq: number): BehaviourEvent | null {
  try {
    if (!isRecord(input)) return null;
    const type = input["type"];
    if (!isType(type)) return null;
    if (!Number.isFinite(ctx.now)) return null;
    const spec = EVENT_SPEC[type];
    const metadata = cleanMeta(spec, input["metadata"]);
    const service = resolveDomain(spec, input["service"], metadata);
    const rawEntity = input["entityId"];
    const entityId: EntityId | null =
      spec.entity && typeof rawEntity === "string" && ENTITY_ID_RE.test(rawEntity)
        ? (rawEntity as EntityId)
        : null;
    return {
      v: 1,
      seq,
      type,
      timestamp: ctx.now,
      sessionId: typeof ctx.sessionId === "string" ? ctx.sessionId.slice(0, 40) : "s",
      service,
      entityId,
      metadata: metadata as BehaviourEvent["metadata"],
    };
  } catch {
    return null;
  }
}
