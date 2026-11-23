// Swyam local server.
//  - POST /api/sarthi    : Sarthi tutor answer (Gemini), grounded in chapter notes
//  - POST /api/generate  : AI notes + quiz + lecture searches for one chapter (JSON)
//  - GET  /api/health    : is the AI configured?
//  - everything else     : serves the built app from ../dist (SPA fallback)
// Plain Node ESM, built-in modules and global fetch only.
// The API key stays on the server and is never logged or returned.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchChapterVideos, readCache, QuotaError } from "./videos.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const DIST = path.join(ROOT, "dist");

const MAX_BODY_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 45000;
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"];

// ── .env loading ────────────────────────────────────────────────────────────
function loadEnvFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && /^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT) || 8787;
const API_KEY = process.env.GEMINI_API_KEY || "";
const MODELS = [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean))];

// ── tiny per-IP rate limit (protects the free-tier quota) ─────────────────────
const hits = new Map();
function rateLimited(ip, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > limit;
}

// ── helpers ─────────────────────────────────────────────────────────────────
function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let done = false;
    req.on("data", (c) => {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        resolve({ tooLarge: true });
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      resolve({ tooLarge: false, text: Buffer.concat(chunks).toString("utf8") });
    });
    req.on("error", (e) => {
      if (done) return;
      done = true;
      reject(e);
    });
  });
}

const str = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/** Calls Gemini, trying each model in order when one is unavailable or rate-limited. */
async function callGemini({ system, prompt, history = [], json = false, maxTokens = 800, temperature = 0.4 }) {
  const contents = [
    ...history.map((h) => ({ role: h.role === "model" ? "model" : "user", parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: prompt }] },
  ];
  const generationConfig = { temperature, maxOutputTokens: maxTokens };
  if (json) generationConfig.responseMimeType = "application/json";

  let lastStatus = 0;
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig }),
        signal: controller.signal,
      });
      if (!r.ok) {
        lastStatus = r.status;
        // 404 = model retired, 429 = quota, 5xx = overloaded → try the next model
        if (r.status === 404 || r.status === 429 || r.status >= 500) continue;
        return { ok: false, status: r.status };
      }
      const data = await r.json().catch(() => null);
      const parts = data?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("") : "";
      if (!text.trim()) {
        lastStatus = 502;
        continue;
      }
      return { ok: true, text, model };
    } catch {
      lastStatus = 504;
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: lastStatus || 502 };
}

// ── /api/sarthi ─────────────────────────────────────────────────────────────
const LANG_RULE = {
  en: "Reply in simple English.",
  hi: "Reply in simple Hindi written in Devanagari script.",
  hinglish: "Reply in Hinglish (Hindi words written in Roman/English letters, mixed naturally with English).",
};

function sarthiSystem(p) {
  return [
    `You are Sarthi, a warm, patient personal tutor for a CBSE Class ${p.classLevel} student in India studying ${p.subject}.`,
    `Current chapter: "${p.chapter}".`,
    "Use the lesson material when it is relevant. If it does not cover the question, answer from standard NCERT/CBSE knowledge for this class and keep it accurate.",
    "Teach step by step in short paragraphs or numbered steps. Use one everyday Indian example when it helps. For maths, show each step.",
    "Keep answers under 180 words unless the student asks for more. End with one short check-your-understanding question when it fits.",
    "Never invent facts, references, video links or exam questions you are not sure about. Never claim to be human.",
    LANG_RULE[p.lang] || LANG_RULE.en,
    "Plain text only: no markdown headings, no tables, no asterisks for bold.",
  ].join(" ");
}

async function handleSarthi(payload, res) {
  const { question, context = "", lang = "en", classLevel = 10, subject = "", chapter = "", history = [] } = payload || {};
  if (!str(question, 1000) || typeof context !== "string" || context.length > 8000) {
    return sendJson(res, 400, { error: "invalid request" });
  }
  const safeHistory = Array.isArray(history)
    ? history
        .filter((h) => h && (h.role === "user" || h.role === "model") && str(h.text, 2000))
        .slice(-8)
    : [];
  const result = await callGemini({
    system: sarthiSystem({ lang, classLevel: Number(classLevel) || 10, subject: String(subject).slice(0, 60), chapter: String(chapter).slice(0, 120) }),
    prompt: (context ? "Lesson material:\n" + context + "\n\n" : "") + "Student: " + question,
    history: safeHistory,
    maxTokens: 700,
  });
  if (!result.ok) return sendJson(res, 502, { error: "model request failed", status: result.status });
  sendJson(res, 200, { answer: result.text.replace(/\*\*/g, "").trim() });
}

