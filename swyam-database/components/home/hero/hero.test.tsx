// Hero Cockpit contracts: the per-state tables are complete, the visuals render on the server without a
// transform, and the stylesheet gates every state-dependent hero part until the store hydrates.
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* The real hook needs the Supabase-backed preferences provider; the hero only asks it to translate. */
vi.mock("@/lib/i18n", () => ({
  useTx: () => (s: string) => s,
  useT: () => (k: string) => k,
}));
import { Reveal, ScaleImage, Stagger, StaggerItem } from "@/components/Reveal";
import { EVOLUTION_STATES } from "@/evolution/config/ids";
import { NAV_REGISTRY, hrefFor } from "@/evolution/config/navigation";
import type { EvolutionState } from "@/evolution/types";
import { HEADLINES, HERO_GATED_PARTS, HERO_VISUAL, LEAD_STRIPS, WATCH_ADAPT_HREF } from "./model";
import HeroVisual, { VISUALS } from "./Visuals";

const read = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), "utf8")
    .split("\r\n")
    .join("\n");
const uiCss = read("../../../styles/evo-ui.css");
const homeCss = read("../../../styles/evo-home.css");
const heroSource = read("../HeroSection.tsx");
const heroParts = heroSource + read("./LeadStrip.tsx");

const LEARNED = EVOLUTION_STATES.filter((s) => s !== "UNIVERSAL") as EvolutionState[];

