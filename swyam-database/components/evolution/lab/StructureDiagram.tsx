/**
 * The current structure (plan §6): the real navigation items, rendered through
 * NavItems with surface="diagram" (no links, no tracking), plus a HomeOutline built
 * from the same UIState. Changed items can be highlighted (Before / After).
 */
import NavItems from "@/components/evolution/NavItems";
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import type { NavItemId, SectionId, UIState } from "@/evolution/types";
import HomeOutline from "./HomeOutline";
import { Chip, LabPanel } from "./LabPanel";
import { experienceLabel } from "./labModel";

function NavRow({
  title,
  items,
  signedIn,
  changed = [],
}: {
  title: string;
  items: readonly NavItemId[];
  signedIn: boolean;
  changed?: readonly NavItemId[];
}) {
  return (
    <div className="mt-2">
      <p className="text-[11.5px] uppercase tracking-wide text-ink-mute">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1.5" data-lab-nav={title}>
        {items.map((id) => (
          <div key={id} className="evo-navchip" data-changed={changed.includes(id) || undefined}>
            <NavItems
              items={[id]}
              surface="diagram"
              signedIn={signedIn}
              highlight={changed.includes(id) ? [id] : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StructureBody({
  ui,
  signedIn,
  changedNav,
  changedSections,
}: {
  ui: UIState;
  signedIn: boolean;
  changedNav?: readonly NavItemId[];
  changedSections?: readonly SectionId[];
}) {
  return (
    <div className="evo-diagram font-body">
      <p className="font-body text-[13px] text-ink-soft">
        {`${experienceLabel(EVOLUTION_CONFIG.states[ui.state].label, EVOLUTION_CONFIG.modeLabels[ui.mode])} · tier ${ui.tier}`}
      </p>
      <NavRow title="Top bar" items={ui.navigation.top} signedIn={signedIn} changed={changedNav} />
      <NavRow title="Phone bar" items={ui.navigation.bottom} signedIn={signedIn} />
      {ui.navigation.overflow.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11.5px] uppercase tracking-wide text-ink-mute">Explore / More</p>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            {ui.navigation.overflow.reduce((n, g) => n + g.items.length, 0)} more destinations, one
            tap away. Nothing is removed.
          </p>
        </div>
      ) : null}
      <div className="mt-4">
        <HomeOutline ui={ui} highlight={changedSections} />
      </div>
    </div>
  );
}

export default function StructureDiagram({
  ui,
  signedIn,
  replaying = false,
}: {
  ui: UIState;
  signedIn: boolean;
  replaying?: boolean;
}) {
  return (
    <LabPanel
      id="structure"
      title="Current structure"
      hint="The real navigation and Home order, drawn from the same plan the app renders."
      right={replaying ? <Chip tone="key">Replay</Chip> : undefined}
    >
      <StructureBody ui={ui} signedIn={signedIn} />
    </LabPanel>
  );
}
