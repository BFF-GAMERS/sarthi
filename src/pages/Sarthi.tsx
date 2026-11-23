import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Mic, MicOff, Send, Square, Volume2 } from "lucide-react";
import type { QuizQuestion } from "../data/curriculum";
import { currentAccount } from "../lib/auth";
import { chapterContext, chapterMeta, getChapter, getSubject, listSubjects, CLASS_LEVELS } from "../lib/content";
import { answer as offlineAnswer, explainWrong, practiceQuestion } from "../lib/sarthi";
import { askSarthi, looksNumerical, solveOnBoard, type SarthiLang } from "../lib/sarthi-api";
import Whiteboard, { type Solution } from "../components/Whiteboard";
import { listen, speak, speechInputSupported, speechOutputSupported, stopSpeaking } from "../lib/voice";
import { recordActivity } from "../lib/progress";
import type { ClassLevel } from "../data/curriculum";

interface Msg {
  id: number;
  from: "you" | "sarthi";
  text: string;
  offline?: boolean;
  board?: Solution;
}

const voiceLang = (l: SarthiLang) => (l === "en" ? "en-IN" : "hi-IN");
const STARTERS: Record<SarthiLang, string[]> = {
  en: ["Explain this chapter in simple words", "Give me a real-life example", "Ask me 3 quick questions", "A 2 kg ball moves at 10 m/s. Find its kinetic energy."],
  hinglish: ["Is chapter ko simple mein samjhao", "Ek real life example do", "Mujhse 3 sawal pucho", "2 kg ki ball 10 m/s se chal rahi hai, kinetic energy nikalo"],
  hi: ["इस अध्याय को आसान भाषा में समझाइए", "एक रोज़मर्रा का उदाहरण दीजिए", "मुझसे 3 छोटे सवाल पूछिए"],
};

