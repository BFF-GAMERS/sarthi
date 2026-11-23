/**
 * Pure composition for the transient plan override (Time-Scrub and Try-On). No React, no storage, no clock.
 *
 *   previewTarget(ref | personaId) -> the structure that would be shown, composed by the same compose() that
 *   builds the live plan, so what a preview shows is exactly what the engine would present.
 *
 * A persona's structure is read from its fixed journey (core/fixtures), never from the user's behaviour, so a
 * preview can neither reveal nor change anything about the person looking at it.
 */
import { actionsFor, compose } from "../core/evolution/compose";
import { PERSONAS } from "../core/fixtures/journeys";
import { runPersona } from "../core/fixtures/trace";
import { PERSONA_IDS } from "../config/ids";
import type {
  ComposeContext,
  EvolutionDecision,
  EvolutionSnapshotRef,
  PersonaId,
  ReasonCode,
  Tier,
  UIState,
} from "../types";
import type { PreviewTarget } from "./types";

/** Try-On shows the full arrangement, not a half-evolved one. */
export const PREVIEW_TIER: Tier = 3;

export const isPersonaId = (x: unknown): x is PersonaId =>
  typeof x === "string" && (PERSONA_IDS as readonly string[]).includes(x);

/** A decision for a stored structure. Navigation, layout and actions are recomposed, never trusted. */
export function decisionForRef(ref: EvolutionSnapshotRef, confidence = 0.8): EvolutionDecision {
  return {
    primaryState: ref.state,
    behaviourMode: ref.mode,
    navigationMode: ref.nav,
    homepageLayout: ref.layout,
    priorityActions: actionsFor(ref.state, ref.tier),
    reason: "",
    confidence,
  };
}

const personaCache = new Map<PersonaId, { ref: EvolutionSnapshotRef; confidence: number }>();

/** The structure a persona's journey ends in, at the preview tier. Deterministic and cached. */
export function personaRef(persona: PersonaId): { ref: EvolutionSnapshotRef; confidence: number } {
  const hit = personaCache.get(persona);
  if (hit) return hit;
  const d = runPersona(PERSONAS[persona]).final.decision;
  const out = {
    ref: {
      state: d.primaryState,
      mode: d.behaviourMode,
      nav: d.navigationMode,
      layout: d.homepageLayout,
      tier: PREVIEW_TIER,
    } satisfies EvolutionSnapshotRef,
    confidence: d.confidence,
  };
  personaCache.set(persona, out);
  return out;
}

export interface ResolvedPreview {
  ref: EvolutionSnapshotRef;
  persona: PersonaId | null;
  confidence: number;
  ui: UIState;
}

/** Resolve a target (a stored ref or a persona id) and compose it for this person's context. */
export function previewTarget(
  target: PreviewTarget,
  ctx: ComposeContext,
  confidence?: number,
): ResolvedPreview {
  if (isPersonaId(target)) {
    const p = personaRef(target);
    const c = confidence ?? p.confidence;
    return {
      ref: p.ref,
      persona: target,
      confidence: c,
      ui: compose(decisionForRef(p.ref, c), p.ref.tier, ctx),
    };
  }
  const c = confidence ?? 0.8;
  return {
    ref: target,
    persona: null,
    confidence: c,
    ui: compose(decisionForRef(target, c), target.tier, ctx),
  };
}

/** What a commit of a preview is attributed to: "Your layout is locked. Swayam keeps it as it is." */
export const COMMIT_REASON: ReasonCode = { key: "LOCKED" };

export const sameRef = (a: EvolutionSnapshotRef, b: EvolutionSnapshotRef): boolean =>
  a.state === b.state &&
  a.mode === b.mode &&
  a.nav === b.nav &&
  a.layout === b.layout &&
  a.tier === b.tier;
