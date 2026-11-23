/**
 * Scoring (plan §3.3, ported from ONE): sessions, decay, affinity, trait signals, the 20-event
 * window and the 12 scores. Arithmetic only. No clock, no randomness.
 */
import { DOMAIN_IDS } from "../../config/ids";
import { lruPush, pushRing, unshiftRing } from "../../lib/ring";
import type { BehaviourEvent, BehaviourScores, DomainId, EventType } from "../../types";
import { EVENT_SPEC, weightOf } from "../behaviour/taxonomy";
import { EVOLUTION_PARAMS as PR, FOCUSED_MODE, type Trait } from "./params";
import type { ByDomain, EngineInternal, OpenSession, SessionSummary, WindowEntry } from "./types";

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const zeroByDomain = (): ByDomain => ({
  LEARNING: 0,
  CAREER: 0,
  SKILL_EXCHANGE: 0,
  COMMUNITY: 0,
});

export function initialInternal(): EngineInternal {
  return {
    v: 1,
    k: 0,
    E: zeroByDomain(),
    F: zeroByDomain(),
    C: zeroByDomain(),
    R: 0,
    Rp: 0,
    Qn: 0,
    Qd: 0,
    window: [],
    sessions: [],
    cur: null,
    seen: [],
    P: null,
    ptier: 0,
    mode: "BALANCED",
    primPending: null,
    modePending: null,
    primWait: 0,
    lastVisibleK: -99,
    prevKey: null,
    prevPos: null,
    vis: "",
    sessionChanges: 0,
    vetoes: [],
    advice: null,
    sessionOpened: false,
  };
}

/** A private mutable copy: ingest mutates only drafts, never the input state. */
export function draftOf(s: EngineInternal): EngineInternal {
  return {
    ...s,
    E: { ...s.E },
    F: { ...s.F },
    C: { ...s.C },
    window: [...s.window],
    sessions: [...s.sessions],
    seen: [...s.seen],
    vetoes: [...s.vetoes],
    cur: s.cur === null ? null : cloneSession(s.cur),
  };
}

function cloneSession(c: OpenSession): OpenSession {
  const viewed: OpenSession["viewed"] = {};
  for (const d of DOMAIN_IDS) {
    const v = c.viewed[d];
    if (v) viewed[d] = [...v];
  }
  return { ...c, domains: [...c.domains], novelty: { ...c.novelty }, viewed };
}

/* ── sessions ───────────────────────────────────────────────────────── */

/** minimalUser contribution of a closed session. */
export const sessionM = (task: boolean, n: number, domains: number): number =>
  task ? clamp01((8 - n) / 4) * (domains <= 1 ? 1 : 0.5) : 0;

export function closeSession(d: EngineInternal): void {
  const c = d.cur;
  if (c === null) return;
  if (c.n > 0) {
    const sum: SessionSummary = {
      id: c.id,
      n: c.n,
      domains: [...c.domains],
      task: c.task,
      m: sessionM(c.task, c.n, c.domains.length),
    };
    d.sessions = unshiftRing(d.sessions, sum, PR.SESSIONS_CAP);
  }
  d.cur = null;
}

export function openSession(d: EngineInternal, id: string, ts: number): void {
  d.cur = {
    id,
    start: ts,
    lastTs: ts,
    n: 0,
    domains: [],
    task: false,
    novelty: {},
    viewed: {},
    anchorTs: ts,
    anchorSteps: 0,
    maxGap: 0,
  };
  d.sessionChanges = 0;
}

/** Sessions seen since reset (closed + open). */
export const sessionsTotal = (d: Pick<EngineInternal, "sessions" | "cur">): number =>
  d.sessions.length + (d.cur !== null && d.cur.n > 0 ? 1 : 0);

/** Sessions (current + closed ring) that used `domain`: the tier-3 cross-visit gate. */
export function sessionsUsing(
  d: Pick<EngineInternal, "sessions" | "cur">,
  domain: DomainId,
): number {
  let n = d.cur !== null && d.cur.domains.includes(domain) ? 1 : 0;
  for (const x of d.sessions) if (x.domains.includes(domain)) n += 1;
  return n;
}

/* ── decay ──────────────────────────────────────────────────────────── */

function decayOnce(d: EngineInternal): void {
  for (const id of DOMAIN_IDS) {
    d.E[id] *= PR.LAMBDA_S;
    d.F[id] *= PR.LAMBDA_S;
    d.C[id] *= PR.LAMBDA_S;
  }
  d.R *= PR.LAMBDA_B;
  d.Rp *= PR.LAMBDA_B;
  d.Qn *= PR.LAMBDA_B;
  d.Qd *= PR.LAMBDA_B;
}

/** Stale decay on a returning visit: STALE_STEPS decay steps per 14 idle days (a loop, capped). */
export function staleDecay(d: EngineInternal, idleMs: number): void {
  if (!(idleMs >= PR.STALE_AFTER_MS)) return;
  const steps = Math.min(
    PR.STALE_MAX_STEPS,
    Math.floor(idleMs / PR.STALE_AFTER_MS) * PR.STALE_STEPS,
  );
  for (let i = 0; i < steps; i++) decayOnce(d);
}

