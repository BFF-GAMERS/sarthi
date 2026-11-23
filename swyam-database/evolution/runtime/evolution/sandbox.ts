/**
 * Lab persona sandbox (plan §6). startPersona() switches the runtime to the lab
 * scope (never synced; the real scope is untouched), resets it and streams the
 * persona's journey with lab/persona-player.ts: ingestNow(…, 'persona') about
 * 250 ms apart, newSession() between journey sessions, then one 'lab' AI analysis.
 * CONTRACT: startPersona / exitDemo signatures are frozen.
 */
import { PERSONAS } from "../../core/fixtures/journeys";
import { playJourney } from "../../lab/persona-player";
import { getRuntime } from "../../state/commands";
import { PREVIEW_TIER, previewTarget } from "../../state/preview";
import type { ComposeContext, PersonaId, UIState } from "../../types";
import { requestAiAnalysis } from "./ai-scheduler";

export interface PersonaRun {
  persona: PersonaId;
  /** Resolves when streaming finishes or is cancelled. */
  done: Promise<void>;
  cancel(): void;
}

let active: PersonaRun | null = null;
const listeners = new Set<() => void>();

function setActive(next: PersonaRun | null) {
  active = next;
  listeners.forEach((l) => l());
}

/** The persona currently streaming, or null. For the Lab's controls (useSyncExternalStore). */
export const getRunningPersona = (): PersonaId | null => active?.persona ?? null;

export function subscribePersonaRun(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Switch to the lab scope, reset it and stream the persona. A new run cancels the previous one. */
export function startPersona(persona: PersonaId, opts?: { intervalMs?: number }): PersonaRun {
  active?.cancel();
  const run = playJourney(getRuntime(), PERSONAS[persona], {
    intervalMs: opts?.intervalMs,
    requestAi: requestAiAnalysis,
  });
  setActive(run);
  void run.done.then(() => {
    if (active === run) setActive(null);
  });
  return run;
}

/** Leave the demo and return to the user's real scope. */
export function exitDemo(): void {
  active?.cancel();
  setActive(null);
  try {
    getRuntime().exitSandbox();
  } catch {
    /* Nothing to leave. */
  }
}

/**
 * The plan a persona's journey ends in, composed at tier 3 (Try-On). Pure: it replays the persona's fixed journey
 * in memory and composes it for this person's context (signed in or not), so nothing about the real scope is read,
 * written or revealed. runtime.previewPlan(persona) uses exactly this composition.
 */
export function composePersonaPlan(persona: PersonaId, ctx: ComposeContext): UIState {
  return previewTarget(persona, ctx).ui;
}

export { PREVIEW_TIER };
