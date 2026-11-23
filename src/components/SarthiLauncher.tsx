import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Mic, MicOff, Send, Sparkles, X } from "lucide-react";
import { currentAccount, logout } from "../lib/auth";
import { chapterContext, chapterMeta, getChapter, listSubjects, CLASS_LEVELS } from "../lib/content";
import { askSarthi, looksNumerical, solveOnBoard, type SarthiLang } from "../lib/sarthi-api";
import { listen, speak, speechInputSupported, stopSpeaking } from "../lib/voice";
import { setMode } from "../lib/theme";
import type { ClassLevel } from "../data/curriculum";
import Whiteboard, { type Solution } from "./Whiteboard";

interface Msg {
  id: number;
  from: "you" | "sarthi";
  text: string;
  board?: Solution;
}

const PAGES: Record<string, string> = {
  home: "/",
  dashboard: "/dashboard",
  courses: "/courses",
  learn: "/learn",
  sarthi: "/sarthi",
  planner: "/planner",
  rewards: "/rewards",
  login: "/login",
};

const HINTS: Record<SarthiLang, string[]> = {
  en: ["Open Class 10 Metals and Non-metals", "Show my rewards", "Turn on dark mode", "A 2 kg ball moves at 10 m/s. Find its KE"],
  hinglish: ["Class 10 physics ka course kholo", "Mera planner dikhao", "Dark mode on karo", "Electricity chapter ka quiz shuru karo"],
  hi: ["कक्षा 10 विज्ञान का कोर्स खोलो", "मेरे रिवॉर्ड्स दिखाओ", "डार्क मोड चालू करो", "प्रकाश संश्लेषण क्या है?"],
};

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and", "class", "chapter", "open", "kholo"].includes(w));

/** Finds a chapter id from loose words like "metals", "chapter 3", optional class/subject. */
function resolveChapter(cls: ClassLevel | null, subject: string | null, chapter: string): string | null {
  const levels = cls ? [cls] : CLASS_LEVELS;
  const num = /^\d+$/.test(chapter.trim()) ? Number(chapter) : null;
  const want = tokens(chapter);
  let best: { id: string; score: number } | null = null;
  for (const l of levels)
    for (const s of listSubjects(l)) {
      if (subject && s.id !== subject) continue;
      for (const c of s.chapters) {
        let score = 0;
        if (num !== null && subject && c.number === num) score = 100;
        const have = tokens(c.title);
        score += want.filter((w) => have.some((h) => h.startsWith(w.slice(0, 5)))).length * 10;
        if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
      }
    }
  return best?.id ?? null;
}

/** Instant, AI-free handling of the most common commands. */
function quickIntent(t: string): { action: string; args: Record<string, string> } | null {
  const s = t.toLowerCase();
  if (/dark\s*mode|dark theme|डार्क/.test(s)) return { action: "set_theme", args: { mode: /off|band|light|बंद/.test(s) ? "light" : "dark" } };
  if (/light\s*mode|light theme/.test(s)) return { action: "set_theme", args: { mode: "light" } };
  if (/log ?out|sign ?out|लॉग आउट/.test(s)) return { action: "logout", args: {} };
  for (const [page, re] of [
    ["rewards", /reward|रिवॉर्ड|points/],
    ["planner", /planner|plan dikh|study plan|प्लानर/],
    ["dashboard", /dashboard|डैशबोर्ड|progress dikh/],
  ] as const)
    if (re.test(s) && s.split(/\s+/).length <= 6) return { action: "navigate", args: { page } };
  return null;
}

