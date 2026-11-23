/**
 * Try On Another Swayam (F3): the two-user moment on one device.
 *
 * Four chips (Learner, Career, Skills, Community). Each one runs the same transient plan override as the
 * Time-Scrub: the real Home and navigation morph into that persona's tier-3 structure (composed by the sandbox
 * from a fixed journey, never from your behaviour), a "Previewing, not your layout" bar holds for about 8 seconds,
 * then everything morphs back. "Make this mine" keeps it (the Keep path); "Back to mine" returns at once.
 * Nothing is stored, tracked or synced while previewing, and every feature stays reachable from the previewed menu.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMotionPrefs } from "../motion/hooks";
import { useEvolutionPrefs, usePreviewPlan } from "../../evolution/react/hooks";
import { clearPreview, commitPreview, previewPlan } from "../../evolution/state/commands";
import type { PersonaId } from "../../evolution/types";

export const TRY_ON_MS = 8_000;

export interface TryOnPersona {
  id: PersonaId;
  /** The chip. */
  label: string;
  /** What the bar says: "Previewing a career Swayam". */
  noun: string;
}

/** The four service-first personas. (fast-user is a pacing demo, not a structure to try on.) */
export const TRY_ON_PERSONAS: readonly TryOnPersona[] = [
  { id: "learning-explorer", label: "Learner", noun: "learner" },
  { id: "career-seeker", label: "Career", noun: "career" },
  { id: "skill-builder", label: "Skills", noun: "skills" },
  { id: "community-explorer", label: "Community", noun: "community" },
];

/** "Previewing the career Swayam, not your layout" (the bar's headline). */
export const previewHeadline = (noun: string): string =>
  `Previewing the ${noun} Swayam, not your layout`;

/** A keyboard activation moves focus to the bar, so the 8 seconds are never a race against Tab. */
let focusBarNext = false;

export default function TryOn({ onStart }: { onStart?: () => void }) {
  const preview = usePreviewPlan();
  const active = preview?.source === "tryon" ? preview.persona : null;

  return (
    <section className="evo-try" aria-labelledby="evo-try-title">
      <h3 id="evo-try-title" className="evo-try-title">
        Try on another Swayam
      </h3>
      <p className="evo-try-note">
        See Home and the menu the way someone else would. Yours does not change.
      </p>
      <div className="evo-try-chips" role="group" aria-label="Try on another Swayam">
        {TRY_ON_PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="evo-try-chip"
            aria-pressed={active === p.id}
            onClick={(e) => {
              focusBarNext = e.detail === 0;
              previewPlan(p.id, { source: "tryon", ttlMs: TRY_ON_MS });
              onStart?.();
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * The bar that says what is on screen is not yours. Mounted once by WhyPanel, so it shows whether or not the
 * panel is open. A scrub shows its own controls in the panel; a chip hold shows a small pill.
 */
export function PreviewBar() {
  const preview = usePreviewPlan();
  const prefs = useEvolutionPrefs();
  const { reduced } = useMotionPrefs();
  const keep = useRef<HTMLButtonElement>(null);
  const id = preview?.id ?? 0;
  const source = preview?.source;

  useEffect(() => {
    if (source !== "tryon" || !focusBarNext) return;
    focusBarNext = false;
    keep.current?.focus({ preventScroll: true });
  }, [id, source]);

  if (!preview || preview.source === "scrub" || typeof document === "undefined") return null;

  if (preview.source === "hold") {
    return createPortal(
      <div className="evo-pv" data-hold="true" role="status">
        <p className="evo-pv-text">Peeking at an earlier layout</p>
      </div>,
      document.body,
    );
  }

  const persona = TRY_ON_PERSONAS.find((p) => p.id === preview.persona);
  const ttl = preview.expiresAt === null ? TRY_ON_MS : preview.expiresAt - preview.startedAt;
  // Touching or focusing the bar means "I am reading this": give the full time again.
  const rearm = () => {
    if (preview.persona) previewPlan(preview.persona, { source: "tryon", ttlMs: TRY_ON_MS });
  };

  return createPortal(
    <div
      className="evo-pv"
      role="group"
      aria-label="Previewing another Swayam"
      onPointerEnter={rearm}
      onFocus={rearm}
    >
      <p className="evo-pv-text" role="status">
        {previewHeadline(persona?.noun ?? "other")}
        <span>
          {reduced
            ? "Back to yours in a few seconds."
            : "Back to yours in a moment. Everything stays reachable."}
        </span>
      </p>
      <div className="evo-pv-actions">
        {prefs.adaptive !== "off" ? (
          <button
            ref={keep}
            type="button"
            className="btn-primary evo-pv-btn"
            onClick={() => commitPreview()}
          >
            Make this mine
          </button>
        ) : null}
        <button type="button" className="btn-ghost evo-pv-btn" onClick={() => clearPreview()}>
          Back to mine
        </button>
      </div>
      {reduced ? null : (
        <span
          key={preview.id}
          className="evo-pv-clock"
          aria-hidden="true"
          style={{ ["--evo-pv-ttl" as string]: `${ttl}ms` }}
        />
      )}
    </div>,
    document.body,
  );
}
