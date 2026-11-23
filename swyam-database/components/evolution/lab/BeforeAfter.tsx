/**
 * Before / After (plan §6, §24), live at the top of the Lab: the UNIVERSAL arrangement
 * composed from the same config next to the current one, with the real navigation labels
 * and Home order. The "after" column moves on the same EvolutionStage the app uses, so
 * while a persona plays you watch the items glide to their new places (reduced motion:
 * instant). The full structure of both sides is one tap away under the fold line.
 */
import type { ReactNode } from "react";
import { EvolutionStage } from "@/components/motion/EvolutionStage";
import { NavIcon } from "@/components/evolution/NavItems";
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { NAV_REGISTRY } from "@/evolution/config/navigation";
import { SECTION_META } from "@/evolution/config/sections";
import { compose, UNIVERSAL_DECISION } from "@/evolution/core/evolution/compose";
import type { NavItemId, UISection, UIState } from "@/evolution/types";
import { diffUi, displayLabel, tierMarker, TIER_STEPS } from "./labModel";
import { LabPanel } from "./LabPanel";
import { StructureBody } from "./StructureDiagram";

const HOME_ROWS = 5;

function NavChip({ id, changed }: { id: NavItemId; changed: boolean }) {
  return (
    <span className="evo-ba__nav" data-changed={changed || undefined}>
      <NavIcon id={id} size={14} />
      {NAV_REGISTRY[id].label}
    </span>
  );
}

function HomeRow({
  ui,
  s,
  index,
  changed,
}: {
  ui: UIState;
  s: UISection;
  index: number;
  changed: boolean;
}) {
  const marker = tierMarker(ui, s, index);
  return (
    <span className="evo-ba__row" data-changed={changed || undefined} data-section={s.id}>
      <span className="evo-ba__n" aria-hidden>
        {index + 1}
      </span>
      <span className="min-w-0 truncate">{SECTION_META[s.id].title}</span>
      {marker ? <span className="evo-outline__tier">{marker}</span> : null}
    </span>
  );
}

function Column({
  kind,
  title,
  ui,
  changedNav,
  changedSections,
  animate,
}: {
  kind: "before" | "after";
  title: string;
  ui: UIState;
  changedNav: readonly NavItemId[];
  changedSections: readonly string[];
  animate: boolean;
}) {
  const open = ui.sections.filter((s) => !s.folded).slice(0, HOME_ROWS);
  const navItems = ui.navigation.top;
  const nav: ReactNode = animate ? (
    <EvolutionStage
      groupId={`lab-${kind}-nav`}
      as="ul"
      itemAs="li"
      className="evo-ba__navlist"
      items={navItems}
      getKey={(id) => id}
      highlight={false}
      renderItem={(id) => <NavChip id={id} changed={changedNav.includes(id)} />}
    />
  ) : (
    <ul className="evo-ba__navlist">
      {navItems.map((id) => (
        <li key={id}>
          <NavChip id={id} changed={changedNav.includes(id)} />
        </li>
      ))}
    </ul>
  );
  const home: ReactNode = animate ? (
    <EvolutionStage
      groupId={`lab-${kind}-home`}
      as="ol"
      itemAs="li"
      className="evo-ba__rows"
      items={open}
      getKey={(s) => s.key}
      highlightRadius="0.5rem"
      maxHighlighted={2}
      renderItem={(s, ctx) => (
        <HomeRow ui={ui} s={s} index={ctx.index} changed={changedSections.includes(s.id)} />
      )}
    />
  ) : (
    <ol className="evo-ba__rows">
      {open.map((s, i) => (
        <li key={s.key}>
          <HomeRow ui={ui} s={s} index={i} changed={changedSections.includes(s.id)} />
        </li>
      ))}
    </ol>
  );
  return (
    <div className="evo-ba__col" data-lab={kind}>
      <h3 className="font-body text-[13px] font-semibold text-ink">{title}</h3>
      <p className="evo-ba__label">Hero button</p>
      <p className="evo-ba__cta">{displayLabel(EVOLUTION_CONFIG.ctas[ui.hero.cta].label)}</p>
      <p className="evo-ba__label">Top bar</p>
      {nav}
      <p className="evo-ba__label">Home, top to bottom</p>
      {home}
    </div>
  );
}

/** 0 → 3, with the current step marked. Text first, colour second. */
export function TierSteps({ tier }: { tier: number }) {
  return (
    <ol className="evo-tiers" aria-label="Evolution tier">
      {TIER_STEPS.map((s) => (
        <li
          key={s.tier}
          data-on={tier >= s.tier || undefined}
          aria-current={tier === s.tier ? "step" : undefined}
        >
          <span className="evo-tiers__dot" aria-hidden />
          <span className="evo-tiers__label">
            {s.tier}
            <span className="hidden sm:inline"> {s.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function BeforeAfter({ after, signedIn }: { after: UIState; signedIn: boolean }) {
  const before = compose(UNIVERSAL_DECISION, 0, {
    signedIn,
    stableNav: false,
    locked: after.locked,
  });
  const diff = diffUi(before, after);
  const same = diff.nav.length === 0 && diff.sections.length === 0;
  return (
    <LabPanel
      id="before-after"
      title="Before and after"
      right={<TierSteps tier={after.tier} />}
      hint={
        same
          ? "Still the universal layout. Pick a persona to watch it change."
          : `${diff.nav.length} nav ${diff.nav.length === 1 ? "item" : "items"} and ${diff.sections.length} Home ${diff.sections.length === 1 ? "section" : "sections"} moved.`
      }
    >
      <div className="evo-ba">
        <Column
          kind="before"
          title="Before · Universal"
          ui={before}
          changedNav={[]}
          changedSections={[]}
          animate={false}
        />
        <Column
          kind="after"
          title={`Now · ${displayLabel(EVOLUTION_CONFIG.states[after.state].label)}`}
          ui={after}
          changedNav={diff.nav}
          changedSections={after.movedUp}
          animate
        />
      </div>
      <details className="evo-ba__full mt-4">
        <summary>Full structure, before and after</summary>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <div data-lab="before-full">
            <h3 className="font-body text-[13px] font-semibold text-ink">Before (universal)</h3>
            <StructureBody ui={before} signedIn={signedIn} />
          </div>
          <div data-lab="after-full">
            <h3 className="font-body text-[13px] font-semibold text-ink">After (now)</h3>
            <StructureBody
              ui={after}
              signedIn={signedIn}
              changedNav={diff.nav}
              changedSections={diff.sections}
            />
          </div>
        </div>
      </details>
    </LabPanel>
  );
}
