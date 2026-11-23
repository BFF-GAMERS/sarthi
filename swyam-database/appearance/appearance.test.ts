import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PREFERENCES_BOOTSTRAP_SCRIPT } from "../context/PreferencesContext";
import {
  liteReasonOf,
  resolveAppearance,
  toAppearanceId,
  type AppearanceSignals,
} from "./registry";

const calm: AppearanceSignals = {
  deviceMemory: 8,
  hardwareConcurrency: 8,
  reducedTransparency: false,
  moreContrast: false,
  highContrastSetting: false,
  fxLightened: false,
};

describe("appearance fallback", () => {
  it("unknown stored values mean Classic", () => {
    expect(toAppearanceId("glass")).toBe("glass");
    expect(toAppearanceId("neon")).toBe("classic");
    expect(toAppearanceId(undefined)).toBe("classic");
  });

  it("a capable device shows what was chosen", () => {
    expect(resolveAppearance("glass", calm)).toEqual({ effective: "glass", reason: null });
    expect(
      resolveAppearance("metal", { ...calm, deviceMemory: 4, hardwareConcurrency: 4 }).effective,
    ).toBe("metal");
    // Safari and Firefox do not report memory: unknown is not low.
    expect(
      resolveAppearance("glass", {
        ...calm,
        deviceMemory: undefined,
        hardwareConcurrency: undefined,
      }).effective,
    ).toBe("glass");
  });

  it.each([
    ["low memory", { deviceMemory: 2 }, "low-memory"],
    ["very low memory", { deviceMemory: 0.5 }, "low-memory"],
    ["two cores", { hardwareConcurrency: 2 }, "few-cores"],
    ["one core", { hardwareConcurrency: 1 }, "few-cores"],
    ["reduced transparency", { reducedTransparency: true }, "reduced-transparency"],
    ["more contrast", { moreContrast: true }, "more-contrast"],
    ["in-app High contrast", { highContrastSetting: true }, "high-contrast-setting"],
    ["Frame-Budget lite", { fxLightened: true }, "frame-budget"],
  ] as const)("%s falls back to classic-lite", (_name, patch, reason) => {
    for (const style of ["glass", "metal"] as const) {
      expect(resolveAppearance(style, { ...calm, ...patch })).toEqual({
        effective: "classic-lite",
        reason,
      });
    }
  });

  it("Classic is never changed by the device", () => {
    const worst = {
      ...calm,
      deviceMemory: 1,
      hardwareConcurrency: 1,
      reducedTransparency: true,
      moreContrast: true,
      fxLightened: true,
    };
    expect(resolveAppearance("classic", worst)).toEqual({ effective: "classic", reason: null });
  });

  it("what the person asked for outranks what was measured", () => {
    expect(
      liteReasonOf({ ...calm, deviceMemory: 1, fxLightened: true, reducedTransparency: true }),
    ).toBe("reduced-transparency");
  });
});

// ── pre-paint script ────────────────────────────────────────────────────────────────────────────────────

function prePaint(
  stored: Record<string, unknown> | null,
  nav: Record<string, unknown> = {},
  media: string[] = [],
) {
  const dataset: Record<string, string> = {};
  const store: Record<string, string> = stored
    ? { "swayam-preferences": JSON.stringify(stored) }
    : {};
  const doc = { documentElement: { dataset, style: { setProperty() {} }, lang: "", dir: "" } };
  const win = { matchMedia: (q: string) => ({ matches: media.some((m) => q.includes(m)) }) };
  const ls = { getItem: (k: string) => store[k] ?? null };
  new Function("document", "localStorage", "window", "navigator", PREFERENCES_BOOTSTRAP_SCRIPT)(
    doc,
    ls,
    win,
    nav,
  );
  return dataset;
}

describe("appearance before first paint", () => {
  it("defaults to Classic, never flat-flagged", () => {
    const d = prePaint(null, { deviceMemory: 1, hardwareConcurrency: 1 });
    expect(d["appearance"]).toBe("classic");
    expect(d["appearanceLite"]).toBeUndefined();
  });

  it("applies the saved style and flags the fallback from the same signals", () => {
    expect(
      prePaint({ appearance: "glass" }, { deviceMemory: 8, hardwareConcurrency: 8 })[
        "appearanceLite"
      ],
    ).toBeUndefined();
    expect(
      prePaint({ appearance: "glass" }, { deviceMemory: 8, hardwareConcurrency: 8 })["appearance"],
    ).toBe("glass");
    expect(prePaint({ appearance: "metal" }, { deviceMemory: 2 })["appearanceLite"]).toBe("1");
    expect(prePaint({ appearance: "metal" }, { hardwareConcurrency: 2 })["appearanceLite"]).toBe(
      "1",
    );
    expect(
      prePaint({ appearance: "glass" }, {}, ["prefers-reduced-transparency"])["appearanceLite"],
    ).toBe("1");
    expect(prePaint({ appearance: "glass" }, {}, ["prefers-contrast"])["appearanceLite"]).toBe("1");
    expect(prePaint({ appearance: "glass", highContrast: true })["appearanceLite"]).toBe("1");
    expect(prePaint({ appearance: "bogus" })["appearance"]).toBe("classic");
  });
});