// ── /api/generate ───────────────────────────────────────────────────────────
const GEN_SYSTEM =
  "You write original, accurate study material for Indian CBSE (NCERT-aligned) school students. " +
  "Write in your own words; never copy textbook passages. Be correct above all: if unsure of a fact, leave it out. " +
  "Return ONLY valid JSON matching the requested shape. No markdown.";

function genPrompt(p) {
  return `Create study material for CBSE Class ${p.classLevel} ${p.subject}, chapter "${p.chapter}".
Return JSON exactly in this shape:
{
  "topics": [4 to 6 short topic names covered in this chapter],
  "lectures": [ {"title": string, "searchQuery": string, "durationMin": number} ] (exactly 2; searchQuery is what a student would type into YouTube to find a good lecture on it, include "class ${p.classLevel}" and "CBSE"),
  "notes": [ 4 to 5 sections, each {
      "heading": "1. <topic>",
      "body": [2 or 3 clear paragraphs, simple language, each under 70 words],
      "definitions": [0 to 3 {"term": string, "meaning": string}],
      "formulas": [0 to 3 strings, only if the subject has formulas for this topic],
      "examples": [0 or 1 {"question": string, "answer": string} worked/solved example]
  } ],
  "summary": [4 to 6 one-line key points for quick revision],
  "examFocus": [ 5 {"question": string, "marks": 1|2|3|5, "hint": one-line answer hint} ] — the kinds of questions CBSE board/school exams most often ask from this chapter, based on common exam patterns,
  "quiz": [ exactly 6 MCQs {"topic": one of the topics, "question": string, "options": [4 strings], "correctIndex": 0-3, "explanation": one or two sentences explaining why} ]
}
Make the quiz test understanding, vary the position of the correct option, and make sure correctIndex is right.
Write maths and chemistry with proper Unicode notation: x², x³, √2, ½, π, θ, ≤, ≥, ≠, →, H₂O, CO₂, Fe³⁺ — never words like "x squared" or "root 2".`;
}

function validGenerated(g) {
  if (!g || typeof g !== "object") return false;
  if (!Array.isArray(g.topics) || g.topics.length < 2) return false;
  if (!Array.isArray(g.notes) || g.notes.length < 2) return false;
  if (!g.notes.every((n) => n && typeof n.heading === "string" && Array.isArray(n.body))) return false;
  if (!Array.isArray(g.quiz) || g.quiz.length < 3) return false;
  return g.quiz.every(
    (q) =>
      q &&
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 &&
      q.correctIndex < 4,
  );
}

async function handleGenerate(payload, res) {
  const { classLevel, subject, chapter } = payload || {};
  const cls = Number(classLevel);
  if (![8, 9, 10, 11, 12].includes(cls) || !str(subject, 60) || !str(chapter, 120)) {
    return sendJson(res, 400, { error: "invalid request" });
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callGemini({
      system: GEN_SYSTEM,
      prompt: genPrompt({ classLevel: cls, subject, chapter }),
      json: true,
      maxTokens: 6000,
      temperature: 0.3,
    });
    if (!result.ok) return sendJson(res, 502, { error: "model request failed", status: result.status });
    let parsed = null;
    try {
      parsed = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      parsed = null;
    }
    if (validGenerated(parsed)) return sendJson(res, 200, { content: parsed, model: result.model });
  }
  sendJson(res, 502, { error: "the AI returned material in an unexpected shape; try again" });
}

// ── /api/solve : step-by-step numerical for the animated whiteboard ─────────
const SOLVE_SYSTEM =
  "You are Sarthi, a CBSE teacher solving a numerical on a blackboard for a Class 8–12 student. " +
  "Be mathematically correct: re-check every calculation and unit before answering. " +
  "Use Unicode notation (x², √, π, θ, ×, ÷, →, subscripts like v₀, H₂O). Return ONLY valid JSON.";

function solvePrompt(p) {
  return `Class ${p.classLevel} ${p.subject}, chapter "${p.chapter}". Solve this numerical step by step:
"${p.question}"
Return JSON:
{
  "given": [short lines like "m = 2 kg", "v = 10 m/s"],
  "find": "what we must find, e.g. Kinetic energy (K)",
  "formula": "the main formula used, e.g. K = ½mv²",
  "steps": [ 3 to 7 objects {"board": "what is written on the board for this step (an equation or short line)", "say": "what the teacher says aloud while writing it, 1–2 short sentences, in ${p.lang === "hi" ? "Hindi (Devanagari)" : p.lang === "hinglish" ? "Hinglish (Roman script)" : "simple English"}"} ],
  "answer": "final answer with unit, e.g. K = 100 J",
  "tip": "one exam tip or common mistake, in the same language as 'say'"
}
If the question is not a numerical, still explain it as steps on the board.`;
}

