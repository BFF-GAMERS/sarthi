import { beforeEach, describe, expect, it } from "vitest";
import {
  NOTICE_STALE_MS,
  OVERLAY_ORDER,
  PRIVACY_MAX_MS,
  PRIVACY_MIN_MS,
  REVEAL_MS,
  activeOverlay,
  describeChange,
  isReveal,
  noticeBus,
  noticeVisibleOn,
  overlayBus,
  pickOverlay,
  privacyBarAllowed,
  privacyCollapseIn,
  requestOverlay,
  resetOverlays,
  showMeTarget,
  type EvolutionNoticeModel,
} from "./notice";
import type { SectionId, UIState } from "../types";

const ui = (over: Partial<{ top: string[]; movedUp: string[]; state: string; tier: number }>) =>
  ({
    state: over.state ?? "CAREER",
    tier: over.tier ?? 1,
    movedUp: over.movedUp ?? [],
    navigation: { top: over.top ?? ["HOME", "JOBS"] },
  }) as unknown as UIState;

const change = (over: Partial<EvolutionNoticeModel> = {}): EvolutionNoticeModel => ({
  id: 1,
  kind: "change",
  message: "Swayam moved Jobs up.",
  undoable: true,
  ...over,
});

beforeEach(() => {
  resetOverlays();
  noticeBus.set(null);
});

describe("overlay queue ordering", () => {
  it("nothing asking means nothing shown", () => {
    expect(pickOverlay([])).toBeNull();
    expect(activeOverlay()).toBeNull();
  });

  it("the adaptation notice goes before the privacy bar, whichever asked first", () => {
    expect(OVERLAY_ORDER).toEqual(["adaptation", "privacy"]);
    expect(pickOverlay(["privacy", "adaptation"])).toBe("adaptation");
    const releasePrivacy = requestOverlay("privacy");
    expect(activeOverlay()).toBe("privacy");
    const releaseAdaptation = requestOverlay("adaptation");
    expect(activeOverlay()).toBe("adaptation");
    releasePrivacy();
    expect(activeOverlay()).toBe("adaptation");
    releaseAdaptation();
    expect(activeOverlay()).toBeNull();
  });

  it("the privacy bar waits and takes the slot when the notice clears", () => {
    const releasePrivacy = requestOverlay("privacy");
    const releaseAdaptation = requestOverlay("adaptation");
    expect(activeOverlay()).toBe("adaptation");
    releaseAdaptation();
    expect(activeOverlay()).toBe("privacy");
    releasePrivacy();
  });

  it("only one overlay is ever active", () => {
    requestOverlay("privacy");
    requestOverlay("adaptation");
    expect(overlayBus.get()).toEqual(["adaptation", "privacy"]);
    expect(activeOverlay()).toBe("adaptation");
  });

  it("asking twice is counted, and a release is idempotent", () => {
    const a = requestOverlay("adaptation");
    const b = requestOverlay("adaptation");
    a();
    a();
    expect(activeOverlay()).toBe("adaptation");
    b();
    expect(activeOverlay()).toBeNull();
  });

  it("publishes only when the asking set changes", () => {
    let n = 0;
    const off = overlayBus.subscribe(() => n++);
    const r1 = requestOverlay("privacy");
    const r2 = requestOverlay("privacy");
    expect(n).toBe(1);
    r1();
    r2();
    off();
    expect(activeOverlay()).toBeNull();
  });
});

