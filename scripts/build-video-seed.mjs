// Turns src/data/videos-seed.txt (hand-picked lectures) into src/data/videos.json,
// fetching each video's real title via YouTube's official oEmbed endpoint and
// dropping any video that no longer exists or cannot be embedded.
//   node scripts/build-video-seed.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [head, body] = fs.readFileSync(path.join(root, "src/data/videos-seed.txt"), "utf8").trim().split(/\r?\n/);
const channels = head.replace(/^CH:/, "").split("|");
const rows = body.split(";").map((r) => {
  const [id, vid, kViews, min, ch] = r.split(",");
  return { chapter: "c" + id, vid, views: Number(kViews) * 1000, sec: Number(min) * 60, channel: channels[Number(ch)] };
});

// Fallbacks (src/data/videos-alt.txt): tried in order when a chapter's first pick can't be embedded.
const altFile = path.join(root, "src/data/videos-alt.txt");
const alts = fs.existsSync(altFile)
  ? fs.readFileSync(altFile, "utf8").trim().split(/\r?\n/).map((l) => {
      const [chapter, vid, kViews, min, ...ch] = l.split(",");
      return { chapter, vid, views: Number(kViews) * 1000, sec: Number(min) * 60, channel: ch.join(",") };
    })
  : [];
rows.push(...alts.map((a) => ({ ...a, alt: true })));

const titles = new Map();
const unique = [...new Set(rows.map((r) => r.vid))];
let i = 0;
async function worker() {
  while (i < unique.length) {
    const vid = unique[i++];
    try {
      const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + vid));
      titles.set(vid, r.ok ? (await r.json()).title : null);
    } catch {
      titles.set(vid, null);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const out = {};
let dropped = 0;
for (const r of rows) {
  const title = titles.get(r.vid);
  if (!title) {
    if (!r.alt) dropped++;
    continue;
  }
  if (r.alt && out[r.chapter]) continue; // primary (or an earlier fallback) already worked
  out[r.chapter] = [{ id: r.vid, title, channel: r.channel, views: r.views, durationSec: r.sec, oneShot: /one\s*shot/i.test(title) }];
}
fs.writeFileSync(path.join(root, "src/data/videos.json"), JSON.stringify(out));
console.log(`chapters: ${Object.keys(out).length}, unique videos: ${unique.length}, dropped (missing/not embeddable): ${dropped}`);
