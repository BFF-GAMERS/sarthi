/** How you use Swayam: quick, research, repeat, explorer, focused, minimal (0..100%). */
import { useEvolutionSnapshot } from "@/evolution/react/hooks";
import { traitValues } from "./labModel";
import { LabPanel, Meter } from "./LabPanel";

export default function TraitBars() {
  const { profile } = useEvolutionSnapshot();
  return (
    <LabPanel
      id="traits"
      title="How you use it"
      hint="Habits the layout can respond to. None of this describes who you are."
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        {traitValues(profile.scores).map(([label, value]) => (
          <Meter key={label} label={label} value={value} />
        ))}
      </div>
    </LabPanel>
  );
}
