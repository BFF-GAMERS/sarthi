/**
 * स्वYAM brand lockup — text only.
 *
 * The Devanagari "स्व" and the Latin "YAM" are set as one word: two spans on a
 * single `align-items: baseline` line, so the browser aligns them on a true
 * shared baseline rather than an eyeballed vertical nudge. Devanagari renders
 * optically smaller than Latin at the same font-size, so "स्व" is scaled up a
 * touch to match the cap height of "YAM".
 *
 * There is deliberately no separate icon/mark — the wordmark *is* the logo.
 */

type Size = "sm" | "md" | "lg" | "xl" | "display";

/** Font size per slot. Tuned to sit comfortably inside a 4.5rem navbar. */
const SIZES: Record<Size, string> = {
  sm: "text-[1.0625rem]",
  md: "text-[1.3125rem] sm:text-[1.4375rem]",
  lg: "text-[1.75rem] sm:text-[2rem]",
  xl: "text-[2.5rem] sm:text-[3.25rem]",
  display: "text-[clamp(2.6rem,0.4rem+9.4vw,9rem)]",
};

export function Wordmark({
  size = "md",
  className = "",
  tone = "ink",
}: {
  size?: Size;
  className?: string;
  /** `ink` for light backgrounds, `paper` for dark blocks. */
  tone?: "ink" | "paper";
}) {
  return (
    <span
      className={`inline-flex select-none items-baseline whitespace-nowrap leading-none ${SIZES[size]} ${className}`}
    >
      <span
        className="font-devanagari font-medium text-saffron-500"
        // Devanagari x-height runs short of Latin cap height at a shared
        // font-size; 1.06em matches them without breaking the baseline.
        style={{ fontSize: "1.06em", letterSpacing: "-0.005em" }}
      >
        स्व
      </span>
      <span
        className={`font-display font-medium ${tone === "paper" ? "text-paper-light" : "text-brand-navy"}`}
        style={{ letterSpacing: "0.01em" }}
      >
        YAM
      </span>
    </span>
  );
}

/** Wordmark plus an optional tagline, for footers and auth headers. */
export function Brand({
  size = "md",
  tagline,
  tone = "ink",
  className = "",
}: {
  size?: Size;
  tagline?: string;
  tone?: "ink" | "paper";
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <Wordmark size={size} tone={tone} />
      {tagline && (
        <span className="mt-1 font-body text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
          {tagline}
        </span>
      )}
    </span>
  );
}
