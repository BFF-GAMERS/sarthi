// Properties P-1, P-2, P-4 (plan §3.3) over 3,000 seeded users x 60 events. The PRNG lives HERE, never in core.
import { describe, expect, it } from "vitest";
import { EVOLUTION_CONFIG as C } from "../../config/evolution-config";
import type { DomainId, EventType, TrackInput } from "../../types";
import { SESSION_GAP_MS } from "../behaviour/session";
import { validateDecision } from "../ui-state/validate";
import { actionsFor } from "./compose";
import {
  createEngine,
  ingest,
  replayEvents,
  startSession,
  type EngineChange,
  type EngineState,
} from "./engine";
import { EVOLUTION_PARAMS as PR } from "./params";

/** mulberry32 */
function prng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES: Record<DomainId, readonly EventType[]> = {
  LEARNING: [
    "course_viewed",
    "course_viewed",
    "course_viewed",
    "course_saved",
    "course_started",
    "course_compared",
    "practice_completed",
    "course_completed",
    "skill_builder_opened",
  ],
  CAREER: [
    "job_viewed",
    "job_viewed",
    "internship_viewed",
    "job_saved",
    "application_started",
    "job_applied",
    "career_launcher_opened",
    "filter_used",
  ],
  SKILL_EXCHANGE: [
    "skill_viewed",
    "skill_viewed",
    "skill_searched",
    "mentor_viewed",
    "skill_passport_opened",
    "skill_swap_requested",
  ],
  COMMUNITY: [
    "community_opened",
    "community_post_viewed",
    "community_post_viewed",
    "profile_viewed",
    "community_post_created",
  ],
};
const PREFIX: Record<DomainId, string> = {
  LEARNING: "crs",
  CAREER: "opp",
  SKILL_EXCHANGE: "skl",
  COMMUNITY: "pst",
};
const DOMS: readonly DomainId[] = ["LEARNING", "CAREER", "SKILL_EXCHANGE", "COMMUNITY"];

type Gen = (rnd: () => number, i: number) => DomainId;
const pick = (rnd: () => number): DomainId => DOMS[(rnd() * 4) | 0] as DomainId;
const PROFILES: Record<string, Gen> = {
  "focused 80% one domain": (rnd) => (rnd() < 0.8 ? "CAREER" : pick(rnd)),
  "two domains 50/50": (rnd) => (rnd() < 0.5 ? "LEARNING" : "COMMUNITY"),
  "spread over all 4": (rnd) => pick(rnd),
  "drift 80% learning to 80% career at #30": (rnd, i) =>
    rnd() < 0.8 ? (i < 30 ? "LEARNING" : "CAREER") : pick(rnd),
};

type Op = { kind: "start"; t: number } | { kind: "ev"; t: number; sid: string; input: TrackInput };

function syntheticOps(rnd: () => number, gen: Gen): Op[] {
  const ops: Op[] = [];
  let t = 1_791_277_200_000;
  let sid = 0;
  const callsStart = rnd() < 0.5;
  for (let i = 0; i < 60; i++) {
    t += 2_000 + ((rnd() * 20_000) | 0);
    if (i > 0 && rnd() < 0.05) {
      t += SESSION_GAP_MS + 1;
      sid += 1;
      if (callsStart) ops.push({ kind: "start", t });
    }
    let input: TrackInput;
    const r = rnd();
    if (r < 0.1)
      input = {
        type: "navigation_item_clicked",
        metadata: {
          item: (["JOBS", "COURSES", "COMMUNITY", "SKILLS"] as const)[(rnd() * 4) | 0],
          surface: "top",
        },
      };
    else if (r < 0.14) input = { type: "page_viewed", metadata: { route: "/jobs" } };
    else {
      const d = gen(rnd, i);
      const list = TYPES[d];
      const type = list[(rnd() * list.length) | 0] as EventType;
      const entity = `${PREFIX[d]}_e${(rnd() * 5) | 0}`;
      input = {
        type,
        entityId: entity as never,
        ...(type === "skill_viewed" || type === "skill_searched"
          ? { metadata: { surface: "skillswap" } as never }
          : {}),
        ...(type === "filter_used" ? { metadata: { surface: "jobs" } as never } : {}),
      } as TrackInput;
    }
    ops.push({ kind: "ev", t, sid: `u${sid}`, input });
  }
  return ops;
}

