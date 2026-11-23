// Sync logic against a fake database port: debounce, pagehide flush, newer-wins, missing table, retry, delete.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngine } from "../core/evolution/engine";
import { actionsFor } from "../core/evolution/compose";
import { initialEngineRecord, type EngineRecord } from "../state/stores";
import {
  PUSH_DEBOUNCE_MS,
  RETRY_MS,
  createSyncController,
  fromRemoteProfile,
  remoteIsNewer,
  syncStatusBus,
  toRemoteHistory,
  toRemoteProfile,
  type RemoteProfile,
  type SyncClient,
  type SyncController,
  type SyncError,
  type SyncPayload,
} from "./supabase-sync";
import type { EvolutionHistoryEntry } from "../types";

const rec = (): EngineRecord => {
  const base = initialEngineRecord("acct_00000001");
  return { ...base, updatedAt: 1_800_000_000_000 };
};

const payload = (): SyncPayload => ({
  profileId: "p1",
  rec: rec(),
  locked: false,
  history: [],
});

interface Fake {
  client: SyncClient;
  pushes: Array<{ profile: RemoteProfile; history: unknown[] }>;
  removed: number;
  pushError: SyncError | null;
  selectError: SyncError | null;
  row: RemoteProfile | null;
}

function fake(): Fake {
  const f: Fake = {
    pushes: [],
    removed: 0,
    pushError: null,
    selectError: null,
    row: null,
    client: {
      select: async () => ({ data: f.row, error: f.selectError }),
      push: async (profile, history) => {
        if (f.pushError) return { error: f.pushError };
        f.pushes.push({ profile, history });
        return { error: null };
      },
      remove: async () => {
        f.removed++;
        return { error: null };
      },
    },
  };
  return f;
}

function controller(f: Fake): SyncController {
  return createSyncController({
    clientFor: async () => f.client,
    later: (ms, fn) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    now: () => Date.now(),
  });
}

const target = (onPushed = vi.fn()) => ({ profileId: "p1", payload, onPushed });

beforeEach(() => {
  vi.useFakeTimers();
  syncStatusBus.set({ synced: false, localOnly: false, at: null });
});
afterEach(() => vi.useRealTimers());

describe("pushing", () => {
  it("debounces: many changes make one push, 15 s after the first", async () => {
    const f = fake();
    const c = controller(f);
    const onPushed = vi.fn();
    c.setTarget(target(onPushed));
    c.markDirty();
    c.markDirty();
    c.markDirty();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS - 1);
    expect(f.pushes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.pushes).toHaveLength(1);
    expect(onPushed).toHaveBeenCalledTimes(1);
    expect(syncStatusBus.get().synced).toBe(true);
  });

  it("pagehide flushes immediately, and only when something is waiting", async () => {
    const f = fake();
    const c = controller(f);
    c.setTarget(target());
    c.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.pushes).toHaveLength(0);
    c.markDirty();
    c.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.pushes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(f.pushes).toHaveLength(1);
  });

  it("sends the aggregate only: no raw events, no entity ids, no free text", async () => {
    const f = fake();
    const c = controller(f);
    c.setTarget(target());
    c.markDirty();
    c.flush();
    await vi.advanceTimersByTimeAsync(0);
    const row = f.pushes[0]!.profile;
    expect(Object.keys(row).sort()).toEqual(
      [
        "action_counts",
        "client_updated_at",
        "confidence",
        "domain_counts",
        "locked",
        "meaningful_count",
        "mode",
        "profile_id",
        "scores",
        "session_count",
        "state",
        "tier",
      ].sort(),
    );
    expect(JSON.stringify(row)).not.toMatch(/entityId|opp_|crs_|events/);
  });

  it("a minor or an ineligible scope (target null) never pushes", async () => {
    const f = fake();
    const c = controller(f);
    c.setTarget(target());
    c.markDirty();
    c.setTarget(null);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(f.pushes).toHaveLength(0);
    c.markDirty();
    c.flush();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(f.pushes).toHaveLength(0);
  });

  it("a missing table (PGRST205 or 42P01) means local-only: no retries, no more pushes", async () => {
    for (const code of ["PGRST205", "42P01"]) {
      syncStatusBus.set({ synced: false, localOnly: false, at: null });
      const f = fake();
      f.pushError = { code, message: "relation does not exist" };
      const c = controller(f);
      c.setTarget(target());
      c.markDirty();
      c.flush();
      await vi.advanceTimersByTimeAsync(0);
      expect(syncStatusBus.get()).toMatchObject({ localOnly: true, synced: false });
      f.pushError = null;
      c.markDirty();
      await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 4);
      expect(f.pushes).toHaveLength(0);
    }
  });

  it("another error retries once, then gives up silently", async () => {
    const f = fake();
    f.pushError = { code: "500", message: "boom" };
    const c = controller(f);
    const attempts = vi.spyOn(f.client, "push");
    c.setTarget(target());
    c.markDirty();
    c.flush();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    await vi.advanceTimersByTimeAsync(RETRY_MS * 3);
    expect(attempts).toHaveBeenCalledTimes(2);
    expect(syncStatusBus.get().synced).toBe(false);
  });

  it("a client that throws is swallowed", async () => {
    const f = fake();
    f.client.push = async () => {
      throw new Error("network");
    };
    const c = controller(f);
    c.setTarget(target());
    c.markDirty();
    c.flush();
    await expect(vi.advanceTimersByTimeAsync(RETRY_MS * 2)).resolves.not.toThrow();
  });
});

