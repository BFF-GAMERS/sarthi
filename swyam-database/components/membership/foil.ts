/**
 * The four foil accents for the membership card, and the contrast maths that keeps them readable.
 *
 * Dark ink sits on a light foil in both themes, so the card reads the same in a bright room and in the
 * dark register; only the glow around it changes. The AI picks an accent id from a closed list of four
 * and never a colour. Pure: no React, no DOM.
 */
import type { CSSProperties } from "react";
import type { AccentId } from "@/membership/config/plans";

export interface FoilTokens {
  a: string;
  b: string;
  c: string;
  /** The foil edge. */
  edge: string;
  /** Glow behind the card in the dark register. */
  glow: string;
}

export const FOIL: Readonly<Record<AccentId, FoilTokens>> = {
  MARIGOLD: {
    a: "#f8dc92",
    b: "#ebb94e",
    c: "#fbe9b8",
    edge: "#b8841c",
    glow: "rgb(235 185 78 / 0.55)",
  },
  PEACOCK: {
    a: "#c3eaec",
    b: "#80c9ce",
    c: "#d9f3f4",
    edge: "#2f8f98",
    glow: "rgb(128 201 206 / 0.5)",
  },
  RANI: {
    a: "#f9c8dc",
    b: "#ea96bb",
    c: "#fcdce9",
    edge: "#b8497a",
    glow: "rgb(234 150 187 / 0.5)",
  },
  INDIGO: {
    a: "#ccd3f6",
    b: "#9ca9e8",
    c: "#e0e5fb",
    edge: "#5062c0",
    glow: "rgb(156 169 232 / 0.5)",
  },
};

/** Text on the foil. */
export const FOIL_INK = "#1b2230";
export const FOIL_INK_SOFT = "#2c3446";

export const DEFAULT_ACCENT: AccentId = "MARIGOLD";

export const foilStyle = (accent: AccentId | null | undefined): CSSProperties => {
  const f = FOIL[accent ?? DEFAULT_ACCENT] ?? FOIL[DEFAULT_ACCENT];
  return {
    ["--foil-a" as string]: f.a,
    ["--foil-b" as string]: f.b,
    ["--foil-c" as string]: f.c,
    ["--foil-edge" as string]: f.edge,
    ["--foil-glow" as string]: f.glow,
  };
};

/* ── WCAG contrast ───────────────────────────────────────────────── */

const channel = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
