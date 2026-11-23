// YouTube Data API v3 search proxy. Server-side only; the key never leaves this file.
// Plain Node ESM, global fetch only. Request logging is done by the caller (sarthi-server.mjs).

const ROUTE = "/api/youtube/search";
const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const TIMEOUT_MS = 15000;
const MAX_RESULTS = 10;

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

// Returns { ok: true, data } or { ok: false }. Never exposes the upstream body.
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) return { ok: false };
    return { ok: true, data: await upstream.json() };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function runSearch(req, res, url) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const key = process.env.YOUTUBE_API_KEY || "";
  if (!key) {
    sendJson(res, 503, {
      error: "YouTube search is not configured. Add YOUTUBE_API_KEY to .env.",
    });
    return;
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 120) {
    sendJson(res, 400, { error: "Query q must be 1-120 characters." });
    return;
  }

  const search = await fetchJson(
    `${SEARCH_URL}?${new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: String(MAX_RESULTS),
      q,
      relevanceLanguage: "en",
      key,
    })}`,
  );
  if (!search.ok) {
    sendJson(res, 502, { error: "YouTube search failed upstream." });
    return;
  }

  const items = Array.isArray(search.data?.items) ? search.data.items : [];
  const videoItems = items.filter((it) => typeof it?.id?.videoId === "string");
  if (videoItems.length === 0) {
    sendJson(res, 200, []);
    return;
  }

  const ids = videoItems.map((it) => it.id.videoId).join(",");
  const details = await fetchJson(
    `${VIDEOS_URL}?${new URLSearchParams({
      part: "statistics,contentDetails",
      id: ids,
      key,
    })}`,
  );
  if (!details.ok) {
    sendJson(res, 502, { error: "YouTube video details failed upstream." });
    return;
  }

  const detailById = new Map();
  const detailItems = Array.isArray(details.data?.items) ? details.data.items : [];
  for (const v of detailItems) detailById.set(v?.id, v);

  const results = videoItems.map((it) => {
    const snippet = it.snippet ?? {};
    const detail = detailById.get(it.id.videoId);
    const rawViews = detail?.statistics?.viewCount;
    return {
      videoId: it.id.videoId,
      title: snippet.title ?? "",
      channel: snippet.channelTitle ?? "",
      publishedAt: snippet.publishedAt ?? null,
      viewCount: rawViews != null ? Number(rawViews) : null,
      durationIso: detail?.contentDetails?.duration ?? null,
    };
  });

  sendJson(res, 200, results);
}

// Returns true when this module handled the request (the caller must stop), false otherwise.
export function handleYouTube(req, res, url) {
  if (url.pathname !== ROUTE) return false;
  runSearch(req, res, url).catch(() => {
    if (!res.headersSent) sendJson(res, 502, { error: "YouTube search failed." });
  });
  return true;
}