// ── contrast ────────────────────────────────────────────────────────────────────────────────────────────

type RGB = [number, number, number];
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** "#rgb", "#rrggbb", "rgb(r g b / a)" or "rgb(r g b)" to [r, g, b, a]. */
function parseColor(v: string): [number, number, number, number] {
  const s = v.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  throw new Error(`cannot parse colour: ${v}`);
}
const over = (fg: [number, number, number, number], bg: RGB): RGB =>
  [0, 1, 2].map((i) => Math.round(fg[i]! * fg[3] + bg[i]! * (1 - fg[3]))) as RGB;

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\r/g, "");
const css = read("../styles/evo-appearance.css");
const rule = (source: string, selectorStart: string): string => {
  const i = source.indexOf(selectorStart);
  if (i < 0) throw new Error(`rule not found: ${selectorStart}`);
  const open = source.indexOf("{", i);
  return source.slice(open + 1, source.indexOf("}", open));
};
const token = (body: string, name: string): string => {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(body);
  if (!m) throw new Error(`token not found: ${name}`);
  return m[1]!.trim();
};

const STYLES = ["classic", "glass", "metal"] as const;
const MODES = [
  ["light", (id: string) => `html[data-appearance="${id}"],`],
  ["dark", (id: string) => `html[data-appearance="${id}"][data-mode="genz"],`],
] as const;

describe("appearance tokens: every type pair is at least 4.5:1", () => {
  for (const id of STYLES) {
    for (const [modeName, selector] of MODES) {
      it(`${id} / ${modeName}`, () => {
        const body = rule(css, selector(id));
        const surfaces = ["--ap-surface", "--ap-surface-2"].map((n) => parseColor(token(body, n)));
        const texts = ["--ap-text", "--ap-text-soft", "--ap-text-mute"].map((n) =>
          parseColor(token(body, n)),
        );
        // The brightest white the sheen can add, from the largest alpha of its white stops.
        const sheen = token(body, "--ap-sheen");
        const peak = Math.max(
          0,
          ...[...sheen.matchAll(/rgb\(255 255 255 \/ ([\d.]+)\)/g)].map((x) => Number(x[1])),
        );
        // Translucent fills are judged over the two extremes the backdrop could be.
        const backdrops: RGB[] = [
          [255, 255, 255],
          [0, 0, 0],
        ];
        let worst = Infinity;
        for (const s of surfaces) {
          for (const bd of backdrops) {
            const base = over(s, bd);
            const lit = over([255, 255, 255, peak], base);
            for (const t of texts) {
              for (const fill of [base, lit]) worst = Math.min(worst, ratio(over(t, fill), fill));
            }
          }
        }
        expect(worst).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("glass tints are opaque enough to carry type over an unknown backdrop", () => {
    for (const [, selector] of MODES) {
      const body = rule(css, selector("glass"));
      for (const n of ["--ap-surface", "--ap-surface-2"])
        expect(parseColor(token(body, n))[3]).toBeGreaterThanOrEqual(0.84);
    }
  });
});

describe("dark register: .bg-ink / .ink-block keep light, readable type", () => {
  const styles = read("../styles.css");
  const flip = rule(styles, '[data-mode="genz"] .bg-ink {\n  --color-paper-light');
  const paperLight = parseColor(token(flip, "--color-paper-light")); // text-paper-light
  const paper = parseColor(token(flip, "--color-paper")); // text-paper
  const white: [number, number, number, number] = [255, 255, 255, 1];
  const fills = {
    ".bg-ink": parseColor(
      token(rule(styles, '[data-mode="genz"] .bg-ink:not(:empty):is('), "background-color"),
    ),
    ".ink-block": parseColor(
      token(
        rule(styles, '[data-mode="genz"] .ink-block {\n  background-color'),
        "background-color",
      ),
    ),
  };

  for (const [name, fill] of Object.entries(fills)) {
    const bg: RGB = [fill[0], fill[1], fill[2]];
    it(`${name}: text-paper-light, text-paper and text-white are at least 4.5:1`, () => {
      for (const t of [paperLight, paper, white])
        expect(ratio([t[0], t[1], t[2]], bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: 60% type (text-paper-light/60) is at least 4.5:1`, () => {
      expect(
        ratio(over([paperLight[0], paperLight[1], paperLight[2], 0.6], bg), bg),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the saffron hover state keeps dark type above 4.5:1", () => {
    expect(ratio([0x14, 0x16, 0x1f], [0xf0, 0x5a, 0x22])).toBeGreaterThanOrEqual(4.5);
  });

  it("the old failure is gone: the fill is no longer the flipped near-white", () => {
    const fill = fills[".bg-ink"];
    expect(
      ratio([paperLight[0], paperLight[1], paperLight[2]], [fill[0], fill[1], fill[2]]),
    ).toBeGreaterThan(10);
  });
});
