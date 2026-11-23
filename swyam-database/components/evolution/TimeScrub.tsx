/**
 * Time-Scrub (F2): history as a tactile instrument.
 *
 * A slider over the committed history. Each stop is a structure Swayam really showed, labelled with the reason it
 * stored for it. Dragging it drives a transient plan override, so the REAL Home and navigation FLIP through
 * Standard -> step 1 -> step 2 -> now, and EvolutionStage leaves a ghost outline and a short arrow at each moved
 * section's old slot. Nothing is written: the override is in memory, drops when the panel closes, on a route
 * change or on any tracked event, and "Restore this layout" goes through the existing Keep path.
 *
 * Press-and-hold on the chip (window event `swayam:chip-hold`) peeks at the previous stop and snaps back on release.
 * Reduced motion: the stops are stepped snapshots; EvolutionStage does not animate and draws no moving ghosts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { EVOLUTION_CONFIG } from "../../evolution/config/evolution-config";
import { renderReason } from "../../evolution/core/evolution/reasons";
import { useEvolutionSnapshot, usePreviewPlan } from "../../evolution/react/hooks";
import {
  clearPreview,
  commitPreview,
  getRuntime,
  previewPlan,
} from "../../evolution/state/commands";
import { sameRef } from "../../evolution/state/preview";
import type {
  EvolutionHistory,
  EvolutionSnapshotRef,
  EvolutionStatus,
  ReasonCode,
  Tier,
} from "../../evolution/types";

// ─── model (pure; the tests read these) ────────────────────────────────────────────────────────────────

export interface ScrubStop {
  /** Unique within the list. */
  key: string;
  ref: EvolutionSnapshotRef;
  /** "Standard layout", "Career focused · Home leads". */
  title: string;
  /** The stored reason, rendered from its code (never free text). */
  reason: string;
  reasonCode: ReasonCode;
  confidence: number;
  /** The last stop is what Swayam shows right now. */
  live: boolean;
}

const TIER_STEP: Readonly<Record<Tier, string>> = {
  0: "Standard layout",
  1: "Home leads",
  2: "Menu follows",
  3: "Fully arranged",
};

/** "Standard layout" at tier 0, otherwise the experience and what has changed so far. */
export function stopTitle(ref: EvolutionSnapshotRef): string {
  if (ref.tier === 0) return TIER_STEP[0];
  const label =
    ref.state === "UNIVERSAL"
      ? EVOLUTION_CONFIG.modeLabels[ref.mode]
      : EVOLUTION_CONFIG.states[ref.state].label;
  return `${label} · ${TIER_STEP[ref.tier]}`;
}

const START: ReasonCode = { key: "START" };

function makeStop(
  index: number,
  ref: EvolutionSnapshotRef,
  reasonCode: ReasonCode,
  confidence: number,
): ScrubStop {
  return {
    key: `${index}:${ref.state}:${ref.mode}:${ref.tier}`,
    ref,
    title: stopTitle(ref),
    reason: renderReason(reasonCode),
    reasonCode,
    confidence,
    live: false,
  };
}

/**
 * The stops of a scrub: where Swayam started, every distinct structure it committed, ending at what is shown now.
 * Consecutive commits with the same structure collapse (a confidence-only change is not a stop). Commits the
 * user has not been shown yet (a held release, or a kept layout) are left out.
 */
export function buildStops(
  history: EvolutionHistory,
  live: { ref: EvolutionSnapshotRef; reasonCode: ReasonCode; confidence: number },
): ScrubStop[] {
  const stops: ScrubStop[] = [];
  const first = history[0];
  if (first) stops.push(makeStop(0, first.from, START, 0));
  for (const e of history) {
    const prev = stops[stops.length - 1];
    if (prev && sameRef(prev.ref, e.to)) continue;
    stops.push(makeStop(stops.length, e.to, e.reasonCode, e.confidence));
  }
  let last = -1;
  stops.forEach((s, i) => {
    if (sameRef(s.ref, live.ref)) last = i;
  });
  if (last >= 0) stops.length = last + 1;
  else stops.push(makeStop(stops.length, live.ref, live.reasonCode, live.confidence));
  const end = stops.length - 1;
  stops[end] = { ...stops[end]!, live: true };
  return stops;
}

/** The structure that is on screen now, from the live snapshot's status and plan. */
export const liveRefOf = (
  status: Pick<EvolutionStatus, "state" | "mode" | "tier">,
  ui: { navMode: EvolutionSnapshotRef["nav"]; layout: EvolutionSnapshotRef["layout"] },
): EvolutionSnapshotRef => ({
  state: status.state,
  mode: status.mode,
  nav: ui.navMode,
  layout: ui.layout,
  tier: status.tier,
});

