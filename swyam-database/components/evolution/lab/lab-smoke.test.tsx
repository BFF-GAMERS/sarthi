import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/CountUp", () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

import EvolutionLab from "@/pages/EvolutionLab";
import EvolutionCompare from "@/pages/EvolutionCompare";
import DemoBanner from "./DemoBanner";

describe("Lab smoke (stub runtime, server render)", () => {
  it("/lab renders every panel from the universal snapshot", () => {
    const html = renderToString(<EvolutionLab />);
    for (const id of [
      "pattern",
      "controls",
      "behaviour",
      "traits",
      "personas",
      "ai",
      "structure",
      "history",
      "before-after",
    ]) {
      expect(html).toContain(`data-lab-panel="${id}"`);
    }
    expect(html).toContain("Run AI analysis");
    expect(html).toContain("Reset Behavior");
    expect(html).toContain("Replay Evolution");
    expect(html).toContain("Exit demo");
    for (const label of [
      "Learning Explorer",
      "Career Seeker",
      "Skill Builder",
      "Community Explorer",
      "Fast User",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("/lab opens on the picker and a live before/after, ahead of the detail panels", () => {
    const html = renderToString(<EvolutionLab />);
    const at = (needle: string) => html.indexOf(needle);
    expect(at('data-lab-panel="personas"')).toBeGreaterThan(-1);
    expect(at('data-lab-panel="personas"')).toBeLessThan(at('data-lab-panel="before-after"'));
    expect(at('data-lab-panel="before-after"')).toBeLessThan(at('data-lab-panel="pattern"'));
    expect(html).toContain('data-lab="before"');
    expect(html).toContain('data-lab="after"');
    expect(html).toContain('aria-label="Evolution tier"');
    expect(html).toContain("Pick a persona to watch स्वYAM adapt.");
    // The play controls sit with the picker, the resets stay in their own panel.
    expect(at('data-lab="play-controls"')).toBeLessThan(at('data-lab-panel="before-after"'));
    // The opening column shows the universal Home, with the real top bar labels.
    expect(html).toContain("Explore स्वYAM");
  });

  it("/lab/compare renders two same-origin preview frames and the What differs list", () => {
    const html = renderToString(<EvolutionCompare />);
    expect(html).toContain("/?evoPreview=learning-explorer");
    expect(html).toContain("/?evoPreview=career-seeker");
    expect(html).toContain("Phone");
    expect(html).toContain("Desktop");
    expect(html).toContain("First difference");
    expect(html).toContain('data-lab="what-differs"');
    expect(html).toContain("What differs");
    expect(html).toContain("Continue learning");
    expect(html).toContain("Find opportunities");
    expect(html).toContain('data-first="true"');
    expect(html).toContain("Reaching its final arrangement");
  });

  it("the demo banner renders nothing outside a demo", () => {
    expect(renderToString(<DemoBanner />)).toBe("");
  });
});
