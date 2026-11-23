// The Plus sheet's contracts: dialog semantics, every string through tx(), a still card when motion is
// off, the way out as easy to hit as the offer, an unticked notify box, honest and equal-sized price lines.
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/* The real hooks need providers and storage; the view only asks to translate. «» marks translated text. */
vi.mock("@/lib/i18n", () => ({ useTx: () => (s: string) => `«${s}»` }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null, profileId: null }) }));
vi.mock("@/membership", () => ({
  recordPlusEvent: () => {},
  useMembership: () => ({}),
  usePlusState: () => ({}),
}));
vi.mock("@/membership/trigger/use-is-minor", () => ({ useIsMinor: () => false }));

import { attachDialog } from "./dialog-a11y";
import { PlusSheetView, type PlusSheetViewProps } from "./PlusSheet";

const css = readFileSync(new URL("../../styles/evo-membership.css", import.meta.url), "utf8")
  .split("\r\n")
  .join("\n");

const base: PlusSheetViewProps = {
  planName: "Campus",
  regularPrice: 199,
  introPrice: 1,
  roleLabel: "«College student»", // the connected sheet passes it through tx() already
  firstName: "Aarav",
  accent: "MARIGOLD",
  headline: "Make your next step easier",
  reason: "Ordered by how much of your time on Swayam goes to careers.",
  source: "rules",
  benefits: [
    { id: "CV_REVIEW", label: "Detailed CV review", availability: "live" },
    { id: "PASSPORT_SHARE", label: "Share your Skill Passport", availability: "live" },
    { id: "SWAP_PRIORITY", label: "Priority in Skill Swap matches", availability: "live" },
    { id: "INTERNSHIP_ALERTS", label: "Internship alerts", availability: "preview" },
  ],
  staticFx: false,
  wide: true,
  guardian: false,
  stage: "offer",
  notify: false,
  onDismiss: () => {},
  onDemo: () => {},
  onNotify: () => {},
};

const render = (over: Partial<PlusSheetViewProps> = {}) =>
  renderToString(<PlusSheetView {...base} {...over} />);

const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("dialog semantics", () => {
  const html = render();
  it("is a modal dialog with a name and a description that exist", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelled = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(labelled && html.includes(`id="${labelled}"`)).toBe(true);
    expect(described && html.includes(`id="${described}"`)).toBe(true);
  });

  it("has a polite live region that reads the whole price", () => {
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/);
    expect(text(html)).toContain("Regular price ₹199 a month");
  });

  it("the close button is the first thing a keyboard reaches", () => {
    const first = html.indexOf("<button");
    expect(html.slice(first, first + 120)).toContain("plus-x");
  });
});

describe("every string goes through tx()", () => {
  it.each([["offer"], ["result"]] as const)("%s screen", (stage) => {
    const raw = text(render({ stage, notify: true, guardian: true }))
      .replace(/«[^»]*»/g, "")
      .replace(/Swayam Plus|Campus|Aarav/g, "")
      .replace(/[\s\d₹·.,:;/—-]/g, "");
    expect(raw).toBe("");
  });
});

describe("a still card when motion is off", () => {
  it("full effects: sheen element, strike phase", () => {
    const html = render({ staticFx: false });
    expect(html).toContain("plus-sheen");
    expect(html).toContain('data-phase="strike"');
  });

  it("reduced motion or a lighter effects tier: no sheen, no tilt, no roll", () => {
    const html = render({ staticFx: true });
    expect(html).not.toContain("plus-sheen");
    expect(html).not.toContain("data-tilt");
    expect(html).toContain('data-phase="done"');
    expect(html).toContain('data-static=""');
    // The settled price is on screen from the first frame.
    expect(text(html)).toContain("₹1");
  });

  it("the stylesheet switches the decoration off for the same cases", () => {
    expect(css).toMatch(/\[data-static\] \.plus-sheen\s*\{\s*display: none/);
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)[\s\S]*?\.plus-sheen\s*\{\s*display: none/,
    );
    expect(css).toMatch(/\[data-motion="reduced"\] \.plus-sheen/);
  });

  it("only transform and opacity move", () => {
    const animated = [...css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
    for (const body of animated) {
      expect(body).not.toMatch(/\b(top|left|right|bottom|width|height|margin|padding)\s*:/);
    }
  });
});

describe("the way out is as easy to hit as the offer", () => {
  const html = render();

  it("Not now, the X and Don't show again are all there", () => {
    expect(html).toContain("«Not now»");
    expect(html).toContain('aria-label="«Close»"');
    expect(html).toContain("«Don&#x27;t show again»");
  });

  it("the X and Not now share the dismiss control's look; the offer shares its size", () => {
    expect(html).toMatch(/class="plus-dismiss plus-x"/);
    expect(html).toMatch(/<button[^>]*class="plus-dismiss"[^>]*>«Not now»/);
    expect(css).toMatch(
      /\.plus-btn,\s*\.plus-dismiss\s*\{[^}]*min-height: 48px[^}]*border: 2px solid/,
    );
    expect(css).toMatch(/\.plus-dismiss\.plus-x\s*\{[^}]*min-height: 44px[^}]*width: 44px/);
  });
});

