/**
 * Runtime handle + user commands.
 *
 * CONTRACT: the exported names and signatures are frozen. The persistence lane
 * replaces the STATIC STUB runtime with the real one (registerRuntime() from
 * EvolutionRuntime on mount). Until then every call is a safe no-op and the
 * snapshot stays UNIVERSAL.
 */
import { createEngine } from "../core/evolution/engine";
import { TAB_STORE_KEY } from "../core/tabs/usage";
import type { AdaptiveSetting } from "../types";
import { defaultSnapshot } from "./defaults";
import type { EvolutionRuntimeApi, PreviewOptions, PreviewTarget } from "./types";

function createStaticRuntime(): EvolutionRuntimeApi {
  const snap = defaultSnapshot();
  const noop = () => {};
  return {
    getSnapshot: () => snap,
    getServerSnapshot: () => snap,
    subscribe: () => noop,
    ingestBatch: noop,
    ingestNow: noop,
    newSession: noop,
    getEngineState: () => createEngine("guest"),
    getEvents: () => [],
    getPreview: () => null,
    subscribePreview: () => noop,
    previewPlan: noop,
    clearPreview: noop,
    commitPreview: noop,
    applyAdvice: noop,
    setAiStatus: noop,
    setAuth: noop,
    enterSandbox: noop,
    exitSandbox: noop,
    resetBehaviour: noop,
    resetEvolution: noop,
    resetExperience: noop,
    setLocked: noop,
    setAdaptive: noop,
    undo: noop,
  };
}

/* Created on first use, not at module load: the SSR bundle can evaluate this module before the
 * engine/config chunk it depends on, and a load-time compose() would then see undefined config. */
let runtime: EvolutionRuntimeApi | null = null;
const rt = (): EvolutionRuntimeApi => (runtime ??= createStaticRuntime());
const swapListeners = new Set<() => void>();

/** The active runtime. Never null; a static UNIVERSAL runtime before mount and on the server. */
export function getRuntime(): EvolutionRuntimeApi {
  return rt();
}

/** Called once by EvolutionRuntime on the client. Hooks re-subscribe to the new runtime. */
export function registerRuntime(next: EvolutionRuntimeApi): void {
  runtime = next;
  swapListeners.forEach((l) => l());
}

/** For react/hooks.ts: notified when the runtime instance itself is swapped. */
export function onRuntimeSwap(listener: () => void): () => void {
  swapListeners.add(listener);
  return () => swapListeners.delete(listener);
}

export const resetBehaviour = (): void => rt().resetBehaviour();
export const resetEvolution = (): void => rt().resetEvolution();
export const resetExperience = (): void => {
  rt().resetExperience();
  // Adaptive tab order (lane B2) is learned too: forget it with everything else.
  try {
    globalThis.localStorage?.removeItem(TAB_STORE_KEY);
  } catch {
    /* blocked storage: nothing was stored */
  }
};
export const setLocked = (locked: boolean): void => rt().setLocked(locked);
export const setAdaptive = (setting: AdaptiveSetting): void => rt().setAdaptive(setting);
export const undoLastChange = (): void => rt().undo();

/**
 * Show another structure on the real Home and navigation, transiently (Time-Scrub, Try-On). Nothing is stored:
 * it ends on a route change, on any tracked event, on a command that changes the experience, or on `ttlMs`.
 */
export const previewPlan = (target: PreviewTarget, opts?: PreviewOptions): void =>
  rt().previewPlan(target, opts);
export const clearPreview = (): void => rt().clearPreview();
/** "Restore this layout" / "Make this mine": present the preview and keep it (locked). */
export const commitPreview = (): void => rt().commitPreview();