async function handleSolve(payload, res) {
  const { question, lang = "en", classLevel = 10, subject = "", chapter = "" } = payload || {};
  if (!str(question, 800)) return sendJson(res, 400, { error: "invalid request" });
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callGemini({
      system: SOLVE_SYSTEM,
      prompt: solvePrompt({ question, lang, classLevel: Number(classLevel) || 10, subject: String(subject).slice(0, 60), chapter: String(chapter).slice(0, 120) }),
      json: true,
      maxTokens: 2000,
      temperature: 0.1,
    });
    if (!result.ok) return sendJson(res, 502, { error: "model request failed", status: result.status });
    let s = null;
    try {
      s = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      s = null;
    }
    if (s && Array.isArray(s.steps) && s.steps.length && s.answer) return sendJson(res, 200, { solution: s });
  }
  sendJson(res, 502, { error: "Could not prepare a board solution. Try rephrasing the question." });
}

// ── /api/agent : turn a spoken/typed command into an app action ─────────────
const AGENT_SYSTEM = `You are Sarthi, the voice assistant inside Swyam, a free CBSE learning app (Classes 8–12).
Turn the user's message into ONE action for the app. Return ONLY JSON: {"action": string, "args": object, "reply": string}.
Actions:
- "navigate": args {"page": "home"|"dashboard"|"courses"|"learn"|"sarthi"|"planner"|"rewards"|"login"}
- "open_chapter": args {"classLevel": 8-12 or null, "subject": "science"|"mathematics"|"social-science"|"physics"|"chemistry"|"biology" or null, "chapter": chapter name or number as string}
- "open_course": args {"classLevel": 8-12 or null, "subject": subject id}
- "start_quiz": same args as open_chapter
- "solve": args {"question": the numerical to solve step by step}
- "answer": args {"question": the study doubt} — for any concept/doubt question
- "set_theme": args {"mode": "dark"|"light"}
- "set_language": args {"lang": "en"|"hi"|"hinglish"}
- "logout": args {}
- "chat": args {} — greetings/small talk; put the full friendly answer in reply
"reply" is a short spoken confirmation (max 15 words) in the user's language style (English, Hindi in Devanagari, or Hinglish in Roman script).
Use the student's class from context when they don't say one. Numerical problems → "solve". Never invent pages that are not listed.`;

async function handleAgent(payload, res) {
  const { text, context = {} } = payload || {};
  if (!str(text, 600)) return sendJson(res, 400, { error: "invalid request" });
  const ctx = `Context: page=${String(context.page || "").slice(0, 60)}; role=${String(context.role || "guest").slice(0, 20)}; class=${Number(context.classLevel) || "unknown"}.`;
  const result = await callGemini({ system: AGENT_SYSTEM, prompt: ctx + "\nUser: " + text, json: true, maxTokens: 300, temperature: 0.1 });
  if (!result.ok) return sendJson(res, 502, { error: "model request failed" });
  try {
    const j = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (typeof j.action !== "string") throw new Error("shape");
    sendJson(res, 200, { action: j.action, args: j.args && typeof j.args === "object" ? j.args : {}, reply: String(j.reply || "").slice(0, 400) });
  } catch {
    sendJson(res, 200, { action: "answer", args: { question: text }, reply: "" });
  }
}

// ── /api/tts : natural voice via Gemini TTS, cached on disk ─────────────────
const TTS_MODELS = ["gemini-2.5-flash-preview-tts"];
const TTS_DIR = path.join(here, "cache", "tts");
const TTS_STYLE = {
  en: "Say this like a warm, friendly Indian school teacher explaining to a student, clear and unhurried:",
  hinglish: "Say this in natural Hinglish like a warm, friendly Indian school teacher (Hindi words with an Indian accent), clear and unhurried:",
  hi: "इसे एक स्नेही भारतीय शिक्षक की तरह साफ़ और आराम से हिंदी में बोलिए:",
};

