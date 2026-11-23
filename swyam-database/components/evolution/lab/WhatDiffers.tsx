/**
 * "What differs" (council fix 12): a plain list of what the two compared Swayams do
 * differently, built from the same compiled plans the frames render. It sits in the width
 * the phone frames leave free, and marks the first Home row where the two diverge, which
 * is where each frame scrolls to.
 */
import { PERSONAS } from "@/evolution/core/fixtures/journeys";
import type { PersonaId } from "@/evolution/types";
import type { CompareModel } from "./labModel";

export default function WhatDiffers({
  a,
  b,
  model,
}: {
  a: PersonaId;
  b: PersonaId;
  model: CompareModel;
}) {
  const differing = model.rows.filter((r) => r.differs).length;
  return (
    <section className="evo-diff" aria-labelledby="evo-diff-title" data-lab="what-differs">
      <h2 id="evo-diff-title" className="font-display text-xl tracking-tight text-ink">
        What differs
      </h2>
      <p className="mt-1 font-body text-[13px] leading-relaxed text-ink-soft">
        {/* One string, so no stray text-node gaps land before the comma and full stop. */}
        {`Same app, same design. ${differing} of ${model.rows.length} things below are arranged differently${
          model.firstIndex >= 0 ? `, starting at Home row ${model.firstIndex + 1}` : ""
        }.`}
      </p>
      <table className="evo-diff__table mt-3">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Part of स्वYAM</span>
            </th>
            <th scope="col">{PERSONAS[a].label}</th>
            <th scope="col">{PERSONAS[b].label}</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((r, i) => {
            const first =
              r.label.startsWith("Home ") && Number(r.label.slice(5)) === model.firstIndex + 1;
            return (
              <tr
                key={`${r.label}-${i}`}
                data-differs={r.differs || undefined}
                data-first={first || undefined}
              >
                <th scope="row">{r.label}</th>
                <td>{r.a}</td>
                <td>
                  {r.b}
                  {r.differs ? <span className="sr-only"> (differs)</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