describe("the offer", () => {
  const html = render();
  const t = text(html);

  it("does not pre-tick the notify box", () => {
    const box = /<input[^>]*type="checkbox"[^>]*>/.exec(html)?.[0] ?? "";
    expect(box).not.toBe("");
    expect(box).not.toContain("checked");
    expect(render({ notify: true })).toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
  });

  it("states the price in full, and the terms at the same size as the offer tag", () => {
    expect(t).toContain("₹1 first month");
    expect(t).toContain("then ₹199/mo · cancel anytime");
    expect(html.match(/class="plus-price-line"/g)?.length).toBe(2);
    expect(css.match(/\.plus-price-line\s*\{/g)?.length).toBe(1);
  });

  it("says plainly that nothing is charged", () => {
    expect(t).toContain("Demo · no payment taken · everything is free during the pilot");
    expect(t).toContain("Start ₹1 trial — demo, no payment taken");
  });

  it("has no timers, scarcity or guilt", () => {
    expect(t).not.toMatch(
      /only today|hurry|last chance|ends (in|soon)|limited time|don.?t miss|running out|you.?ll regret|selling fast/i,
    );
  });

  it("marks the top two as picked for you, and preview items as previews", () => {
    expect(html.match(/data-kind="picked"/g)?.length).toBe(2);
    expect(html.match(/data-kind="preview"/g)?.length).toBe(1);
    expect(html).toMatch(/data-kind="picked"[^>]*title="«Ordered by[^"]*·[^"]*«Chosen by rules»"/);
  });

  it("asks a guardian only when it should", () => {
    expect(render({ guardian: true })).toContain("Ask a parent or guardian before subscribing");
    expect(html).not.toContain("Ask a parent or guardian");
  });

  it("shows the plan, the role and the embossed first name on the card", () => {
    expect(html).toContain("plus-foil-name");
    expect(t).toContain("Aarav");
    expect(t).toContain("College student");
    expect(t).toContain("«Swayam Plus» · Campus");
  });

  it("the phone sheet has a drag handle; the laptop dialog does not", () => {
    expect(render({ wide: false })).toContain("plus-grab");
    expect(html).not.toContain("plus-grab");
  });
});

describe("the result screen", () => {
  const t = text(render({ stage: "result" }));
  it("is honest that nothing was charged", () => {
    expect(t).toContain("You're on the Swayam Plus demo");
    expect(t).toContain("Nothing was charged. Payments aren't open yet.");
  });
  it("offers no way to pay", () => {
    expect(t).not.toMatch(/subscribe now|pay now|upgrade|checkout/i);
  });
});

/* ── focus trap, Escape and focus return, without a browser ─────────── */

class FakeEl {
  isConnected = true;
  style = { overflow: "" };
  children: FakeEl[] = [];
  private attrs = new Map<string, string>();
  constructor(
    private readonly doc: FakeDoc,
    readonly name: string,
  ) {}
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  getAttribute(n: string) {
    return this.attrs.get(n) ?? null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  contains(o: unknown) {
    return o === this || this.children.includes(o as FakeEl);
  }
  querySelectorAll() {
    return this.children;
  }
  focus() {
    this.doc.activeElement = this;
  }
}

class FakeDoc {
  activeElement: FakeEl | null = null;
  body = new FakeEl(this, "body");
  private handlers: Array<(e: unknown) => void> = [];
  addEventListener(_t: string, fn: (e: unknown) => void) {
    this.handlers.push(fn);
  }
  removeEventListener(_t: string, fn: (e: unknown) => void) {
    this.handlers = this.handlers.filter((h) => h !== fn);
  }
  get listenerCount() {
    return this.handlers.length;
  }
  key(key: string, shiftKey = false) {
    const e = { key, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    this.handlers.forEach((h) => h(e));
    return e;
  }
}

function setup() {
  const doc = new FakeDoc();
  vi.stubGlobal("document", doc);
  vi.stubGlobal("HTMLElement", FakeEl);
  const opener = new FakeEl(doc, "opener");
  opener.focus();
  const panel = new FakeEl(doc, "panel");
  const close = new FakeEl(doc, "close");
  const cta = new FakeEl(doc, "cta");
  const never = new FakeEl(doc, "never");
  panel.children = [close, cta, never];
  const onEscape = vi.fn();
  const release = attachDialog(panel as unknown as HTMLElement, { onEscape });
  return { doc, opener, panel, close, cta, never, onEscape, release };
}

describe("focus trap, Escape and focus return", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("moves focus to the first control, the way out", () => {
    const s = setup();
    expect(s.doc.activeElement).toBe(s.close);
    s.release();
  });

  it("keeps Tab inside, both directions", () => {
    const s = setup();
    s.never.focus();
    const fwd = s.doc.key("Tab");
    expect(fwd.preventDefault).toHaveBeenCalled();
    expect(s.doc.activeElement).toBe(s.close);
    const back = s.doc.key("Tab", true);
    expect(back.preventDefault).toHaveBeenCalled();
    expect(s.doc.activeElement).toBe(s.never);
    s.release();
  });

  it("Escape closes", () => {
    const s = setup();
    s.doc.key("Escape");
    expect(s.onEscape).toHaveBeenCalledTimes(1);
    s.release();
  });

  it("holds the page still while open and gives focus and scrolling back after", () => {
    const s = setup();
    expect(s.doc.body.style.overflow).toBe("hidden");
    s.release();
    expect(s.doc.body.style.overflow).toBe("");
    expect(s.doc.activeElement).toBe(s.opener);
    expect(s.doc.listenerCount).toBe(0);
    s.release(); // a second release is harmless
    expect(s.doc.activeElement).toBe(s.opener);
  });
});
