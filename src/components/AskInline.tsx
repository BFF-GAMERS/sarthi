import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MessageCircle, Mic, Volume2 } from "lucide-react";
import type { Chapter } from "../data/curriculum";
import { chapterContext, chapterMeta } from "../lib/content";
import { askSarthi, type SarthiLang } from "../lib/sarthi-api";
import { answer as offlineAnswer } from "../lib/sarthi";
import { listen, speak, speechInputSupported } from "../lib/voice";
import { recordActivity } from "../lib/progress";
import { currentAccount } from "../lib/auth";

const voiceLang = (l: SarthiLang) => (l === "en" ? "en-IN" : "hi-IN");

/** A compact "ask a doubt" box shown inside every chapter. */
export default function AskInline({ chapter }: { chapter: Chapter }) {
  const meta = chapterMeta(chapter.id);
  const acc = currentAccount();
  const [lang, setLang] = useState<SarthiLang>(acc?.language === "hi" ? "hi" : acc?.language === "hinglish" ? "hinglish" : "en");
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<{ text: string; offline: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setReply(null);
    const res = await askSarthi({
      question,
      context: chapterContext(chapter),
      lang,
      classLevel: meta?.classLevel ?? 10,
      subject: meta?.subjectName ?? "",
      chapter: chapter.title,
    });
    setReply(res.ok ? { text: res.answer, offline: false } : { text: offlineAnswer(question, chapter.id).text, offline: true });
    recordActivity("sarthi", chapter.id);
    setBusy(false);
  }

  function mic() {
    setListening(true);
    listen(
      voiceLang(lang),
      (t) => {
        setQ(t);
        void ask(t);
      },
      () => setListening(false),
      () => setListening(false),
    );
  }

  return (
    <aside className="card p-5" aria-label="Ask Sarthi about this chapter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="kicker flex items-center gap-2">
          <MessageCircle size={14} /> Doubt in this chapter? Ask Sarthi
        </p>
        <select className="input !w-auto !py-1 text-sm" aria-label="Answer language" value={lang} onChange={(e) => setLang(e.target.value as SarthiLang)}>
          <option value="en">English</option>
          <option value="hinglish">Hinglish</option>
          <option value="hi">हिन्दी</option>
        </select>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <input
          className="input flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]"
          placeholder={`e.g. explain ${chapter.topics[0] ?? chapter.title} simply`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Your question"
        />
        {speechInputSupported() && (
          <button
            type="button"
            className="btn-ghost !px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]"
            onClick={mic}
            disabled={busy || listening}
            aria-label="Ask by voice"
          >
            <Mic size={18} aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]" disabled={busy} aria-busy={busy}>
          {busy ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Thinking…
            </span>
          ) : (
            "Ask"
          )}
        </button>
      </form>
      {listening && <p className="mt-2 text-sm">Listening… speak now</p>}
      {busy && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm opacity-80">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Sarthi jawab likh raha hai…
        </p>
      )}
      {reply && (
        <div className="panel mt-4 p-4">
          {reply.offline && <p className="text-sm opacity-70">Offline answer from the lesson notes</p>}
          <p style={{ whiteSpace: "pre-line" }}>{reply.text}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn-text flex items-center gap-1" onClick={() => speak(reply.text, voiceLang(lang))}>
              <Volume2 size={16} /> Listen
            </button>
            <Link className="btn-text" to={`/sarthi?chapter=${chapter.id}`}>
              Continue in full Sarthi chat →
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
