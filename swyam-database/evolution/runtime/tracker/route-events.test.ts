import { beforeEach, describe, expect, it } from "vitest";
import { ENTITY_ID_RE } from "../../config/ids";
import {
  _resetRouteEvents,
  emitRouteEvents,
  normaliseTemplate,
  routeEventsFor,
  subscribeRouteEvents,
} from "./route-events";

const types = (t: string, p: Record<string, string> = {}) =>
  routeEventsFor(t, p).map((e) => e.type);

beforeEach(() => _resetRouteEvents());

describe("routeEventsFor (§4.2 route table)", () => {
  it("every route starts with page_viewed carrying the TEMPLATE, never the filled path", () => {
    const [first] = routeEventsFor("/jobs/$id", { id: "AB-12" });
    expect(first).toMatchObject({
      type: "page_viewed",
      metadata: { route: "/jobs/$id" },
      entityId: null,
    });
    expect(routeEventsFor("/about")).toHaveLength(1);
  });

  it("maps entity routes to lowercase public-slug ids that satisfy ENTITY_ID_RE", () => {
    const course = routeEventsFor("/courses/$id", { id: "Python-Basics" })[1];
    expect(course).toMatchObject({ type: "course_viewed", entityId: "crs_python-basics" });
    expect(routeEventsFor("/jobs/$id", { id: "OPP1" })[1]).toMatchObject({
      type: "job_viewed",
      entityId: "opp_opp1",
      metadata: { source: "native" },
    });
    expect(routeEventsFor("/internships/$id", { id: "9" })[1].type).toBe("internship_viewed");
    expect(routeEventsFor("/mentor/$slug", { slug: "Excel" })[1]).toMatchObject({
      type: "skill_viewed",
      entityId: "skl_excel",
      metadata: { surface: "mentor" },
    });
    for (const e of [
      ...routeEventsFor("/courses/$id", { id: "A B" }),
      ...routeEventsFor("/careers/$slug", { slug: "Data Analyst" }),
    ]) {
      if (e.entityId) expect(e.entityId).toMatch(ENTITY_ID_RE);
    }
  });

  it("covers the remaining table rows", () => {
    expect(types("/board")).toEqual(["page_viewed", "skill_builder_opened"]);
    expect(types("/skills")).toEqual(["page_viewed", "skill_builder_opened"]);
    expect(routeEventsFor("/passport")[1]).toMatchObject({
      type: "skill_passport_opened",
      metadata: { self: true },
    });
    expect(routeEventsFor("/passport/$slug", { slug: "x" })[1]).toMatchObject({
      metadata: { self: false },
    });
    expect(routeEventsFor("/profile")[1]).toMatchObject({
      type: "profile_viewed",
      metadata: { self: true },
    });
    expect(types("/community")).toEqual(["page_viewed", "community_opened"]);
    expect(types("/careers/")).toEqual(["page_viewed", "career_launcher_opened"]);
    expect(types("/careers/$slug", { slug: "x" })).toEqual([
      "page_viewed",
      "career_launcher_opened",
    ]);
    expect(routeEventsFor("/cv")[1]).toMatchObject({ metadata: { surface: "cv" } });
    expect(types("/courses/compare")).toEqual(["page_viewed", "course_compared"]);
  });

  it("never attaches a person to a profile or passport event", () => {
    expect(routeEventsFor("/u/$handle", { handle: "Asha" })[1]).toMatchObject({
      type: "profile_viewed",
      metadata: { self: false },
      entityId: null,
    });
    expect(routeEventsFor("/passport/$slug", { slug: "asha" })[1].entityId).toBeNull();
  });

  it("/schemes emits only a bare page_viewed; /lab emits nothing", () => {
    expect(routeEventsFor("/schemes")).toEqual([
      { type: "page_viewed", metadata: { route: "/schemes" }, entityId: null },
    ]);
    expect(routeEventsFor("/schemes/$id", { id: "pm" })).toHaveLength(1);
    expect(routeEventsFor("/lab/")).toEqual([]);
    expect(routeEventsFor("/lab/compare")).toEqual([]);
  });

  it("normalises trailing slashes", () => {
    expect(normaliseTemplate("/careers/")).toBe("/careers");
    expect(normaliseTemplate("/")).toBe("/");
  });
});

describe("emitRouteEvents dedupe", () => {
  it("emits once per visit even when called twice (StrictMode), again on a new visit", () => {
    const got: string[] = [];
    const emit = (e: { type: string }) => got.push(e.type);
    expect(emitRouteEvents("k1|/courses/x", "/courses/$id", { id: "x" }, emit)).toBe(2);
    expect(emitRouteEvents("k1|/courses/x", "/courses/$id", { id: "x" }, emit)).toBe(0);
    expect(got).toEqual(["page_viewed", "course_viewed"]);
    expect(emitRouteEvents("k2|/jobs/y", "/jobs/$id", { id: "y" }, emit)).toBe(2);
    // back to the first entry is a new visit again
    expect(emitRouteEvents("k1|/courses/x", "/courses/$id", { id: "x" }, emit)).toBe(2);
    expect(got).toHaveLength(6);
  });
});

describe("subscribeRouteEvents", () => {
  it("subscribes to onResolved, skips search-only changes, emits for the initial resolved route, and unsubscribes", () => {
    let handler: ((e: { pathChanged: boolean }) => void) | undefined;
    let unsubscribed = false;
    const router = {
      state: {
        status: "idle",
        resolvedLocation: {},
        matches: [{ fullPath: "/lab/", params: {} }],
        location: { href: "/lab", pathname: "/lab", state: { __TSR_key: "a" } },
      },
      subscribe: (name: string, fn: typeof handler) => {
        expect(name).toBe("onResolved");
        handler = fn;
        return () => {
          unsubscribed = true;
        };
      },
    };
    const stop = subscribeRouteEvents(router as never);
    expect(handler).toBeTypeOf("function");
    handler?.({ pathChanged: false });
    handler?.({ pathChanged: true }); // /lab: nothing emitted, nothing thrown
    stop();
    expect(unsubscribed).toBe(true);
  });
});