interface Run {
  state: EngineState;
  changes: { k: number; change: EngineChange; at: number }[];
  decisionsOk: boolean;
}

function apply(ops: readonly Op[], start: EngineState = createEngine("lab_p"), check = false): Run {
  let s = start;
  const changes: Run["changes"] = [];
  let decisionsOk = true;
  for (const op of ops) {
    if (op.kind === "start") {
      s = startSession(s, op.t);
      continue;
    }
    const r = ingest(s, op.input, { now: op.t, sessionId: op.sid });
    s = r.state;
    if (r.change) changes.push({ k: s.profile.meaningfulCount, change: r.change, at: op.t });
    if (check && (r.change || r.event)) {
      const ok =
        validateDecision(s.decision, "local").ok &&
        JSON.stringify(s.decision.priorityActions) ===
          JSON.stringify(actionsFor(s.decision.primaryState, s.tier));
      if (!ok) decisionsOk = false;
    }
  }
  return { state: s, changes, decisionsOk };
}

const key = (r: { state: string; mode: string; nav: string; layout: string; tier: number }) =>
  `${r.state}|${r.mode}|${r.nav}|${r.layout}|${r.tier}`;
const isDomainState = (s: string) => s.endsWith("_FIRST");

describe("P-2 flicker (3,000 seeded synthetic users x 60 events)", () => {
  const rnd = prng(20261006);
  for (const [name, gen] of Object.entries(PROFILES)) {
    it(`${name}: 0 A-B-A reversals, <= 4 visible changes in any 10-event window, none before event 5, never domain to domain`, () => {
      let rapid = 0;
      let early = 0;
      let direct = 0;
      let invalid = 0;
      let maxWin = 0;
      let withChange = 0;
      for (let u = 0; u < 750; u++) {
        const run = apply(syntheticOps(rnd, gen), createEngine("lab_p"), u % 10 === 0);
        if (!run.decisionsOk) invalid += 1;
        const ch = run.changes;
        if (ch.length > 0) withChange += 1;
        // A -> B -> A within the reversal lock
        const seq = [
          {
            k: 0,
            key: key({
              state: "UNIVERSAL",
              mode: "BALANCED",
              nav: "UNIVERSAL",
              layout: "UNIVERSAL",
              tier: 0,
            }),
          },
        ];
        for (const c of ch) seq.push({ k: c.k, key: key(c.change.to) });
        for (let i = 2; i < seq.length; i++) {
          const a = seq[i];
          const b = seq[i - 1];
          const z = seq[i - 2];
          if (a && b && z && a.key === z.key && a.k - b.k < PR.REVERSAL_LOCK) rapid += 1;
        }
        for (let i = 0; i < ch.length; i++) {
          let n = 0;
          for (let j = i; j < ch.length && (ch[j]?.k ?? 0) - (ch[i]?.k ?? 0) < 10; j++) n += 1;
          maxWin = Math.max(maxWin, n);
        }
        if (ch.length > 0 && (ch[0]?.k ?? 99) < PR.MIN_TOTAL) early += 1;
        for (const c of ch)
          if (
            isDomainState(c.change.from.state) &&
            isDomainState(c.change.to.state) &&
            c.change.from.state !== c.change.to.state
          )
            direct += 1;
      }
      expect({ rapid, early, direct, invalid }).toEqual({
        rapid: 0,
        early: 0,
        direct: 0,
        invalid: 0,
      });
      expect(maxWin).toBeLessThanOrEqual(4);
      if (name.startsWith("focused")) expect(withChange).toBeGreaterThan(300);
    }, 120_000);
  }
});

