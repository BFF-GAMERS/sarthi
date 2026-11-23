import { useId } from "react";
/**
 * Textile motifs, redrawn as industrial geometry.
 *
 * Jaali — the pierced stone screen of Mughal architecture — becomes a hard
 * lattice of rotated squares on a strict grid. Ikat — the resist-dye weave
 * whose edges famously "feather" — becomes a squared-off chevron with a
 * ghosted second pass standing in for the blur.
 *
 * Both render as tiled SVG <pattern> fills that take `currentColor`, so a
 * parent's text colour drives them. Decorative only: always aria-hidden.
 */

type PatternProps = {
  className?: string;
  /** Tile size in px. Larger reads as architecture, smaller as texture. */
  scale?: number;
  opacity?: number;
};

/**
 * A pattern id that survives hydration.
 *
 * This was a module-level counter. The server renders the page once and gets
 * `ikat-2`; the browser mounts a different set of components on the way to the
 * same tree and gets `ikat-4`, so React found the id and the `fill="url(#…)"`
 * that references it both changed, and logged a hydration mismatch on every
 * page carrying a pattern. `useId` is React's answer to exactly this: the same
 * value on both sides, unique per instance.
 */
const usePatternId = (prefix: string) => `${prefix}-${useId().replace(/:/g, "")}`;

/** Pierced lattice screen — rotated squares in a ruled grid. */
export function JaaliPattern({ className, scale = 56, opacity = 0.16 }: PatternProps) {
  const id = usePatternId("jaali");
  return (
    <svg
      aria-hidden
      className={className}
      width="100%"
      height="100%"
      style={{ opacity }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={id} width={scale} height={scale} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.25">
            {/* Outer diamond — the pierced opening */}
            <path
              d={`M${scale / 2} 2 L${scale - 2} ${scale / 2} L${scale / 2} ${scale - 2} L2 ${scale / 2} Z`}
            />
            {/* Inner diamond — the stone web */}
            <path
              d={`M${scale / 2} ${scale * 0.3} L${scale * 0.7} ${scale / 2} L${scale / 2} ${scale * 0.7} L${scale * 0.3} ${scale / 2} Z`}
            />
            {/* Frame rule */}
            <path d={`M0 0 H${scale} V${scale} H0 Z`} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Resist-dye chevron — hard edge over a ghosted offset pass. */
export function IkatPattern({ className, scale = 48, opacity = 0.14 }: PatternProps) {
  const id = usePatternId("ikat");
  const h = scale * 0.6;
  return (
    <svg
      aria-hidden
      className={className}
      width="100%"
      height="100%"
      style={{ opacity }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={id} width={scale} height={h} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d={`M0 ${h * 0.75} L${scale * 0.25} ${h * 0.25} L${scale * 0.5} ${h * 0.75} L${scale * 0.75} ${h * 0.25} L${scale} ${h * 0.75}`}
            />
            <path
              d={`M0 ${h} L${scale * 0.25} ${h * 0.5} L${scale * 0.5} ${h} L${scale * 0.75} ${h * 0.5} L${scale} ${h}`}
              opacity="0.45"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
