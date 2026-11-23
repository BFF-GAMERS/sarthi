/**
 * Settings -> "Your Swayam" (plan §4.6). Every choice here is honoured before any AI result:
 *
 *   On                    normal
 *   Keep current layout   learning continues and is visible in the Lab; the structure is frozen
 *   Off                   stops tracking, renders UNIVERSAL
 *   Reset my experience   forget what Swayam learned and go back to the standard layout
 *   Delete synced copy    shown only when an account copy exists on the server
 *
 * Also here: Try on another Swayam (a transient preview of someone else's arrangement; nothing is saved), and a
 * plain note when the frame budget lightened Swayam for this device.
 */
import { Sparkles } from "lucide-react";
import { useState } from "react";
import {
  useEvolutionHydrated,
  useEvolutionPrefs,
  useFxLightened,
  useSyncStatus,
} from "../../evolution/react/hooks";
import { resetExperience, setAdaptive, setLocked } from "../../evolution/state/commands";
import { deleteSyncedCopy } from "../../evolution/sync/supabase-sync";
import PaceSettings from "../pace/PaceSettings";
import { PreviewStyles } from "./TimeScrub";
import TryOn from "./TryOn";

type Choice = "on" | "keep" | "off";

const CHOICES: ReadonlyArray<{ id: Choice; label: string; note: string }> = [
  {
    id: "on",
    label: "On",
    note: "Swayam learns from what you do here, on this device, and arranges itself.",
  },
  {
    id: "keep",
    label: "Keep current layout",
    note: "It keeps learning, but the arrangement stays exactly as it is now.",
  },
  { id: "off", label: "Off", note: "No learning, and Swayam stays in its standard layout." },
];

export default function YourSwayamSettings() {
  const prefs = useEvolutionPrefs();
  const hydrated = useEvolutionHydrated();
  const sync = useSyncStatus();
  const lightened = useFxLightened();
  const [said, setSaid] = useState("");
  const choice: Choice =
    prefs.adaptive === "off" ? "off" : prefs.locked || prefs.adaptive === "paused" ? "keep" : "on";

  const pick = (c: Choice) => {
    if (c === "off") setAdaptive("off");
    else {
      setAdaptive("on");
      setLocked(c === "keep");
    }
    setSaid(
      c === "off"
        ? "Adaptation is off."
        : c === "keep"
          ? "Your layout is kept."
          : "Adaptation is on.",
    );
  };

  return (
    <section className="panel p-6" id="your-swayam" aria-labelledby="your-swayam-title">
      <h2
        id="your-swayam-title"
        className="flex items-center gap-2 font-display text-lg tracking-tight text-ink"
      >
        <Sparkles size={18} className="text-saffron-500" aria-hidden /> Your Swayam
      </h2>
      <p className="mt-2 font-body text-[13px] leading-snug text-ink-mute">
        Swayam learns from what you do here, on this device, to arrange itself. Nothing is sold or
        shared. Reset any time.
      </p>

      <fieldset className="mt-4" disabled={!hydrated}>
        <legend className="sr-only">How Swayam adapts</legend>
        <div className="grid gap-2">
          {CHOICES.map((c) => (
            <label
              key={c.id}
              className="evo-choice"
              data-selected={choice === c.id ? "true" : "false"}
            >
              <input
                type="radio"
                name="evo-adaptive"
                value={c.id}
                checked={choice === c.id}
                onChange={() => pick(c.id)}
                className="sr-only"
              />
              <span className="evo-choice-dot" aria-hidden="true" />
              <span>
                <span className="block font-body text-sm font-medium text-ink">{c.label}</span>
                <span className="block font-body text-[12px] leading-snug text-ink-mute">
                  {c.note}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <PreviewStyles />
      {hydrated ? <TryOn /> : null}
      {lightened ? (
        <p className="mt-4 font-body text-[12px] leading-snug text-ink-mute">
          Swayam lightened itself for this device so it stays smooth. Turn on Full effects in
          Settings to override.
        </p>
      ) : null}

      <PaceSettings />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-ghost"
          disabled={!hydrated}
          onClick={() => {
            resetExperience();
            setSaid("Done. Swayam forgot what it learned and went back to the standard layout.");
          }}
        >
          Reset my experience
        </button>
        {sync.synced ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              void deleteSyncedCopy().then((ok) =>
                setSaid(
                  ok
                    ? "Your synced copy was deleted."
                    : "We could not delete the synced copy just now. Try again.",
                ),
              );
            }}
          >
            Delete synced copy
          </button>
        ) : null}
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
