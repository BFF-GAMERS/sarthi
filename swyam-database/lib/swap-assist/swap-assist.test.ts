import { describe, expect, it } from "vitest";
import {
  MAX_DRAFT_CHARS,
  MAX_SKILL_CHARS,
  applyDraft,
  buildIcebreakers,
  cleanSkill,
} from "./icebreaker";
import {
  PLAYBOOK_HIDE_KEY,
  buildPlaybook,
  hidePlaybookForever,
  isPlaybookHidden,
  showPlaybookAgain,
} from "./playbook";

const tx = (s: string) => s;

class MemoryStore {
  private data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
}
const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("icebreaker drafts", () => {
  const drafts = buildIcebreakers(
    { learnSkill: "Welding", teachSkill: "Tailoring", learnLevel: "beginner" },
    tx,
  );

  it("offers three tones, each mentioning only the two skills", () => {
    expect(drafts.map((d) => d.tone)).toEqual(["warm", "brief", "curious"]);
    for (const d of drafts) {
      expect(d.text).toContain("Welding");
      expect(d.text.length).toBeLessThanOrEqual(MAX_DRAFT_CHARS);
    }
    expect(drafts[0]!.text).toContain("Tailoring");
    expect(drafts[0]!.text).toContain("beginner");
    expect(drafts[1]!.text).toBe("Hi! Want to swap Tailoring for Welding?");
  });

  it("is deterministic and has no unfilled placeholder", () => {
    const again = buildIcebreakers(
      { learnSkill: "Welding", teachSkill: "Tailoring", learnLevel: "beginner" },
      tx,
    );
    expect(again).toEqual(drafts);
    for (const d of drafts) expect(d.text).not.toMatch(/\{\w+\}/);
  });

  it("works without something to teach back, and without a level", () => {
    const solo = buildIcebreakers({ learnSkill: "Welding" }, tx);
    expect(solo[1]!.text).toBe("Hi! Could you teach me Welding?");
    for (const d of solo) expect(d.text).not.toMatch(/\{\w+\}|undefined|null|in return/);
  });

  it("returns nothing when there is no skill, and ignores an unknown level", () => {
    expect(buildIcebreakers({ learnSkill: "  " }, tx)).toEqual([]);
    const odd = buildIcebreakers({ learnSkill: "Welding", learnLevel: "ninja" }, tx);
    expect(odd[0]!.text).not.toContain("ninja");
  });

  it("makes skill names safe: one line, bounded, no markup or placeholders", () => {
    expect(cleanSkill("  Wel\n<b>ding</b> {learn} ")).toBe("Wel b ding /b learn");
    expect(cleanSkill("x".repeat(500)).length).toBeLessThanOrEqual(MAX_SKILL_CHARS);
    expect(cleanSkill(42)).toBe("");
    const tricky = buildIcebreakers({ learnSkill: "$& {teach}", teachSkill: "Art" }, tx);
    expect(tricky[1]!.text).not.toMatch(/\{\w+\}/);
  });

  it("is translated through tx, including the tone labels", () => {
    const hi = buildIcebreakers({ learnSkill: "Welding" }, (s) => `[hi] ${s}`);
    expect(hi[0]!.label).toBe("[hi] Warm");
    expect(hi[1]!.text).toContain("[hi] Hi!");
  });

  it("applyDraft keeps what the person typed", () => {
    expect(applyDraft("", "Hello")).toBe("Hello");
    expect(applyDraft("   ", "Hello")).toBe("Hello");
    expect(applyDraft("My own words", "Hello")).toBe("My own words\n\nHello");
    // Tapping a second chip swaps the previous suggestion, not the person's text.
    expect(applyDraft("Hello", "Hi there", "Hello")).toBe("Hi there");
    expect(applyDraft("Mine\n\nHello", "Hi there", "Hello")).toBe("Mine\n\nHi there");
  });
});

describe("session playbook", () => {
  it("is 30 minutes: 5 + 10 + 10 + 3 + 2", () => {
    const p = buildPlaybook({ teachSkill: "Tailoring", learnSkill: "Welding" }, tx);
    expect(p.steps.map((s) => s.minutes)).toEqual([5, 10, 10, 3, 2]);
    expect(p.totalMinutes).toBe(30);
    expect(p.steps.map((s) => s.id)).toEqual(["hello", "turn-1", "turn-2", "recap", "next"]);
  });

  it("is personalised only with the two skill names", () => {
    const p = buildPlaybook({ teachSkill: "Tailoring", learnSkill: "Welding" }, tx);
    expect(p.steps[1]!.title).toBe("You teach Tailoring");
    expect(p.steps[2]!.title).toBe("They teach Welding");
    expect(JSON.stringify(p)).not.toMatch(/\{\w+\}/);
  });

  it("copes with a one-way request and a missing skill name", () => {
    const p = buildPlaybook({ teachSkill: "Tailoring", learnSkill: null }, tx);
    expect(p.steps[2]!.title).toBe("Practice Tailoring together");
    expect(p.totalMinutes).toBe(30);
    expect(buildPlaybook({}, tx).steps[1]!.title).toBe("You teach your skill");
  });

  it("remembers 'Don't show again' on this device, and can forget it", () => {
    const store = new MemoryStore();
    expect(isPlaybookHidden(store)).toBe(false);
    hidePlaybookForever(store);
    expect(store.getItem(PLAYBOOK_HIDE_KEY)).toBe("1");
    expect(isPlaybookHidden(store)).toBe(true);
    showPlaybookAgain(store);
    expect(isPlaybookHidden(store)).toBe(false);
  });

  it("never throws when storage is blocked, and then shows the plan", () => {
    expect(() => hidePlaybookForever(throwing)).not.toThrow();
    expect(isPlaybookHidden(throwing)).toBe(false);
    expect(() => showPlaybookAgain(throwing)).not.toThrow();
  });
});
