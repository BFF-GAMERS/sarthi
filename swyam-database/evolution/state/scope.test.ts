// Scope hashing, the D10 session boundary and the one-time guest merge.
import { describe, expect, it } from "vitest";
import { createMemoryAdapter } from "../platform/storage/memory";
import { keyOf, MERGED_KEY } from "../platform/storage/keys";
import {
  hashProfileId,
  mergeGuestIntoAccount,
  resolveSession,
  scopeFor,
  SESSION_GAP_MS,
  type SessionMarker,
  type SessionPort,
} from "./scope";

const port = (): SessionPort & { m: SessionMarker | null } => {
  const p = {
    m: null as SessionMarker | null,
    read: () => p.m,
    write: (m: SessionMarker) => {
      p.m = m;
    },
  };
  return p;
};

describe("scope", () => {
  it("guest for a visitor, acct_<8 hex> for a member, never the raw id", () => {
    expect(scopeFor(null)).toBe("guest");
    const s = scopeFor("0b1c2d3e-aaaa-bbbb-cccc-1234567890ab");
    expect(s).toMatch(/^acct_[0-9a-f]{8}$/);
    expect(s).not.toContain("0b1c2d3e");
    expect(scopeFor("0b1c2d3e-aaaa-bbbb-cccc-1234567890ab")).toBe(s);
    expect(hashProfileId("a")).not.toBe(hashProfileId("b"));
  });
});

describe("D10 session boundary", () => {
  const T0 = 1_800_000_000_000;

  it("the first call starts a session; calls inside the gap keep it", () => {
    const p = port();
    const a = resolveSession(p, T0);
    expect(a.isNew).toBe(true);
    const b = resolveSession(p, T0 + SESSION_GAP_MS - 1000);
    expect(b).toEqual({ id: a.id, isNew: false });
  });

  it("30 minutes of silence starts a new session", () => {
    const p = port();
    const a = resolveSession(p, T0);
    const b = resolveSession(p, T0 + SESSION_GAP_MS + 1);
    expect(b.isNew).toBe(true);
    expect(b.id).not.toBe(a.id);
  });

  it("activity keeps pushing the gap forward", () => {
    const p = port();
    const a = resolveSession(p, T0);
    let t = T0;
    for (let i = 0; i < 5; i++) {
      t += SESSION_GAP_MS - 60_000;
      expect(resolveSession(p, t).id).toBe(a.id);
    }
  });

  it("a fresh tab (no marker) is a new session; a refresh (marker kept) is not", () => {
    const first = port();
    const a = resolveSession(first, T0);
    const refreshed = resolveSession(first, T0 + 5000);
    expect(refreshed.id).toBe(a.id);
    const freshTab = resolveSession(port(), T0 + 6000);
    expect(freshTab.isNew).toBe(true);
    expect(freshTab.id).not.toBe(a.id);
  });
});

describe("guest -> account merge", () => {
  const acct = scopeFor("member-1");
  const guestEngine = JSON.stringify({
    state: { engine: { v: 1, scope: "guest", profile: { scope: "guest" } }, rev: 3, syncedAt: 99 },
    version: 1,
  });

  it("merges once on the first sign-in: rewrites the scope, moves the keys, clears guest, sets the marker", () => {
    const a = createMemoryAdapter();
    a.setItem(keyOf("guest", "engine"), guestEngine);
    a.setItem(keyOf("guest", "behaviour"), '{"state":{"events":[]},"version":1}');
    expect(mergeGuestIntoAccount(a, acct)).toBe(true);
    const moved = JSON.parse(a.getItem(keyOf(acct, "engine")) ?? "{}");
    expect(moved.state.engine.scope).toBe(acct);
    expect(moved.state.engine.profile.scope).toBe(acct);
    expect(moved.state.syncedAt).toBeNull();
    expect(a.getItem(keyOf("guest", "engine"))).toBeNull();
    expect(a.getItem(keyOf(acct, "behaviour"))).not.toBeNull();
    expect(a.getItem(MERGED_KEY)).toBe("1");
  });

  it("never merges twice, and not for a second account on the same device", () => {
    const a = createMemoryAdapter();
    mergeGuestIntoAccount(a, acct);
    a.setItem(keyOf("guest", "engine"), guestEngine);
    expect(mergeGuestIntoAccount(a, scopeFor("member-2"))).toBe(false);
    expect(a.getItem(keyOf("guest", "engine"))).not.toBeNull();
  });

  it("never overwrites an account scope that already has data", () => {
    const a = createMemoryAdapter();
    a.setItem(keyOf(acct, "engine"), "existing");
    a.setItem(keyOf("guest", "engine"), guestEngine);
    expect(mergeGuestIntoAccount(a, acct)).toBe(false);
    expect(a.getItem(keyOf(acct, "engine"))).toBe("existing");
  });

  it("a corrupt guest record cannot throw", () => {
    const a = createMemoryAdapter();
    a.setItem(keyOf("guest", "engine"), "{not json");
    expect(() => mergeGuestIntoAccount(a, acct)).not.toThrow();
  });
});