/* ── per-event accumulation ─────────────────────────────────────────── */

const domainOf = (e: BehaviourEvent): DomainId | null =>
  e.service === "PLATFORM" ? null : e.service;

function novelty(c: OpenSession, key: string): number {
  const seen = c.novelty[key] ?? 0;
  c.novelty[key] = seen + 1;
  return 1 / (seen + 1);
}

/** Weak events (navigation and section clicks, list filter/search): affinity only, no decay, no count, never meaningful. */
export function feedAffinityOnly(d: EngineInternal, e: BehaviourEvent): void {
  const dom = domainOf(e);
  const c = d.cur;
  if (dom === null || c === null) return;
  const sp = EVENT_SPEC[e.type];
  d.E[dom] += sp.aff * novelty(c, `${e.type}|${dom}`);
}

/** Folds one MEANINGFUL event into the draft. Mutates `d` only. */
export function accumulate(d: EngineInternal, e: BehaviourEvent): void {
  const sp = EVENT_SPEC[e.type];
  const meta = e.metadata as Readonly<Record<string, unknown>>;
  const c = d.cur as OpenSession;
  const gap = e.timestamp - c.lastTs;
  c.lastTs = e.timestamp;
  d.k += 1;
  c.n += 1;
  const dom = domainOf(e);
  if (dom !== null && !c.domains.includes(dom)) c.domains.push(dom);
  if (sp.goal) c.task = true;
  const nu = novelty(c, `${e.type}|${dom ?? "-"}|${e.entityId ?? "-"}`);

  decayOnce(d);

  if (dom !== null) {
    const base = sp.aff === sp.w ? weightOf(e.type, meta) : sp.aff;
    d.E[dom] += base * nu * (meta["via"] === "adaptive" ? PR.ADAPTIVE_DISCOUNT : 1);
    d.C[dom] += 1;
    if (sp.kind === "commit") d.F[dom] += PR.FOC_UNIT;
  }

  const rec: WindowEntry = { type: e.type, domain: dom, kind: sp.kind };
  if (sp.kind === "commit") rec.commit = true;

  // research (x novelty): compares and filters, plus breadth across distinct entities
  let r = 0;
  if (e.type === "course_compared") r = 2;
  else if (sp.kind === "research") r = 1;
  if (sp.kind === "research") rec.research = true;
  if (sp.kind === "view" && dom !== null && e.entityId !== null) {
    const list = c.viewed[dom] ?? [];
    if (!list.includes(e.entityId)) list.push(e.entityId);
    c.viewed[dom] = list;
    if (list.length >= PR.BREADTH_AFTER) r += 0.5;
  }
  d.R += r * nu;

  // repeat (no novelty): a revisit of an entity already seen
  const seenKey = dom !== null && e.entityId !== null ? `${dom}:${e.entityId}` : null;
  if (sp.kind === "view" && seenKey !== null && d.seen.includes(seenKey)) {
    d.Rp += 1;
    rec.repeat = true;
  }
  if (seenKey !== null) d.seen = lruPush(d.seen, seenKey, PR.SEEN_CAP);

  // quick: a speed sample on goal events
  c.anchorSteps += 1;
  if (gap > c.maxGap) c.maxGap = gap;
  if (sp.goal) {
    if (c.maxGap <= PR.QUICK_MAX_GAP_MS) {
      const secs = (e.timestamp - c.anchorTs) / 1000;
      d.Qn += 0.5 * clamp01((8 - c.anchorSteps) / 6) + 0.5 * clamp01((90 - secs) / 60);
      d.Qd += 1;
      rec.quick = true;
    }
    c.anchorTs = e.timestamp;
    c.anchorSteps = 0;
    c.maxGap = 0;
  }

  d.window = pushRing(d.window, rec, PR.WINDOW);
}

/* ── read-only derivations ──────────────────────────────────────────── */

export interface DomainWindow {
  n: number;
  types: EventType[];
  commits: number;
  views: number;
}

export interface WindowStats {
  per: Record<DomainId, DomainWindow>;
  repeat: number;
  research: number;
  quick: number;
  /** Distinct domains in the window. */
  domains: number;
}

export function windowStats(s: Pick<EngineInternal, "window">): WindowStats {
  const per = {} as Record<DomainId, DomainWindow>;
  for (const id of DOMAIN_IDS) per[id] = { n: 0, types: [], commits: 0, views: 0 };
  const ws: WindowStats = { per, repeat: 0, research: 0, quick: 0, domains: 0 };
  let seen = 0;
  for (const e of s.window) {
    if (e.domain !== null) {
      const p = per[e.domain];
      if (p.n === 0) seen += 1;
      p.n += 1;
      if (!p.types.includes(e.type)) p.types.push(e.type);
      if (e.commit) p.commits += 1;
      if (e.kind === "view") p.views += 1;
    }
    if (e.repeat) ws.repeat += 1;
    if (e.research) ws.research += 1;
    if (e.quick) ws.quick += 1;
  }
  ws.domains = seen;
  return ws;
}