export default function Sarthi() {
  const account = currentAccount();
  const [params, setParams] = useSearchParams();
  const requested = params.get("chapter");
  const reqMeta = requested ? chapterMeta(requested) : undefined;
  const [classLevel, setClassLevel] = useState<ClassLevel>(reqMeta?.classLevel ?? account?.classLevel ?? 10);
  const subjects = listSubjects(classLevel);
  const [subjectId, setSubjectId] = useState(reqMeta?.subjectId ?? subjects[0]?.id ?? "");
  const subject = getSubject(classLevel, subjectId) ?? subjects[0];
  const chapter = (requested && getChapter(requested)) || subject?.chapters[0];

  const [lang, setLang] = useState<SarthiLang>(account?.language === "hi" ? "hi" : account?.language === "hinglish" ? "hinglish" : "en");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [rate, setRate] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const [practice, setPractice] = useState<QuizQuestion | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const nextId = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    stopRef.current?.();
    stopSpeaking();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  if (!chapter || !subject) {
    return (
      <section className="container-x py-12">
        <p>No chapters available.</p>
      </section>
    );
  }
  const meta = chapterMeta(chapter.id);

  function pickChapter(id: string) {
    setParams({ chapter: id });
    setMessages([]);
    setPractice(null);
    setNote(null);
  }

  function say(text: string) {
    speak(text, voiceLang(lang), () => setSpeaking(true), () => setSpeaking(false), rate);
  }

  async function solve(raw: string) {
    const question = raw.trim();
    if (!question || busy || !chapter) return;
    stopSpeaking();
    setMessages((p) => [...p, { id: ++nextId.current, from: "you", text: "🧮 " + question }]);
    setInput("");
    setBusy(true);
    setNote(null);
    const res = await solveOnBoard({ question, lang, classLevel: meta?.classLevel ?? classLevel, subject: meta?.subjectName ?? subject!.name, chapter: chapter.title });
    setBusy(false);
    recordActivity("sarthi", chapter.id, "board");
    if (res.ok) setMessages((p) => [...p, { id: ++nextId.current, from: "sarthi", text: res.solution.answer, board: res.solution }]);
    else {
      setNote(res.error);
      void send(question, true);
    }
  }

  async function send(raw: string, plain = false) {
    const question = raw.trim();
    if (!question || busy || !chapter) return;
    if (!plain && looksNumerical(question)) return solve(question);
    stopSpeaking();
    const history = messages.slice(-8).map((m) => ({ role: m.from === "you" ? ("user" as const) : ("model" as const), text: m.text }));
    setMessages((p) => [...p, { id: ++nextId.current, from: "you", text: question }]);
    setInput("");
    setBusy(true);
    setNote(null);
    const res = await askSarthi({
      question,
      context: chapterContext(chapter),
      lang,
      classLevel: meta?.classLevel ?? classLevel,
      subject: meta?.subjectName ?? subject!.name,
      chapter: chapter.title,
      history,
    });
    const text = res.ok ? res.answer : offlineAnswer(question, chapter.id).text;
    if (!res.ok) setNote(res.error);
    setMessages((p) => [...p, { id: ++nextId.current, from: "sarthi", text, offline: !res.ok }]);
    setBusy(false);
    recordActivity("sarthi", chapter.id);
    if (autoSpeak && speechOutputSupported()) say(text);
  }

  function toggleMic() {
    if (listening) {
      stopRef.current?.();
      setListening(false);
      return;
    }
    stopSpeaking();
    setNote(null);
    setListening(true);
    stopRef.current = listen(
      voiceLang(lang),
      (text) => {
        setListening(false);
        void send(text);
      },
      () => {
        setListening(false);
        stopRef.current = null;
      },
      (msg) => {
        setListening(false);
        stopRef.current = null;
        setNote(msg);
      },
    );
  }

  const state = listening ? "listening" : busy ? "thinking" : speaking ? "speaking" : "idle";
  const stateText = { listening: "Listening… speak now", thinking: "Sarthi is thinking…", speaking: "Sarthi is speaking…", idle: "Tap the mic and ask your doubt" }[state];

  return (
    <section className="container-x py-10">
      <p className="kicker">Personal tutor</p>
      <h1 className="type-xl mt-2">Sarthi AI</h1>

      <div className="card mt-6 grid gap-3 p-4 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Class
          <select
            className="input"
            value={classLevel}
            onChange={(e) => {
              const c = Number(e.target.value) as ClassLevel;
              setClassLevel(c);
              const first = listSubjects(c)[0];
              setSubjectId(first?.id ?? "");
              if (first?.chapters[0]) pickChapter(first.chapters[0].id);
            }}
          >
            {CLASS_LEVELS.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Subject
          <select
            className="input"
            value={subject.id}
            onChange={(e) => {
              setSubjectId(e.target.value);
              const s = getSubject(classLevel, e.target.value);
              if (s?.chapters[0]) pickChapter(s.chapters[0].id);
            }}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          Chapter
          <select className="input" value={chapter.id} onChange={(e) => pickChapter(e.target.value)}>
            {subject.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.number}. {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:gap-5 lg:grid-cols-3">
        {/* conversation */}
        <div className="card flex min-h-[20rem] flex-col p-4 sm:min-h-[28rem] sm:p-5 lg:col-span-2">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <p className="opacity-75">Ask anything about “{chapter.title}”. Try:</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {STARTERS[lang].map((s) => (
                    <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.board ? "w-full" : m.from === "you" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[90%]"}>
                {m.board ? (
                  <Whiteboard solution={m.board} lang={lang} rate={rate} />
                ) : (
                <div className={m.from === "you" ? "chip-accent !block !whitespace-pre-line !rounded-2xl !px-4 !py-2" : "panel whitespace-pre-line rounded-2xl p-4"}>
                  {m.from === "sarthi" && m.offline && <p className="mb-1 text-xs opacity-60">Offline answer from lesson notes</p>}
                  {m.text}
                </div>
                )}
                {m.from === "sarthi" && !m.board && (
                  <button type="button" className="btn-text mt-1 flex items-center gap-1 !text-sm" onClick={() => say(m.text)}>
                    <Volume2 size={14} /> Listen again
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <p className="flex items-center gap-2 opacity-75">
                <Loader2 className="animate-spin" size={16} /> Sarthi is thinking…
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          {note && (
            <p className="mt-2 text-sm" role="status">
              {note}
            </p>
          )}

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input className="input flex-1" aria-label="Type your question" placeholder="Type your doubt…" value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="button" className="btn-ghost !px-3 whitespace-nowrap" disabled={busy || !input.trim()} onClick={() => void solve(input)} title="Solve step by step on Sarthi's board" aria-label="Solve on board">
              🧮 <span className="hidden sm:inline">Solve on board</span>
            </button>
            <button type="submit" className="btn-primary !px-4" disabled={busy || !input.trim()} aria-label="Send">
              <Send size={18} />
            </button>
          </form>
          <p className="mt-1 text-xs opacity-60">Numericals open on Sarthi’s board automatically — solved step by step, explained aloud.</p>
        </div>

        {/* voice panel */}
        <div className="grid content-start gap-4 sm:gap-5">
          <div className="card flex flex-col items-center p-6 text-center">
            <p className="kicker mb-5">Voice mode</p>
            <button
              type="button"
              onClick={toggleMic}
              disabled={!speechInputSupported() || busy}
              aria-label={listening ? "Stop listening" : "Speak your question"}
              aria-pressed={listening}
              className="voice-orb"
              data-state={state}
            >
              {state === "thinking" ? <Loader2 size={46} className="animate-spin" /> : listening ? <MicOff size={46} /> : <Mic size={46} />}
            </button>
            <div className="mt-6 flex h-6 items-center gap-2" role="status">
              {(listening || speaking) && (
                <span className="voice-bars" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              )}
              <span className="font-semibold">{stateText}</span>
            </div>
            <p className="mt-1 text-xs opacity-60">{lang === "en" ? "Speaking English" : lang === "hi" ? "हिन्दी में बोलिए" : "Hinglish mein boliye"}</p>
            {speaking && (
              <button type="button" className="btn-ghost mt-3 flex items-center gap-1" onClick={() => { stopSpeaking(); setSpeaking(false); }}>
                <Square size={14} /> Stop speaking
              </button>
            )}
            {!speechInputSupported() && <p className="mt-2 text-sm opacity-75">Voice input needs Chrome or Edge. You can still type.</p>}
          </div>

          <div className="card grid gap-3 p-4 text-sm">
            <label className="flex flex-col gap-1">
              Language
              <select className="input" value={lang} onChange={(e) => setLang(e.target.value as SarthiLang)}>
                <option value="en">English</option>
                <option value="hinglish">Hinglish</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} /> Speak answers aloud
            </label>
            <label className="flex flex-col gap-1">
              Speech speed: {rate.toFixed(1)}×
              <input type="range" min={0.6} max={1.6} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            </label>
            {messages.length > 0 && (
              <button type="button" className="btn-text" onClick={() => setMessages([])}>
                Clear conversation
              </button>
            )}
          </div>

          <div className="card p-4">
            <p className="kicker">Practice</p>
            {chapter.quiz.length === 0 ? (
              <div className="panel mt-3 p-3">
                <p className="text-sm opacity-75">Open this chapter in Learn once to prepare its practice questions.</p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-ghost mt-2"
                  onClick={() => {
                    setPractice(practiceQuestion(chapter.id));
                    setPicked(null);
                    setChecked(false);
                  }}
                >
                  {practice ? "Next question" : "Give me a question"}
                </button>
                {practice && (
                  <fieldset className="mt-3 text-sm">
                    <legend className="font-semibold">{practice.question}</legend>
                    {practice.options.map((o, i) => (
                      <label key={i} className="mt-1 flex cursor-pointer gap-2">
                        <input type="radio" name="practice" checked={picked === i} onChange={() => { setPicked(i); setChecked(false); }} />
                        {o}
                      </label>
                    ))}
                    <button type="button" className="btn-primary mt-2" disabled={picked === null} onClick={() => setChecked(true)}>
                      Check
                    </button>
                    {checked && picked === practice.correctIndex && <p className="mt-2">✅ Correct!</p>}
                    {checked && picked !== null && picked !== practice.correctIndex && (
                      <div className="panel mt-2 p-2">
                        <p>Answer: {practice.options[practice.correctIndex]}</p>
                        <p className="mt-1">{explainWrong(chapter.id, practice.id)}</p>
                        <button type="button" className="btn-text mt-1" onClick={() => void send(`I got this wrong, explain simply: ${practice.question} Correct answer: ${practice.options[practice.correctIndex]}`)}>
                          Ask Sarthi to explain more →
                        </button>
                      </div>
                    )}
                  </fieldset>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
