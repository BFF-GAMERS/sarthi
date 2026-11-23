/**
 * The three always-visible demo controls (plan §6): play the persona, replay the event log
 * step by step, leave the demo. Kept apart from the resets so they sit above the fold.
 */
import { exitDemo, startPersona } from "@/evolution/runtime/evolution/sandbox";
import { PERSONAS } from "@/evolution/core/fixtures/journeys";
import { useEvolutionStatus } from "@/evolution/react/hooks";
import type { PersonaId } from "@/evolution/types";
import { useRunningPersona } from "./useRunningPersona";

export const DEFAULT_PERSONA: PersonaId = "career-seeker";

export default function PlayControls({
  persona,
  onReplay,
}: {
  persona: PersonaId | null;
  onReplay: () => void;
}) {
  const status = useEvolutionStatus();
  const running = useRunningPersona();
  const target = persona ?? DEFAULT_PERSONA;
  return (
    <div className="evo-play mt-3" data-lab="play-controls">
      <button
        type="button"
        className="btn-primary evo-play__btn"
        onClick={() => startPersona(target)}
        aria-busy={running !== null}
        aria-label={
          running
            ? `Playing ${PERSONAS[running].label}`
            : `Simulate Behavior (${PERSONAS[target].label})`
        }
      >
        {running ? `Playing ${PERSONAS[running].label}…` : <>Simulate Behavior</>}
      </button>
      <button
        type="button"
        className="btn-ghost evo-play__btn"
        onClick={onReplay}
        aria-label="Replay Evolution"
      >
        <span className="sm:hidden">Replay</span>
        <span className="hidden sm:inline">Replay Evolution</span>
      </button>
      <button
        type="button"
        className="btn-ghost evo-play__btn"
        onClick={exitDemo}
        disabled={!status.demo && !running}
        aria-label="Exit demo"
      >
        <span className="sm:hidden">Exit</span>
        <span className="hidden sm:inline">Exit demo</span>
      </button>
    </div>
  );
}