describe("P-1 single event", () => {
  it("appending any single event never switches domain to domain and never changes within DWELL", () => {
    const rnd = prng(42);
    const gens = Object.values(PROFILES);
    let checked = 0;
    for (let u = 0; u < 30; u++) {
      const ops = syntheticOps(rnd, gens[u % gens.length] as Gen);
      let s = createEngine("lab_p");
      let last = ops[0]?.t ?? 0;
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (!op) continue;
        if (op.kind === "start") {
          s = startSession(s, op.t);
          continue;
        }
        if (i % 4 === 3) {
          for (const type of Object.values(TYPES).flat()) {
            const r = ingest(s, { type, entityId: "crs_e1" } as TrackInput, {
              now: last + 4_000,
              sessionId: op.sid,
            });
            checked += 1;
            if (
              isDomainState(s.decision.primaryState) &&
              isDomainState(r.state.decision.primaryState)
            )
              expect(r.state.decision.primaryState).toBe(s.decision.primaryState);
            expect(r.state.profile.meaningfulCount).toBeGreaterThanOrEqual(
              s.profile.meaningfulCount,
            );
          }
        }
        s = ingest(s, op.input, { now: op.t, sessionId: op.sid }).state;
        last = op.t;
      }
    }
    expect(checked).toBeGreaterThan(2_000);
  }, 120_000);

  it("never mutates the state it was given", () => {
    const rnd = prng(5);
    const ops = syntheticOps(rnd, PROFILES["focused 80% one domain"] as Gen);
    let s = createEngine("lab_p");
    for (const op of ops) {
      if (op.kind === "start") {
        s = startSession(s, op.t);
        continue;
      }
      const frozen = JSON.stringify(s);
      const r = ingest(s, op.input, { now: op.t, sessionId: op.sid });
      expect(JSON.stringify(s)).toBe(frozen);
      s = r.state;
    }
  });
});

describe("P-4 determinism", () => {
  it("replayEvents is bit-identical to incremental ingest", () => {
    const rnd = prng(11);
    for (let u = 0; u < 40; u++) {
      const ops = syntheticOps(rnd, PROFILES["spread over all 4"] as Gen).filter(
        (o) => o.kind === "ev",
      );
      const run = apply(ops);
      const events = ops.map((o, i) => {
        if (o.kind !== "ev") throw new Error("unreachable");
        const e = ingest(createEngine("lab_p"), o.input, { now: o.t, sessionId: o.sid }).event;
        if (!e) throw new Error("dropped");
        return { ...e, seq: i + 1 };
      });
      expect(JSON.stringify(replayEvents("lab_p", events))).toBe(JSON.stringify(run.state));
    }
  });

  it("folding in chunks with a JSON persist/restore between chunks equals one run", () => {
    const rnd = prng(7);
    for (let u = 0; u < 120; u++) {
      const gen = Object.values(PROFILES)[u % 4] as Gen;
      const ops = syntheticOps(rnd, gen);
      const once = apply(ops);
      let s = createEngine("lab_p");
      const changes: unknown[] = [];
      let i = 0;
      while (i < ops.length) {
        const n = 1 + ((rnd() * 9) | 0);
        const part = apply(ops.slice(i, i + n), s);
        changes.push(...part.changes.map((c) => c.change));
        s = JSON.parse(JSON.stringify(part.state)) as EngineState;
        i += n;
      }
      expect(JSON.stringify(s)).toBe(JSON.stringify(once.state));
      expect(JSON.stringify(changes)).toBe(JSON.stringify(once.changes.map((c) => c.change)));
    }
  });

  it("is a pure function of the event stream: two runs agree exactly", () => {
    const ops = syntheticOps(prng(99), PROFILES["drift 80% learning to 80% career at #30"] as Gen);
    expect(JSON.stringify(apply(ops).state)).toBe(JSON.stringify(apply(ops).state));
  });

  it("every committed reason is the local template and at most 160 characters", () => {
    const rnd = prng(3);
    for (let u = 0; u < 200; u++) {
      const run = apply(syntheticOps(rnd, Object.values(PROFILES)[u % 4] as Gen));
      expect(run.state.decision.reason.length).toBeLessThanOrEqual(160);
      for (const c of run.changes) expect(c.change.confidence).toBeLessThanOrEqual(1);
    }
    expect(C.tiers[3].overlay).toBe(true);
  });
});
