// Every navigation destination resolves to a real file route (plan §3.6). Reads routeTree.gen.ts as text.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EVOLUTION_CONFIG as C } from "./evolution-config";
import { NAV_ITEM_IDS, PRIORITY_ACTION_IDS } from "./ids";
import { NAV_REGISTRY, PENDING_ROUTES, hrefFor, pathOf } from "./navigation";
import { PRIORITY_ACTIONS } from "./actions";

const text = readFileSync(
  fileURLToPath(new URL("../../routeTree.gen.ts", import.meta.url)),
  "utf8",
);
const block = text.slice(text.indexOf("export interface FileRoutesByFullPath"));
// Index routes are listed with a trailing slash ("/jobs/"); a link to "/jobs" resolves to them.
const ROUTES = new Set(
  [...block.slice(0, block.indexOf("}")).matchAll(/^\s+'([^']+)':/gm)].flatMap((m) => {
    const p = m[1] as string;
    return [p, p.replace(/\/$/, "") || "/"];
  }),
);

describe("route resolution", () => {
  it("reads a plausible route table", () => {
    expect(ROUTES.size).toBeGreaterThan(30);
    expect(ROUTES.has("/")).toBe(true);
  });

  it("the pending-routes allow-list is empty (every route now exists)", () => {
    expect(PENDING_ROUTES).toEqual([]);
  });

  it("pathOf strips the query and the hash", () => {
    expect(pathOf("/skillswap?tab=matches")).toBe("/skillswap");
    expect(pathOf("/my-learning#practice")).toBe("/my-learning");
    expect(pathOf(`/auth?mode=login&next=${encodeURIComponent("/jobs")}`)).toBe("/auth");
  });

  for (const id of NAV_ITEM_IDS) {
    it(`${id}: member and visitor routes exist`, () => {
      const d = NAV_REGISTRY[id];
      expect(d.id).toBe(id);
      for (const href of [d.member, d.visitor]) {
        const path = pathOf(href);
        expect(PENDING_ROUTES.includes(path) || ROUTES.has(path), `${id} -> ${href}`).toBe(true);
      }
      expect(hrefFor(id, true)).toBe(d.member);
      expect(hrefFor(id, false)).toBe(d.visitor);
    });
  }

  it("every priority action points at a registered destination", () => {
    for (const id of PRIORITY_ACTION_IDS) {
      const a = PRIORITY_ACTIONS[id];
      expect(a.id).toBe(id);
      expect(NAV_REGISTRY[a.nav]).toBeDefined();
    }
  });

  it("every CTA target is a real route (or the recent-entity marker)", () => {
    for (const cta of Object.values(C.ctas)) {
      const targets =
        cta.to === "recent"
          ? []
          : typeof cta.to === "string"
            ? [cta.to]
            : [cta.to.member, cta.to.visitor];
      for (const t of targets) expect(ROUTES.has(pathOf(t)), t).toBe(true);
    }
  });

  it("every nav list in the config only uses registered destinations", () => {
    for (const list of Object.values(C.navigation))
      for (const id of list) expect(NAV_REGISTRY[id]).toBeDefined();
  });
});