describe("pull and delete", () => {
  it("pull returns the row and marks the account as synced", async () => {
    const f = fake();
    f.row = toRemoteProfile(payload());
    const c = controller(f);
    c.setTarget(target());
    expect(await c.pull()).toEqual(f.row);
    expect(syncStatusBus.get().synced).toBe(true);
  });

  it("pull on a missing table is local-only and returns null", async () => {
    const f = fake();
    f.selectError = { code: "PGRST205" };
    const c = controller(f);
    c.setTarget(target());
    expect(await c.pull()).toBeNull();
    expect(syncStatusBus.get().localOnly).toBe(true);
  });

  it("deleteRemote removes the copy, cancels waiting pushes and clears the synced flag", async () => {
    const f = fake();
    const c = controller(f);
    c.setTarget(target());
    c.markDirty();
    c.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(syncStatusBus.get().synced).toBe(true);
    c.markDirty();
    expect(await c.deleteRemote()).toBe(true);
    expect(f.removed).toBe(1);
    expect(syncStatusBus.get().synced).toBe(false);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(f.pushes).toHaveLength(1);
  });

  it("deleteRemote without a target is a false, not a throw", async () => {
    const c = controller(fake());
    expect(await c.deleteRemote()).toBe(false);
  });
});

describe("newer wins", () => {
  it("remoteIsNewer compares client_updated_at with the local clock", () => {
    const row = { ...toRemoteProfile(payload()), client_updated_at: new Date(2000).toISOString() };
    expect(remoteIsNewer(row, 1000)).toBe(true);
    expect(remoteIsNewer(row, 2000)).toBe(false);
    expect(remoteIsNewer(row, 3000)).toBe(false);
    expect(remoteIsNewer(null, 0)).toBe(false);
    expect(remoteIsNewer({ ...row, client_updated_at: "garbage" }, 0)).toBe(false);
  });

  const remote = (over: Partial<RemoteProfile> = {}): RemoteProfile => ({
    ...toRemoteProfile(payload()),
    state: "CAREER_FIRST",
    mode: "CAREER_FOCUSED",
    tier: 3,
    confidence: 0.9,
    session_count: 4,
    ...over,
  });

  it("a valid server row becomes a local record with a validated decision", () => {
    const next = fromRemoteProfile(remote(), "acct_00000001", rec());
    expect(next).not.toBeNull();
    expect(next!.engine.decision.primaryState).toBe("CAREER_FIRST");
    expect(next!.engine.decision.priorityActions).toEqual(actionsFor("CAREER_FIRST", 3));
    expect(next!.engine.tier).toBe(3);
    expect(next!.engine.profile.sessionCount).toBe(4);
    expect(next!.engine.scope).toBe("acct_00000001");
    expect(next!.rev).toBe(rec().rev + 1);
    expect(next!.committedSource).toBe("manual"); // released instantly, never announced
    expect(next!.syncedAt).not.toBeNull();
  });

  it.each([
    ["an unknown state", { state: "HACKED" }],
    ["an unknown mode", { mode: "ANGRY" }],
    ["an invalid tier", { tier: 9 }],
  ])("rejects %s", (_n, over) => {
    expect(
      fromRemoteProfile(remote(over as Partial<RemoteProfile>), "acct_00000001", rec()),
    ).toBeNull();
  });

  it("rejects non-objects and clamps junk numbers", () => {
    expect(fromRemoteProfile(null, "acct_00000001", rec())).toBeNull();
    expect(fromRemoteProfile("x", "acct_00000001", rec())).toBeNull();
    const out = fromRemoteProfile(
      remote({ confidence: 7, scores: { careerAffinity: 9, learningAffinity: -3 } }),
      "acct_00000001",
      rec(),
    );
    expect(out!.engine.decision.confidence).toBe(1);
    expect(out!.engine.profile.scores.careerAffinity).toBe(1);
    expect(out!.engine.profile.scores.learningAffinity).toBe(0);
  });
});

describe("history rows", () => {
  const entry = (at: number, source: EvolutionHistoryEntry["source"]): EvolutionHistoryEntry => ({
    id: `h${at}`,
    at,
    seq: at,
    from: { state: "UNIVERSAL", mode: "BALANCED", nav: "UNIVERSAL", layout: "UNIVERSAL", tier: 0 },
    to: {
      state: "CAREER_FIRST",
      mode: "CAREER_FOCUSED",
      nav: "CAREER_PRIORITY",
      layout: "CAREER_DISCOVERY",
      tier: 2,
    },
    confidence: 0.7,
    source,
    reasonCode: { key: "DOMAIN_RISING" },
  });

  it("never syncs persona demos, only rows newer than the last push, with a short template reason", () => {
    const rows = toRemoteHistory(
      [entry(1, "deterministic"), entry(2, "persona"), entry(3, "ai")],
      1,
    );
    expect(rows.map((r) => r.source)).toEqual(["ai"]);
    expect(rows[0]!.reason.length).toBeLessThanOrEqual(200);
    expect(rows[0]).toMatchObject({ from_state: "UNIVERSAL", to_state: "CAREER_FIRST" });
  });

  it("caps at 50", () => {
    const many = Array.from({ length: 80 }, (_, i) => entry(i + 1, "deterministic"));
    expect(toRemoteHistory(many, null)).toHaveLength(50);
  });
});

describe("engine facade interplay", () => {
  it("a fresh engine maps to a valid UNIVERSAL row", () => {
    const row = toRemoteProfile({
      ...payload(),
      rec: { ...rec(), engine: createEngine("acct_00000001") },
    });
    expect(row).toMatchObject({ state: "UNIVERSAL", mode: "BALANCED", tier: 0 });
  });
});
