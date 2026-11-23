/**
 * Declarative tracking for plain links: spread `trackAttrs(EV.X, {...})` on an element and the delegated
 * listener turns the click into track(). Explicit track() calls are preferred (plan §4.2).
 *   <a href="/events" {...trackAttrs("dashboard_section_clicked", { metadata: { section: "events" } })}>
 *     -> data-track="dashboard_section_clicked" data-track-section="events"
 */
import { EVENT_TYPES } from "../../config/ids";
import type { EntityId, EventType, ServiceId } from "../../types";

export const TRACK_ATTR = {
  type: "data-track",
  entity: "data-track-entity",
  service: "data-track-service",
  scopeOff: "data-track-scope",
  metaPrefix: "data-track-",
} as const;

export interface TrackAttrInput {
  entityId?: EntityId | null;
  service?: ServiceId;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const RESERVED = new Set<string>([
  TRACK_ATTR.type,
  TRACK_ATTR.entity,
  TRACK_ATTR.service,
  TRACK_ATTR.scopeOff,
]);
const TYPES = new Set<string>(EVENT_TYPES);

export function trackAttrs(
  type: EventType,
  input: TrackAttrInput = {},
): Record<`data-${string}`, string> {
  const out: Record<`data-${string}`, string> = { [TRACK_ATTR.type]: type };
  if (input.entityId) out[TRACK_ATTR.entity] = input.entityId;
  if (input.service) out[TRACK_ATTR.service] = input.service;
  for (const [k, v] of Object.entries(input.metadata ?? {})) {
    if (v === undefined || v === null || !/^[a-z]+$/i.test(k)) continue;
    out[`${TRACK_ATTR.metaPrefix}${k.toLowerCase()}` as `data-${string}`] = String(v);
  }
  return out;
}

function coerce(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return /^\d{1,3}$/.test(raw) ? Number(raw) : raw;
}

/** Reads a [data-track] element back into track() arguments; the engine's sanitiser validates it afterwards. */
export function parseTrackAttrs(el: Element): {
  type: EventType;
  metadata: Record<string, unknown>;
  entityId: EntityId | null;
  service?: ServiceId;
} | null {
  try {
    const type = el.getAttribute(TRACK_ATTR.type);
    if (!type || !TYPES.has(type)) return null;
    const metadata: Record<string, unknown> = {};
    for (const name of el.getAttributeNames()) {
      if (!name.startsWith(TRACK_ATTR.metaPrefix) || RESERVED.has(name)) continue;
      const raw = el.getAttribute(name);
      if (raw !== null) metadata[name.slice(TRACK_ATTR.metaPrefix.length)] = coerce(raw);
    }
    return {
      type: type as EventType,
      metadata,
      entityId: (el.getAttribute(TRACK_ATTR.entity) as EntityId | null) ?? null,
      service: (el.getAttribute(TRACK_ATTR.service) as ServiceId | null) ?? undefined,
    };
  } catch {
    return null;
  }
}
