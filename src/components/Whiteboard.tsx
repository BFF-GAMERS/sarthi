import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { prefetchSpeech, speak, speechOutputSupported, stopSpeaking } from "../lib/voice";
import type { SarthiLang } from "../lib/sarthi-api";

/** Shared focus ring for keyboard users. */
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]";

export interface Solution {
  given?: string[];
  find?: string;
  formula?: string;
  steps: { board: string; say?: string }[];
  answer: string;
  tip?: string;
}

interface Line {
  kind: "given" | "find" | "formula" | "step" | "answer" | "tip";
  text: string;
  say: string;
}

const INTRO: Record<SarthiLang, (s: Solution) => string> = {
  en: (s) => `Let's write what is given${s.find ? ", and what we need to find" : ""}.`,
  hinglish: (s) => `Pehle likhte hain kya diya hai${s.find ? " aur humein kya nikalna hai" : ""}.`,
  hi: (s) => `पहले लिखते हैं कि क्या दिया गया है${s.find ? " और हमें क्या ज्ञात करना है" : ""}।`,
};
const ANSWER: Record<SarthiLang, string> = { en: "So the final answer is", hinglish: "To final answer hai", hi: "तो अंतिम उत्तर है" };
const FORMULA: Record<SarthiLang, string> = { en: "We will use this formula.", hinglish: "Iske liye hum ye formula use karenge.", hi: "इसके लिए हम यह सूत्र लगाएँगे।" };

function toLines(s: Solution, lang: SarthiLang): Line[] {
  const lines: Line[] = [];
  const given = (s.given ?? []).filter(Boolean);
  if (given.length) lines.push({ kind: "given", text: "Given:  " + given.join(",   "), say: INTRO[lang](s) });
  if (s.find) lines.push({ kind: "find", text: "To find:  " + s.find, say: "" });
  if (s.formula) lines.push({ kind: "formula", text: "Formula:  " + s.formula, say: FORMULA[lang] });
  s.steps.forEach((st) => lines.push({ kind: "step", text: st.board, say: st.say ?? "" }));
  lines.push({ kind: "answer", text: s.answer, say: `${ANSWER[lang]} ${s.answer}.` });
  if (s.tip) lines.push({ kind: "tip", text: "💡 " + s.tip, say: s.tip });
  return lines;
}

/** An animated blackboard: each line is "chalked" in while Sarthi explains it aloud. */
export default function Whiteboard({ solution, lang, rate = 1 }: { solution: Solution; lang: SarthiLang; rate?: number }) {
  const lines = toLines(solution, lang);
  const [shown, setShown] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [caption, setCaption] = useState(lines[0]?.say ?? "");
  const timer = useRef<number | null>(null);
  const run = useRef(0);
  const voice = speechOutputSupported();
  const voiceLang = lang === "en" ? "en-IN" : "hi-IN";

  // Speak the newest line, then reveal the next one when speech ends.
  useEffect(() => {
    if (!playing) return;
    const token = ++run.current;
    const line = lines[shown - 1];
    if (!line) return;
    setCaption(line.say);
    let moved = false;
    let safety: number | null = null;
    const advance = () => {
      if (moved || token !== run.current) return;
      moved = true;
      if (safety) window.clearTimeout(safety);
      if (shown < lines.length) timer.current = window.setTimeout(() => token === run.current && setShown((n) => n + 1), 500);
      else setPlaying(false);
    };
    const readMs = Math.max(1600, (line.say || line.text).length * 70) / rate;
    const nextSay = lines[shown]?.say;
    if (nextSay) prefetchSpeech(nextSay, voiceLang);
    if (line.say && voice) {
      speak(line.say, voiceLang, undefined, advance, rate);
      // If speech never reports "end" (or the voice download stalls), don't let the board freeze.
      safety = window.setTimeout(advance, readMs + 9000);
    } else {
      timer.current = window.setTimeout(advance, readMs);
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (safety) window.clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, playing]);

  useEffect(() => () => stopSpeaking(), []);

  function pause() {
    run.current++;
    stopSpeaking();
    if (timer.current) window.clearTimeout(timer.current);
    setPlaying(false);
  }
  function play() {
    if (shown >= lines.length && !playing) setShown(1);
    setPlaying(true);
  }
  function restart() {
    pause();
    setShown(1);
    setTimeout(() => setPlaying(true), 50);
  }
  function skip() {
    run.current++;
    stopSpeaking();
    setShown(lines.length);
    setPlaying(false);
  }

  const finished = shown >= lines.length && !playing;

  return (
    <div className="board" role="region" aria-label="Solved on the board">
      <div className="board-head">
        <span>Sarthi’s board</span>
        <div className="flex gap-1">
          {playing ? (
            <button type="button" className={`board-btn ${FOCUS_RING}`} onClick={pause} aria-label="Pause">
              <Pause size={15} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className={`board-btn ${FOCUS_RING}`} onClick={play} aria-label={finished ? "Play again" : "Play"}>
              <Play size={15} aria-hidden="true" />
            </button>
          )}
          <button type="button" className={`board-btn ${FOCUS_RING}`} onClick={restart} aria-label="Restart">
            <RotateCcw size={15} aria-hidden="true" />
          </button>
          <button type="button" className={`board-btn ${FOCUS_RING}`} onClick={skip} aria-label="Show full solution">
            <SkipForward size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ol className="board-body" aria-live="polite">
        {lines.slice(0, shown).map((l, i) => (
          <li key={i} className={`chalk chalk-${l.kind}`} style={{ animationDuration: `${Math.min(1.6, 0.4 + l.text.length * 0.018) / rate}s` }}>
            {l.kind === "step" && <span className="chalk-no">{lines.slice(0, i + 1).filter((x) => x.kind === "step").length}.</span>}
            {l.text}
          </li>
        ))}
        {playing && <li className="chalk-cursor" aria-hidden />}
      </ol>

      {caption && (
        <p className="board-caption">
          <span aria-hidden>🔊 </span>
          {caption}
        </p>
      )}
      <p className="mt-2 text-xs opacity-70">
        Line {Math.min(shown, lines.length)} of {lines.length}
        {finished ? " · Done" : playing ? " · Likh rahe hain…" : " · Paused"}
      </p>
      <div
        className="board-progress"
        role="progressbar"
        aria-label="Board progress"
        aria-valuemin={1}
        aria-valuemax={lines.length}
        aria-valuenow={Math.min(shown, lines.length)}
      >
        <div style={{ width: `${(shown / lines.length) * 100}%` }} />
      </div>
    </div>
  );
}
