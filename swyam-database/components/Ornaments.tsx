import type { ReactNode } from "react";

/**
 * Small structural pieces shared by most pages.
 *
 * Every page opens with an eyebrow tag above its title, several carry a stat
 * row, and a few need a soft accent rule between sections. Keeping the five
 * shapes here means a page never draws its own version, and the two colour
 * registers restyle all of them through tokens alone — nothing in this file
 * reads the interface mode.
 *
 * All colour comes from the token palette. `tone` picks which hue an element
 * leans on; saffron is the default and the only one used for chrome. The
 * others are for data: a stat about verification is peacock, one about
 * money is marigold, and so on.
 */

export type Tone = "saffron" | "peacock" | "marigold" | "rani" | "indigo";

const toneVar = (t: Tone) => `var(--color-${t === "saffron" ? "saffron-500" : t})`;

/* ── Accent rule ────────────────────────────────────────────────────────
   A slim gradient bar used where a page changes subject: the top of the
   footer, the divider inside a hero panel. Quieter than a colour block,
   more deliberate than a hairline. */
export function ChevronStripe({
  className = "",
  height = 4,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      aria-hidden
      className={`w-full rounded-full ${className}`}
      style={{
        height: Math.min(height, 6),
        backgroundImage:
          "linear-gradient(90deg, var(--color-saffron-500) 0%, var(--color-saffron-300) 40%, var(--color-peacock) 100%)",
      }}
    />
  );
}

/* ── Accent panel ───────────────────────────────────────────────────────
   A card with a coloured top edge. Wraps content that deserves to stand a
   little apart from the ordinary cards around it. */
export function PaintedPanel({
  children,
  className = "",
  tone = "saffron",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light shadow-[var(--shadow-soft)] ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: toneVar(tone) }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* ── Eyebrow tag ────────────────────────────────────────────────────────
   The small label above a page title: a dot and tracked capitals inside a
   tinted pill. */
export function SloganPlate({
  children,
  tone = "saffron",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const colour = toneVar(tone);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em] ${className}`}
      style={{
        color: colour,
        borderColor: `color-mix(in srgb, ${colour} 28%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${colour} 8%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: colour }}
      />
      {children}
    </span>
  );
}

/* ── Short rule ─────────────────────────────────────────────────────────
   A short saffron bar under a heading. */
export function BlockPrintRule({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-1 w-16 rounded-full ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--color-saffron-500), var(--color-saffron-300))",
      }}
    />
  );
}

/* ── Stat ───────────────────────────────────────────────────────────────
   A figure and its label. The figure is set large in the display face
   with tabular numerals so a row of them lines up. */
export function NumberPlate({
  value,
  label,
  tone = "saffron",
}: {
  value: string | number;
  label: string;
  tone?: Tone | "ink";
}) {
  const colour = tone === "ink" ? "var(--color-ink)" : toneVar(tone);
  return (
    <div className="min-w-0">
      <span className="stat-figure block" style={{ color: colour }}>
        {value}
      </span>
      <span className="mt-1.5 block font-body text-[13px] leading-snug text-ink-mute">{label}</span>
    </div>
  );
}
