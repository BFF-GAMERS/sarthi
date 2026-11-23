import { describe, expect, it } from "vitest";
import { ENTITY_ID_RE, EVENT_TYPES } from "../../config/ids";
import type { TrackInput } from "../../types";
import { createEngine, ingest, sanitizeInput, type EngineState } from "../evolution/engine";
import type { EngineInternal } from "../evolution/types";
import { sanitize } from "./sanitize";
import { nextSession, SESSION_GAP_MS } from "./session";
import { EVENT_SPEC, isMeaningful, weightOf } from "./taxonomy";

const ctx = { now: 1_000, sessionId: "s1" };
const clean = (input: unknown) => sanitize(input, ctx, 1);
const internal = (s: EngineState) => s.internal as EngineInternal;

describe("EVENT_SPEC (plan §3.2)", () => {
  it("covers every event type", () => {
    for (const t of EVENT_TYPES) expect(EVENT_SPEC[t]).toBeDefined();
    expect(Object.keys(EVENT_SPEC).length).toBe(EVENT_TYPES.length);
  });

  it("uses the weight ladder view 1.5, save 2.0, start 2.5, commit 4.0", () => {
    expect(EVENT_SPEC.course_viewed.w).toBe(1.5);
    expect(EVENT_SPEC.job_saved.w).toBe(2.0);
    expect(EVENT_SPEC.course_started.w).toBe(2.5);
    expect(EVENT_SPEC.application_started.w).toBe(2.5);
    expect(EVENT_SPEC.job_applied.w).toBe(4.0);
    expect(EVENT_SPEC.skill_swap_requested.w).toBe(4.0);
    expect(weightOf("career_launcher_opened", { action: "plan_built" })).toBe(2.5);
    expect(weightOf("career_launcher_opened", { action: "open" })).toBe(1.5);
  });

  it("is meaningful at weight >= 1.0; navigation and section clicks are not", () => {
    expect(isMeaningful("course_viewed")).toBe(true);
    expect(isMeaningful("course_compared")).toBe(true);
    expect(isMeaningful("profile_viewed")).toBe(true);
    expect(isMeaningful("navigation_item_clicked")).toBe(false);
    expect(isMeaningful("dashboard_section_clicked")).toBe(false);
    expect(isMeaningful("page_viewed")).toBe(false);
    expect(EVENT_SPEC.navigation_item_clicked.aff).toBe(0.5);
    expect(EVENT_SPEC.page_viewed.w).toBe(0);
  });

  it("list_filtered and list_searched are weak: affinity only, never meaningful, domain from the list surface", () => {
    for (const t of ["list_filtered", "list_searched"] as const) {
      expect(isMeaningful(t)).toBe(false);
      expect(EVENT_SPEC[t].w).toBeLessThan(1);
      expect(EVENT_SPEC[t].aff).toBeGreaterThan(0);
      expect(EVENT_SPEC[t].entity).toBe(false);
    }
    expect(
      clean({ type: "list_filtered", metadata: { surface: "jobs", filter: "mode" } })?.service,
    ).toBe("CAREER");
    expect(clean({ type: "list_searched", metadata: { surface: "internships" } })?.service).toBe(
      "CAREER",
    );
    expect(
      clean({ type: "list_filtered", metadata: { surface: "courses", filter: "level" } })?.service,
    ).toBe("LEARNING");
    // An unknown surface is dropped (never free text) and the event falls back to PLATFORM.
    const odd = clean({ type: "list_searched", metadata: { surface: "my private notes" } });
    expect(odd?.metadata).toEqual({});
    expect(odd?.service).toBe("PLATFORM");
    // Never an entity id.
    expect(
      clean({ type: "list_searched", entityId: "opp_job-1", metadata: { surface: "jobs" } })
        ?.entityId,
    ).toBeNull();
  });

  it("a flood of list filters and searches adds affinity but never a meaningful event or a change", () => {
    let s: EngineState = createEngine("lab_weak");
    const input: TrackInput[] = [];
    for (let i = 0; i < 30; i++)
      input.push(
        i % 2
          ? { type: "list_filtered", metadata: { surface: "jobs", filter: "mode" } }
          : { type: "list_searched", metadata: { surface: "jobs" } },
      );
    input.forEach((e, i) => {
      const r = ingest(s, e, { now: 10_000 + i * 5_000, sessionId: "s1" });
      expect(r.change).toBeNull();
      s = r.state;
    });
    expect(s.profile.meaningfulCount).toBe(0);
    expect(s.tier).toBe(0);
    expect(s.profile.countsByType.list_filtered).toBe(15);
    expect(internal(s).E.CAREER).toBeGreaterThan(0);
  });

  it("multiplies a recommendation click on an adaptive surface by 0.75", () => {
    const base = createEngine("lab_x");
    const a = ingest(
      base,
      { type: "recommendation_clicked", service: "CAREER", metadata: { via: "adaptive" } },
      ctx,
    );
    const b = ingest(
      base,
      { type: "recommendation_clicked", service: "CAREER", metadata: { via: "static" } },
      ctx,
    );
    expect(internal(a.state).E.CAREER / internal(b.state).E.CAREER).toBeCloseTo(0.75, 10);
  });

  it("derives the domain of skill events from the surface", () => {
    expect(clean({ type: "skill_viewed", metadata: { surface: "skillswap" } })?.service).toBe(
      "SKILL_EXCHANGE",
    );
    expect(clean({ type: "skill_viewed", metadata: { surface: "board" } })?.service).toBe(
      "SKILL_EXCHANGE",
    );
    expect(clean({ type: "skill_searched", metadata: { surface: "courses" } })?.service).toBe(
      "LEARNING",
    );
    expect(clean({ type: "skill_viewed", service: "LEARNING" })?.service).toBe("LEARNING");
    expect(clean({ type: "skill_builder_opened" })?.service).toBe("LEARNING");
    expect(clean({ type: "job_viewed", service: "COMMUNITY" })?.service).toBe("CAREER");
  });

  it("derives the domain of search, filter and navigation events", () => {
    expect(clean({ type: "search_performed", metadata: { surface: "jobs" } })?.service).toBe(
      "CAREER",
    );
    expect(clean({ type: "search_performed", service: "LEARNING" })?.service).toBe("LEARNING");
    expect(clean({ type: "search_performed" })?.service).toBe("PLATFORM");
    expect(clean({ type: "navigation_item_clicked", metadata: { item: "JOBS" } })?.service).toBe(
      "CAREER",
    );
    expect(
      clean({ type: "dashboard_section_clicked", metadata: { section: "MATCHES" } })?.service,
    ).toBe("SKILL_EXCHANGE");
  });
});

