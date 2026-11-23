// Pacing contract: a focused guest sees the homepage lead with their domain after 5-6 meaningful
// actions and the navigation after 8-10; one click or mixed browsing changes nothing.
import { describe, expect, it } from "vitest";
import type { EntityId, TrackInput } from "../../types";
import { JOURNEY_T0 } from "../fixtures/trace";
import { createEngine, ingest, type EngineState } from "./engine";

const ev = (type: string, id?: string, metadata?: Record<string, unknown>): TrackInput =>
  ({
    type,
    ...(id ? { entityId: id as EntityId } : {}),
    ...(metadata ? { metadata } : {}),
  }) as TrackInput;

const job = (n: number) => ev("job_viewed", `opp_job-${n}`, { source: "native" });
const internship = (n: number) => ev("internship_viewed", `opp_int-${n}`, { source: "native" });
const course = (n: number) => ev("course_viewed", `crs_c${n}`);
const skill = (n: number) => ev("skill_viewed", `skl_s${n}`, { surface: "skills" });
const search = () => ev("search_performed", undefined, { surface: "jobs" });
const save = (n: number) => ev("job_saved", `opp_job-${n}`);

/** Streams events 8 s apart in one session; returns the meaningful count at each visible change. */
function play(events: readonly TrackInput[]) {
  let s: EngineState = createEngine("lab_pacing");
  const changes: { k: number; tier: number; nav: string }[] = [];
  events.forEach((input, i) => {
    const r = ingest(s, input, { now: JOURNEY_T0 + (i + 1) * 8_000, sessionId: "s1" });
    s = r.state;
    if (r.change)
      changes.push({
        k: s.profile.meaningfulCount,
        tier: r.change.to.tier,
        nav: r.change.to.nav,
      });
  });
  return { s, changes };
}

const range = Array.from({ length: 14 }, (_, i) => i + 1);

describe("pacing: a focused guest", () => {
  const focused: Record<string, TrackInput[]> = {
    "job pages only": range.map(job),
    "jobs and internships": range.map((n) => (n % 2 ? job(n) : internship(n))),
    "views, a search and a save": [
      job(1),
      job(2),
      search(),
      job(3),
      save(1),
      job(4),
      job(5),
      job(6),
      save(2),
      job(7),
      job(8),
    ],
  };

  for (const [name, events] of Object.entries(focused)) {
    it(`${name}: homepage after 5-6 actions, navigation after 8-10`, () => {
      const { changes } = play(events);
      const t1 = changes.find((c) => c.tier === 1);
      const t2 = changes.find((c) => c.tier === 2);
      expect(t1?.k).toBeGreaterThanOrEqual(5);
      expect(t1?.k).toBeLessThanOrEqual(6);
      expect(t1?.nav).toBe("UNIVERSAL");
      expect(t2?.k).toBeGreaterThanOrEqual(8);
      expect(t2?.k).toBeLessThanOrEqual(10);
      expect(t2?.nav).toBe("CAREER_PRIORITY");
    });
  }

  it("never changes the same thing twice in a row: the two changes are at least 3 actions apart", () => {
    const { changes } = play(range.map(job));
    expect((changes[1]?.k ?? 0) - (changes[0]?.k ?? 0)).toBeGreaterThanOrEqual(3);
  });
});

describe("pacing: weak and mixed signals change nothing", () => {
  it("one click, and two", () => {
    expect(play([job(1)]).changes).toEqual([]);
    expect(play([job(1), job(2)]).changes).toEqual([]);
  });

  it("the first four actions never change anything, however focused", () => {
    expect(play(range.slice(0, 4).map(job)).changes).toEqual([]);
  });

  it("random mixed browsing across four areas", () => {
    const mixed = [
      job(1),
      course(1),
      skill(1),
      ev("community_opened"),
      job(2),
      course(2),
      skill(2),
      ev("community_post_viewed", "post_a"),
      job(3),
      course(3),
      skill(3),
      ev("community_opened"),
      job(4),
      course(4),
      skill(4),
      ev("community_opened"),
    ];
    const { changes, s } = play(mixed);
    expect(changes).toEqual([]);
    expect(s.tier).toBe(0);
  });

  it("list filters and searches alone never change anything", () => {
    const weak = range.flatMap(() => [
      ev("list_filtered", undefined, { surface: "jobs", filter: "mode" }),
      ev("list_searched", undefined, { surface: "jobs" }),
    ]);
    const { changes, s } = play(weak);
    expect(changes).toEqual([]);
    expect(s.tier).toBe(0);
  });

  it("filters and searches between views do not move the thresholds earlier", () => {
    const { changes } = play([
      job(1),
      ev("list_filtered", undefined, { surface: "jobs", filter: "mode" }),
      job(2),
      ev("list_searched", undefined, { surface: "jobs" }),
      job(3),
      ev("list_filtered", undefined, { surface: "jobs", filter: "paid" }),
      job(4),
    ]);
    expect(changes).toEqual([]);
  });

  it("two areas in equal measure", () => {
    const both = range.flatMap((n) => [job(n), course(n)]);
    expect(play(both).changes).toEqual([]);
  });
});
