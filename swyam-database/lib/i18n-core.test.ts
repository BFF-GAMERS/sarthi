import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TRANSLATED_LOCALES,
  coverage,
  isLocaleLoaded,
  loadLocale,
  localeVersion,
  subscribeLocales,
  translate,
  translateText,
} from "./i18n-core";

const generated = JSON.parse(
  readFileSync(new URL("./i18n.generated.json", import.meta.url), "utf8"),
) as Record<string, Record<string, string>>;

describe("i18n loader", () => {
  it("renders English with nothing loaded, and never throws for an unknown language", async () => {
    expect(translate("hi", "courses")).toBe("Courses");
    expect(translateText("hi", "Continue learning")).toBe("Continue learning");
    expect(isLocaleLoaded("en")).toBe(true);
    expect(isLocaleLoaded("hi")).toBe(false);
    await expect(loadLocale("xx")).resolves.toBeUndefined();
    await expect(loadLocale("en")).resolves.toBeUndefined();
    expect(coverage("en")).toBe(1);
    expect(coverage("hi")).toBe(0);
  });

  it("lists every shipped language as translated, English included", () => {
    expect([...TRANSLATED_LOCALES].sort()).toEqual(
      ["as", "bn", "en", "gu", "hi", "kn", "ml", "mr", "ne", "or", "pa", "ta", "te", "ur"].sort(),
    );
  });

  it("fetches a language once, notifies subscribers, then translates", async () => {
    let calls = 0;
    const off = subscribeLocales(() => {
      calls += 1;
    });
    const before = localeVersion();
    await Promise.all([loadLocale("hi"), loadLocale("hi")]);
    off();
    expect(calls).toBe(1);
    expect(localeVersion()).toBe(before + 1);
    expect(isLocaleLoaded("hi")).toBe(true);
    expect(translate("hi", "courses")).toBe("कोर्स");
    expect(translate("hi", "menu")).not.toBe("");
    const [english, hindi] = Object.entries(generated["hi"]!)[0]!;
    expect(translateText("hi", english)).toBe(hindi);
    expect(coverage("hi")).toBeGreaterThan(0);
    // A second call is a no-op: no new version, no new notification.
    await loadLocale("hi");
    expect(localeVersion()).toBe(before + 1);
  });

  it("keeps each language's whole-site table identical to i18n.generated.json", async () => {
    for (const code of ["bn", "hi", "ur"]) {
      await loadLocale(code);
      const sample = Object.entries(generated[code]!);
      expect(sample.length).toBeGreaterThan(300);
      for (const [english, translated] of sample) {
        expect(translateText(code, english)).toBe(translated);
      }
    }
  });

  it("falls back per key, not per language", async () => {
    await loadLocale("mr");
    expect(translate("mr", "courses")).not.toBe("Courses");
    expect(translateText("mr", "a sentence nobody translated")).toBe(
      "a sentence nobody translated",
    );
  });
});
