import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useTx } from "@/lib/i18n";
import { trapFocus } from "@/lib/focus-trap";
import { parseHref } from "@/lib/notification-href";
import { isSpeechRecognitionSupported, listen } from "@/lib/voice";
import { confirmQuestion, describeMatch } from "@/lib/intent/describe";
import { START, intentFlow } from "@/lib/intent/flow";
import { MAX_PHRASE } from "@/lib/intent/phrase";
import { resolveIntent } from "@/lib/intent/resolve";

/**
 * One text box (and a mic, where the browser has one), then a confirm step.
 *
 * Nothing here moves the page by itself. Typing, speaking, a keyword hit and a
 * model answer all end on "Go to ...?" with Go, Change and Cancel; the link is
 * only followed from Go (see `intentFlow`, where `going` is reachable only
 * from `confirm`). Esc closes, and Tab stays inside the dialog.
 */
export default function SayItDialog({ onClose }: { onClose: () => void }) {
  const tx = useTx();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [flow, dispatch] = useReducer(intentFlow, START);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");
  const [canListen] = useState(() => isSpeechRecognitionSupported());
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const goBtn = useRef<HTMLButtonElement>(null);
  const stopListening = useRef<(() => void) | null>(null);

  /* Focus trap, Esc, and page scroll locked while the dialog is open. */
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const release = trapFocus(el, { onEscape: onClose, initialFocus: input.current });
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      release();
      root.style.overflow = before;
      stopListening.current?.();
    };
  }, [onClose]);

  /* Look the phrase up. A newer step or a close cancels the old lookup. */
  useEffect(() => {
    if (flow.step !== "resolving") return;
    const ctl = new AbortController();
    void resolveIntent(flow.phrase, { signal: ctl.signal }).then((result) => {
      if (!ctl.signal.aborted) dispatch({ type: "resolved", result });
    });
    return () => ctl.abort();
  }, [flow]);

  /* The one place a link is followed, and only after Go moved the flow to "going". */
  useEffect(() => {
    if (flow.step !== "going") return;
    void navigate(parseHref(flow.href) as Parameters<typeof navigate>[0]);
    onClose();
  }, [flow, navigate, onClose]);

  /* Put focus where the next action is. */
  useEffect(() => {
    if (flow.step === "confirm") goBtn.current?.focus();
    else if (flow.step === "ask") input.current?.focus();
  }, [flow.step]);

  const submit = (phrase: string) => {
    setNote("");
    dispatch({ type: "submit", phrase });
  };

  const toggleMic = () => {
    if (listening) {
      stopListening.current?.();
      return;
    }
    setNote("");
    const stop = listen(prefs.locale, {
      onPartial: setText,
      onFinal: (heard) => {
        setText(heard);
        // Heard words only look the place up; the confirm step still comes before any move.
        submit(heard);
      },
      onError: (message) => setNote(message),
      onEnd: () => setListening(false),
    });
    if (stop) {
      stopListening.current = stop;
      setListening(true);
    } else {
      setNote(tx("The microphone could not start. You can type instead."));
    }
  };

  const signedIn = !!user;
  const title = tx("Say where you want to go");

  return createPortal(
    <div
      className="say-it-layer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="say-it-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="say-it-title"
        data-say-it=""
      >
        {flow.step === "confirm" ? (
          <>
            <h2 id="say-it-title" className="font-display text-xl tracking-tight text-ink">
              {confirmQuestion(flow.match, tx)}
            </h2>
            <p className="mt-1.5 font-body text-sm text-ink-soft">
              {tx("Nothing moves until you press Go.")}
            </p>
            <div className="say-it-actions">
              <button
                ref={goBtn}
                type="button"
                className="btn-primary min-h-11 !px-5 !text-sm"
                onClick={() => dispatch({ type: "go", signedIn })}
              >
                {tx("Go")}
              </button>
              <button
                type="button"
                className="btn-ghost min-h-11 !px-5 !text-sm"
                onClick={() => dispatch({ type: "change" })}
              >
                {tx("Change")}
              </button>
              <button type="button" className="btn-ghost min-h-11 !px-5 !text-sm" onClick={onClose}>
                {tx("Cancel")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="say-it-title" className="font-display text-xl tracking-tight text-ink">
              {title}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(text);
              }}
            >
              <label
                htmlFor="say-it-input"
                className="mt-1.5 block font-body text-sm text-ink-soft"
              >
                {tx("Type or speak. You'll confirm before anything moves.")}
              </label>
              <div className="say-it-row">
                <input
                  id="say-it-input"
                  ref={input}
                  type="text"
                  value={text}
                  maxLength={MAX_PHRASE}
                  autoComplete="off"
                  enterKeyHint="go"
                  onChange={(e) => setText(e.target.value)}
                  placeholder={tx("e.g. remote internships, free courses, mere skills")}
                  className="input"
                />
                {canListen && (
                  <button
                    type="button"
                    className="say-it-icon-btn"
                    aria-pressed={listening}
                    aria-label={listening ? tx("Stop listening") : tx("Speak")}
                    onClick={toggleMic}
                  >
                    {listening ? <MicOff size={18} aria-hidden /> : <Mic size={18} aria-hidden />}
                  </button>
                )}
              </div>
              <div className="say-it-actions">
                <button
                  type="submit"
                  className="btn-primary min-h-11 !px-5 !text-sm"
                  disabled={flow.step === "resolving" || !text.trim()}
                >
                  {flow.step === "resolving" ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                  ) : null}
                  {tx("Find")}
                </button>
                <button
                  type="button"
                  className="btn-ghost min-h-11 !px-5 !text-sm"
                  onClick={onClose}
                >
                  {tx("Cancel")}
                </button>
              </div>
            </form>

            <div role="status" aria-live="polite">
              {flow.step === "resolving" && (
                <p className="mt-3 font-body text-sm text-ink-soft">{tx("Looking…")}</p>
              )}
              {note && <p className="mt-3 font-body text-sm text-ink-soft">{note}</p>}
              {flow.step === "none" && (
                <div className="mt-3">
                  <p className="font-body text-sm text-ink-soft">
                    {tx("Nothing matched that. Pick a place to see it, then confirm.")}
                  </p>
                  <ul className="say-it-suggest">
                    {flow.suggestions.map((m) => (
                      <li key={`${m.routeId}:${JSON.stringify(m.filters)}`}>
                        <button
                          type="button"
                          className="swap-chip"
                          onClick={() => dispatch({ type: "pick", match: m })}
                        >
                          {describeMatch(m, tx)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
