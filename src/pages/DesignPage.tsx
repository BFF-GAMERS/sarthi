import { useState } from "react";
import { Loader2 } from "lucide-react";

const SWATCHES = [
  { name: "Saffron 500", className: "bg-saffron-500" },
  { name: "Paper light", className: "bg-paper-light" },
  { name: "Ink", className: "bg-ink" },
];

export default function DesignPage() {
  const [filter, setFilter] = useState(true);

  return (
    <section className="container-x py-[var(--section-y)]">
      <p className="kicker">Reference</p>
      <h1 className="type-xl mt-3">Design system</h1>

      <div className="mt-10 grid gap-8">
        <div className="card grid gap-5 p-6">
          <h2 className="type-lg">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary">btn-primary</button>
            <button type="button" className="btn-ghost">btn-ghost</button>
            <button type="button" className="btn-dark">btn-dark</button>
            <button type="button" className="btn-text">btn-text</button>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-ink-line pt-5">
            <button type="button" className="btn-primary" disabled>
              btn-primary disabled
            </button>
            <button type="button" className="btn-ghost" disabled>
              btn-ghost disabled
            </button>
            <button type="button" className="btn-primary" disabled aria-busy="true">
              <Loader2 size={17} className="animate-spin" aria-hidden />
              Loading
            </button>
          </div>
        </div>

        <div className="card grid gap-4 p-6">
          <h2 className="type-lg">Chips and stickers</h2>
          <div className="flex flex-wrap gap-3">
            <span className="chip">chip</span>
            <span className="chip-accent">chip-accent</span>
            <span className="sticker">sticker</span>
          </div>
        </div>

        <div className="card grid gap-4 p-6">
          <h2 className="type-lg">Filter pill</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="filter-pill"
              aria-pressed={filter}
              onClick={() => setFilter((f) => !f)}
            >
              {filter ? "Selected" : "Not selected"}
            </button>
          </div>
        </div>

        <div className="card grid gap-5 p-6">
          <h2 className="type-lg">Input</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="demo-input" className="text-sm font-semibold text-ink-soft">
                Example field
              </label>
              <input id="demo-input" className="input" placeholder="Type here" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="demo-error" className="text-sm font-semibold text-ink-soft">
                Field with an error
              </label>
              <input id="demo-error" className="input" defaultValue="wrong value" aria-invalid="true" aria-describedby="demo-error-msg" />
              <p id="demo-error-msg" className="text-sm" style={{ color: "var(--color-danger)" }}>
                Check this value and try again.
              </p>
            </div>
            <div className="grid gap-2">
              <label htmlFor="demo-disabled" className="text-sm font-semibold text-ink-soft">
                Disabled field
              </label>
              <input id="demo-disabled" className="input" placeholder="Not editable" disabled />
            </div>
          </div>
        </div>

        <div className="card grid gap-2 p-6">
          <h2 className="type-lg">Stat figure</h2>
          <p className="stat-figure">1,240</p>
        </div>

        <div className="grid gap-4">
          <h2 className="type-lg">Palette</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SWATCHES.map((s) => (
              <div key={s.name} className="card grid gap-3 p-4">
                <div className={`${s.className} h-16 rounded-md border border-ink-line`} />
                <p className="text-sm text-ink-soft">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
