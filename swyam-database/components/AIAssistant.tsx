import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  X,
  Send,
  Bot,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Check,
  Loader2,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../context/AuthContext";
import { SUPPORTED_LANGUAGES } from "../lib/languages";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  listen,
  speakBest,
  stopAllSpeech,
} from "../lib/voice";
import CallSarthi from "./CallSarthi";
import { confirmSwapRequest, runSarthiAction, type NavTarget } from "../lib/sarthi-actions";
import type { SwapMatch } from "../lib/skillswap";
import SarvamCall from "./SarvamCall";
import { useTx } from "../lib/i18n";
import { track, EV, NAV_REGISTRY, hrefFor, pathOf } from "@/evolution";
import type { NavItemId } from "@/evolution";

/** Sarthi sent the person somewhere: the nav item for that route (when there is one), surface 'sarthi'. */
function trackSarthiNav(to: string): void {
  const item = (Object.keys(NAV_REGISTRY) as NavItemId[]).find(
    (id) => pathOf(hrefFor(id, true)) === to || pathOf(hrefFor(id, false)) === to,
  );
  track(EV.NAVIGATION_ITEM_CLICKED, { surface: "sarthi", ...(item ? { item } : {}) });
}

const SUGGESTED = [
  "I can teach Python and want to learn UI design",
  "Show me my swap matches",
  "Which course suits me?",
  "Analyze my skill gap",
  "Government schemes for me",
  "Find internships near me",
];

/** Event other pages dispatch to raise the chatbot. */
export const SARTHI_OPEN_EVENT = "sarthi:open";

/** Open Sarthi from anywhere in the app. */
export function openSarthi() {
  window.dispatchEvent(new CustomEvent(SARTHI_OPEN_EVENT));
}

