import { useMemo, useSyncExternalStore } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { useFxLightened } from "../evolution/react/hooks";
import {
  resolveAppearance,
  type AppearanceId,
  type AppearanceSignals,
  type EffectiveAppearance,
  type LiteReason,
} from "./registry";

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      try {
        const m = window.matchMedia(query);
        m.addEventListener("change", cb);
        return () => m.removeEventListener("change", cb);
      } catch {
        return () => {};
      }
    },
    () => {
      try {
        return window.matchMedia(query).matches;
      } catch {
        return false;
      }
    },
    () => false,
  );
}

const noopSubscribe = () => () => {};
/** "memory|cores", a primitive so the snapshot is stable. The server snapshot says nothing. */
const hardwareKey = (): string => {
  try {
    const n = navigator as Navigator & { deviceMemory?: number };
    return `${n.deviceMemory ?? ""}|${n.hardwareConcurrency ?? ""}`;
  } catch {
    return "|";
  }
};

/** What the device and the person have said about transparency, contrast and power. */
export function useAppearanceSignals(highContrastSetting: boolean): AppearanceSignals {
  const reducedTransparency = useMedia("(prefers-reduced-transparency: reduce)");
  const moreContrast = useMedia("(prefers-contrast: more)");
  const fxLightened = useFxLightened();
  const hw = useSyncExternalStore(noopSubscribe, hardwareKey, () => "|");
  return useMemo(() => {
    const [m, c] = hw.split("|");
    return {
      deviceMemory: m ? Number(m) : undefined,
      hardwareConcurrency: c ? Number(c) : undefined,
      reducedTransparency,
      moreContrast,
      highContrastSetting,
      fxLightened,
    };
  }, [hw, reducedTransparency, moreContrast, highContrastSetting, fxLightened]);
}

export interface EffectiveAppearanceState {
  chosen: AppearanceId;
  /** `classic-lite` when a non-Classic choice is being shown flat. */
  effective: EffectiveAppearance;
  reason: LiteReason | null;
}

/** The style that is actually painted, with the reason when it is the flat fallback. */
export function useEffectiveAppearance(): EffectiveAppearanceState {
  const { prefs } = usePreferences();
  const signals = useAppearanceSignals(prefs.highContrast);
  return useMemo(() => {
    const { effective, reason } = resolveAppearance(prefs.appearance, signals);
    return { chosen: prefs.appearance, effective, reason };
  }, [prefs.appearance, signals]);
}