describe("sanitiser (plan §3.2)", () => {
  it("drops unknown types and non-objects", () => {
    expect(clean({ type: "keylogger" })).toBeNull();
    expect(clean(null)).toBeNull();
    expect(clean("course_viewed")).toBeNull();
    expect(clean({})).toBeNull();
  });

  it("keeps allow-listed metadata only and drops sensitive and free-text fields", () => {
    const e = clean({
      type: "course_viewed",
      entityId: "crs_python-basics",
      metadata: {
        group: "tech",
        free: true,
        dob: "2001-02-03",
        age: 19,
        gender: "f",
        region: "Kerala",
        profileType: "student",
        query: "how do i get a job",
      },
    });
    expect(e?.metadata).toEqual({ group: "tech", free: true });
    expect(JSON.stringify(e)).not.toMatch(/dob|age"|gender|region|profileType|query|job"/i);
  });

  it("rejects values outside the enum and free text in enum fields", () => {
    const e = clean({ type: "job_viewed", metadata: { source: "<script>alert(1)</script>" } });
    expect(e?.metadata).toEqual({});
    const f = clean({
      type: "filter_used",
      metadata: { surface: "jobs", filter: "Free Text Here!" },
    });
    expect(f?.metadata).toEqual({ surface: "jobs" });
    expect(
      clean({ type: "search_performed", metadata: { surface: "my secret query" } })?.metadata,
    ).toEqual({});
  });

  it("accepts only entity ids that match ENTITY_ID_RE", () => {
    expect(clean({ type: "course_viewed", entityId: "crs_python-basics" })?.entityId).toBe(
      "crs_python-basics",
    );
    expect(clean({ type: "job_viewed", entityId: "ext_adzuna:987" })?.entityId).toBe(
      "ext_adzuna:987",
    );
    for (const bad of [
      "python",
      "usr_123",
      "crs_Has Space",
      "crs_",
      "crs_" + "a".repeat(65),
      "uid_1",
      "crs_a/b",
    ]) {
      expect(ENTITY_ID_RE.test(bad)).toBe(false);
      expect(clean({ type: "course_viewed", entityId: bad })?.entityId).toBeNull();
    }
  });

  it("never keeps an entity on events that may not carry one", () => {
    expect(clean({ type: "profile_viewed", entityId: "com_someone" })?.entityId).toBeNull();
    expect(clean({ type: "search_performed", entityId: "crs_a" })?.entityId).toBeNull();
    expect(clean({ type: "navigation_item_clicked", entityId: "crs_a" })?.entityId).toBeNull();
    expect(clean({ type: "page_viewed", entityId: "crs_a" })?.entityId).toBeNull();
  });

  it("emits only a bare route template for page_viewed, so /schemes carries nothing else", () => {
    const e = clean({
      type: "page_viewed",
      metadata: {
        route: "/schemes",
        dob: "2000-01-01",
        age: 30,
        gender: "m",
        region: "x",
        profileType: "y",
      },
    });
    expect(e?.metadata).toEqual({ route: "/schemes" });
    expect(e?.entityId).toBeNull();
    expect(e?.service).toBe("PLATFORM");
    // a filled-in path or a path with a query is not a template
    expect(
      clean({
        type: "page_viewed",
        metadata: { route: "/jobs/8f14e45f-ceea-467a-9575-8f2d6f1c1a2b" },
      })?.metadata,
    ).toEqual({});
    expect(
      clean({ type: "page_viewed", metadata: { route: "/search?q=secret" } })?.metadata,
    ).toEqual({});
    expect(clean({ type: "page_viewed", metadata: { route: "/jobs/$id" } })?.metadata).toEqual({
      route: "/jobs/$id",
    });
  });

  it("is total: it never throws on hostile input", () => {
    const hostile: unknown[] = [
      {
        type: "course_viewed",
        metadata: {
          get group() {
            throw new Error("boom");
          },
        },
      },
      {
        type: "course_viewed",
        entityId: {
          toString() {
            throw new Error("boom");
          },
        },
      },
      Object.create(null),
      [],
      { type: "course_viewed", metadata: null },
    ];
    for (const h of hostile) expect(() => clean(h)).not.toThrow();
  });

  it("the engine facade stamps seq, timestamp and session from its context", () => {
    const input: TrackInput = { type: "course_viewed", entityId: "crs_a" };
    const e = sanitizeInput(input, { now: 5, sessionId: "abc" }, 7);
    expect(e).toMatchObject({ v: 1, seq: 7, timestamp: 5, sessionId: "abc", service: "LEARNING" });
  });
});

