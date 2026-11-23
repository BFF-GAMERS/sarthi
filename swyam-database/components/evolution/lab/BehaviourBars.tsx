/** Learning / Career / Skills / Community share of behaviour, from the profile scores (plan §6). */
import { useEvolutionSnapshot } from "@/evolution/react/hooks";
import { DOMAIN_BARS, domainShares } from "./labModel";
import { LabPanel, Meter } from "./LabPanel";

export default function BehaviourBars() {
  const { profile } = useEvolutionSnapshot();
  const shares = domainShares(profile.scores);
  const none = shares.every((v) => v === 0);
  return (
    <LabPanel
      id="behaviour"
      title="What you use most"
      hint="Share of your recent activity across the four areas of स्वYAM."
    >
      <div className="flex flex-col gap-3.5">
        {DOMAIN_BARS.map(([label], i) => (
          <Meter key={label} label={label} value={shares[i]} />
        ))}
      </div>
      {none ? (
        <p className="mt-3 font-body text-[12.5px] text-ink-mute">
          Nothing learned yet. Use स्वYAM, or play a persona below.
        </p>
      ) : null}
    </LabPanel>
  );
}
