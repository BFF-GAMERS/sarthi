import { useEffect } from "react";
import { useEffectiveAppearance } from "./useEffectiveAppearance";

/**
 * Keeps `<html data-appearance-lite>` in step with the device. `data-appearance` itself is written by the
 * preferences provider (and before first paint by the bootstrap script); this adds the flat-fallback flag
 * that the stylesheet keys on. Renders nothing.
 */
export default function AppearanceSync() {
  const { chosen, effective, reason } = useEffectiveAppearance();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset["appearance"] = chosen;
    if (effective === "classic-lite") root.dataset["appearanceLite"] = reason ?? "1";
    else delete root.dataset["appearanceLite"];
  }, [chosen, effective, reason]);
  return null;
}
