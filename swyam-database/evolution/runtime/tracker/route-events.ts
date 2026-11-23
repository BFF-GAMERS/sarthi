/**
 * Route-driven events (plan §4.2 table). CONTRACT: `subscribeRouteEvents` is frozen; EvolutionRuntime
 * calls it once with the router. One `onResolved` subscription -> page_viewed{route TEMPLATE} + the
 * entity events (course_viewed for /courses/$id, ...), deduplicated per visit so StrictMode (double
 * subscribe) cannot double-count. /schemes emits only a bare page_viewed; /lab emits nothing.
 * It also installs the preload-race guard on the router (router-guard.ts), the one place that owns the router here.
 */
import type { AnyRouter } from "@tanstack/react-router";
import type { EntityId, EventType } from "../../types";
import { startDelegate } from "./delegate";
import { entityId } from "./entity";
import { guardPreloadRace } from "./router-guard";
import { track } from "./track";

export interface RouteEvent {
  type: EventType;
  metadata?: Record<string, unknown>;
  entityId: EntityId | null;
}

interface Params {
  id?: string;
  slug?: string;
  handle?: string;
  [k: string]: string | undefined;
}

/** `/careers/` -> `/careers`; the root stays `/`. */
export function normaliseTemplate(fullPath: string): string {
  return fullPath.length > 1 ? fullPath.replace(/\/+$/, "") : fullPath || "/";
}

/** Pure: which events a resolved route emits (§4.2 route table). page_viewed is always first. */
export function routeEventsFor(routeTemplate: string, params: Params = {}): RouteEvent[] {
  const t = normaliseTemplate(routeTemplate);
  if (t === "/lab" || t.startsWith("/lab/")) return [];
  if (t === "/schemes" || t.startsWith("/schemes/")) {
    return [{ type: "page_viewed", metadata: { route: "/schemes" }, entityId: null }];
  }
  const out: RouteEvent[] = [{ type: "page_viewed", metadata: { route: t }, entityId: null }];
  const add = (
    type: EventType,
    entity: EntityId | null = null,
    metadata?: Record<string, unknown>,
  ) => out.push({ type, metadata, entityId: entity });
  switch (t) {
    case "/courses/$id":
      add("course_viewed", entityId("crs", params.id));
      break;
    case "/courses/compare":
      add("course_compared");
      break;
    case "/jobs/$id":
      add("job_viewed", entityId("opp", params.id), { source: "native" });
      break;
    case "/internships/$id":
      add("internship_viewed", entityId("opp", params.id), { source: "native" });
      break;
    case "/board":
    case "/skills":
      add("skill_builder_opened", null, { action: "open" });
      break;
    case "/mentor/$slug":
      add("skill_viewed", entityId("skl", params.slug), { surface: "mentor" });
      break;
    case "/passport":
      add("skill_passport_opened", null, { self: true });
      break;
    case "/passport/$slug":
      add("skill_passport_opened", null, { self: false });
      break;
    case "/profile":
      add("profile_viewed", null, { self: true });
      break;
    case "/u/$handle":
      add("profile_viewed", null, { self: false }); // entity always null: a handle is a person
      break;
    case "/community":
      add("community_opened");
      break;
    case "/careers":
      add("career_launcher_opened", null, { surface: "careers", action: "open" });
      break;
    case "/careers/$slug":
      add("career_launcher_opened", entityId("car", params.slug), {
        surface: "careers",
        action: "open",
      });
      break;
    case "/cv":
      add("career_launcher_opened", null, { surface: "cv", action: "open" });
      break;
  }
  return out;
}

let lastVisit = "";
let emitted = new Set<string>();

/** Emits a route's events once per (visit, event). A new visit key resets the dedupe set. Returns how many fired. */
export function emitRouteEvents(
  visitKey: string,
  routeTemplate: string,
  params: Params = {},
  emit: (e: RouteEvent) => void = (e) =>
    track(e.type, e.metadata as never, { entityId: e.entityId }),
): number {
  if (visitKey !== lastVisit) {
    lastVisit = visitKey;
    emitted = new Set();
  }
  let n = 0;
  for (const e of routeEventsFor(routeTemplate, params)) {
    const k = `${e.type}|${e.entityId ?? ""}|${String((e.metadata as { route?: string } | undefined)?.route ?? "")}`;
    if (emitted.has(k)) continue;
    emitted.add(k);
    emit(e);
    n++;
  }
  return n;
}

/** Tests only. */
export function _resetRouteEvents(): void {
  lastVisit = "";
  emitted = new Set();
}

function emitForRouter(router: AnyRouter): void {
  try {
    const { matches, location } = router.state;
    const leaf = matches[matches.length - 1];
    if (!leaf) return;
    const st = (location.state ?? {}) as unknown as { __TSR_key?: unknown; key?: unknown };
    const key = String(st.__TSR_key ?? st.key ?? location.href);
    emitRouteEvents(`${key}|${location.pathname}`, String(leaf.fullPath), leaf.params as Params);
  } catch {
    /* route events must never break navigation */
  }
}

export function subscribeRouteEvents(router: AnyRouter): () => void {
  const stopDelegate = startDelegate();
  let unsubscribe: () => void = () => {};
  // Same router, same moment: also guard the intent-preload / fast-Back race (see router-guard.ts).
  const unguard = guardPreloadRace(router);
  try {
    unsubscribe = router.subscribe("onResolved", (evt) => {
      if (evt.pathChanged === false) return; // search/hash-only changes are not a new view
      emitForRouter(router);
    });
    // The first resolve can land before EvolutionRuntime subscribes; the visit key dedupes any repeat.
    if (router.state.status === "idle" && router.state.resolvedLocation) emitForRouter(router);
  } catch {
    /* ignore */
  }
  return () => {
    try {
      unsubscribe();
    } catch {
      /* ignore */
    }
    unguard();
    stopDelegate();
  };
}
