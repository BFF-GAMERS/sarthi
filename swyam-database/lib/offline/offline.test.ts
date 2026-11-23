import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatApprox,
  formatBytes,
  hasRoomFor,
  measureBytes,
  quotaFraction,
  totalBytes,
} from "./format";
import {
  deleteAllPacks,
  deletePack,
  estimateQuota,
  getPack,
  isStorageAvailable,
  listPacks,
  putPack,
  toMeta,
  type StoredPack,
} from "./store";
import { sanitizeContent } from "./pack";
import { CACHE_NAME, CACHE_PREFIX, extractAssetUrls, isSecureOrigin } from "./sw-register";
import { packLessonToDetail, packToLearnState } from "../learn";

const pack: StoredPack = {
  courseSlug: "ui-ux-figma",
  title: "UI/UX Design with Figma",
  bytes: 1234,
  savedAt: 1_700_000_000_000,
  lessons: [
    {
      id: "l2",
      title: "Frames",
      position: 2,
      moduleTitle: "Basics",
      modulePosition: 1,
      kind: "text",
      durationMinutes: 8,
      content: { objective: "Use frames", body: ["One", "Two"], practice: [] },
      transcript: null,
    },
    {
      id: "l1",
      title: "Welcome",
      position: 1,
      moduleTitle: "Basics",
      modulePosition: 1,
      kind: "video",
      durationMinutes: 5,
      content: {},
      transcript: "Hello and welcome.",
    },
    {
      id: "l3",
      title: "Components",
      position: 1,
      moduleTitle: "Systems",
      modulePosition: 2,
      kind: "text",
      durationMinutes: null,
      content: { checklist: ["a"] },
      transcript: null,
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("size and quota maths", () => {
  it("measures UTF-8 bytes, not characters", () => {
    expect(measureBytes("abc")).toBe(3);
    expect(measureBytes("नमस्ते")).toBeGreaterThan(6);
    expect(measureBytes({ a: 1 })).toBe(7);
  });

  it("formats sizes the way a person would say them", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(180 * 1024)).toBe("180 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(NaN)).toBe("0 B");
  });

  it("rounds an estimate to 'About 180 KB'", () => {
    expect(formatApprox(183 * 1024)).toBe("About 180 KB");
    expect(formatApprox(40 * 1024)).toBe("About 40 KB");
    expect(formatApprox(3 * 1024 * 1024)).toBe("About 3.0 MB");
  });

  it("clamps the quota share and survives a missing quota", () => {
    expect(quotaFraction(50, 200)).toBe(0.25);
    expect(quotaFraction(500, 200)).toBe(1);
    expect(quotaFraction(10, 0)).toBe(0);
    expect(quotaFraction(-5, 100)).toBe(0);
  });

  it("asks for headroom before a download, and tries anyway with no estimate", () => {
    expect(hasRoomFor(100, null)).toBe(true);
    expect(hasRoomFor(100, { usage: 0, quota: 1000 })).toBe(true);
    expect(hasRoomFor(100, { usage: 900, quota: 1000 })).toBe(false);
    expect(hasRoomFor(100, { usage: 790, quota: 1000 })).toBe(true);
  });

  it("totals pack sizes", () => {
    expect(totalBytes([{ bytes: 10 }, { bytes: 5 }, { bytes: NaN }])).toBe(15);
    expect(toMeta(pack)).toEqual({
      courseSlug: "ui-ux-figma",
      title: "UI/UX Design with Figma",
      bytes: 1234,
      savedAt: 1_700_000_000_000,
      lessonCount: 3,
    });
  });
});

describe("store with no usable IndexedDB", () => {
  it("is a clean no-op when indexedDB is missing", async () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(isStorageAvailable()).toBe(false);
    expect(await listPacks()).toEqual([]);
    expect(await getPack("x")).toBeNull();
    expect(await putPack(pack)).toEqual({ ok: false, reason: "unavailable" });
    expect(await deletePack("x")).toEqual({ ok: false, reason: "unavailable" });
    expect(await deleteAllPacks()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("does not throw when opening the database throws", async () => {
    vi.stubGlobal("indexedDB", {
      open() {
        throw new Error("SecurityError");
      },
    });
    expect(isStorageAvailable()).toBe(true);
    expect(await listPacks()).toEqual([]);
    expect(await putPack(pack)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns null for the quota when the browser cannot estimate", async () => {
    vi.stubGlobal("navigator", {});
    expect(await estimateQuota()).toBeNull();
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ usage: 5, quota: 100 }) } });
    expect(await estimateQuota()).toEqual({ usage: 5, quota: 100 });
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => {
          throw new Error("denied");
        },
      },
    });
    expect(await estimateQuota()).toBeNull();
  });
});

describe("what goes into a pack", () => {
  it("keeps lesson text fields and drops everything else", () => {
    const out = sanitizeContent({
      objective: "o",
      body: ["b"],
      practice: [{ q: "?" }],
      media_url: "https://cdn.example/video.mp4",
      embed: "<iframe src='https://youtube.com/embed/x'></iframe>",
      captions_url: "https://cdn.example/c.vtt",
    });
    expect(Object.keys(out).sort()).toEqual(["body", "objective", "practice"]);
    expect(JSON.stringify(out)).not.toMatch(/youtube|mp4|vtt/);
  });

  it("tolerates content that is not an object", () => {
    expect(sanitizeContent(null)).toEqual({});
    expect(sanitizeContent("text")).toEqual({});
    expect(sanitizeContent([1, 2])).toEqual({});
  });
});