describe("nextSession (D10)", () => {
  const t0 = 1_800_000_000_000;
  it("opens a first session", () => {
    const r = nextSession(null, t0, false);
    expect(r.isNew).toBe(true);
    expect(r.session.startedAt).toBe(t0);
  });

  it("a refresh keeps the session", () => {
    const first = nextSession(null, t0, false).session;
    const again = nextSession(first, t0 + 60_000, false);
    expect(again.isNew).toBe(false);
    expect(again.session.id).toBe(first.id);
    expect(again.session.lastAt).toBe(t0 + 60_000);
  });

  it("a missing sessionStorage marker (fresh tab) starts a new session", () => {
    const first = nextSession(null, t0, false).session;
    const fresh = nextSession(first, t0 + 1_000, true);
    expect(fresh.isNew).toBe(true);
  });

  it("a gap of more than 30 minutes starts a new session; exactly 30 minutes does not", () => {
    const first = nextSession(null, t0, false).session;
    expect(nextSession(first, t0 + SESSION_GAP_MS, false).isNew).toBe(false);
    const next = nextSession(first, t0 + SESSION_GAP_MS + 1, false);
    expect(next.isNew).toBe(true);
    expect(next.session.id).not.toBe(first.id);
  });

  it("is pure and deterministic", () => {
    const prev = { id: "sx", startedAt: 1, lastAt: 2 };
    const a = nextSession(prev, 100, false);
    expect(nextSession(prev, 100, false)).toEqual(a);
    expect(prev).toEqual({ id: "sx", startedAt: 1, lastAt: 2 });
  });
});
