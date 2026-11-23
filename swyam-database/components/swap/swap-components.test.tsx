// Component contracts for the swap helpers. Rendered on the server or called as plain functions: there is
// no DOM in this test environment, and these components keep their logic out of hooks so they can be.
import { readFileSync } from "node:fs";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
  useTx: () => (s: string) => s,
  useT: () => (k: string) => k,
}));

import IcebreakerDrafts, { DraftChips } from "./IcebreakerDrafts";
import SessionPlaybook from "./SessionPlaybook";
import { buildIcebreakers } from "@/lib/swap-assist/icebreaker";
import { PLAYBOOK_HIDE_KEY } from "@/lib/swap-assist/playbook";

function walk(node: ReactNode, visit: (el: ReactElement<Record<string, unknown>>) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (node && typeof node === "object" && "props" in node) {
    const el = node as ReactElement<Record<string, unknown>>;
    visit(el);
    walk(el.props["children"] as ReactNode, visit);
  }
}
const buttons = (tree: ReactNode) => {
  const found: ReactElement<Record<string, unknown>>[] = [];
  walk(tree, (el) => {
    if (el.type === "button") found.push(el);
  });
  return found;
};
const label = (el: ReactElement<Record<string, unknown>>) => String(el.props["children"]);

const tx = (s: string) => s;
const drafts = buildIcebreakers({ learnSkill: "Welding", teachSkill: "Tailoring" }, tx);

describe("IcebreakerDrafts never sends", () => {
  it("is labelled as a suggestion to edit before sending", () => {
    const html = renderToStaticMarkup(
      <IcebreakerDrafts learnSkill="Welding" teachSkill="Tailoring" value="" onChange={() => {}} />,
    );
    expect(html).toContain("Suggestion - edit before sending");
    expect(html).toContain("Warm");
    expect(html).toContain("Brief");
    expect(html).toContain("Curious");
  });

  it("renders nothing when there is no skill to talk about", () => {
    const html = renderToStaticMarkup(
      <IcebreakerDrafts learnSkill="" value="" onChange={() => {}} />,
    );
    expect(html).toBe("");
  });

  it("chips are plain buttons, never submit buttons, and there is no form", () => {
    const html = renderToStaticMarkup(
      <IcebreakerDrafts learnSkill="Welding" value="" onChange={() => {}} />,
    );
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="submit"');
    expect((html.match(/type="button"/g) ?? []).length).toBe(3);
  });

  it("a tap only hands the draft to onPick; nothing else is called", () => {
    const onPick = vi.fn();
    const tree = DraftChips({ drafts, caption: "c", onPick });
    const chips = buttons(tree);
    expect(chips).toHaveLength(3);
    for (const chip of chips) expect(chip.props["type"]).toBe("button");
    (chips[0]!.props["onClick"] as () => void)();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(drafts[0]);
  });

  it("has no way to send: no send prop, no submit call, and the card sends only from its own button", () => {
    const src = readFileSync(new URL("./IcebreakerDrafts.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/onSend|onSubmit|requestSubmit|\.submit\(|onRequest|sendSwapRequest/);
    const card = readFileSync(new URL("../SwapCards.tsx", import.meta.url), "utf8");
    // The drafts get the message setter, and the request is made only inside the undo window's commit.
    expect(card).toContain("onChange={setMessage}");
    expect(card.match(/onRequest\(match, message, format\)/g)).toHaveLength(1);
  });
});

describe("SessionPlaybook skip and don't-show-again", () => {
  afterEach(() => vi.unstubAllGlobals());

  const fakeStorage = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };

  it("lists the five steps and the two skill names", () => {
    const html = renderToStaticMarkup(
      <SessionPlaybook teachSkill="Tailoring" learnSkill="Welding" onClose={() => {}} />,
    );
    expect(html).toContain("You teach Tailoring");
    expect(html).toContain("They teach Welding");
    expect(html).toContain("5 min");
    expect(html).toContain("Skip");
    expect(html).toContain("Don&#x27;t show again");
  });

  it("Skip closes without remembering anything", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const onClose = vi.fn();
    const tree = SessionPlaybook({ teachSkill: "A", learnSkill: "B", onClose });
    const skip = buttons(tree).find((b) => label(b) === "Skip")!;
    (skip.props["onClick"] as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.data.size).toBe(0);
  });

  it("Don't show again closes and sets the local flag", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const onClose = vi.fn();
    const tree = SessionPlaybook({ teachSkill: "A", learnSkill: "B", onClose });
    const never = buttons(tree).find((b) => label(b) === "Don't show again")!;
    (never.props["onClick"] as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.getItem(PLAYBOOK_HIDE_KEY)).toBe("1");
  });

  it("opened by hand from a swap card it only offers Close, and sets no flag", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const onClose = vi.fn();
    const tree = SessionPlaybook({ teachSkill: "A", learnSkill: "B", onClose, manual: true });
    expect(buttons(tree).map(label)).toEqual(["Close"]);
    (buttons(tree)[0]!.props["onClick"] as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.data.size).toBe(0);
  });
});
