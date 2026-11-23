/** Current experience: label, mode, confidence, tier and what would move it next (plan §6). */
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { explainNext } from "@/evolution/core/evolution/engine";
import { useEvolutionStatus } from "@/evolution/react/hooks";
import { getRuntime } from "@/evolution/state/commands";
import { Chip, LabPanel } from "./LabPanel";
import { displayLabel } from "./labModel";

function nextHint(tier: number): string {
  let hint: string | null = null;
  try {
    hint = explainNext(getRuntime().getEngineState());
  } catch {
    /* The Lab never fails on a missing engine. */
  }
  if (hint) return hint;
  return tier >= 3 ? "Full adaptation reached." : "Keep using स्वYAM and it will keep learning.";
}

export default function PatternCard() {
  const s = useEvolutionStatus();
  const pct = Math.round(Math.max(0, Math.min(1, s.confidence)) * 100);
  return (
    <LabPanel
      id="pattern"
      title="Current experience"
      right={s.demo ? <Chip tone="key">Demo</Chip> : undefined}
    >
      <p className="font-display text-3xl tracking-tight text-ink" data-lab="pattern-label">
        {displayLabel(s.label)}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 font-body">
        <div>
          <dt className="text-[11.5px] uppercase tracking-wide text-ink-mute">Mode</dt>
          <dd className="mt-0.5 text-[15px] font-semibold text-ink">
            {displayLabel(EVOLUTION_CONFIG.modeLabels[s.mode])}
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] uppercase tracking-wide text-ink-mute">Confidence</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
            {/* Plain text: CountUp carries a second, screen-reader copy of the figure,
                which reads as "0% 0%" wherever the text is extracted. */}
            {`${pct}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] uppercase tracking-wide text-ink-mute">Tier</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{s.tier} of 3</dd>
        </div>
      </dl>
      <p className="mt-4 font-body text-[13.5px] leading-relaxed text-ink-soft">{s.reason}</p>
      <p className="mt-2 font-body text-[13px] font-semibold text-ink" data-lab="pattern-next">
        {nextHint(s.tier)}
      </p>
    </LabPanel>
  );
}
