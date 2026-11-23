// The Settings card: there for everyone, honest for everyone, and never animating the price.
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: { email: "a@b.in", name: "Aarav Sharma", role: "student" } as { name: string } | null,
  plan: {
    id: "CAMPUS",
    name: "Campus",
    profileType: "college",
    regularPrice: 199,
    introPrice: 1,
  } as Record<string, unknown> | null,
  minor: false as boolean | null,
  interest: null as "trial_demo" | "notify" | null,
}));

vi.mock("@/lib/i18n", () => ({ useTx: () => (s: string) => s }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: h.user, profileId: h.user ? "p1" : null }),
}));
vi.mock("@/membership", () => ({
  recordPlusEvent: () => {},
  useMembership: () => ({
    plan: h.plan,
    accent: "PEACOCK",
    reason: "The usual list for your role.",
    source: "rules",
  }),
  usePlusState: () => ({ state: { interest: h.interest } }),
}));
vi.mock("@/membership/trigger/use-is-minor", () => ({ useIsMinor: () => h.minor }));

import MembershipCard from "./MembershipCard";

const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");

describe("MembershipCard", () => {
  it("a member with a plan sees the card, the full price and a button", () => {
    const html = renderToString(<MembershipCard />);
    const t = text(html);
    expect(t).toContain("Swayam Plus · Campus");
    expect(t).toContain("then ₹199/mo · cancel anytime");
    expect(t).toContain("Why this plan");
    expect(html).toMatch(/<button[^>]*class="plus-btn"[^>]*>See what is included/);
    expect(html).toContain("plus-card");
  });

  it("never animates the price on a repeat visit", () => {
    const html = renderToString(<MembershipCard />);
    expect(html).toContain('data-phase="done"');
    expect(html).not.toContain("plus-sheen");
  });

  it("a minor or unknown age is asked to involve a guardian", () => {
    h.minor = true;
    expect(text(renderToString(<MembershipCard />))).toContain(
      "Ask a parent or guardian before subscribing",
    );
    h.minor = null;
    expect(text(renderToString(<MembershipCard />))).toContain(
      "Ask a parent or guardian before subscribing",
    );
    h.minor = false;
    expect(text(renderToString(<MembershipCard />))).not.toContain("Ask a parent or guardian");
  });

  it("says Demo trial, never a paid badge, once somebody has taken the offer", () => {
    h.interest = "trial_demo";
    const t = text(renderToString(<MembershipCard />));
    expect(t).toContain("Demo trial · no payment");
    expect(t).not.toMatch(/subscribed|premium member|paid/i);
    h.interest = null;
  });

  it("a guest gets a neutral coming-soon card with no rupee figure", () => {
    h.user = null;
    h.plan = null;
    const t = text(renderToString(<MembershipCard />));
    expect(t).toContain("Swayam Plus is coming soon");
    expect(t).not.toContain("₹");
  });
});
