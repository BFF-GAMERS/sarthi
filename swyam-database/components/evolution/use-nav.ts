/**
 * Small hooks shared by the nav surfaces. Kept out of NavItems.tsx so that file
 * only exports components (fast refresh).
 */
import { useLocation } from "@tanstack/react-router";
import { useReducedMotion } from "framer-motion";
import { NAV_REGISTRY } from "@/evolution/config/navigation";
import type { NavItemId } from "@/evolution/types";
import { usePreferences } from "@/context/PreferencesContext";
import { useT, useTx, type Strings } from "@/lib/i18n";
import { activeNavItem } from "./nav-model";

/** Which of `items` the current location belongs to (hash and query aware). */
export function useActiveNavItem(items: readonly NavItemId[]): NavItemId | null {
  const loc = useLocation();
  return activeNavItem(items, { pathname: loc.pathname, searchStr: loc.searchStr, hash: loc.hash });
}

/**
 * The label for a destination. English reads the registry label so every
 * surface agrees; another language uses the registry's i18n key when it has
 * one, then the generated site dictionary, then the English label.
 */
export function useNavLabel(): (id: NavItemId) => string {
  const { prefs } = usePreferences();
  const t = useT();
  const tx = useTx();
  return (id) => {
    const d = NAV_REGISTRY[id];
    if (prefs.locale !== "en" && d.labelKey) return t(d.labelKey as keyof Strings);
    return tx(d.label);
  };
}

/** True when changes should land instantly. The structure still evolves; only the movement is skipped. */
export function useInstantMotion(): boolean {
  const { prefs } = usePreferences();
  const system = useReducedMotion();
  return prefs.reducedMotion || Boolean(system);
}
