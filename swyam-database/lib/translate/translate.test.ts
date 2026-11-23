// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LruCache } from "@/evolution/server/cache";
import { handleTranslate, parseBody } from "./handler";
import { batches, isPrivatePath, shouldTranslate, withSameSpacing } from "./text";

const post = (body: unknown) =>
  new Request("https://swyam.online/api/translate", {
    method: "POST",
    body: JSON.stringify(body),
  });
const deps = (answer: string, calls: string[] = []) => ({
  apiKey: () => "k",
  ask: (async (turns: { content: string }[]) => {
    calls.push(turns[0]!.content);
    return answer;
  }) as never,
  cache: new LruCache<string>(100, 60_000),
  now: () => 1,
  log: () => {},
});

describe("what gets translated", () => {
  it("takes English sentences and labels", () => {
    expect(shouldTranslate("Learn a skill.")).toBe(true);
    expect(shouldTranslate("  Courses ")).toBe(true);
  });
  it("leaves names, codes, figures, links and other scripts alone", () => {
    for (const s of [
      "SkillSwap",
      "Sarthi",
      "SWY-24-0417",
      "₹2,999",
      "12 / 40",
      "a@b.in",
      "https://x.in",
      "कौशल भारत",
      "4",
    ])
      expect(shouldTranslate(s), s).toBe(false);
  });
  it("never reads the private pages", () => {
    expect(isPrivatePath("/messages/123")).toBe(true);
    expect(isPrivatePath("/notifications")).toBe(true);
    expect(isPrivatePath("/courses")).toBe(false);
  });
  it("keeps the spaces around inline text", () => {
    expect(withSameSpacing("  Hello ", "नमस्ते")).toBe("  नमस्ते ");
  });
  it("splits work into requests the server accepts", () => {
    const b = batches(Array.from({ length: 60 }, () => "x".repeat(100)));
    expect(b.map((x) => x.length)).toEqual([25, 25, 10]);
    expect(batches(["a".repeat(3000), "b".repeat(3000)]).length).toBe(2);
  });
});

describe("/api/translate", () => {
  it("refuses English, unknown languages and oversize input", () => {
    expect(parseBody({ lang: "en", texts: ["a"] })).toBeNull();
    expect(parseBody({ lang: "xx", texts: ["a"] })).toBeNull();
    expect(parseBody({ lang: "hi", texts: [] })).toBeNull();
    expect(parseBody({ lang: "hi", texts: ["a".repeat(1201)] })).toBeNull();
    expect(parseBody({ lang: "hi", texts: Array(26).fill("a") })).toBeNull();
    expect(parseBody({ lang: "hi", texts: ["Hello"] })?.label).toBe("Hindi");
  });
  it("translates, then serves the same string from cache", async () => {
    const calls: string[] = [];
    const d = deps(JSON.stringify({ t: ["नमस्ते"] }), calls);
    const a = await (await handleTranslate(post({ lang: "hi", texts: ["Hello"] }), d)).json();
    const b = await (await handleTranslate(post({ lang: "hi", texts: ["Hello"] }), d)).json();
    expect(a.translations).toEqual(["नमस्ते"]);
    expect(b.translations).toEqual(["नमस्ते"]);
    expect(calls).toHaveLength(1);
  });
  it("keeps the English (null) when the model answers the wrong shape", async () => {
    const r = await handleTranslate(
      post({ lang: "hi", texts: ["A b", "C d"] }),
      deps('{"t":["x"]}'),
    );
    expect((await r.json()).translations).toEqual([null, null]);
  });
  it("is a 400 for a malformed body", async () => {
    expect((await handleTranslate(post({ lang: "hi" }), deps("{}"))).status).toBe(400);
  });
});
