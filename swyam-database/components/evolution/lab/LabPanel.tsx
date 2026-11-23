/**
 * Shared Lab building blocks: a titled panel and a labelled meter.
 * The meter animates with transform: scaleX (never width) so a streaming persona
 * stays on the compositor; reduced motion still updates the value, just instantly.
 */
import type { ReactNode } from "react";

export function LabPanel({
  id,
  title,
  hint,
  right,
  className = "",
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`lab-${id}`}
      data-lab-panel={id}
      className={`rounded-[var(--radius-card)] border border-ink-line bg-paper-light p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`lab-${id}`} className="font-display text-xl tracking-tight text-ink">
            {title}
          </h2>
          {hint ? (
            <p className="mt-1 font-body text-[13px] leading-relaxed text-ink-soft">{hint}</p>
          ) : null}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Meter({
  label,
  value,
  valueText,
}: {
  label: string;
  /** 0..1 */
  value: number;
  valueText?: string;
}) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const pct = Math.round(v * 100);
  return (
    <div className="font-body">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-ink">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-ink-soft">
          {valueText ?? `${pct}%`}
        </span>
      </div>
      <div
        className="evo-meter mt-1.5"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="evo-meter__fill" style={{ transform: `scaleX(${v})` }} />
      </div>
    </div>
  );
}

/** A small label chip. */
export function Chip({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "key";
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2 font-mono text-[10.5px] font-semibold uppercase tracking-wide ${
        tone === "key" ? "bg-saffron-50 text-saffron-700" : "bg-paper-deep text-ink-soft"
      }`}
    >
      {children}
    </span>
  );
}
