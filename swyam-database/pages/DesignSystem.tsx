import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Clock, Loader2, Target } from "lucide-react";
import { SloganPlate, BlockPrintRule } from "../components/Ornaments";
import Media from "../components/Media";
import { useToast } from "../components/Toast";
import { usePreferences } from "../context/PreferencesContext";

/**
 * The design system, on one page.
 *
 * Not decoration and not a portfolio piece: it is the only place where the
 * whole visual language can be seen at once, which is the only way to notice
 * that a page has four kinds of card, three greys that are nearly the same,
 * and a disabled state nobody drew. Everything on this page is a specimen —
 * the words are labels, not content — and every token is read live from the
 * stylesheet, so this page cannot drift from the product the way a picture
 * of a design system does.
 *
 * It is noindex, and it is linked from nowhere in the product.
 */
export default function DesignSystem() {
  const toast = useToast();
  const { prefs, set } = usePreferences();
  const [busy, setBusy] = useState(false);

  return (
    <div className="container-x max-w-5xl pb-24 pt-32">
      <SloganPlate tone="peacock">Design system</SloganPlate>
      <h1 className="section-title mt-4">One page, every decision</h1>
      <BlockPrintRule className="mt-5" />
      <p className="mt-5 max-w-2xl font-body text-[15px] leading-relaxed text-ink-soft">
        Specimens, not data. Every color, size and radius below is read from the live stylesheet, so
        what is on this page is what is on every other one. Switch the register and the theme in the
        controls to see both halves of the system.
      </p>

      {/* The two registers, side by side with the real switch. */}
      <div className="quiet mt-6 flex flex-wrap items-center gap-3 p-4">
        <span className="datum">Register</span>
        {(["millennial", "genz"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => set("interfaceMode", m)}
            className={`filter-pill !h-9 ${prefs.interfaceMode === m ? "!bg-ink !text-paper" : ""}`}
          >
            {m === "genz" ? "Gen Z (dark)" : "Millennial (light)"}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => set("highContrast", !prefs.highContrast)}
          className={`filter-pill !h-9 ${prefs.highContrast ? "!bg-ink !text-paper" : ""}`}
        >
          High contrast
        </button>
      </div>

      {/* ── Colour ── */}
      <Section title="Color" note="Ink on paper, one accent, and four tones that mean something.">
        <SwatchRow
          label="Paper — the surfaces, lightest to deepest"
          tokens={[
            "--color-paper",
            "--color-paper-light",
            "--color-paper-dim",
            "--color-paper-deep",
          ]}
        />
        <SwatchRow
          label="Ink — text, in three weights, plus the hairline"
          tokens={["--color-ink", "--color-ink-soft", "--color-ink-mute", "--color-ink-line"]}
        />
        <SwatchRow
          label="Saffron — the one accent. 500 is the action color"
          tokens={[
            "--color-saffron-50",
            "--color-saffron-300",
            "--color-saffron-500",
            "--color-saffron-600",
          ]}
        />
        <SwatchRow
          label="Meaning — never used for decoration"
          tokens={["--color-emeraldx-400", "--color-peacock", "--color-marigold", "--color-rani"]}
        />
        <p className="mt-4 font-body text-[12.5px] leading-relaxed text-ink-mute">
          Status is never color alone: a verified badge carries a tick and the word, an error
          carries an icon and a sentence, a “focus” subject is labeled, not just tinted.
        </p>
      </Section>

      {/* ── Type ── */}
      <Section title="Type" note="Two families. Display for headings, body for everything read.">
        <div className="space-y-5">
          <Specimen label="section-title · Bricolage Grotesque">
            <p className="section-title">Learn a skill. Prove it.</p>
          </Specimen>
          <Specimen label="type-lede · the one paragraph under a heading">
            <p className="type-lede max-w-xl">
              Forty courses, half of them free, every one ending in an assessment.
            </p>
          </Specimen>
          <Specimen label="body 14.5px · everything anybody actually reads">
            <p className="max-w-xl font-body text-[14.5px] leading-relaxed text-ink-soft">
              Set in Instrument Sans at a 1.7 line height, capped near sixty-five characters,
              because a line a reader loses their place in is a line they stop reading.
            </p>
          </Specimen>
          <Specimen label="datum · the small label above a value">
            <p className="datum">Last updated</p>
          </Specimen>
          <Specimen label="mono, tabular · every figure that is compared">
            <p className="font-mono text-[15px] tabular-nums text-ink">12 / 40 · ₹18,000 · 72%</p>
          </Specimen>
        </div>
      </Section>

      {/* ── Space and shape ── */}
      <Section title="Space and shape" note="One rhythm, three steps. One radius, three sizes.">
        <div className="flex flex-wrap items-end gap-6">
          {[
            { label: "inside a section", v: "1rem" },
            { label: "between sections", v: "2rem" },
            { label: "between chapters", v: "3.5rem" },
          ].map((s) => (
            <div key={s.label}>
              <div className="bg-saffron-300" style={{ width: 48, height: s.v }} />
              <p className="mt-2 font-mono text-[11px] text-ink-mute">{s.v}</p>
              <p className="font-body text-[12px] text-ink-soft">{s.label}</p>
            </div>
          ))}
          <div className="flex items-end gap-4">
            {[
              { label: "control", cls: "rounded-[var(--radius-control)]" },
              { label: "card", cls: "rounded-[var(--radius-card)]" },
              { label: "pill", cls: "rounded-[var(--radius-pill)]" },
            ].map((r) => (
              <div key={r.label}>
                <div className={`h-12 w-16 border border-ink-line bg-paper-light ${r.cls}`} />
                <p className="mt-2 font-body text-[12px] text-ink-soft">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Controls, in every state ── */}
      <Section
        title="Controls"
        note="Every state drawn on purpose, including the ones nobody likes."
      >
        <div className="space-y-5">
          <Specimen label="Primary — one per screen">
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary">
                Enroll now <ArrowRight size={15} aria-hidden />
              </button>
              <button className="btn-primary" disabled>
                Disabled
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setBusy(true);
                  window.setTimeout(() => setBusy(false), 1400);
                }}
              >
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
                {busy ? "Working…" : "Press for the loading state"}
              </button>
            </div>
          </Specimen>
          <Specimen label="Secondary and text">
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-ghost">Compare</button>
              <button className="btn-ghost" disabled>
                Disabled
              </button>
              <button className="btn-text">Clear all</button>
            </div>
          </Specimen>
          <Specimen label="Pills and chips — filters, and facts">
            <div className="flex flex-wrap items-center gap-2">
              <button className="filter-pill">Free</button>
              <button className="filter-pill !bg-ink !text-paper">
                <Check size={13} aria-hidden /> Selected
              </button>
              <span className="chip">Beginner</span>
              <span className="chip-accent">Free</span>
              <span className="sticker">No fee</span>
            </div>
          </Specimen>
          <Specimen label="Input — rest, focus, error, disabled">
            <div className="grid max-w-lg gap-3 sm:grid-cols-2">
              <input className="input" placeholder="Rest" />
              <input className="input" placeholder="Disabled" disabled />
              <div>
                <label htmlFor="ds-error" className="sr-only">
                  A field with an error
                </label>
                <input
                  id="ds-error"
                  className="input border-danger"
                  placeholder="Error"
                  aria-invalid="true"
                  aria-describedby="ds-err"
                />
                <p id="ds-err" className="mt-1 font-body text-[12px] text-danger">
                  Says what is wrong and how to fix it.
                </p>
              </div>
              <select className="input" aria-label="A select, for comparison">
                <option>Select</option>
              </select>
            </div>
          </Specimen>
          <Specimen label="Feedback — every action ends in one of these">
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-ghost !py-2 !text-xs"
                onClick={() =>
                  toast({
                    title: "Saved — Plumbing Technician",
                    action: { label: "See saved", to: "/saved" },
                  })
                }
              >
                Success toast
              </button>
              <button
                className="btn-ghost !py-2 !text-xs"
                onClick={() =>
                  toast({ tone: "info", title: "Sign in to save this", body: "It is free." })
                }
              >
                Info toast
              </button>
              <button
                className="btn-ghost !py-2 !text-xs"
                onClick={() =>
                  toast({
                    tone: "bad",
                    title: "That did not save",
                    body: "Check the connection and try again.",
                  })
                }
              >
                Error toast
              </button>
            </div>
          </Specimen>
        </div>
      </Section>

      {/* ── Surfaces ── */}
      <Section title="Surfaces" note="Two levels, and a third that is only a tint.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="font-body text-[14px] font-semibold text-ink">Card</p>
            <p className="mt-1 font-body text-[12.5px] leading-relaxed text-ink-mute">
              A hairline at rest. The shadow is the hover, because a shadow means “this one, now”.
            </p>
          </div>
          <div className="quiet p-5">
            <p className="font-body text-[14px] font-semibold text-ink">Quiet</p>
            <p className="mt-1 font-body text-[12.5px] leading-relaxed text-ink-mute">
              A tint, no border. For a question or a note that is not a module of its own.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-ink-line p-5 text-center">
            <p className="font-body text-[14px] font-semibold text-ink">Empty state</p>
            <p className="mt-1 font-body text-[12.5px] leading-relaxed text-ink-mute">
              Dashed, and it always names the next action rather than the absence.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Loading ── */}
      <Section
        title="Waiting"
        note="A placeholder that keeps the page's shape tells people it is loading, not broken."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Media src={null} ratio="16 / 10" className="rounded-xl" />
            <p className="mt-2 font-body text-[12px] text-ink-mute">Picture, before it lands</p>
          </div>
          <div className="card p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-paper-deep" />
            <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-paper-deep" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-paper-deep" />
            <p className="mt-3 font-body text-[12px] text-ink-mute">
              Skeleton, shaped like its card
            </p>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-body text-[13px] text-ink">Course progress</span>
              <span className="font-mono text-[12px] tabular-nums text-ink">72%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-deep"
              role="progressbar"
              aria-label="Course progress"
              aria-valuenow={72}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span className="block h-full w-[72%] rounded-full bg-saffron-500" />
            </div>
            <p className="mt-3 font-body text-[12px] text-ink-mute">
              Progress, always with its number
            </p>
          </div>
        </div>
      </Section>

      {/* ── The one composed thing ── */}
      <Section title="Next best action" note="The only card on a dashboard with a primary button.">
        <div className="overflow-hidden rounded-[var(--radius)] border border-ink-line bg-paper-light">
          <div className="p-6">
            <p className="datum flex items-center gap-1.5">
              <Target size={12} className="text-saffron-500" aria-hidden /> Do this next
            </p>
            <h3 className="mt-3 font-display text-2xl leading-tight tracking-tight text-ink">
              Specimen: the title is the action, in the imperative
            </h3>
            <p className="mt-2 max-w-xl font-body text-[14.5px] leading-relaxed text-ink-soft">
              One line saying what it changes — never “complete your profile”, always what
              completing it does.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="btn-primary !py-3">
                One destination <ArrowRight size={16} aria-hidden />
              </span>
              <span className="inline-flex items-center gap-1.5 font-body text-[12.5px] text-ink-mute">
                <Clock size={13} aria-hidden /> about 6 min
              </span>
            </div>
          </div>
          <div className="border-t border-ink-line bg-paper-dim/40 px-6 py-4">
            <p className="datum">After that</p>
            <p className="mt-1.5 font-body text-[13.5px] text-ink">
              Quiet, and never more than three.
            </p>
          </div>
        </div>
      </Section>

      <p className="mt-12 font-body text-[12.5px] text-ink-mute">
        Not linked from the product.{" "}
        <Link to="/trust" className="text-saffron-600 underline">
          The trust center
        </Link>{" "}
        is the page that explains the product’s claims; this one explains its parts.
      </p>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-line pb-2.5">
        <h2 className="font-display text-[1.35rem] tracking-tight text-ink">{title}</h2>
        <p className="font-body text-[12.5px] text-ink-mute">{note}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <p className="font-mono text-[11px] leading-relaxed text-ink-mute">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Swatches read live from the stylesheet, so they cannot go stale. */
function SwatchRow({ label, tokens }: { label: string; tokens: string[] }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="font-body text-[12.5px] text-ink-soft">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tokens.map((t) => (
          <div key={t} className="w-[10.5rem]">
            <div
              className="h-14 rounded-xl border border-ink-line"
              style={{ backgroundColor: `var(${t})` }}
            />
            <p className="mt-1.5 truncate font-mono text-[10.5px] text-ink-mute">
              {t.replace("--color-", "")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
