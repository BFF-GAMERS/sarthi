/**
 * "Your Swayam" status dot + WhyPanel trigger (plan §4.6).
 * One small dot in the navbar at every width (it replaced the "Learning how you use Swayam" chip, which
 * ate the room "Log in / Join free" needs at 1280-1440 px and crowded the phone's top bar). The visible mark
 * is about 14 px inside a 44 x 44 px hit area, and it carries no text: the accessible name and the tooltip
 * are one full sentence from nav-model `dotLabel`, e.g. "Your Swayam: Career focused, 68%".
 *
 * Colour is never the only cue. Each state has its own shape: learning = hollow green ring, adapted = filled
 * gold dot with a check, kept = filled gold with a lock, paused = ring with two bars, off = dashed ring
 * with a slash. The confidence is Math.round(c*100), the same expression the WhyPanel prints.
 *
 * The dot is the motion kit's AdaptingPulse: it breathes and sends out two rings once when the page lands
 * already adapted, and once for every committed change, then goes quiet (no loop). Reduced motion fades the
 * dot instead (no rings, no scale). It renders nothing until the store has hydrated, so the server markup
 * and the first client render agree.
 *
 * Press and hold (>= 350 ms) is the Time-Scrub peek: it dispatches `swayam:chip-hold` {phase:"start"} on
 * window, and {phase:"end"} on release. The click that follows a hold is swallowed so peeking never opens
 * the panel; a normal tap, Enter or Space still does. `variant` is kept for callers ("nav" | "inline").
 */
import { useEffect, useRef } from "react";
import { useTx } from "../../lib/i18n";
import { AdaptingPulse } from "../motion/AdaptingPulse";
import {
  useEvolutionHydrated,
  useEvolutionPrefs,
  useEvolutionStatus,
  useUiState,
  useWhyPanelState,
} from "../../evolution/react/hooks";
import { openWhy } from "../../evolution/state/notice";
import { dotLabel, dotTone, type DotTone } from "./nav-model";

/** How long a press has to last before it counts as a hold (council §5). */
export const CHIP_HOLD_MS = 350;

const emitHold = (phase: "start" | "end") =>
  window.dispatchEvent(new CustomEvent("swayam:chip-hold", { detail: { phase } }));

/** Visible mark, in px. The button around it is 44 x 44 (evo-nav.css `.evo-dot`). */
const DOT_PX = 14;

/** The shape that goes inside the dot, so the state never rests on colour alone. */
function DotGlyph({ tone }: { tone: DotTone }) {
  return (
    <svg
      className="evo-dot-glyph"
      width={DOT_PX}
      height={DOT_PX}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {tone === "adapted" && <path d="M3.9 7.3 6.1 9.5 10.2 4.9" />}
      {tone === "kept" && (
        <>
          <path d="M5.5 6.4V5.5a1.5 1.5 0 0 1 3 0v.9" strokeWidth={1.4} />
          <rect x="4.2" y="6.4" width="5.6" height="4" rx="0.9" fill="currentColor" stroke="none" />
        </>
      )}
      {tone === "paused" && <path d="M5.6 4.9v4.2M8.4 4.9v4.2" />}
      {tone === "off" && <path d="M4.7 9.3 9.3 4.7" />}
    </svg>
  );
}

export interface AdaptingIndicatorProps {
  variant: "nav" | "inline";
  className?: string;
}

function StatusDot({ variant, className }: AdaptingIndicatorProps) {
  const status = useEvolutionStatus();
  const prefs = useEvolutionPrefs();
  const ui = useUiState();
  const why = useWhyPanelState();
  const tx = useTx();
  const timer = useRef<number | null>(null);
  /** A "start" was sent and its "end" has not been. */
  const active = useRef(false);
  /** The click that follows a hold must not open the panel. */
  const swallow = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const release = () => {
    clear();
    if (!active.current) return;
    active.current = false;
    emitHold("end");
    // The click (if the browser sends one) comes right after pointerup; forget it if it does not.
    swallow.current = true;
    window.setTimeout(() => {
      swallow.current = false;
    }, 50);
  };
  useEffect(
    () => () => {
      clear();
      if (active.current) emitHold("end");
    },
    [],
  );

  const learning = status.state === "UNIVERSAL" || status.tier === 0;
  const input = {
    adaptive: prefs.adaptive,
    learning,
    locked: prefs.locked,
    label: status.label,
    confidence: status.confidence,
  };
  const tone = dotTone(input);
  const name = dotLabel(input, tx);
  // Landing on a page that is already adapted should say so once; a quiet "learning" dot should not.
  const adapted = prefs.adaptive === "on" && !learning;

  return (
    <button
      type="button"
      className={`evo-dot ${className ?? ""}`.trim()}
      data-variant={variant}
      data-tone={tone}
      data-evo-chip
      aria-label={name}
      title={name}
      aria-haspopup="dialog"
      aria-expanded={why.open}
      aria-controls="evo-why-panel"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        swallow.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          active.current = true;
          emitHold("start");
        }, CHIP_HOLD_MS);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => {
        // A long press on a phone must peek, not open the system menu.
        if (active.current || timer.current !== null) e.preventDefault();
      }}
      onClick={(e) => {
        if (swallow.current) {
          swallow.current = false;
          return;
        }
        openWhy(e.currentTarget);
      }}
    >
      <AdaptingPulse
        pulseKey={ui.renderKey}
        pulseOnMount={adapted}
        size={DOT_PX}
        color="currentColor"
        className="evo-dot-pulse"
      >
        <DotGlyph tone={tone} />
        {/* The polite live region announces the full sentence when it changes. */}
        <span className="sr-only">{name}</span>
      </AdaptingPulse>
    </button>
  );
}

/**
 * Renders nothing until the store has hydrated (server markup and first client render agree). The dot proper
 * is a separate component so the translator hook, which needs the i18n provider, never runs on the server.
 */
export default function AdaptingIndicator(props: AdaptingIndicatorProps) {
  const hydrated = useEvolutionHydrated();
  if (!hydrated) return null;
  return <StatusDot {...props} />;
}
