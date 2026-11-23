// Fills server/cache/videos.json with the most-watched lectures for every chapter.
//   npm run fetch-videos                 → Maths, Science, Physics, Chemistry, Social Science (Classes 8–12)
//   npm run fetch-videos -- --all        → also Biology
//   npm run fetch-videos -- --class 10   → one class only
// Safe to re-run: chapters already cached are skipped. Stops cleanly when the
// daily YouTube quota runs out — run it again tomorrow to continue.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchChapterVideos, readCache, QuotaError } from "../server/videos.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "";
const key = process.env.YOUTUBE_API_KEY || (env.match(/^YOUTUBE_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!key) {
  console.error("Add YOUTUBE_API_KEY=... to .env first (free key from Google Cloud Console → YouTube Data API v3).");
  process.exit(1);
}

const args = process.argv.slice(2);
const all = args.includes("--all");
const onlyClass = args.includes("--class") ? Number(args[args.indexOf("--class") + 1]) : null;
const syllabus = JSON.parse(fs.readFileSync(path.join(root, "src/data/syllabus.json"), "utf8"));
const cache = readCache();

const jobs = [];
for (const [cls, subjects] of Object.entries(syllabus)) {
  if (onlyClass && Number(cls) !== onlyClass) continue;
  for (const s of subjects) {
    if (!all && s.code === "bio") continue;
    s.chapters.forEach((title, i) => {
      const id = `c${cls}-${s.code}-${String(i + 1).padStart(2, "0")}`;
      if (!cache[id]) jobs.push({ id, classLevel: Number(cls), subject: s.name, chapter: title });
    });
  }
}

console.log(`${jobs.length} chapters to fetch (${Object.keys(cache).length} already cached).`);
let done = 0;
for (const job of jobs) {
  try {
    const vids = await fetchChapterVideos(job, key);
    done += 1;
    const top = vids[0] ? `${(vids[0].views / 1e6).toFixed(1)}M views · ${vids[0].channel}` : "no good match";
    console.log(`✓ ${job.id} ${job.chapter} → ${vids.length} videos (${top})`);
  } catch (e) {
    if (e instanceof QuotaError) {
      console.log(`\nDaily YouTube quota reached after ${done} chapters. Run this again tomorrow to continue.`);
      break;
    }
    console.log(`✗ ${job.id} ${job.chapter}: ${e.message}`);
  }
}
console.log(`Done: ${done} fetched this run.`);
