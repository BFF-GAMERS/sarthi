import { useRef } from "react";
import { Check } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";
import { useEffectiveAppearance } from "../../appearance/useEffectiveAppearance";
import { APPEARANCES, LITE_REASON_TEXT, type AppearanceId } from "../../appearance/registry";
import { useTx } from "../../lib/i18n";

/**
 * Classic | Liquid Glass | Metallic, as a radio group with a live preview swatch per style.
 *
 * The swatches draw themselves with the same tokens the page uses (evo-appearance.css), in the current
 * Light or Dark. The choice is the person's and stays on the device. When the device cannot afford
 * the effects, or the person asked for less transparency or more contrast, the page shows the flat
 * version and the status line below says so and why; nothing is lost and switching styles still works.
 */
export default function AppearanceControl() {
  const tx = useTx();
  const { prefs, set } = usePreferences();
  const { chosen, effective, reason } = useEffectiveAppearance();
  const group = useRef<HTMLDivElement>(null);

  const choose = (id: AppearanceId) => set("appearance", id);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const i = APPEARANCES.findIndex((a) => a.id === prefs.appearance);
    const next = APPEARANCES[(i + step + APPEARANCES.length) % APPEARANCES.length]!;
    choose(next.id);
    group.current?.querySelector<HTMLElement>(`[data-appearance-choice="${next.id}"]`)?.focus();
  };

  const label = (id: AppearanceId) => tx(APPEARANCES.find((a) => a.id === id)!.label);
  const status =
    effective === "classic-lite" && reason
      ? `${label(chosen)} ${tx("is chosen, but you are seeing the flat Classic look because")} ${tx(
          LITE_REASON_TEXT[reason],
        )}. ${tx("Nothing is lost, and the choice is kept for when it can run.")}`
      : chosen === "classic"
        ? tx("Classic is showing. It is the standard Swayam look, light on your device.")
        : `${label(chosen)} ${tx("is showing.")}`;

  return (
    <div className="w-full sm:w-[24rem]">
      <div
        ref={group}
        role="radiogroup"
        aria-label={tx("Appearance")}
        onKeyDown={onKeyDown}
        className="ap-group"
      >
        {APPEARANCES.map((a) => {
          const on = prefs.appearance === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-describedby="ap-status"
              tabIndex={on ? 0 : -1}
              data-appearance-choice={a.id}
              className="ap-opt"
              onClick={() => choose(a.id)}
            >
              <span className="ap-swatch" data-ap={a.id} aria-hidden>
                <span className="ap-swatch-bar" />
                <span className="ap-swatch-card">
                  <i />
                  <i />
                </span>
              </span>
              <span className="ap-opt-name">
                {tx(a.label)}
                {on && <Check size={14} className="shrink-0 text-saffron-500" aria-hidden />}
              </span>
            </button>
          );
        })}
      </div>
      <p id="ap-status" className="ap-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
