/**
 * Mounted once in __root.tsx between PreferencesProvider and ToastProvider.
 *
 * Wraps the app in framer-motion's MotionConfig so every animation honours reduced motion: the OS setting
 * ("user") or Swayam's own switch ("always"). Evolution itself never depends on motion; with reduced motion
 * the structure still changes, instantly. The theme is independent of the evolution.
 */
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { usePreferences } from "../../context/PreferencesContext";

export default function EvolutionProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  return (
    <MotionConfig reducedMotion={prefs.reducedMotion ? "always" : "user"}>{children}</MotionConfig>
  );
}
