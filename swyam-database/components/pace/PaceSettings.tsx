/**
 * Settings: pace and steady hands. A section of "Your Swayam".
 *
 * Plain about what it watches (how fast and how accurately you tap and scroll, on this device) and what it never
 * uses. Every control takes effect at once and is announced in a polite live region.
 */
import { useState, useSyncExternalStore } from "react";
import { Hand } from "lucide-react";
import { useEvolutionPrefs } from "../../evolution/react/hooks";
import { useSafeTx } from "./useSafeTx";
import { usePace } from "../../lib/pace";
import { isPaceHydrated, subscribePace, type SteadyMode } from "../../lib/pace/store";
import { useReducedMotionPref } from "../motion/hooks";

export default function PaceSettings() {
  const tx = useSafeTx();
  const pace = usePace();
  const adaptiveOff = useEvolutionPrefs().adaptive === "off";
  const reduced = useReducedMotionPref();
  const hydrated = useSyncExternalStore(subscribePace, isPaceHydrated, () => false);
  const [said, setSaid] = useState("");
  const modes: ReadonlyArray<{ id: SteadyMode; label: string; note: string }> = [
    {
      id: "auto",
      label: tx("Auto"),
      note: tx("Turns on by itself if your taps keep missing or landing twice."),
    },
    {
      id: "on",
      label: tx("On"),
      note: tx(
        "Bigger buttons, more space between them, a double-tap guard, and a check before anything that can't be undone.",
      ),
    },
    { id: "off", label: tx("Off"), note: tx("Buttons stay their normal size.") },
  ];

  const { effective, counts } = pace;
  const watched = counts.taps + counts.scrolls;

  let status: string;
  if (!pace.enabled) status = tx("Pace matching is off. Motion runs at its normal speed.");
  else if (adaptiveOff)
    status = tx("Paused, because Swayam's adaptation is off. Motion runs at its normal speed.");
  else if (reduced) status = tx("Paused, because reduced motion is on.");
  else if (effective.pace === "calm")
    status = tx("Right now: unhurried. Motion runs a little slower and softer.");
  else if (effective.pace === "snappy")
    status = tx("Right now: quick. Motion runs a little faster and crisper.");
  else status = tx("Right now: balanced. Motion runs at its normal speed.");

  return (
    <section
      className="mt-6 border-t border-ink-line pt-5"
      id="pace"
      aria-labelledby="pace-title"
      data-pace-settings
    >
      <h3
        id="pace-title"
        className="flex items-center gap-2 font-display text-base tracking-tight text-ink"
      >
        <Hand size={16} className="text-saffron-500" aria-hidden /> {tx("Pace and steady hands")}
      </h3>
      <p className="mt-2 font-body text-[13px] leading-snug text-ink-mute">
        {tx(
          "Swayam watches how fast you tap and scroll, on this device, never your age. It never reads what you type or what is on your screen. It uses this to set the speed of motion, and to offer bigger buttons if taps keep missing.",
        )}
      </p>

      <label className="evo-switch">
        <input
          type="checkbox"
          role="switch"
          checked={pace.enabled}
          disabled={!hydrated}
          onChange={(e) => {
            pace.setEnabled(e.target.checked);
            setSaid(e.target.checked ? tx("Pace matching is on.") : tx("Pace matching is off."));
          }}
        />
        <span className="evo-switch-track" aria-hidden="true" />
        <span className="font-body text-sm text-ink">{tx("Match my pace")}</span>
      </label>
      <p className="mt-2 font-body text-[12px] leading-snug text-ink-mute">{status}</p>
      {watched > 0 ? (
        <p className="mt-1 font-body text-[12px] leading-snug text-ink-mute">
          {tx("Seen so far on this device:")} {counts.taps} {tx("taps")}, {counts.scrolls}{" "}
          {tx("scrolls")}. {tx("Older than 30 days is forgotten.")}
        </p>
      ) : null}

      <fieldset className="mt-4" disabled={!hydrated}>
        <legend className="font-body text-sm font-medium text-ink">{tx("Steady hands")}</legend>
        <div className="mt-2 grid gap-2">
          {modes.map((m) => (
            <label
              key={m.id}
              className="evo-choice"
              data-selected={pace.steadyMode === m.id ? "true" : "false"}
            >
              <input
                type="radio"
                name="pace-steady"
                value={m.id}
                checked={pace.steadyMode === m.id}
                onChange={() => {
                  pace.setSteadyMode(m.id);
                  setSaid(tx("Steady hands:") + " " + m.label + ".");
                }}
                className="sr-only"
              />
              <span className="evo-choice-dot" aria-hidden="true" />
              <span>
                <span className="block font-body text-sm font-medium text-ink">{m.label}</span>
                <span className="block font-body text-[12px] leading-snug text-ink-mute">
                  {m.note}
                </span>
              </span>
            </label>
          ))}
        </div>
        {pace.steadyMode === "auto" && pace.steadyActive ? (
          <p className="mt-2 font-body text-[12px] leading-snug text-ink-mute">
            {tx("Steady hands is on right now, because your recent taps often missed.")}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-4">
        <button
          type="button"
          className="btn-ghost"
          disabled={!hydrated}
          onClick={() => {
            pace.reset();
            setSaid(tx("Done. Swayam forgot how you tap and scroll."));
          }}
        >
          {tx("Reset what it learned")}
        </button>
      </div>
      <p
        className="mt-3 min-h-[1.25rem] font-body text-[12px] text-ink-mute"
        role="status"
        aria-live="polite"
      >
        {said}
      </p>
    </section>
  );
}
