import { describe, expect, it } from "vitest";
import { PREFERENCES_BOOTSTRAP_SCRIPT, resolveInterfaceMode } from "./PreferencesContext";

/** Runs the real pre-paint script against a fake document, storage and operating system. */
function prePaint(opts: { stored?: Record<string, unknown> | string | null; osDark: boolean }) {
  const dataset: Record<string, string> = {};
  const store: Record<string, string> = {};
  if (typeof opts.stored === "string") store["swayam-interface-mode"] = opts.stored;
  else if (opts.stored) store["swayam-preferences"] = JSON.stringify(opts.stored);
  const doc = {
    documentElement: { dataset, style: { setProperty() {} }, lang: "", dir: "" },
  };
  const win = {
    matchMedia: (q: string) => ({
      matches: q.includes("prefers-color-scheme") ? opts.osDark : false,
    }),
  };
  const ls = { getItem: (k: string) => store[k] ?? null };
  new Function("document", "localStorage", "window", "navigator", PREFERENCES_BOOTSTRAP_SCRIPT)(
    doc,
    ls,
    win,
    {},
  );
  return dataset;
}

describe("theme default and Light / Dark / System", () => {
  it("a fresh profile on a light OS renders the light register", () => {
    expect(prePaint({ osDark: false })["mode"]).toBe("millennial");
  });

  it("a fresh profile on a dark OS renders the dark register", () => {
    expect(prePaint({ osDark: true })["mode"]).toBe("genz");
  });

  it("System follows the OS even when other preferences were saved", () => {
    const stored = { themeChoice: "system", interfaceMode: "genz", textScale: 1.1 };
    expect(prePaint({ stored, osDark: false })["mode"]).toBe("millennial");
    expect(prePaint({ stored, osDark: true })["mode"]).toBe("genz");
  });

  it("an explicit Light or Dark ignores the OS", () => {
    expect(prePaint({ stored: { themeChoice: "light" }, osDark: true })["mode"]).toBe("millennial");
    expect(prePaint({ stored: { themeChoice: "dark" }, osDark: false })["mode"]).toBe("genz");
  });

  it("records saved before the choice existed keep the register they named", () => {
    expect(prePaint({ stored: { interfaceMode: "millennial" }, osDark: true })["mode"]).toBe(
      "millennial",
    );
    expect(prePaint({ stored: { interfaceMode: "genz" }, osDark: false })["mode"]).toBe("genz");
    expect(prePaint({ stored: "millennial", osDark: true })["mode"]).toBe("millennial");
  });

  it("keeps the other pre-paint stamps working", () => {
    const d = prePaint({ stored: { highContrast: true, reducedMotion: true }, osDark: false });
    expect(d["contrast"]).toBe("high");
    expect(d["motion"]).toBe("reduced");
  });

  it("resolves a choice against the OS", () => {
    expect(resolveInterfaceMode("system", true)).toBe("genz");
    expect(resolveInterfaceMode("system", false)).toBe("millennial");
    expect(resolveInterfaceMode("light", true)).toBe("millennial");
    expect(resolveInterfaceMode("dark", false)).toBe("genz");
  });

  it("still stamps the evolution attributes from the boot record", () => {
    const dataset: Record<string, string> = {};
    const boot = JSON.stringify({
      v: 1,
      state: "CAREER_FIRST",
      nav: "CAREER_PRIORITY",
      layout: "CAREER_DISCOVERY",
      density: "COMFORTABLE",
      tier: 2,
    });
    const ls = { getItem: (k: string) => (k === "swayam.evo.boot" ? boot : null) };
    const doc = { documentElement: { dataset, style: { setProperty() {} } } };
    const win = { matchMedia: () => ({ matches: false }) };
    new Function("document", "localStorage", "window", "navigator", PREFERENCES_BOOTSTRAP_SCRIPT)(
      doc,
      ls,
      win,
      {},
    );
    expect(dataset["evoState"]).toBe("CAREER_FIRST");
    expect(dataset["evoNav"]).toBe("CAREER_PRIORITY");
    expect(dataset["evoTier"]).toBe("2");
  });
});