function pcmToWav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function handleTts(payload, res) {
  const { text, lang = "en", voice = "Kore" } = payload || {};
  if (!str(text, 700)) return sendJson(res, 400, { error: "invalid request" });
  const safeVoice = /^[A-Z][a-z]+$/.test(voice) ? voice : "Kore";
  const key = (await import("node:crypto")).createHash("sha1").update(`${lang}|${safeVoice}|${text}`).digest("hex");
  const file = path.join(TTS_DIR, key + ".wav");
  if (fs.existsSync(file)) {
    res.writeHead(200, { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000" });
    return fs.createReadStream(file).pipe(res);
  }
  for (const model of TTS_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${TTS_STYLE[lang] || TTS_STYLE.en} ${text}` }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: safeVoice } } } },
        }),
        signal: controller.signal,
      });
      if (!r.ok) {
        if (r.status === 429) return sendJson(res, 429, { error: "voice quota used up" });
        continue;
      }
      const j = await r.json().catch(() => null);
      const data = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!data?.data) continue;
      const rate = Number(/rate=(\d+)/.exec(data.mimeType || "")?.[1]) || 24000;
      const wav = pcmToWav(Buffer.from(data.data, "base64"), rate);
      fs.mkdirSync(TTS_DIR, { recursive: true });
      fs.writeFileSync(file, wav);
      res.writeHead(200, { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000" });
      return res.end(wav);
    } catch {
      /* try next */
    } finally {
      clearTimeout(timer);
    }
  }
  sendJson(res, 502, { error: "voice unavailable" });
}

// ── static files (built app) ────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function serveStatic(pathname, res) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Swyam API server is running. Build the app first (npm run build) or use `npm run dev`.");
    return;
  }
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  let file = path.join(DIST, safe);
  if (!file.startsWith(DIST)) file = DIST;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  const ext = path.extname(file);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(file).pipe(res);
}

// ── server ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const started = Date.now();
  const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
  if (pathname.startsWith("/api/")) {
    res.on("finish", () => console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`));
  }

  if (pathname === "/api/health") {
    return sendJson(res, 200, { ai: Boolean(API_KEY), models: API_KEY ? MODELS : [] });
  }

  if (pathname === "/api/videos-all" && req.method === "GET") {
    const c = readCache();
    const out = {};
    for (const [id, v] of Object.entries(c)) out[id] = v.videos;
    return sendJson(res, 200, { videos: out, youtube: Boolean(process.env.YOUTUBE_API_KEY) });
  }

  if (pathname === "/api/videos" && req.method === "POST") {
    (async () => {
      const raw = await readBody(req);
      let p = null;
      try {
        p = raw.tooLarge ? null : JSON.parse(raw.text);
      } catch {
        p = null;
      }
      if (!p || !/^c\d+-[a-z]+-\d+$/.test(p.id || "") || !str(p.subject, 60) || !str(p.chapter, 120)) {
        return sendJson(res, 400, { error: "invalid request" });
      }
      const cached = readCache()[p.id];
      if (cached) return sendJson(res, 200, { videos: cached.videos, cached: true });
      const ytKey = process.env.YOUTUBE_API_KEY || "";
      if (!ytKey) return sendJson(res, 503, { error: "YouTube lecture search is not configured (YOUTUBE_API_KEY missing)." });
      if (rateLimited("yt:" + (req.socket.remoteAddress || "local"), 20)) return sendJson(res, 429, { error: "Too many requests." });
      try {
        const videos = await fetchChapterVideos({ id: p.id, classLevel: Number(p.classLevel), subject: p.subject, chapter: p.chapter }, ytKey);
        sendJson(res, 200, { videos, cached: false });
      } catch (e) {
        sendJson(res, e instanceof QuotaError ? 429 : 502, { error: e instanceof QuotaError ? "Today's YouTube quota is used up. Videos for new chapters will load tomorrow." : "Could not reach YouTube." });
      }
    })().catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: "server error" });
    });
    return;
  }

  if (pathname === "/api/sarthi" || pathname === "/api/generate" || pathname === "/api/solve" || pathname === "/api/tts" || pathname === "/api/agent") {
    if (req.method !== "POST") {
      req.resume();
      return sendJson(res, 405, { error: "method not allowed" }, { Allow: "POST" });
    }
    if (!API_KEY) {
      req.resume();
      return sendJson(res, 503, { error: "Sarthi AI is not configured. Add GEMINI_API_KEY to .env." });
    }
    const ip = req.socket.remoteAddress || "local";
    const isTts = pathname === "/api/tts";
    if (rateLimited(isTts ? "tts:" + ip : ip, isTts ? 90 : 30)) {
      req.resume();
      return sendJson(res, 429, { error: "Too many requests. Wait a minute and try again." });
    }
    (async () => {
      const raw = await readBody(req);
      if (raw.tooLarge) return sendJson(res, 413, { error: "request too large" });
      let payload;
      try {
        payload = JSON.parse(raw.text);
      } catch {
        return sendJson(res, 400, { error: "invalid request" });
      }
      if (pathname === "/api/sarthi") return handleSarthi(payload, res);
      if (pathname === "/api/solve") return handleSolve(payload, res);
      if (pathname === "/api/tts") return handleTts(payload, res);
      if (pathname === "/api/agent") return handleAgent(payload, res);
      return handleGenerate(payload, res);
    })().catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: "server error" });
    });
    return;
  }

  if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });
  if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "method not allowed" });
  serveStatic(pathname, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Swyam running at http://127.0.0.1:${PORT}  (AI: ${API_KEY ? "on, " + MODELS[0] : "off"})`);
});
