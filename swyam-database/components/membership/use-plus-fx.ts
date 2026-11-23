/**
 * Whether the membership visuals should hold still, and whether the screen is wide.
 *
 * Static means: no pointer tilt, no sheen, no strike draw, no price roll. It is on for reduced motion
 * (the OS setting or the in-app switch) and whenever Frame-Budget Mode has left the full effects tier,
 * so a slow phone gets the plain card instead of a stutter. Server and first client render agree on
 * `false`, `false`, so there is never a hydration mismatch.
 */
import { useSyncExternalStore } from "react";
import { useReducedMotionPref } from "@/components/motion";

const subscribeFx = (onChange: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("swayam:fx", onChange);
  return () => window.removeEventListener("swayam:fx", onChange);
};
const readFx = (): boolean => {
  if (typeof document === "undefined") return false;
  const t = document.documentElement.getAttribute("data-fx");
  return t === "lite" || t === "static";
};

/** True when the effects tier is lite or static. */
export const useLiteFx = (): boolean => useSyncExternalStore(subscribeFx, readFx, () => false);

export const useStaticFx = (): boolean => {
  const reduced = useReducedMotionPref();
  const lite = useLiteFx();
  return reduced || lite;
};

const WIDE = "(min-width: 768px)";
const subscribeWide = (onChange: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(WIDE);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};
const readWide = (): boolean =>
  typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE).matches : false;

/** True on a laptop-sized screen, where the sheet becomes a centred two-pane dialog. */
export const useIsWide = (): boolean => useSyncExternalStore(subscribeWide, readWide, () => false);
