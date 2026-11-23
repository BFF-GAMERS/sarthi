/**
 * Persona player (plan §6): streams one persona journey into the sandbox, about
 * 250 ms between events, through the same runtime path real behaviour takes.
 *
 * Pure orchestration over EvolutionRuntimeApi: no react, no storage, no Date.now.
 * The runtime and the AI call are injected, so tests drive it with fake timers.
 * It never throws and never blocks the UI: the final AI analysis is fired and not
 * awaited, and if it fails the deterministic engine has already decided.
 */
import type { PersonaJourney } from "../core/fixtures/journeys";
import type { EvolutionRuntimeApi } from "../state/types";
import type { AnalyzerTrigger, PersonaId } from "../types";

export const DEFAULT_INTERVAL_MS = 250;

export interface PersonaRunHandle {
  persona: PersonaId;
  /** Resolves when streaming finishes or is cancelled. */
  done: Promise<void>;
  cancel(): void;
}

export interface PlayOptions {
  intervalMs?: number;
  /** Called once after the last event unless cancelled; its result is not awaited. */
  requestAi?: (rt: EvolutionRuntimeApi, trigger: AnalyzerTrigger) => Promise<unknown>;
  onProgress?: (progress: { sent: number; total: number }) => void;
}

export function playJourney(
  rt: EvolutionRuntimeApi,
  journey: PersonaJourney,
  opts: PlayOptions = {},
): PersonaRunHandle {
  const interval = Math.max(0, opts.intervalMs ?? DEFAULT_INTERVAL_MS);
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wake: (() => void) | null = null;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      wake = resolve;
      timer = setTimeout(() => {
        timer = null;
        wake = null;
        resolve();
      }, ms);
    });

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const w = wake;
    wake = null;
    w?.();
  };

  const total = journey.sessions.reduce((n, s) => n + s.length, 0);

  const run = async () => {
    try {
      rt.enterSandbox("lab", journey.id);
      let sent = 0;
      for (let s = 0; s < journey.sessions.length && !cancelled; s++) {
        if (s > 0) rt.newSession();
        const session = journey.sessions[s];
        for (let i = 0; i < session.length && !cancelled; i++) {
          rt.ingestNow(session[i], "persona");
          sent++;
          opts.onProgress?.({ sent, total });
          const isLast = s === journey.sessions.length - 1 && i === session.length - 1;
          if (!isLast) await sleep(interval);
        }
      }
      if (!cancelled && opts.requestAi) {
        try {
          void Promise.resolve(opts.requestAi(rt, "lab")).catch(() => {});
        } catch {
          /* The on-device engine already decided. */
        }
      }
    } catch {
      /* Never block the UI on a demo. */
    }
  };

  return { persona: journey.id, done: run(), cancel };
}
