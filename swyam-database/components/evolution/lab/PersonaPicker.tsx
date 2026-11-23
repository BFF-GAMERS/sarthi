/**
 * "Watch Swayam adapt" (plan §6.1): the five demo personas as touch-sized chips plus the
 * play controls and a one-line live status. Picking a persona streams its journey into the
 * sandbox and the Before/After below it moves with it. Your own profile is not touched.
 */
import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { PERSONAS } from "@/evolution/core/fixtures/journeys";
import { PERSONA_IDS } from "@/evolution/config/ids";
import type { PersonaId } from "@/evolution/types";
import { LabPanel } from "./LabPanel";
import { experienceLabel } from "./labModel";
import PlayControls from "./PlayControls";

export default function PersonaPicker({
  selected,
  running,
  status,
  evolved,
  onPick,
  onReplay,
}: {
  selected: PersonaId | null;
  running: PersonaId | null;
  /** The live one-line status (announced politely). */
  status: string;
  /** True once the persona finished and the structure is at its final tier. */
  evolved: boolean;
  onPick: (id: PersonaId) => void;
  onReplay: () => void;
}) {
  const current = selected ? PERSONAS[selected] : null;
  const list = useRef<HTMLUListElement>(null);

  // On phones the personas are a swipe strip: bring the playing one into view, sideways only.
  useEffect(() => {
    const box = list.current;
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !on || box.scrollWidth <= box.clientWidth) return;
    const left = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
  }, [selected]);

  return (
    <LabPanel id="personas" title="Watch स्वYAM adapt">
      <p className="-mt-2 mb-3 hidden font-body text-[13px] leading-relaxed text-ink-soft sm:block">
        Replays a short sample journey in a private sandbox. Your own profile is not touched.
      </p>
      <ul className="evo-personas" ref={list}>
        {PERSONA_IDS.map((id) => {
          const p = PERSONAS[id];
          const on = selected === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick(id)}
                aria-pressed={on}
                data-persona={id}
                className="evo-persona w-full text-left"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-body text-[14px] font-semibold text-ink">{p.label}</span>
                  {running === id ? (
                    <span className="font-mono text-[10.5px] uppercase text-saffron-700">
                      playing
                    </span>
                  ) : null}
                </span>
                <span className="evo-persona__desc">{p.description}</span>
                <span className="evo-persona__tag">
                  {experienceLabel(
                    EVOLUTION_CONFIG.states[p.expected.state].label,
                    EVOLUTION_CONFIG.modeLabels[p.expected.mode],
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {current ? (
        <p className="evo-picked mt-2 font-body text-[12.5px] leading-relaxed text-ink-soft">
          {current.description}
        </p>
      ) : null}
      <PlayControls persona={selected} onReplay={onReplay} />
      <p className="evo-status mt-2 font-body text-[13px] text-ink" role="status" data-lab="status">
        {status}
        {evolved ? (
          <>
            {" "}
            <Link
              to="/"
              className="font-semibold text-saffron-700 underline-offset-2 hover:underline"
            >
              See it on Home
            </Link>
          </>
        ) : null}
      </p>
    </LabPanel>
  );
}
