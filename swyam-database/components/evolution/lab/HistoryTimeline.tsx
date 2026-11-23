/**
 * What changed and why (plan §6): each committed change with its source chip
 * (deterministic / ai / persona / reset / undo / manual), time and template reason.
 * Reads the live history by default; the Lab passes replay entries while replaying.
 */
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { renderReason } from "@/evolution/core/evolution/engine";
import { useEvolutionHistory } from "@/evolution/react/hooks";
import type { EvolutionHistory, EvolutionSnapshotRef } from "@/evolution/types";
import { experienceLabel, sourceLabel } from "./labModel";
import { Chip, LabPanel } from "./LabPanel";

function describe(ref: EvolutionSnapshotRef): string {
  const state = EVOLUTION_CONFIG.states[ref.state].label;
  const mode = EVOLUTION_CONFIG.modeLabels[ref.mode];
  return `${experienceLabel(state, mode)} · tier ${ref.tier}`;
}

const timeFmt = (at: number): string => {
  try {
    return new Date(at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
};

export default function HistoryTimeline({
  history,
  replaying = false,
}: {
  history?: EvolutionHistory;
  replaying?: boolean;
}) {
  const live = useEvolutionHistory();
  const entries = history ?? live;
  const newestFirst = [...entries].reverse();
  return (
    <LabPanel
      id="history"
      title="History"
      hint={
        replaying
          ? "Replaying: showing the changes up to the current step. Nothing is saved."
          : "Every committed change, newest first."
      }
      right={replaying ? <Chip tone="key">Replay</Chip> : undefined}
    >
      {newestFirst.length === 0 ? (
        <p className="font-body text-[13.5px] text-ink-soft">
          No changes yet. स्वYAM is still learning how you use it.
        </p>
      ) : (
        <ol className="flex flex-col" data-lab="history-list">
          {newestFirst.map((e) => (
            <li key={e.id} className="border-t border-ink-line py-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={e.source === "persona" || e.source === "ai" ? "key" : "plain"}>
                  {sourceLabel(e.source)}
                </Chip>
                <span className="font-mono text-[11.5px] tabular-nums text-ink-mute">
                  {timeFmt(e.at)}
                </span>
                <span className="font-mono text-[11.5px] tabular-nums text-ink-mute">
                  {Math.round(e.confidence * 100)}%
                </span>
              </div>
              <p className="mt-1.5 font-body text-[13.5px] text-ink">
                {describe(e.from)} <span aria-label="became">→</span> {describe(e.to)}
              </p>
              <p className="mt-0.5 font-body text-[12.5px] text-ink-soft">
                {renderReason(e.reasonCode)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </LabPanel>
  );
}
