/**
 * Replay Evolution (plan §6.2): re-folds the scope's event log step by step and lets
 * the Lab show the structure and history at each step. Play, pause, step, scrub.
 * Read-only: it never writes to the store, and never emits tracking events.
 */
import type { ReplayApi } from "./useReplay";
import { LabPanel } from "./LabPanel";

export default function ReplayPlayer({ replay }: { replay: ReplayApi }) {
  const { state, controller } = replay;
  if (!state || !controller) return null;
  const empty = state.total === 0;
  const cur = state.current;
  return (
    <LabPanel
      id="replay"
      title="Replay evolution"
      hint="Re-runs your event log through the engine. The live layout is not changed."
    >
      {empty ? (
        <p className="font-body text-[13.5px] text-ink-soft" data-lab="replay-empty">
          Nothing to replay yet. Play a persona first.
        </p>
      ) : (
        <>
          <p className="font-body text-[13.5px] text-ink" data-lab="replay-status">
            Step {state.index} of {state.total}
            {cur ? ` · ${cur.event.type.replace(/_/g, " ")} · tier ${cur.tier}` : " · start"}
          </p>
          <input
            type="range"
            min={0}
            max={state.total}
            value={state.index}
            onChange={(e) => controller.seek(Number(e.target.value))}
            aria-label="Replay position"
            className="mt-3 w-full accent-[var(--color-saffron-500)]"
          />
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {state.playing ? (
          <button
            type="button"
            className="btn-ghost !px-4 !py-2 !text-[13px]"
            onClick={controller.pause}
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary !px-4 !py-2 !text-[13px]"
            onClick={controller.play}
            disabled={empty}
          >
            {state.index >= state.total && !empty ? "Play again" : "Play"}
          </button>
        )}
        <button
          type="button"
          className="btn-ghost !px-4 !py-2 !text-[13px]"
          onClick={controller.step}
          disabled={empty || state.index >= state.total}
        >
          Step
        </button>
        <button
          type="button"
          className="btn-ghost !px-4 !py-2 !text-[13px]"
          onClick={controller.restart}
          disabled={empty || state.index === 0}
        >
          Restart
        </button>
        <button type="button" className="btn-ghost !px-4 !py-2 !text-[13px]" onClick={replay.stop}>
          Back to live
        </button>
      </div>
    </LabPanel>
  );
}
