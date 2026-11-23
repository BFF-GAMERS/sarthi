/**
 * A wireframe of Home built from the compiled UIState and SECTION_META (plan §6):
 * hero call to action, priority actions, then the section blocks at their real span,
 * with tier markers (T1/T2 = moved up at that tier, T3 = folded under More for you).
 * Structure only; there is no paint here.
 */
import { PRIORITY_ACTIONS } from "@/evolution/config/actions";
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { SECTION_META } from "@/evolution/config/sections";
import type { SectionId, UISection, UIState } from "@/evolution/types";
import { displayLabel, tierMarker } from "./labModel";

const COLS = { full: 6, half: 3, third: 2 } as const;

export default function HomeOutline({
  ui,
  highlight = [],
}: {
  ui: UIState;
  highlight?: readonly SectionId[];
}) {
  const open = ui.sections.filter((s) => !s.folded);
  const folded = ui.sections.filter((s) => s.folded && s.id !== "MORE_FOR_YOU");
  const cta = EVOLUTION_CONFIG.ctas[ui.hero.cta];
  const block = (s: UISection, index: number) => {
    const meta = SECTION_META[s.id];
    const marker = tierMarker(ui, s, index);
    const changed = highlight.includes(s.id);
    return (
      <li
        key={s.key}
        data-section={s.id}
        data-changed={changed || undefined}
        className="evo-outline__block"
        style={{ gridColumn: `span ${COLS[s.span.desktop]}` }}
      >
        <span className="font-body text-[12.5px] font-semibold text-ink">{meta.title}</span>
        {marker ? <span className="evo-outline__tier">{marker}</span> : null}
      </li>
    );
  };
  return (
    <div className="evo-outline font-body" data-lab="home-outline">
      <p className="text-[11.5px] uppercase tracking-wide text-ink-mute">Home</p>
      <div className="evo-outline__hero">
        <span className="text-[12.5px] text-ink-soft">Hero button</span>
        <span className="text-[13px] font-semibold text-ink">{displayLabel(cta.label)}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Priority actions">
        {ui.priorityActions.map((id) => (
          <li key={id} className="evo-outline__action">
            {displayLabel(PRIORITY_ACTIONS[id].label)}
          </li>
        ))}
      </ul>
      <ol className="evo-outline__grid mt-2" aria-label="Home sections in order">
        {open.map((s, i) => block(s, i))}
      </ol>
      {folded.length > 0 ? (
        <details className="mt-2 rounded-[var(--radius-control)] border border-dashed border-ink-line p-2">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-soft">
            More for you ({folded.length} folded)
          </summary>
          <ol className="evo-outline__grid mt-2">
            {folded.map((s, i) => block(s, open.length + i))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