describe("serving the Learn page from a pack", () => {
  it("builds the contents list in module and lesson order, with nothing ticked", () => {
    const s = packToLearnState(pack);
    expect(s.enrolled).toBe(true);
    expect(s.enrollmentId).toBeNull();
    expect(s.lessonsTotal).toBe(3);
    expect(s.modules.map((m) => m.title)).toEqual(["Basics", "Systems"]);
    expect(s.modules[0]!.lessons.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(s.modules.every((m) => m.unlocked && !m.complete)).toBe(true);
    expect(s.modules.flatMap((m) => m.lessons).every((l) => !l.completed && !l.bookmarked)).toBe(
      true,
    );
  });

  it("returns lesson text with no video, note or bookmark, and flags the copy", () => {
    const d = packLessonToDetail(pack, "l1")!;
    expect(d.offlineCopy).toBe(true);
    expect(d.videoId).toBeNull();
    expect(d.note).toBe("");
    expect(d.bookmarked).toBe(false);
    expect(d.transcript).toBe("Hello and welcome.");
    const t = packLessonToDetail(pack, "l2")!;
    expect(t.body).toEqual(["One", "Two"]);
    expect(t.objective).toBe("Use frames");
    expect(packLessonToDetail(pack, "missing")).toBeNull();
  });
});

describe("service worker registration helpers", () => {
  it("only registers on https or a local development host", () => {
    expect(isSecureOrigin("https:", "www.swyam.online")).toBe(true);
    expect(isSecureOrigin("http:", "localhost")).toBe(true);
    expect(isSecureOrigin("http:", "127.0.0.1")).toBe(true);
    expect(isSecureOrigin("http:", "swayam.test")).toBe(false);
    expect(isSecureOrigin("http:", "example.com")).toBe(false);
  });

  it("finds only same-origin hashed js and css in a page", () => {
    const html = `
      <link rel="modulepreload" href="/assets/learn-abc123.js">
      <link rel="stylesheet" href="/assets/index-9f.css">
      <script type="module" src="/assets/index-77.js"></script>
      <script src="https://cdn.example.com/assets/evil.js"></script>
      <img src="/assets/photo.png">
      <link rel="modulepreload" href="/assets/learn-abc123.js">`;
    expect(extractAssetUrls(html)).toEqual([
      "/assets/learn-abc123.js",
      "/assets/index-9f.css",
      "/assets/index-77.js",
    ]);
    expect(extractAssetUrls(html, 1)).toHaveLength(1);
  });
});

describe("public/sw.js", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../../../public/sw.js", import.meta.url)),
    "utf8",
  );
  const mod = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(src, { module: mod, URL });
  const sw = mod.exports as {
    classify: (m: string, url: string, mode: string, origin: string) => string | null;
    cacheable: (r: unknown) => boolean;
    CACHE_NAME: string;
    CACHE_PREFIX: string;
  };
  const O = "https://www.swyam.online";
  const c = (m: string, path: string, mode = "navigate", origin = O) =>
    sw.classify(m, path.startsWith("http") ? path : origin + path, mode, O);

  it("uses the same cache name as the page side", () => {
    expect(sw.CACHE_NAME).toBe(CACHE_NAME);
    expect(sw.CACHE_PREFIX).toBe(CACHE_PREFIX);
  });

  it("handles a lesson page navigation and hashed build assets", () => {
    expect(c("GET", "/learn/ui-ux-figma")).toBe("page");
    expect(c("GET", "/assets/index-abc.js", "cors")).toBe("asset");
    expect(c("GET", "/assets/index-abc.css", "no-cors")).toBe("asset");
  });

  it("never touches a mutation, however it is addressed", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(c(m, "/learn/ui-ux-figma")).toBeNull();
      expect(c(m, "/assets/index-abc.js", "cors")).toBeNull();
    }
  });

  it("ignores home, auth, api, evolution and other origins", () => {
    expect(c("GET", "/")).toBeNull();
    expect(c("GET", "/auth")).toBeNull();
    expect(c("GET", "/auth/callback?code=1")).toBeNull();
    expect(c("GET", "/api/evolution/track", "cors")).toBeNull();
    expect(c("GET", "/evolution/anything")).toBeNull();
    expect(c("GET", "/courses/ui-ux-figma")).toBeNull();
    expect(c("GET", "/learn/")).toBeNull();
    expect(c("GET", "/learn/ui-ux-figma", "cors")).toBeNull();
    expect(c("GET", "/assets/photo.png", "cors")).toBeNull();
    expect(c("GET", "https://abc.supabase.co/rest/v1/lessons?select=*", "cors")).toBeNull();
    expect(c("GET", "https://abc.supabase.co/assets/index.js", "cors")).toBeNull();
    expect(c("GET", "https://www.youtube-nocookie.com/embed/x", "navigate")).toBeNull();
  });

  it("skips a URL that carries a token or code", () => {
    expect(c("GET", "/learn/x?access_token=abc")).toBeNull();
    expect(c("GET", "/learn/x?code=abc")).toBeNull();
  });

  it("only stores same-origin successes that allow it", () => {
    const res = (init: { ok: boolean; type: string; cc?: string }) => ({
      ok: init.ok,
      type: init.type,
      headers: { get: () => init.cc ?? null },
    });
    expect(sw.cacheable(res({ ok: true, type: "basic" }))).toBe(true);
    expect(sw.cacheable(res({ ok: false, type: "basic" }))).toBe(false);
    expect(sw.cacheable(res({ ok: true, type: "cors" }))).toBe(false);
    expect(sw.cacheable(res({ ok: true, type: "basic", cc: "private, max-age=0" }))).toBe(false);
    expect(sw.cacheable(res({ ok: true, type: "basic", cc: "no-store" }))).toBe(false);
  });
});
