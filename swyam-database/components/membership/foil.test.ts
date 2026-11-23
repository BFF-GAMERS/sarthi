import { describe, expect, it } from "vitest";
import { ACCENT_IDS } from "@/membership/config/plans";
import { FOIL, FOIL_INK, FOIL_INK_SOFT, contrast, foilStyle } from "./foil";

const HEX = /^#[0-9a-f]{6}$/i;

describe("the foil accents", () => {
  it("has exactly the four accents the AI may pick from", () => {
    expect(Object.keys(FOIL).sort()).toEqual([...ACCENT_IDS].sort());
  });

  it.each(ACCENT_IDS)("%s: dark ink on every foil stop is at least 4.5:1", (id) => {
    for (const stop of [FOIL[id].a, FOIL[id].b, FOIL[id].c]) {
      expect(stop).toMatch(HEX);
      expect(contrast(FOIL_INK, stop), `${id} ${stop} ink`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(FOIL_INK_SOFT, stop), `${id} ${stop} soft ink`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the Demo ribbon text is readable on its ink pill", () => {
    expect(contrast("#fdf3d4", FOIL_INK)).toBeGreaterThanOrEqual(4.5);
  });

  it("the style sets one custom property per token and falls back to marigold", () => {
    const s = foilStyle("RANI") as Record<string, string>;
    expect(s["--foil-b"]).toBe(FOIL.RANI.b);
    expect((foilStyle(null) as Record<string, string>)["--foil-a"]).toBe(FOIL.MARIGOLD.a);
  });

  it("contrast maths matches known values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#ffffff")).toBeGreaterThan(4.4);
  });
});
