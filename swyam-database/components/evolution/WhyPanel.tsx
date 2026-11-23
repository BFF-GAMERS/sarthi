/**
 * "Why is my Swayam arranged like this?" (plan §4.6): a popover at >= 1024px, a bottom sheet below.
 * Shows the experience, the confidence (once), where the arrangement came from, what moved, and the controls:
 * Reset my experience, Keep my current layout, Open Evolution Lab, Adaptation settings. Below them, the two
 * ways to feel the adaptation: Try on another Swayam and Replay your Swayam (Time-Scrub).
 * Focus trap, Esc to close, focus returns to the trigger. Never shows model names or technical details.
 * Mounted once, by EvolutionNotice. It also owns the always-on preview surfaces: the "Previewing" bar and the
 * press-and-hold peek on the chip, so they work with the panel closed.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { trapFocus } from "../../lib/focus-trap";
import { EVOLUTION_CONFIG } from "../../evolution/config/evolution-config";
import { defaultSnapshot } from "../../evolution/state/defaults";
import { closeWhy, whatMoved } from "../../evolution/state/notice";
import {
  clearPreview,
  getRuntime,
  resetExperience,
  setLocked,
} from "../../evolution/state/commands";
import {
  useEvolutionPrefs,
  useEvolutionStatus,
  useFxLightened,
  usePreviewPlan,
  useUiState,
  useWhyPanelState,
} from "../../evolution/react/hooks";
import type { BehaviourMode, DomainId, EvolutionStatus } from "../../evolution/types";
import TimeScrub, { PreviewStyles, useChipHoldPeek } from "./TimeScrub";
import TryOn, { PreviewBar } from "./TryOn";

const WIDE = "(min-width: 1024px)";
const TABLET = "(min-width: 768px)";

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
}

const UNIVERSAL_UI = defaultSnapshot().ui;

// ─── copy (pure; the tests read these) ─────────────────────────────────────────────────────────────────

/** The domain as a noun in a sentence: "Arranged for career". */
const DOMAIN_NOUN: Readonly<Record<DomainId, string>> = {
  LEARNING: "learning",
  CAREER: "career",
  SKILL_EXCHANGE: "skill exchange",
  COMMUNITY: "community",
};

/** For the arrangements that follow a way of using Swayam rather than a domain. */
const MODE_NOUN: Readonly<Partial<Record<BehaviourMode, string>>> = {
  EXPLORER: "exploring",
  QUICK: "quick visits",
  RESEARCH: "comparing options",
  REPEAT: "where you left off",
  MINIMAL: "a simpler Home",
};

/** The one place a confidence is turned into a number: the same expression as the nav chip. */
export const confidencePct = (confidence: number): number => Math.round(confidence * 100);

export interface WhyCopy {
  /** Still learning: no arrangement to explain yet. */
  learning: boolean;
  label: string;
  /** Shown once, as "68% sure". */
  pct: number;
  /** "Arranged for career", or null when nothing is arranged. */
  arranged: string | null;
  /** "from this visit" / "from your last visit". */
  provenance: string;
  /** "Swayam lightened itself for this phone." when the frame budget stepped in. */
  fx: string | null;
}

export function whyCopy(
  status: Pick<EvolutionStatus, "state" | "mode" | "tier" | "label" | "confidence" | "restored">,
  opts: { lightened?: boolean; phone?: boolean } = {},
): WhyCopy {
  const learning = status.state === "UNIVERSAL" || status.tier === 0;
  const domain = EVOLUTION_CONFIG.states[status.state].domain;
  const noun = domain ? DOMAIN_NOUN[domain] : (MODE_NOUN[status.mode] ?? null);
  return {
    learning,
    label: status.label,
    pct: confidencePct(status.confidence),
    arranged: !learning && noun ? `Arranged for ${noun}` : null,
    provenance: status.restored ? "from your last visit" : "from this visit",
    fx: opts.lightened
      ? `Swayam lightened itself for this ${opts.phone ? "phone" : "device"}.`
      : null,
  };
}

// ─── the panel ─────────────────────────────────────────────────────────────────────────────────────────

