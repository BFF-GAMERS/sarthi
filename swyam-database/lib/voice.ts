/**
 * Voice for Sarthi — speech in, speech out.
 *
 * Built on the browser's own Web Speech API, so there is no API key, no audio
 * upload and no per-minute cost: recognition and synthesis both run on the
 * user's device. That matters for the people this platform is for, who are
 * often on metered mobile data.
 *
 * Support is uneven (recognition is Chromium-and-Safari; synthesis is close to
 * universal), so every entry point reports whether it is available and the UI
 * hides the microphone rather than offering a button that does nothing.
 */

import { speechTag } from "./languages";

/* ── Vendor typings ──────────────────────────────────────────────────
   SpeechRecognition is still prefixed in Chromium and absent from the DOM
   lib, so the shape it is used through is declared here rather than reaching
   for `any` at every call site. */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ── Language tags ───────────────────────────────────────────────
   The speech tag lives with the language table in `languages.ts`, so the
   selector, recognition and synthesis can never disagree about what "ta"
   means. */

export { speechTag } from "./languages";

/* ── Listening ───────────────────────────────────────────────────── */

export const isSpeechRecognitionSupported = (): boolean => recognitionCtor() !== null;

export interface ListenHandlers {
  /** Fires repeatedly with the best guess so far, so the field can fill live. */
  onPartial?: (text: string) => void;
  /** Fires once with the settled transcript. */
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

/**
 * Start listening. Returns a stop function, or null when unsupported.
 *
 * Single-utterance rather than continuous: the caller wants one question, and
 * a continuous stream would keep the microphone open after the person has
 * finished talking.
 */
export function listen(language: string, handlers: ListenHandlers): (() => void) | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = speechTag(language);
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let settled = "";

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (!result) continue;
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) settled += text;
      else interim += text;
    }
    if (interim) handlers.onPartial?.((settled + interim).trim());
  };

  rec.onerror = (e) => {
    // "aborted" and "no-speech" are ordinary outcomes of stopping or staying
    // quiet, not faults worth showing.
    if (e.error === "aborted" || e.error === "no-speech") return;
    handlers.onError?.(
      e.error === "not-allowed"
        ? "Microphone access was blocked. Allow it in your browser to talk to Sarthi."
        : (e.message ?? `Speech recognition failed (${e.error}).`),
    );
  };

  rec.onend = () => {
    const text = settled.trim();
    if (text) handlers.onFinal(text);
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    // start() throws if a recognition session is already running.
    return null;
  }

  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}

/* ── Speaking ────────────────────────────────────────────────────── */

export const isSpeechSynthesisSupported = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * Strip the markdown Sarthi answers in, so the voice reads prose rather than
 * saying "asterisk asterisk" around every bold run.
 */
export function speakableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pick the closest installed voice for a tag; null lets the browser choose. */
function voiceFor(tag: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const lower = tag.toLowerCase();
  const base = lower.split("-")[0]!;
  return (
    voices.find((v) => v.lang.toLowerCase() === lower) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  );
}

/**
 * Read text aloud, replacing anything already being spoken.
 *
 * Long answers are split on sentence boundaries because several engines cut
 * off a single utterance after roughly fifteen seconds.
 */
export function speak(text: string, language: string, onEnd?: () => void): void {
  if (!isSpeechSynthesisSupported()) return;
  const clean = speakableText(text);
  if (!clean) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const tag = speechTag(language);
  const voice = voiceFor(tag);
  const chunks = clean.match(/[^.!?]+[.!?]*/g)?.filter((s) => s.trim()) ?? [clean];

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk.trim());
    u.lang = tag;
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = 1;
    if (i === chunks.length - 1 && onEnd) u.onend = onEnd;
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

/* ── Sarvam voice ────────────────────────────────────────────────────
   The browser rarely ships a usable Indian-language voice, so Hindi or
   Tamil either comes out mispronounced or silently reads as English.
   When a Sarvam key is configured the server synthesises through Bulbul
   instead; `speakBest` prefers it and falls back to the browser. */

let sarvamSupport: Map<string, boolean> | null = null;

/** Whether the server can speak this language through Sarvam. Cached. */
export async function sarvamAvailable(language: string): Promise<boolean> {
  sarvamSupport ??= new Map();
  const cached = sarvamSupport.get(language);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`/api/voice?language=${encodeURIComponent(language)}`);
    const body = (await res.json()) as { supported?: boolean };
    const ok = body.supported === true;
    sarvamSupport.set(language, ok);
    return ok;
  } catch {
    sarvamSupport.set(language, false);
    return false;
  }
}

/** The audio element currently playing a Sarvam clip, so it can be stopped. */
let current: HTMLAudioElement | null = null;

export function stopSarvam(): void {
  if (!current) return;
  current.pause();
  current.src = "";
  current = null;
}

/**
 * Speak, using the best voice available.
 *
 * Tries Sarvam first for the languages it covers, and falls back to the
 * browser on any failure — a network hiccup should cost you the nicer voice,
 * not the reply.
 */
export async function speakBest(text: string, language: string): Promise<void> {
  stopSpeaking();
  stopSarvam();

  if (await sarvamAvailable(language)) {
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: speakableText(text), language }),
      });
      if (res.ok) {
        const body = (await res.json()) as { audio?: string; mimeType?: string };
        if (body.audio) {
          const audio = new Audio(`data:${body.mimeType ?? "audio/wav"};base64,${body.audio}`);
          current = audio;
          await audio.play();
          return;
        }
      }
    } catch {
      /* fall through to the browser voice */
    }
  }

  speak(text, language);
}

/** Stop whichever voice is talking. */
export function stopAllSpeech(): void {
  stopSpeaking();
  stopSarvam();
}