describe("the privacy bar rules", () => {
  it("never renders on /lab or its compare frames", () => {
    expect(privacyBarAllowed({ pathname: "/lab", reveal: false })).toBe(false);
    expect(privacyBarAllowed({ pathname: "/lab/compare", reveal: false })).toBe(false);
    expect(privacyBarAllowed({ pathname: "/labour", reveal: false })).toBe(true);
    expect(privacyBarAllowed({ pathname: "/jobs", reveal: false })).toBe(true);
  });

  it("never renders on the privacy page itself", () => {
    expect(privacyBarAllowed({ pathname: "/privacy", reveal: false })).toBe(false);
  });

  it("never renders during the evolved-Home reveal", () => {
    expect(isReveal({ pathname: "/", state: "CAREER", sinceMountMs: 300 })).toBe(true);
    expect(isReveal({ pathname: "/", state: "CAREER", sinceMountMs: REVEAL_MS })).toBe(false);
    expect(isReveal({ pathname: "/", state: "UNIVERSAL", sinceMountMs: 0 })).toBe(false);
    expect(isReveal({ pathname: "/jobs", state: "CAREER", sinceMountMs: 0 })).toBe(false);
    expect(privacyBarAllowed({ pathname: "/", reveal: true })).toBe(false);
  });

  it("collapses after 8 s with no interaction", () => {
    expect(privacyCollapseIn(0, null)).toBe(PRIVACY_MAX_MS);
    expect(privacyCollapseIn(3000, null)).toBe(PRIVACY_MAX_MS - 3000);
    expect(privacyCollapseIn(PRIVACY_MAX_MS + 10, null)).toBe(0);
  });

  it("collapses on the first interaction, but never before it has been readable", () => {
    expect(privacyCollapseIn(500, 400)).toBe(PRIVACY_MIN_MS - 500);
    expect(privacyCollapseIn(PRIVACY_MIN_MS, 400)).toBe(0);
    expect(privacyCollapseIn(4000, 4000)).toBe(0);
    expect(privacyCollapseIn(1000, 6000)).toBe(5000);
  });
});

describe("where a change announcement shows", () => {
  it("a Home section move is silent on /cv, shown on Home with Show me", () => {
    const n = change({ moved: ["JOBS" as SectionId], navChanged: false });
    expect(noticeVisibleOn(n, "/cv")).toBe(false);
    expect(noticeVisibleOn(n, "/jobs")).toBe(false);
    expect(noticeVisibleOn(n, "/")).toBe(true);
    expect(showMeTarget(n)).toBe("JOBS");
  });

  it("a navigation change shows everywhere and has no section to show", () => {
    const n = change({ moved: [], navChanged: true, message: "Swayam updated your navigation." });
    expect(noticeVisibleOn(n, "/cv")).toBe(true);
    expect(showMeTarget(n)).toBeNull();
  });

  it("undo and reset answers always show", () => {
    expect(noticeVisibleOn(change({ kind: "undo", moved: [] }), "/cv")).toBe(true);
    expect(noticeVisibleOn(change({ kind: "reset" }), "/lab")).toBe(true);
  });

  it("a notice without move info shows as before", () => {
    expect(noticeVisibleOn(change(), "/cv")).toBe(true);
  });

  it("a stale change is not shown late", () => {
    const n = change({ moved: [], navChanged: true, at: 1000 });
    expect(noticeVisibleOn(n, "/", 1000 + NOTICE_STALE_MS - 1)).toBe(true);
    expect(noticeVisibleOn(n, "/", 1000 + NOTICE_STALE_MS + 1)).toBe(false);
  });
});

describe("noticeBus", () => {
  it("stamps a change notice with what describeChange found", () => {
    const msg = describeChange(
      ui({ movedUp: [], top: ["HOME"] }),
      ui({ movedUp: ["JOBS"], top: ["HOME"] }),
    );
    noticeBus.set({ id: 7, kind: "change", message: msg, undoable: true });
    expect(noticeBus.get()).toMatchObject({ moved: ["JOBS"], navChanged: false });
    expect(noticeBus.get()?.at).toBeTypeOf("number");
  });

  it("notes a navigation change", () => {
    const msg = describeChange(ui({ top: ["HOME"] }), ui({ top: ["HOME", "JOBS"] }));
    expect(msg).toBe("Swayam updated your navigation.");
    noticeBus.set({ id: 8, kind: "change", message: msg, undoable: true });
    expect(noticeBus.get()).toMatchObject({ moved: [], navChanged: true });
  });

  it("leaves undo and reset notices exactly as given", () => {
    noticeBus.set({
      id: 9,
      kind: "reset",
      message: "Swayam forgot what it learned.",
      undoable: false,
    });
    expect(noticeBus.get()).toEqual({
      id: 9,
      kind: "reset",
      message: "Swayam forgot what it learned.",
      undoable: false,
    });
  });
});