export default function WhyPanel() {
  const { open, anchor, returnTo } = useWhyPanelState();
  const status = useEvolutionStatus();
  const prefs = useEvolutionPrefs();
  const ui = useUiState();
  const preview = usePreviewPlan();
  const lightened = useFxLightened();
  const wide = useMedia(WIDE);
  const tablet = useMedia(TABLET);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useChipHoldPeek();

  useEffect(() => {
    if (!open || !panel.current) return;
    return trapFocus(panel.current, {
      onEscape: closeWhy,
      returnTo,
      initialFocus: closeBtn.current,
    });
  }, [open, returnTo]);

  // Closing the panel is "let go": a scrub returns to the live layout. (A Try-On has its own bar and timer.)
  useEffect(() => {
    if (!open && getRuntime().getPreview()?.source === "scrub") clearPreview();
  }, [open]);

  const peek = preview?.source === "scrub";
  const showPanel = open && typeof document !== "undefined";
  if (!showPanel && !preview) return null;

  const copy = whyCopy(status, { lightened, phone: !tablet });
  const moved = whatMoved(ui, UNIVERSAL_UI);
  const style =
    wide && anchor
      ? { top: anchor.bottom + 8, right: Math.max(16, window.innerWidth - anchor.right) }
      : undefined;

  return (
    <>
      <PreviewStyles />
      <PreviewBar />
      {showPanel
        ? createPortal(
            <>
              <div
                className="evo-scrim"
                data-wide={wide ? "true" : "false"}
                onClick={closeWhy}
                aria-hidden="true"
                style={peek ? { background: "transparent", pointerEvents: "none" } : undefined}
              />
              <div
                ref={panel}
                id="evo-why-panel"
                className="evo-why"
                data-wide={wide ? "true" : "false"}
                data-peek={peek ? "true" : "false"}
                role="dialog"
                aria-modal="true"
                aria-labelledby="evo-why-title"
                style={style}
              >
                <div className="evo-why-head">
                  <h2 id="evo-why-title" className="evo-why-title">
                    Your Swayam
                  </h2>
                  <button
                    ref={closeBtn}
                    type="button"
                    className="evo-why-close"
                    onClick={closeWhy}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <p className="evo-why-exp">
                  {copy.learning ? (
                    <span>Learning how you use Swayam</span>
                  ) : (
                    <>
                      <span className="evo-why-label">{copy.label}</span>
                      <span className="evo-why-conf">{`${copy.pct}% sure`}</span>
                    </>
                  )}
                </p>
                <p className="evo-why-reason">{status.reason}</p>

                {copy.arranged ? (
                  <p className="evo-why-restored">
                    {`${copy.arranged} ${copy.provenance} `}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {"· "}
                      <button
                        type="button"
                        className="evo-link"
                        onClick={() => {
                          resetExperience();
                          closeWhy();
                        }}
                      >
                        Reset
                      </button>
                    </span>
                  </p>
                ) : null}

                {copy.fx ? <p className="evo-why-restored">{copy.fx}</p> : null}

                {moved.sections.length + moved.nav.length > 0 ? (
                  <div className="evo-why-moved">
                    <h3 className="evo-why-sub">What moved</h3>
                    <ul>
                      {moved.sections.length > 0 ? (
                        <li>Up on Home: {moved.sections.join(", ")}</li>
                      ) : null}
                      {moved.nav.length > 0 ? (
                        <li>In your navigation: {moved.nav.join(", ")}</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                <label className="evo-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={prefs.locked}
                    onChange={(e) => setLocked(e.target.checked)}
                  />
                  <span className="evo-switch-track" aria-hidden="true" />
                  <span>Keep my current layout</span>
                </label>

                <div
                  className="evo-why-actions"
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 1rem" }}
                >
                  <button
                    type="button"
                    className="btn-ghost evo-why-btn"
                    onClick={() => {
                      resetExperience();
                      closeWhy();
                    }}
                  >
                    Reset my experience
                  </button>
                  <Link to="/lab" className="evo-why-link" onClick={closeWhy}>
                    Open Evolution Lab
                  </Link>
                  <Link
                    to="/settings"
                    hash="your-swayam"
                    className="evo-why-link"
                    onClick={closeWhy}
                  >
                    Adaptation settings
                  </Link>
                </div>

                <TryOn onStart={closeWhy} />
                <TimeScrub enabled={prefs.adaptive !== "off"} />
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
