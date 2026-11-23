// Picks the most-watched relevant YouTube lectures for a chapter using the
// official YouTube Data API v3 (no scraping, no invented IDs), and caches the
// result in server/cache/videos.json so each chapter costs quota only once.
//
// Quota: 1 search (100 units) + 1 videos.list (1 unit) per chapter.
// The free daily quota is 10,000 units ≈ 99 chapters per day.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(here, "cache");
const CACHE_FILE = path.join(CACHE_DIR, "videos.json");

const STOP = new Set(["and", "the", "of", "in", "a", "an", "to", "its", "their", "some", "our", "with", "for", "is", "how", "do", "what", "why", "on", "from"]);

let cache = null;
export function readCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

function writeCache() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = CACHE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 1));
  fs.renameSync(tmp, CACHE_FILE);
}

function isoToSeconds(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

function keywords(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export class QuotaError extends Error {}

/**
 * @param {{id:string, classLevel:number, subject:string, chapter:string}} ch
 * @param {string} key YouTube Data API key
 * @returns {Promise<Array<{id,title,channel,views,durationSec,publishedAt,oneShot}>>}
 */
export async function fetchChapterVideos(ch, key, { force = false } = {}) {
  const c = readCache();
  if (!force && c[ch.id]) return c[ch.id].videos;

  const q = `class ${ch.classLevel} ${ch.subject} ${ch.chapter} cbse`;
  const searchUrl =
    "https://www.googleapis.com/youtube/v3/search?" +
    new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "25",
      order: "relevance",
      regionCode: "IN",
      videoEmbeddable: "true",
      safeSearch: "strict",
      q,
      key,
    });
  const s = await fetch(searchUrl);
  const sj = await s.json().catch(() => ({}));
  if (!s.ok) {
    const reason = sj?.error?.errors?.[0]?.reason || "";
    if (reason.includes("quota")) throw new QuotaError("YouTube daily quota used up");
    throw new Error(`YouTube search failed (${s.status}${reason ? ": " + reason : ""})`);
  }
  const ids = (sj.items || []).map((it) => it.id?.videoId).filter(Boolean);
  if (ids.length === 0) {
    c[ch.id] = { fetchedAt: new Date().toISOString(), query: q, videos: [] };
    writeCache();
    return [];
  }

  const v = await fetch(
    "https://www.googleapis.com/youtube/v3/videos?" +
      new URLSearchParams({ part: "snippet,statistics,contentDetails,status", id: ids.join(","), key }),
  );
  const vj = await v.json().catch(() => ({}));
  if (!v.ok) {
    const reason = vj?.error?.errors?.[0]?.reason || "";
    if (reason.includes("quota")) throw new QuotaError("YouTube daily quota used up");
    throw new Error(`YouTube videos lookup failed (${v.status})`);
  }

  const kw = keywords(ch.chapter);
  const classRe = new RegExp(`\\b(class|std|grade)?\\s*${ch.classLevel}(th)?\\b|cbse|ncert`, "i");
  const videos = (vj.items || [])
    .filter((it) => it.status?.embeddable !== false && it.status?.privacyStatus === "public")
    .map((it) => ({
      id: it.id,
      title: decodeEntities(it.snippet?.title || ""),
      channel: it.snippet?.channelTitle || "",
      views: Number(it.statistics?.viewCount || 0),
      durationSec: isoToSeconds(it.contentDetails?.duration),
      publishedAt: it.snippet?.publishedAt || "",
    }))
    .filter((x) => x.durationSec >= 8 * 60 && x.durationSec <= 5 * 3600) // full lectures, not shorts
    .filter((x) => {
      const t = x.title.toLowerCase();
      const hits = kw.filter((w) => t.includes(w)).length;
      return hits >= Math.min(1, kw.length) && classRe.test(x.title);
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 4)
    .map((x) => ({ ...x, oneShot: /one\s*shot/i.test(x.title) }));

  c[ch.id] = { fetchedAt: new Date().toISOString(), query: q, videos };
  writeCache();
  return videos;
}