/** The stops for the live snapshot. [] before hydration. */
export function useScrubStops(): ScrubStop[] {
  const snap = useEvolutionSnapshot();
  const { history, status, ui, hydrated } = snap;
  return useMemo(
    () =>
      hydrated
        ? buildStops(history, {
            ref: liveRefOf(status, ui),
            reasonCode: status.reasonCode,
            confidence: status.confidence,
          })
        : [],
    [hydrated, history, status, ui],
  );
}

const stopOptions = (s: ScrubStop) => ({
  source: "scrub" as const,
  reasonCode: s.reasonCode,
  confidence: s.confidence,
});

// ─── press-and-hold on the chip ────────────────────────────────────────────────────────────────────────

/** A hold that never reports its release must not strand a preview. */
const HOLD_SAFETY_MS = 15_000;

/**
 * What a `swayam:chip-hold` does: "start" peeks at the previous stop (a hold with nothing to peek at does
 * nothing); "end" returns to the live layout, but only if the hold is what is being shown.
 */
export function applyChipHold(phase: string | undefined, stops: readonly ScrubStop[]): void {
  if (phase === "start") {
    const prev = stops[stops.length - 2];
    if (prev)
      previewPlan(prev.ref, { ...stopOptions(prev), source: "hold", ttlMs: HOLD_SAFETY_MS });
  } else if (phase === "end") {
    if (getRuntime().getPreview()?.source === "hold") clearPreview();
  }
}

/**
 * Listens for `swayam:chip-hold` ({phase: "start" | "end"}, dispatched by the nav chip) and peeks at the previous
 * stop while the chip is held. Mount once (WhyPanel does).
 */
export function useChipHoldPeek(): void {
  const stops = useScrubStops();
  const ref = useRef(stops);
  useEffect(() => {
    ref.current = stops;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHold = (e: Event) =>
      applyChipHold((e as CustomEvent<{ phase?: string }>).detail?.phase, ref.current);
    window.addEventListener("swayam:chip-hold", onHold);
    return () => window.removeEventListener("swayam:chip-hold", onHold);
  }, []);
}

// ─── the panel block ───────────────────────────────────────────────────────────────────────────────────

