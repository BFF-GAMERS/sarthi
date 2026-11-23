import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

/*
 * The launcher is a stand-in for the assistant's own button and must not
 * import it (that would put the 200 kB chunk back in the first load), so the
 * two share a look and an event name by copy. This keeps the copies honest.
 */
describe("AssistantLauncher", () => {
  const launcher = read("./AssistantLauncher.tsx");
  const assistant = read("./AIAssistant.tsx");

  it("listens for the event the assistant listens for", () => {
    expect(assistant).toContain('SARTHI_OPEN_EVENT = "sarthi:open"');
    expect(launcher).toContain('SARTHI_OPEN_EVENT = "sarthi:open"');
  });

  it("is drawn with the assistant's own button classes, so nothing moves on hand-off", () => {
    const look =
      "fixed bottom-[calc(1.5rem+var(--bottom-bar,0px)+var(--sticky-bar,0px))] right-4 z-[45] flex h-14 items-center gap-2 rounded-[var(--radius-pill)] bg-gradient-to-br from-saffron-500 to-saffron-600 px-5 text-[color:var(--color-on-accent)] shadow-[var(--shadow-float)]";
    expect(assistant).toContain(look);
    expect(launcher).toContain(look);
  });

  it("never statically imports the assistant", () => {
    expect(launcher).not.toMatch(/^import[^\n]*AIAssistant/m);
  });
});