describe("per-state tables", () => {
  it("every engine state has a visual, and every visual kind has a component", () => {
    for (const s of EVOLUTION_STATES) {
      const kind = HERO_VISUAL[s];
      expect(kind, s).toBeTruthy();
      expect(VISUALS[kind], `${s} -> ${kind}`).toBeTypeOf("function");
    }
    expect(Object.keys(HERO_VISUAL).sort()).toEqual([...EVOLUTION_STATES].sort());
  });

  it("the four named domains each get their own visual, UNIVERSAL keeps the plate", () => {
    expect(HERO_VISUAL.UNIVERSAL).toBe("plate");
    const own = new Set([
      HERO_VISUAL.CAREER_FIRST,
      HERO_VISUAL.LEARNING_FIRST,
      HERO_VISUAL.SKILL_EXCHANGE_FIRST,
      HERO_VISUAL.COMMUNITY_FIRST,
    ]);
    expect(own.size).toBe(4);
    expect(own.has("plate")).toBe(false);
  });

  it("every learned state has its own headline pair; UNIVERSAL keeps the dictionary one", () => {
    expect(HEADLINES.UNIVERSAL).toBeNull();
    const seen = new Set<string>();
    for (const s of LEARNED) {
      const h = HEADLINES[s];
      expect(h, s).not.toBeNull();
      expect(h!.first.length).toBeLessThanOrEqual(16);
      expect(h!.second.length).toBeLessThanOrEqual(16);
      seen.add(`${h!.first}|${h!.second}`);
    }
    expect(seen.size).toBe(LEARNED.length);
  });

  it("every learned state has a three-item lead strip of real, reachable destinations", () => {
    expect(LEAD_STRIPS.UNIVERSAL).toEqual([]);
    for (const s of LEARNED) {
      const items = LEAD_STRIPS[s];
      expect(items, s).toHaveLength(3);
      for (const it of items) {
        expect(NAV_REGISTRY[it.nav], `${s}/${it.nav}`).toBeTruthy();
        expect(hrefFor(it.nav, false)).toMatch(/^\//);
        expect(hrefFor(it.nav, true)).toMatch(/^\//);
      }
      expect(new Set(items.map((i) => i.nav)).size).toBe(3);
    }
  });

  it("career leads with Jobs, Internships, Applications", () => {
    expect(LEAD_STRIPS.CAREER_FIRST.map((i) => i.label)).toEqual([
      "Jobs",
      "Internships",
      "Applications",
    ]);
  });

  it("the Lab link plays the career persona", () => {
    expect(WATCH_ADAPT_HREF).toBe("/lab?play=career");
  });
});

describe("server markup", () => {
  it("every state's visual renders as one labelled image with no inline transform", () => {
    for (const s of EVOLUTION_STATES) {
      const html = renderToString(<HeroVisual state={s} featured={null} />);
      expect(html, s).toContain('role="img"');
      expect(html, s).toContain("aria-label=");
      expect(html, s).not.toMatch(/transform:\s*(translate|scale)/);
    }
  });

  it("different states render different visuals", () => {
    const html = (s: EvolutionState) => renderToString(<HeroVisual state={s} featured={null} />);
    const all = new Set(EVOLUTION_STATES.map(html));
    expect(all.size).toBe(EVOLUTION_STATES.length);
  });

  it("a real recent opening replaces the sample title in the career ticket", () => {
    const html = renderToString(
      <HeroVisual state="CAREER_FIRST" featured={{ title: "Wiring helper", sub: "Acme Power" }} />,
    );
    expect(html).toContain("Wiring helper");
    expect(html).toContain("Acme Power");
  });

  it("reveals emit no transform (reduced motion cannot mismatch): the offset is CSS", () => {
    const html = renderToString(
      <>
        <Reveal y={40} delay={0.2}>
          a
        </Reveal>
        <Stagger>
          <StaggerItem>b</StaggerItem>
        </Stagger>
        <ScaleImage src="/x.png" alt="x" />
      </>,
    );
    expect(html).not.toMatch(/transform:/);
    expect(html).not.toMatch(/translate/);
    expect(html).toContain("rv");
    expect(html).toContain("--rv-y:40px");
  });
});

describe("no-flash gate (evo-ui.css)", () => {
  const gate = uiCss.slice(
    uiCss.indexOf('html[data-evo-state]:not([data-evo-state="UNIVERSAL"])\n  [data-evo-hero]'),
  );
  const rule = gate.slice(0, gate.indexOf("}") + 1);

  it("hides the hero's state-dependent parts while data-evo-state is not UNIVERSAL and the store is cold", () => {
    expect(rule).toContain('html[data-evo-state]:not([data-evo-state="UNIVERSAL"])');
    expect(rule).toContain("[data-evo-hero]:not([data-hydrated])");
    expect(rule).toContain("visibility: hidden");
    for (const part of HERO_GATED_PARTS) expect(rule, part).toContain(`.${part}`);
    expect(rule).toContain(".evo-chip");
  });

  it("can hide but never strand: it releases after 2.5 s", () => {
    expect(rule).toContain("evo-gate-open 0s linear 2.5s forwards");
  });

  it("the markup carries the gate hooks: data-evo-hero, data-hydrated and every gated class", () => {
    expect(heroSource).toContain("data-evo-hero");
    expect(heroSource).toMatch(/data-hydrated=\{hydrated/);
    for (const part of HERO_GATED_PARTS) expect(heroParts, part).toContain(part);
  });

  it("reserves the lede height and the title lines, so the search bar never moves", () => {
    expect(homeCss).toMatch(/\.hero-lede\s*\{\s*height:\s*3\.15rem/);
    expect(homeCss).toMatch(/\.hero-title-pair\s*\{\s*min-height:\s*1\.96em/);
  });

  it("the 150 ms fade is the only entrance a learned state gets", () => {
    expect(uiCss).toMatch(/\.hero-fade\s*\{\s*animation:\s*hero-fade-in 0\.15s/);
  });
});

describe("reduced-motion hydration", () => {
  it("entrances only exist under html[data-motion=full], never in the markup", () => {
    const rises = uiCss.match(/[^\n]*\.hero-rise[^\n]*\{/g) ?? [];
    expect(rises.length).toBeGreaterThan(0);
    for (const r of rises) expect(r).toContain('html[data-motion="full"]');
    expect(heroSource).not.toMatch(/useReducedMotion|useSkipAnimation|matchMedia/);
    expect(heroSource).not.toMatch(/initial=\{/);
  });

  it("the parallax is cancelled by CSS under reduced motion", () => {
    expect(uiCss).toMatch(/html\[data-motion="reduced"\] :is\(\.hero-parallax, \.rv-parallax\)/);
  });
});

describe("compact phone cockpit (evo-home.css)", () => {
  it("folds stats and try-chips into one 44 px strip below 640 px", () => {
    const phone = homeCss.slice(homeCss.indexOf("Phone, learned state"));
    expect(phone).toContain("max-width: 639.98px");
    expect(phone).toMatch(/\.hero-try,[\s\S]*?\.hero-stats[\s\S]*?display:\s*none/);
    expect(phone).toMatch(/\.hero-strip\s*\{[^}]*height:\s*2\.75rem/);
  });
});