export function messageText(message: { parts?: Array<{ type: string; text?: string }> }) {
  return (message.parts ?? []).map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

let localSeq = 0;
const localId = () => `local-${++localSeq}`;

/**
 * Sarthi — one assistant for the whole product.
 *
 * Three capabilities behind a single surface, rather than three assistants:
 *   text     — the grounded catalogue answers from /api/chat
 *   voice    — on-device speech in and out, no key and no per-minute cost
 *   actions  — real reads and writes against the signed-in account, so
 *              "I can teach Python and want to learn UI design" ends in an
 *              actual swap request rather than advice about how to send one
 *
 * Actions are tried first; anything Sarthi can't act on falls through to the
 * chat endpoint unchanged.
 */
export default function AIAssistant() {
  const tx = useTx();
  const { user, profileId } = useAuth();
  const navigate = useNavigate();
  const name = user?.name.split(" ")[0] ?? "friend";
  const nameRef = useRef(name);
  nameRef.current = name;
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<string>("en");
  const langRef = useRef(lang);
  langRef.current = lang;

  const [acting, setActing] = useState(false);
  /** The last question typed or spoken, handed to the voice agent on a call. */
  const [lastQuestion, setLastQuestion] = useState<string>("");
  /** Matches rendered under a particular assistant message. */
  const [matchesByMessage, setMatchesByMessage] = useState<Record<string, SwapMatch[]>>({});
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const stopListenRef = useRef<(() => void) | null>(null);
  const spokenRef = useRef<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [voiceIn, setVoiceIn] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  useEffect(() => {
    // Feature detection has to wait for the client: the server has no window.
    setVoiceIn(isSpeechRecognitionSupported());
    setVoiceOut(isSpeechSynthesisSupported());
  }, []);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Carry the chosen language on every turn so the model keeps replying
      // in it rather than drifting back to English mid-conversation.
      body: () => ({ language: langRef.current, userName: nameRef.current }),
    }),
    onError: (e) => setError(e.message || "Something went wrong. Try again."),
  });

  const busy = status === "submitted" || status === "streaming" || acting;

  /*
   * Typing dots belong to the gap before the first character, not to the
   * whole response.
   *
   * The first version keyed off `status` alone and the dots never went away:
   * they sat under a finished answer indefinitely, which reads as "still
   * thinking" and makes the reader wait for something that already arrived.
   * So the test is no longer "what does the transport say", it is "is there
   * an answer on screen yet" — which is the thing being waited for, and is
   * true or false regardless of how the status settles.
   *
   * Keying off the LAST message rather than any assistant message keeps it
   * correct on the second question too: at that point the last message is the
   * new one from the member, so the dots come back.
   */
  const lastMessage = messages[messages.length - 1];
  /*
   * Compare POSITIONS, not the tail of the list.
   *
   * Two earlier attempts keyed off `status` and then off the last message,
   * and both left the dots on screen permanently under a finished answer —
   * the transport does not reliably settle, and the last entry is not always
   * the assistant's. The only question that matters is simpler than either:
   * has the newest question been answered yet? That is a comparison of where
   * the last question sits against where the last answer-with-text sits, and
   * it is immune to trailing empty messages and to a stuck status.
   */
  let lastAsked = -1;
  let lastAnswered = -1;
  messages.forEach((m, i) => {
    if (m.role === "user") lastAsked = i;
    else if (m.role === "assistant" && messageText(m).trim()) lastAnswered = i;
  });
  const awaiting = lastAsked > lastAnswered;
  const composing = acting || (awaiting && status !== "error");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, acting]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(SARTHI_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SARTHI_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Stop the microphone and the voice when the panel closes.
  useEffect(() => {
    if (open) return;
    stopListenRef.current?.();
    stopListenRef.current = null;
    setListening(false);
    stopAllSpeech();
  }, [open]);

  /* Read finished assistant replies aloud, once each. */
  useEffect(() => {
    if (!speakReplies || status === "streaming") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenRef.current.has(last.id)) return;
    const text = messageText(last);
    if (!text.trim()) return;
    spokenRef.current.add(last.id);
    void speakBest(text, langRef.current);
  }, [messages, status, speakReplies]);

  const appendLocal = useCallback(
    (role: "user" | "assistant", text: string) => {
      const id = localId();
      setMessages((prev) => [
        ...prev,
        { id, role, parts: [{ type: "text", text }] } as (typeof prev)[number],
      ]);
      return id;
    },
    [setMessages],
  );

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      setError(null);
      setInput("");
      setLastQuestion(clean);
      stopAllSpeech();

      // Try to act on it before falling back to a conversational answer.
      setActing(true);
      try {
        const result = await runSarthiAction(clean, profileRef.current);
        if (result) {
          appendLocal("user", clean);
          const replyId = appendLocal("assistant", result.reply);
          if (result.matches?.length) {
            const found = result.matches;
            setMatchesByMessage((prev) => ({ ...prev, [replyId]: found }));
          }
          if (speakReplies) {
            spokenRef.current.add(replyId);
            void speakBest(result.reply, langRef.current);
          }
          if (result.navigate) {
            const to: NavTarget = result.navigate;
            trackSarthiNav(String(to));
            window.setTimeout(() => void navigate({ to }), 400);
          }
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't work. Try again.");
        return;
      } finally {
        setActing(false);
      }

      void sendMessage({ text: clean });
    },
    [busy, appendLocal, navigate, sendMessage, speakReplies],
  );

  const toggleMic = () => {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      return;
    }
    setError(null);
    const stop = listen(langRef.current, {
      onPartial: (t) => setInput(t),
      onFinal: (t) => {
        setInput("");
        void send(t);
      },
      onError: (m) => setError(m),
      onEnd: () => {
        stopListenRef.current = null;
        setListening(false);
      },
    });
    if (!stop) {
      setError("Voice input isn't available in this browser.");
      return;
    }
    stopListenRef.current = stop;
    setListening(true);
  };

  const sendRequest = async (match: SwapMatch) => {
    const me = profileRef.current;
    if (!me) return;
    const key = `${match.candidateId}:${match.theyTeach.id}`;
    setSendingTo(key);
    try {
      await confirmSwapRequest(me, match);
      setRequested((prev) => new Set(prev).add(key));
      const line = `Request sent to ${match.displayName}. You'll see their reply in SkillSwap and in your notifications.`;
      appendLocal("assistant", line);
      if (speakReplies) void speakBest(line, langRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that request.");
    } finally {
      setSendingTo(null);
    }
  };

  const reset = () => {
    setMessages([]);
    setMatchesByMessage({});
    setRequested(new Set());
    setError(null);
    spokenRef.current = new Set();
    stopAllSpeech();
  };

  return (
    <>
      <motion.button
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 16 }}
        whileHover={{ y: -3 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? tx("Close Sarthi") : tx("Ask Sarthi")}
        data-sarthi-button=""
        className="fixed bottom-[calc(1.5rem+var(--bottom-bar,0px)+var(--sticky-bar,0px))] right-4 z-[45] flex h-14 items-center gap-2 rounded-[var(--radius-pill)] bg-gradient-to-br from-saffron-500 to-saffron-600 px-5 text-[color:var(--color-on-accent)] shadow-[var(--shadow-float)] sm:right-6"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
        {/*
          An unlabelled circle in a corner is not a discoverable feature —
          people were not finding the assistant at all. The name rides along
          on wider screens and drops on phones, where the corner is scarce.
        */}
        {!open && (
          <span className="hidden font-body text-sm font-semibold sm:inline">
            {tx("Ask Sarthi")}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={tx("Sarthi")}
            className="fixed bottom-[calc(6rem+var(--bottom-bar,0px)+var(--sticky-bar,0px))] right-4 z-[45] flex h-[min(34rem,calc(100dvh-9rem-var(--bottom-bar,0px)-var(--sticky-bar,0px)))] w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ink-line bg-paper-light shadow-[var(--shadow-float)] sm:right-6"
          >
            <header className="flex items-center justify-between border-b border-ink-line bg-ink px-4 py-3 text-paper-light">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-saffron-glow" aria-hidden />
                <div>
                  <p className="font-display text-base leading-none tracking-tight">Sarthi</p>
                  <p className="font-body text-[10px] uppercase tracking-[0.16em] text-paper-deep">
                    {tx("Learning \u00b7 Career \u00b7 SkillSwap")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor="sarthi-lang">
                  {tx("Chat language")}
                </label>
                <select
                  id="sarthi-lang"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="rounded-full border border-paper-deep/40 bg-transparent px-2 py-1 font-body text-[11px] text-paper-light outline-none"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="text-ink">
                      {l.native}
                    </option>
                  ))}
                </select>
                {voiceOut && (
                  <button
                    onClick={() =>
                      setSpeakReplies((v) => {
                        if (v) stopAllSpeech();
                        return !v;
                      })
                    }
                    aria-pressed={speakReplies}
                    aria-label={speakReplies ? "Turn off spoken replies" : "Read replies aloud"}
                    className={`grid h-7 w-7 place-items-center rounded-full border transition-colors ${
                      speakReplies
                        ? "border-saffron-glow bg-saffron-500 text-on-accent"
                        : "border-paper-deep/40 hover:bg-saffron-500"
                    }`}
                  >
                    {speakReplies ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </button>
                )}
                <button
                  onClick={reset}
                  aria-label={tx("Reset conversation")}
                  className="grid h-7 w-7 place-items-center rounded-full border border-paper-deep/40 transition-colors hover:bg-saffron-500"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" data-lenis-prevent>
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="font-editorial text-lg leading-snug text-ink-soft">
                    Namaste {name} — tell me what you can teach and what you want to learn, and I'll
                    find you a swap partner.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED.map((s) => (
                      <button
                        key={s}
                        onClick={() => void send(s)}
                        className="chip text-left hover:bg-saffron-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {voiceIn && (
                    <p className="font-body text-[11px] text-ink-mute">
                      {tx("Or press the microphone and just say it.")}
                    </p>
                  )}
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id}>
                  <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[85%] rounded-xl border border-ink-line px-3 py-2 font-body text-[13px] leading-relaxed ${
                        m.role === "user" ? "bg-saffron-500 text-on-accent" : "bg-paper"
                      }`}
                    >
                      {m.role === "user" ? (
                        messageText(m)
                      ) : (
                        <div className="prose-sm [&_a]:text-saffron-600 [&_a]:underline [&_li]:my-0.5 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_strong]:font-semibold [&_ul]:ml-4 [&_ul]:list-disc">
                          <ReactMarkdown>{messageText(m)}</ReactMarkdown>
                          {/* Only on the reply currently arriving, so a pause
                              between chunks reads as thinking, not a stall. */}
                          {awaiting && m.id === lastMessage?.id && (
                            <motion.span
                              aria-hidden
                              animate={{ opacity: [1, 0.15, 1] }}
                              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] rounded-sm bg-saffron-500 align-baseline"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Matches Sarthi found, actionable right here. */}
                  {matchesByMessage[m.id]?.map((match) => {
                    const key = `${match.candidateId}:${match.theyTeach.id}`;
                    const sent = requested.has(key);
                    return (
                      <div
                        key={key}
                        className="mt-2 rounded-xl border border-ink-line bg-paper-light p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-display text-sm leading-tight text-ink">
                              {match.displayName}
                            </p>
                            <p className="mt-0.5 font-body text-[11px] leading-snug text-ink-mute">
                              {tx("Teaches")}{" "}
                              <span className="text-ink">{match.theyTeach.name}</span>{" "}
                              {tx("\u00b7 wants")}{" "}
                              <span className="text-ink">
                                {match.youTeach?.name ?? "nothing yet"}
                              </span>
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-saffron-500">
                            {match.score}
                          </span>
                        </div>
                        <button
                          onClick={() => void sendRequest(match)}
                          disabled={sent || sendingTo === key}
                          className={`mt-2 w-full rounded-lg px-3 py-1.5 font-body text-[11px] font-medium transition-colors ${
                            sent
                              ? "cursor-default bg-emeraldx-400/10 text-emeraldx-400"
                              : "bg-ink text-paper-light hover:bg-saffron-500 disabled:opacity-60"
                          }`}
                        >
                          {sent ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Check size={12} aria-hidden /> {tx("Request sent")}
                            </span>
                          ) : sendingTo === key ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2 size={12} className="animate-spin" aria-hidden />{" "}
                              {tx("Sending")}
                            </span>
                          ) : (
                            "Send swap request"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/*
               * Deliberately NOT wrapped in AnimatePresence.
               *
               * With an exit animation the dots outlived the answer: the exit
               * began and never completed, so a finished reply sat under a
               * "Sarthi is typing" that never stopped, and the reader waited
               * for something already on screen. An indicator whose whole job
               * is to say "not yet" must be able to say "now" instantly.
               * It fades in; it leaves the moment the answer lands.
               */}
              {composing && (
                <motion.div
                  initial={{ y: 6, scale: 0.96 }}
                  animate={{ y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-2 rounded-xl border border-ink-line bg-paper px-3 py-2.5">
                    <span className="sr-only" role="status">
                      {tx("Sarthi is typing")}
                    </span>
                    <span className="flex items-end gap-1" aria-hidden>
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                          transition={{
                            duration: 1.05,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.15,
                          }}
                          className="h-1.5 w-1.5 rounded-full bg-saffron-500"
                        />
                      ))}
                    </span>
                    <span className="font-body text-[11px] text-ink-mute">
                      {acting ? tx("Working on it\u2026") : tx("Sarthi is typing\u2026")}
                    </span>
                  </div>
                </motion.div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-saffron-500 bg-saffron-50 px-3 py-2 font-body text-[12px] text-saffron-700"
                >
                  {error}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-ink-line px-3 pt-2.5">
              {/* Talks to the same agent, in the browser, with no number needed. */}
              <CallSarthi language={lang} context={lastQuestion} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2 px-3 pb-3 pt-2"
            >
              {voiceIn && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? "Stop listening" : "Speak to Sarthi"}
                  aria-pressed={listening}
                  className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors ${
                    listening
                      ? "border-saffron-500 bg-saffron-500 text-on-accent"
                      : "border-ink-line bg-paper-light text-ink-soft hover:bg-paper-dim"
                  }`}
                >
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  {listening && (
                    <motion.span
                      className="absolute inset-0 rounded-xl border-2 border-saffron-500"
                      animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.25, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      aria-hidden
                    />
                  )}
                </button>
              )}
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                // Submitting on Enter explicitly rather than leaning on the
                // browser's implicit form submission, which was not firing
                // here — people were typing a question, pressing Enter, and
                // watching nothing happen.
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (!busy && input.trim()) void send(input);
                }}
                placeholder={listening ? "Listening…" : "Ask, or say what you can teach…"}
                className="input !py-2 !text-[13px]"
                aria-label={tx("Message Sarthi")}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={tx("Send message")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink text-paper-light transition-colors hover:bg-saffron-500 disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>

            {/*
               A call, for somebody this box is not working for.

               Typing a question is the barrier for a lot of the people this
               platform exists for — a cheap keyboard, a language the phone
               does not type well, or simply not much reading. They are
               already here, having opened the assistant and got stuck, which
               makes this the right place to offer a voice instead of the
               contact page they will never scroll to.

               Draws nothing until the voice agent is configured, so it costs
               a confused reader nothing in the meantime.
            */}
            <SarvamCall
              label={tx("Talk to Sarthi instead")}
              className="border-t border-ink-line px-4 py-3"
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