export default function SarthiLauncher() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const acc = currentAccount();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<SarthiLang>(acc?.language === "hi" ? "hi" : acc?.language === "hinglish" ? "hinglish" : "en");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const nid = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [msgs, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pathname.startsWith("/sarthi") || pathname === "/login") return null;

  const voiceLang = lang === "en" ? "en-IN" : "hi-IN";
  const push = (m: Omit<Msg, "id">) => setMsgs((p) => [...p, { ...m, id: ++nid.current }]);
  const talk = (text: string) => {
    if (!text) return;
    speak(text, voiceLang, () => setSpeaking(true), () => setSpeaking(false));
  };
  const reply = (text: string) => {
    push({ from: "sarthi", text });
    talk(text);
  };

  // The chapter the user is currently looking at (for "explain this", "is chapter ka quiz", …)
  const params = new URLSearchParams(search);
  const hereChapter = params.get("chapter") ?? params.get("m");
  const hereMeta = hereChapter ? chapterMeta(hereChapter) : undefined;
  const cls = (acc?.classLevel ?? hereMeta?.classLevel ?? 10) as ClassLevel;

  async function doAnswer(question: string) {
    const ch = hereChapter ? getChapter(hereChapter) : undefined;
    const res = await askSarthi({
      question,
      context: ch ? chapterContext(ch, 4000) : "",
      lang,
      classLevel: hereMeta?.classLevel ?? cls,
      subject: hereMeta?.subjectName ?? "",
      chapter: ch?.title ?? "",
    });
    reply(res.ok ? res.answer : res.error);
  }

  async function doSolve(question: string) {
    const res = await solveOnBoard({ question, lang, classLevel: hereMeta?.classLevel ?? cls, subject: hereMeta?.subjectName ?? "", chapter: hereMeta?.title ?? "" });
    if (res.ok) push({ from: "sarthi", text: res.solution.answer, board: res.solution });
    else reply(res.error);
  }

  async function run(text: string) {
    const said = text.trim();
    if (!said || busy) return;
    stopSpeaking();
    push({ from: "you", text: said });
    setInput("");
    setBusy(true);
    try {
      let intent: { action: string; args: Record<string, unknown>; reply?: string } | null = quickIntent(said);
      if (!intent && looksNumerical(said)) intent = { action: "solve", args: { question: said } };
      if (!intent) {
        const r = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: said, context: { page: pathname, role: acc?.role ?? "guest", classLevel: cls } }),
        });
        intent = r.ok ? await r.json() : { action: "answer", args: { question: said } };
      }
      await execute(intent!, said);
    } catch {
      reply("Internet issue — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function execute(intent: { action: string; args: Record<string, unknown>; reply?: string }, said: string) {
    const a = intent.args ?? {};
    const say = (fallback: string) => reply(intent.reply || fallback);
    const argClass = CLASS_LEVELS.includes(Number(a.classLevel) as ClassLevel) ? (Number(a.classLevel) as ClassLevel) : null;
    switch (intent.action) {
      case "navigate": {
        const to = PAGES[String(a.page)] ?? "/";
        navigate(to);
        return say(lang === "en" ? "Done, opening it." : lang === "hi" ? "खोल रहा हूँ।" : "Ho gaya, khol diya.");
      }
      case "open_course": {
        const subject = String(a.subject ?? "");
        const level = argClass ?? cls;
        if (listSubjects(level).some((s) => s.id === subject)) {
          navigate(`/courses/${level}/${subject}`);
          return say("Opening the course.");
        }
        navigate("/courses");
        return say("Here are all the courses.");
      }
      case "open_chapter":
      case "start_quiz": {
        const id = resolveChapter(argClass ?? (a.subject ? cls : null), a.subject ? String(a.subject) : null, String(a.chapter ?? said));
        if (!id) return say(lang === "en" ? "I couldn't find that chapter. Try its name." : "Woh chapter nahi mila, naam se boliye.");
        const m = chapterMeta(id)!;
        navigate(`/courses/${m.classLevel}/${m.subjectId}/learn?m=${id}${intent.action === "start_quiz" ? "#quiz" : ""}`);
        if (intent.action === "start_quiz") setTimeout(() => document.getElementById("quiz")?.scrollIntoView({ behavior: "smooth" }), 1200);
        return say(`${m.title} — Class ${m.classLevel} ${m.subjectName}.`);
      }
      case "set_theme":
        setMode(a.mode === "light" ? "millennial" : "genz");
        window.dispatchEvent(new Event("swyam:theme"));
        return say(a.mode === "light" ? "Light mode on." : "Dark mode on.");
      case "set_language": {
        const l = String(a.lang);
        if (l === "en" || l === "hi" || l === "hinglish") setLang(l);
        return say(l === "hi" ? "अब मैं हिंदी में बोलूँगा।" : l === "hinglish" ? "Ab main Hinglish mein baat karunga." : "I'll speak English now.");
      }
      case "logout":
        logout();
        navigate("/");
        return say("You are logged out.");
      case "solve":
        return doSolve(String(a.question ?? said));
      case "chat":
        return say("Namaste!");
      default:
        return doAnswer(String(a.question ?? said));
    }
  }

  function mic() {
    if (listening) {
      stopRef.current?.();
      setListening(false);
      return;
    }
    stopSpeaking();
    setListening(true);
    stopRef.current = listen(
      voiceLang,
      (t) => {
        setListening(false);
        void run(t);
      },
      () => setListening(false),
      () => setListening(false),
    );
  }

  const state = listening ? "listening" : busy ? "thinking" : speaking ? "speaking" : "idle";

  if (!open) {
    return (
      <button type="button" className="btn-primary anim-float fixed bottom-4 right-4 z-50 flex items-center gap-2 shadow-lg sm:bottom-6 sm:right-6" onClick={() => setOpen(true)} aria-label="Ask Sarthi — open voice assistant">
        <Sparkles size={18} aria-hidden="true" /> Ask Sarthi
      </button>
    );
  }

  return (
    <div className="sarthi-pop card fixed bottom-4 right-4 z-50 flex w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden p-0 shadow-[var(--shadow-float)]" role="dialog" aria-label="Sarthi voice assistant">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-ink-line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} aria-hidden="true" style={{ color: "var(--color-saffron-500)" }} />
          <p className="font-semibold">Sarthi</p>
          <span className="text-xs opacity-60">voice assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <select className="input !w-auto !py-1 !text-xs" aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as SarthiLang)}>
            <option value="en">EN</option>
            <option value="hinglish">Hinglish</option>
            <option value="hi">हिन्दी</option>
          </select>
          <button type="button" className="btn-text !p-1" onClick={() => { stopSpeaking(); setOpen(false); }} aria-label="Close Sarthi">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="max-h-[50vh] min-h-[10rem] flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="text-sm">
            <p className="opacity-75">Bolo ya likho — main kar dunga. Try:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HINTS[lang].map((h) => (
                <button key={h} type="button" className="chip !text-xs transition-colors hover:bg-saffron-50 hover:text-saffron-700" onClick={() => void run(h)}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) =>
          m.board ? (
            <Whiteboard key={m.id} solution={m.board} lang={lang} />
          ) : (
            <div key={m.id} className={m.from === "you" ? "ml-auto max-w-[85%] rounded-2xl bg-[var(--color-saffron-50)] px-3 py-2 text-sm" : "mr-auto max-w-[92%] whitespace-pre-line rounded-2xl border border-[var(--color-ink-line)] px-3 py-2 text-sm"}>
              {m.text}
            </div>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm opacity-70">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Working on it…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--color-ink-line)] p-3">
        <button
          type="button"
          className="voice-orb !h-12 !w-12 shrink-0"
          data-state={state}
          onClick={mic}
          disabled={!speechInputSupported() || busy}
          aria-label={listening ? "Stop listening" : "Speak a command"}
        >
          {listening ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
        </button>
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(input);
          }}
        >
          <input className="input flex-1 !py-2 text-sm" placeholder={listening ? "Listening…" : "Command or doubt…"} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Command for Sarthi" />
          <button type="submit" className="btn-primary !px-3" disabled={busy || !input.trim()} aria-label="Send">
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