export default function TimeScrub({ enabled = true }: { enabled?: boolean }) {
  const stops = useScrubStops();
  const preview = usePreviewPlan();
  const [idx, setIdx] = useState<number | null>(null);
  const n = stops.length;
  const scrubbing = preview?.source === "scrub";

  // The preview ended somewhere else (route change, tracked event, Restore): the slider goes back to now.
  useEffect(() => {
    if (!scrubbing) setIdx(null);
  }, [scrubbing]);

  if (n < 2) {
    return (
      <section className="evo-ts" aria-labelledby="evo-ts-title" data-empty="true">
        <h3 id="evo-ts-title" className="evo-ts-title">
          Replay your Swayam
        </h3>
        <p className="evo-ts-reason">
          Nothing to replay yet. When Swayam rearranges itself, you can scrub back through it here.
        </p>
      </section>
    );
  }

  const value = Math.min(idx ?? n - 1, n - 1);
  const stop = stops[value]!;
  const past = value < n - 1;

  const go = (v: number) => {
    if (v >= n - 1) {
      setIdx(null);
      if (scrubbing) clearPreview();
      return;
    }
    setIdx(v);
    previewPlan(stops[v]!.ref, stopOptions(stops[v]!));
  };

  return (
    <section className="evo-ts" aria-labelledby="evo-ts-title" data-past={past ? "true" : "false"}>
      <div className="evo-ts-head">
        <h3 id="evo-ts-title" className="evo-ts-title">
          Replay your Swayam
        </h3>
        <span className="evo-ts-pos">{past ? `Step ${value + 1} of ${n}` : "Now"}</span>
      </div>
      <input
        type="range"
        className="evo-ts-range"
        min={0}
        max={n - 1}
        step={1}
        value={value}
        disabled={!enabled}
        aria-label="Scrub back through how your Swayam changed"
        aria-valuetext={`${stop.title}. ${stop.reason}`}
        onChange={(e) => go(Number(e.target.value))}
      />
      {n <= 16 ? (
        <div className="evo-ts-ticks" aria-hidden="true">
          {stops.map((s, i) => (
            <span key={s.key} className="evo-ts-tick" data-on={i === value ? "true" : "false"} />
          ))}
        </div>
      ) : null}
      <p className="evo-ts-stop">{stop.live ? `Now · ${stop.title}` : stop.title}</p>
      <p className="evo-ts-reason">{stop.reason}</p>
      {past ? (
        <div className="evo-ts-actions">
          <button
            type="button"
            className="btn-primary evo-ts-btn"
            onClick={() => {
              commitPreview();
              setIdx(null);
            }}
          >
            Restore this layout
          </button>
          <button
            type="button"
            className="btn-ghost evo-ts-btn"
            onClick={() => {
              setIdx(null);
              clearPreview();
            }}
          >
            Back to now
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ─── styles (this lane has no stylesheet of its own; tokens only, so every theme and register follows) ──

export const PREVIEW_CSS = `
.evo-ts{margin-top:1rem;padding-top:.9rem;border-top:1px solid var(--color-ink-line)}
.evo-ts-head{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem}
.evo-ts-title,.evo-try-title{margin:0;font-size:.75rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-ink-mute)}
.evo-ts-pos{font-size:.75rem;font-variant-numeric:tabular-nums;color:var(--color-ink-mute);white-space:nowrap}
.evo-ts-range{display:block;width:100%;height:2.75rem;margin:.15rem 0 0;padding:0;accent-color:var(--color-saffron-500);background:transparent;cursor:pointer}
.evo-ts-range:disabled{cursor:not-allowed;opacity:.5}
.evo-ts-range:focus-visible{outline:2px solid var(--color-saffron-500);outline-offset:2px;border-radius:999px}
.evo-ts-ticks{display:flex;justify-content:space-between;padding:0 .5rem;margin-top:-.4rem;pointer-events:none}
.evo-ts-tick{width:.35rem;height:.35rem;border-radius:999px;background:var(--color-ink-line)}
.evo-ts-tick[data-on="true"]{background:var(--color-saffron-500)}
.evo-ts-stop{margin:.45rem 0 0;font-weight:600;color:var(--color-ink)}
.evo-ts-reason{margin:.15rem 0 0;color:var(--color-ink-soft);font-size:.8125rem;line-height:1.35}
.evo-ts-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.65rem}
.evo-ts-btn{min-height:2.75rem;justify-content:center}
.evo-why[data-peek="true"]{background:transparent;border-color:transparent;box-shadow:none;pointer-events:none;overflow:visible}
.evo-why[data-peek="true"]>*:not(.evo-ts){visibility:hidden}
.evo-why[data-peek="true"]>.evo-ts{pointer-events:auto;margin-top:0;padding:.9rem 1rem;border:1px solid var(--color-ink-line);border-radius:var(--radius-card);background:var(--color-paper-light);box-shadow:var(--shadow-soft)}
.evo-try{margin-top:1rem;padding-top:.9rem;border-top:1px solid var(--color-ink-line)}
.evo-try-note{margin:.25rem 0 0;color:var(--color-ink-soft);font-size:.8125rem;line-height:1.35}
.evo-try-chips{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.4rem;margin-top:.55rem}
.evo-try-chip{min-height:2.75rem;padding:.25rem .3rem;border:1px solid var(--color-ink-line);border-radius:999px;background:transparent;color:var(--color-ink);font:inherit;font-size:.8125rem;font-weight:600;cursor:pointer;white-space:nowrap}
.evo-try-chip:hover{border-color:var(--color-saffron-500)}
.evo-try-chip[aria-pressed="true"]{background:var(--color-saffron-500);border-color:var(--color-saffron-500);color:#fff}
.evo-try-chip:focus-visible{outline:2px solid var(--color-saffron-500);outline-offset:2px}
.evo-try-chip:disabled{cursor:not-allowed;opacity:.5}
.evo-pv{position:fixed;z-index:95;left:max(.75rem,env(safe-area-inset-left));right:max(.75rem,env(safe-area-inset-right));bottom:calc(5rem + env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .9rem;padding:.7rem 1rem .85rem;border:1px solid var(--color-saffron-500);border-radius:var(--radius-card);background:var(--color-paper-light);color:var(--color-ink);box-shadow:var(--shadow-soft);font-family:var(--font-body,inherit);font-size:.875rem;overflow:hidden}
@media (min-width:1024px){.evo-pv{left:50%;right:auto;bottom:calc(1.25rem + env(safe-area-inset-bottom));transform:translateX(-50%);width:max-content;max-width:min(36rem,calc(100vw - 2rem))}}
.evo-pv-text{margin:0;flex:1 1 11rem;font-weight:600}
.evo-pv-text span{display:block;font-weight:400;color:var(--color-ink-soft);font-size:.8125rem}
.evo-pv-actions{display:flex;flex-wrap:wrap;gap:.5rem}
.evo-pv-btn{min-height:2.75rem;justify-content:center;white-space:nowrap}
.evo-pv-clock{position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--color-saffron-500);transform-origin:left center;animation:evo-pv-run var(--evo-pv-ttl,8s) linear forwards}
@keyframes evo-pv-run{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.evo-pv[data-hold="true"]{flex-wrap:nowrap;padding:.55rem 1rem;width:max-content}
.evo-pv[data-hold="true"] .evo-pv-text{flex:none}
@media (max-width:359px){.evo-try-chip{font-size:.75rem;padding-inline:.15rem}}
`;

/** One <style> carrying the preview surfaces' CSS. Rendered by WhyPanel (once) and by Settings. */
export function PreviewStyles() {
  return <style data-evo-preview="">{PREVIEW_CSS}</style>;
}