export interface Scores {
  /** affinity_d = (E_d / T) * ev */
  affinity: Record<DomainId, number>;
  T: number;
  ev: number;
  behaviour: Record<Trait, number>;
}

export function scores(s: EngineInternal): Scores {
  let T = 0;
  for (const id of DOMAIN_IDS) T += s.E[id];
  const ev = T / (T + PR.K_EV);
  const affinity = zeroByDomain();
  for (const id of DOMAIN_IDS) affinity[id] = T === 0 ? 0 : (s.E[id] / T) * ev;
  let Ct = 0;
  let C2 = 0;
  for (const id of DOMAIN_IDS) {
    Ct += s.C[id];
    C2 += s.C[id] * s.C[id];
  }
  const neff = C2 === 0 ? 0 : (Ct * Ct) / C2;
  const explorer = clamp01((neff - 1.5) / 1.5) * (Ct / (Ct + PR.K_EXPL));
  let mNum = 0;
  let mDen = 1;
  let wgt = 1;
  for (let i = 0; i < s.sessions.length && i < PR.MINIMAL_SESSIONS; i++) {
    mNum += wgt * (s.sessions[i] as SessionSummary).m;
    mDen += wgt;
    wgt *= PR.MINIMAL_DECAY;
  }
  const foc = (d: DomainId): number => s.F[d] / (s.F[d] + PR.K_FOC);
  return {
    affinity,
    T,
    ev,
    behaviour: {
      RESEARCH: s.R / (s.R + PR.K_RES),
      REPEAT: s.Rp / (s.Rp + PR.K_REP),
      QUICK: s.Qn / (s.Qd + PR.K_QUICK),
      EXPLORER: explorer,
      MINIMAL: mNum / mDen,
      CAREER_FOCUSED: foc("CAREER"),
      LEARNING_FOCUSED: foc("LEARNING"),
      SKILL_FOCUSED: foc("SKILL_EXCHANGE"),
    },
  };
}

/** c(d) = ev * clamp01(((E_d - max_{t!=d} E_t) / T) / LEAD_SCALE). */
export function conf(s: Pick<EngineInternal, "E">, dom: DomainId): number {
  let T = 0;
  let other = 0;
  for (const t of DOMAIN_IDS) {
    T += s.E[t];
    if (t !== dom && s.E[t] > other) other = s.E[t];
  }
  if (T === 0) return 0;
  return (T / (T + PR.K_EV)) * clamp01((s.E[dom] - other) / T / PR.LEAD_SCALE);
}

/** argmax_d E_d, ties to the canonical order. */
export function topDomain(s: Pick<EngineInternal, "E">): DomainId {
  let b: DomainId = DOMAIN_IDS[0];
  for (const id of DOMAIN_IDS) if (s.E[id] > s.E[b]) b = id;
  return b;
}

/** Mode eligibility (plan §3.3). */
export function eligibility(s: EngineInternal, ws: WindowStats): Record<Trait, boolean> {
  const ok = s.k >= PR.MODE_MIN_TOTAL;
  let lean = 0;
  for (const x of s.sessions.slice(0, PR.MINIMAL_SESSIONS)) if (x.m >= PR.MINIMAL_LEAN_M) lean += 1;
  const focused = (d: DomainId): boolean => ok && ws.per[d].commits >= PR.FOCUSED_MIN_COMMITS;
  return {
    REPEAT: ok && ws.repeat >= PR.REPEAT_MIN_SIGNALS,
    RESEARCH: ok && ws.research >= PR.TRAIT_MIN_EVENTS,
    QUICK: ok && ws.quick >= PR.TRAIT_MIN_EVENTS,
    MINIMAL: ok && lean >= PR.MINIMAL_LEAN_SESSIONS,
    EXPLORER: ok && ws.domains >= PR.EXPLORER_MIN_DOMAINS,
    CAREER_FOCUSED: focused("CAREER"),
    LEARNING_FOCUSED: focused("LEARNING"),
    SKILL_FOCUSED: focused("SKILL_EXCHANGE"),
  };
}

/** The 12 scores, 0..1 (Lab, profile). */
export function behaviourScores(s: EngineInternal): BehaviourScores {
  const sc = scores(s);
  return {
    learningAffinity: sc.affinity.LEARNING,
    careerAffinity: sc.affinity.CAREER,
    skillExchangeAffinity: sc.affinity.SKILL_EXCHANGE,
    communityAffinity: sc.affinity.COMMUNITY,
    quickUser: sc.behaviour.QUICK,
    researchUser: sc.behaviour.RESEARCH,
    repeatUser: sc.behaviour.REPEAT,
    explorer: sc.behaviour.EXPLORER,
    careerFocused: sc.behaviour.CAREER_FOCUSED,
    learningFocused: sc.behaviour.LEARNING_FOCUSED,
    skillFocused: sc.behaviour.SKILL_FOCUSED,
    minimalUser: sc.behaviour.MINIMAL,
  };
}

export { FOCUSED_MODE };
