/**
 * Appearance styles: how surfaces (navbar, cards, panels, the membership card) are made.
 *
 * Orthogonal to Light / Dark: any style works in both registers. Classic is the current Swayam look and
 * the default; Liquid Glass and Metallic are opt-in. Chosen by the person, never inferred from who they
 * are. On a device that cannot afford the effects, or for a person who asked for less transparency or
 * more contrast, the page quietly shows the flat version (`classic-lite`) and says why in Settings.
 */

export type AppearanceId = "classic" | "glass" | "metal";
/** What is actually painted: the chosen style, or the flat fallback. */
export type EffectiveAppearance = AppearanceId | "classic-lite";

export const DEFAULT_APPEARANCE: AppearanceId = "classic";

export interface AppearanceDef {
  /** Also the value of `<html data-appearance>`. */
  id: AppearanceId;
  /** English; the UI runs it through tx(). */
  label: string;
  blurb: string;
}

export const APPEARANCES: readonly AppearanceDef[] = [
  { id: "classic", label: "Classic", blurb: "The standard Swayam look." },
  { id: "glass", label: "Liquid Glass", blurb: "Frosted, see-through surfaces." },
  { id: "metal", label: "Metallic", blurb: "Brushed metal surfaces with a soft sheen." },
];

export const isAppearanceId = (v: unknown): v is AppearanceId =>
  v === "classic" || v === "glass" || v === "metal";

/** Anything stored or typed that is not a known style means Classic. */
export const toAppearanceId = (v: unknown): AppearanceId =>
  isAppearanceId(v) ? v : DEFAULT_APPEARANCE;

export type LiteReason =
  | "reduced-transparency"
  | "more-contrast"
  | "high-contrast-setting"
  | "low-memory"
  | "few-cores"
  | "frame-budget";

/** Why the flat look is showing, in plain English (run through tx() where shown). */
export const LITE_REASON_TEXT: Record<LiteReason, string> = {
  "reduced-transparency": "your device asks for less transparency",
  "more-contrast": "your device asks for more contrast",
  "high-contrast-setting": "High contrast is on in Swayam",
  "low-memory": "this device has little memory",
  "few-cores": "this device has a slow processor",
  "frame-budget": "Swayam saw this device struggling to keep up and lightened itself",
};

export interface AppearanceSignals {
  /** navigator.deviceMemory in GB; undefined where the browser does not say. */
  deviceMemory?: number | undefined;
  hardwareConcurrency?: number | undefined;
  reducedTransparency: boolean;
  moreContrast: boolean;
  /** The in-app High contrast switch. */
  highContrastSetting: boolean;
  /** Frame-Budget lightened Swayam (html[data-fx] is lite or static); see useFxLightened. */
  fxLightened: boolean;
}

/**
 * The first reason the effects should not run, or null. Order is by how explicit the person was:
 * what they asked for beats what we measured.
 */
export function liteReasonOf(s: AppearanceSignals): LiteReason | null {
  if (s.reducedTransparency) return "reduced-transparency";
  if (s.moreContrast) return "more-contrast";
  if (s.highContrastSetting) return "high-contrast-setting";
  if (s.deviceMemory !== undefined && s.deviceMemory <= 2) return "low-memory";
  if (s.hardwareConcurrency !== undefined && s.hardwareConcurrency <= 2) return "few-cores";
  if (s.fxLightened) return "frame-budget";
  return null;
}

export interface ResolvedAppearance {
  effective: EffectiveAppearance;
  /** Set only when a non-Classic choice is being shown flat. */
  reason: LiteReason | null;
}

/** Classic never changes with the device; Glass and Metallic fall back to `classic-lite`. */
export function resolveAppearance(
  chosen: AppearanceId,
  signals: AppearanceSignals,
): ResolvedAppearance {
  if (chosen === "classic") return { effective: "classic", reason: null };
  const reason = liteReasonOf(signals);
  return reason ? { effective: "classic-lite", reason } : { effective: chosen, reason: null };
}
