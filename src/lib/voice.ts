/*
 * Browser speech input and output. Nothing here sends audio to a server:
 * recognition and synthesis are whatever the browser provides, and some
 * browsers route recognition through their own cloud service.
 *
 * Recognition types are declared locally and loosely, so this file does not
 * depend on DOM speech-recognition typings, which are missing from many TS libs.
 */

export type SpeechLang = "en-IN" | "hi-IN";

interface RecognitionAlternativeLike {
  transcript: string;
}

interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<RecognitionAlternativeLike>>;
}

interface RecognitionErrorEventLike {
  error?: string;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

const UNSUPPORTED_INPUT = "Voice input is not supported in this browser. Use the text box.";

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function errorMessage(code: string | undefined): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied.";
    case "no-speech":
      return "No speech was heard. Try again.";
    case "audio-capture":
      return "No microphone was found.";
    default:
      return "Voice input failed. Try again or use the text box.";
  }
}

export function speechInputSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function speechOutputSupported(): boolean {
  return typeof window !== "undefined" && (typeof Audio !== "undefined" || "speechSynthesis" in window);
}

/**
 * Listens once (continuous = false) and reports the transcript.
 * Returns a function that stops listening early.
 */
export function listen(
  lang: SpeechLang,
  onResult: (text: string) => void,
  onEnd: () => void,
  onError: (msg: string) => void,
): () => void {
  const noop = (): void => {};
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    onError(UNSUPPORTED_INPUT);
    return noop;
  }

  let rec: RecognitionLike;
  try {
    rec = new Ctor();
  } catch {
    onError(UNSUPPORTED_INPUT);
    return noop;
  }

  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = false;

  rec.onresult = (event: RecognitionEventLike) => {
    const alternative = event.results[0]?.[0];
    const text = (alternative?.transcript ?? "").trim();
    if (text.length > 0) onResult(text);
  };
  rec.onerror = (event: RecognitionErrorEventLike) => {
    onError(errorMessage(event.error));
  };
  rec.onend = () => {
    onEnd();
  };

  try {
    rec.start();
  } catch {
    onError("Could not start voice input. Try again.");
    return noop;
  }

  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}

/* ── Speech output ─────────────────────────────────────────────────────────
 * 1st choice: natural AI voice from the server (/api/tts → Gemini TTS, cached).
 * Fallback: the browser's best installed voice (prefers "Natural"/"Google" voices).
 * Long text is split into sentence chunks so speech starts quickly and the
 * next chunk downloads while the current one plays.
 */

let session = 0;
let current: HTMLAudioElement | null = null;
let ttsDownUntil = 0;
const audioCache = new Map<string, Promise<string | null>>();

type TtsLang = "en" | "hi" | "hinglish";
const ttsLang = (text: string, lang: SpeechLang): TtsLang => (lang === "en-IN" ? "en" : /[ऀ-ॿ]/.test(text) ? "hi" : "hinglish");

function chunk(text: string, max = 240): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?।])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).trim().length > max && cur) {
      out.push(cur.trim());
      cur = s;
    } else cur = (cur + " " + s).trim();
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length > 650 ? c.match(/.{1,600}(\s|$)/g) ?? [c] : [c]));
}

function fetchAudio(text: string, lang: TtsLang): Promise<string | null> {
  if (Date.now() < ttsDownUntil) return Promise.resolve(null);
  const key = lang + "|" + text;
  const hit = audioCache.get(key);
  if (hit) return hit;
  const p = fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  })
    .then(async (r) => {
      if (!r.ok) {
        // quota used up or AI voice not configured: use the browser voice for a while
        if (r.status === 429 || r.status === 503) ttsDownUntil = Date.now() + 10 * 60_000;
        audioCache.delete(key);
        return null;
      }
      return URL.createObjectURL(await r.blob());
    })
    .catch(() => {
      audioCache.delete(key);
      return null;
    });
  audioCache.set(key, p);
  return p;
}

/** Starts downloading the natural voice for a line before it is needed. */
export function prefetchSpeech(text: string, lang: SpeechLang): void {
  const parts = chunk(text);
  if (parts[0]) void fetchAudio(parts[0], ttsLang(text, lang));
}

function bestVoice(lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const same = voices.filter((v) => v.lang.replace("_", "-") === lang);
  const family = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  const pool = same.length ? same : family;
  return (
    pool.find((v) => /natural|online|neural/i.test(v.name)) ??
    pool.find((v) => /google/i.test(v.name)) ??
    pool[0]
  );
}

function browserSpeak(text: string, lang: SpeechLang, onStart: (() => void) | undefined, onEnd: (() => void) | undefined, rate: number, my: number) {
  if (!("speechSynthesis" in window)) return onEnd?.();
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1.02;
    const v = bestVoice(lang);
    if (v) u.voice = v;
    u.onstart = () => my === session && onStart?.();
    u.onend = () => my === session && onEnd?.();
    u.onerror = () => my === session && onEnd?.();
    synth.speak(u);
  } catch {
    onEnd?.();
  }
}

/** Cancels any current speech, then speaks the text in the most natural voice available. */
export function speak(text: string, lang: SpeechLang, onStart?: () => void, onEnd?: () => void, rate = 1): void {
  stopSpeaking();
  const my = ++session;
  const parts = chunk(text);
  const tl = ttsLang(text, lang);
  const urls: (Promise<string | null> | undefined)[] = parts.map((p, i) => (i < 2 ? fetchAudio(p, tl) : undefined));
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      onStart?.();
    }
  };

  const playAt = async (i: number): Promise<void> => {
    if (my !== session) return;
    if (i >= parts.length) return onEnd?.();
    const url = await (urls[i] ?? (urls[i] = fetchAudio(parts[i], tl)));
    if (i + 1 < parts.length && !urls[i + 1]) urls[i + 1] = fetchAudio(parts[i + 1], tl);
    if (my !== session) return;
    if (!url) return browserSpeak(parts.slice(i).join(" "), lang, start, onEnd, rate, my);
    const a = new Audio(url);
    a.playbackRate = rate;
    current = a;
    a.onplay = start;
    a.onended = () => void playAt(i + 1);
    a.onerror = () => void playAt(i + 1);
    a.play().catch(() => browserSpeak(parts.slice(i).join(" "), lang, start, onEnd, rate, my));
  };
  void playAt(0);
}

export function stopSpeaking(): void {
  session += 1;
  if (current) {
    current.pause();
    current = null;
  }
  try {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    /* speech synthesis unavailable */
  }
}
