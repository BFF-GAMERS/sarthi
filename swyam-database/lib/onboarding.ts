/**
 * The first run.
 *
 * `profiles` has carried `onboarding_step` and `onboarded_at` since the schema
 * was written and nothing ever set them, so every new member landed on an
 * empty dashboard: no skills, so no matches; no language; and the
 * accessibility settings someone might actually depend on left switched off
 * until they went looking for the Settings page.
 *
 * Everything asked here is either used immediately or not asked. The whole
 * thing writes through one `SECURITY DEFINER` call so a member who closes the
 * tab halfway through does not end up half-set-up.
 */

import { getSupabase, requireSupabase } from "./supabase";
import type { Json } from "../types/database";

export interface OnboardingAnswers {
  displayName?: string;
  /** ISO date. Sets `is_minor`, and decides which schemes apply. */
  dateOfBirth?: string;
  region?: string;
  headline?: string;
  interfaceMode?: "genz" | "millennial";
  locale?: string;
  languages?: string[];
  highContrast?: boolean;
  dyslexiaFont?: boolean;
  reducedMotion?: boolean;
  voiceNavigation?: boolean;
  screenReaderHints?: boolean;
  keyboardShortcuts?: boolean;
  captionsDefault?: boolean;
  textScale?: number;
  /** Skill ids. */
  teach?: string[];
  learn?: string[];
  goal?: string;
}

/**
 * Whether this member has been through it.
 *
 * Returns false when the backend is unreachable, so a network blip shows the
 * dashboard rather than trapping someone in a form they already filled in.
 */
export async function needsOnboarding(profileId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return false;
  return data.onboarded_at === null;
}

/** Write the answers, and mark the profile as set up. */
export async function completeOnboarding(a: OnboardingAnswers): Promise<void> {
  const supabase = requireSupabase();

  // Only send what was answered: the function treats an absent key as "leave
  // whatever is stored", which is what skipping a step should mean.
  const payload: Record<string, Json> = {};
  const put = (key: string, value: Json | undefined) => {
    if (value !== undefined && value !== null && value !== "") payload[key] = value;
  };

  put("display_name", a.displayName);
  put("date_of_birth", a.dateOfBirth);
  put("region", a.region);
  put("headline", a.headline);
  put("interface_mode", a.interfaceMode);
  put("locale", a.locale);
  put("goal", a.goal);
  if (a.languages?.length) payload["languages"] = a.languages;
  if (a.teach?.length) payload["teach"] = a.teach;
  if (a.learn?.length) payload["learn"] = a.learn;
  if (a.textScale !== undefined) payload["text_scale"] = a.textScale;

  for (const [key, value] of [
    ["high_contrast", a.highContrast],
    ["dyslexia_font", a.dyslexiaFont],
    ["reduced_motion", a.reducedMotion],
    ["voice_navigation", a.voiceNavigation],
    ["screen_reader_hints", a.screenReaderHints],
    ["keyboard_shortcuts", a.keyboardShortcuts],
    ["captions_default", a.captionsDefault],
  ] as const) {
    if (typeof value === "boolean") payload[key] = value;
  }

  const { data, error } = await supabase.rpc("complete_onboarding", { p: payload });
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as Record<string, unknown>;
  if (r["ok"] !== true) throw new Error("Your answers could not be saved.");
}

/**
 * Mark it done without answering.
 *
 * Someone who wants to look around first should be able to. They keep the
 * defaults and can change any of it in Settings and on their profile.
 */
export async function skipOnboarding(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("complete_onboarding", { p: {} });
  if (error) throw new Error(error.message);
}

/**
 * Remember which step somebody stopped on.
 *
 * `profiles.onboarding_step` has existed since the schema was written and
 * nothing ever wrote to it. It is what makes "save and exit" real on a
 * second device: the answers themselves stay on the device they were typed
 * on, but the place in the flow follows the account.
 */
export async function setOnboardingStep(profileId: string, step: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_step: String(Math.max(0, Math.round(step))) })
    .eq("id", profileId);
  // A failure here costs the member nothing they can see — the local draft
  // is what reopens the wizard — so it is not worth an error screen.
  if (error) console.warn("onboarding_step:", error.message);
}

/** The step to resume at, or 0. */
export async function getOnboardingStep(profileId: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return 0;
  const n = Number(data.onboarding_step);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
