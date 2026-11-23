/**
 * Default (UNIVERSAL, visitor) snapshot — the SSR snapshot and the starting
 * point of every new scope. Owned by the persistence lane after contracts.
 */
import { compose, UNIVERSAL_DECISION } from "../core/evolution/compose";
import { emptyProfile } from "../core/evolution/engine";
import type { AiStatus, EvolutionSnapshot, Scope } from "../types";

export const IDLE_AI: AiStatus = {
  kind: "idle",
  lastTrigger: null,
  lastDecision: null,
  detail: null,
  fallback: null,
  callsLeftToday: 6,
  at: null,
};

export function defaultSnapshot(scope: Scope = "guest", signedIn = false): EvolutionSnapshot {
  const ui = compose(UNIVERSAL_DECISION, 0, { signedIn, stableNav: false, locked: false });
  return {
    scope,
    prefs: { adaptive: "on", locked: false },
    profile: emptyProfile(scope),
    decision: UNIVERSAL_DECISION,
    tier: 0,
    ui,
    history: [],
    status: {
      scope,
      state: "UNIVERSAL",
      mode: "BALANCED",
      tier: 0,
      confidence: 0,
      label: "Balanced",
      reason: "Learning how you use Swayam.",
      reasonCode: { key: "START" },
      restored: false,
      lastChangeAt: null,
      demo: null,
    },
    ai: IDLE_AI,
    hydrated: false,
  };
}
