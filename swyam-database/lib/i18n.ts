/**
 * Interface language — the React half.
 *
 * The strings, the loader and the English base live in `i18n-core.ts`; this
 * file is the hooks that bind them to the member's chosen language. Only the
 * active language is downloaded (see the note on loading in `i18n-core.ts`),
 * and these hooks subscribe to the loader so every consumer re-renders when
 * that language's table arrives.
 */

import { useSyncExternalStore } from "react";
import { usePreferences } from "../context/PreferencesContext";
import {
  localeVersion,
  subscribeLocales,
  translate,
  translateText,
  type Strings,
} from "./i18n-core";

export * from "./i18n-core";

/** The chosen language, kept current as its strings stream in. */
function useActiveLocale(): string {
  const { prefs } = usePreferences();
  // The value is unused: subscribing is what schedules the re-render.
  useSyncExternalStore(subscribeLocales, localeVersion, localeVersion);
  return prefs.locale;
}

/**
 * The hook every component uses.
 *
 * `t("courses")` reads the member's chosen language from preferences, so a
 * component never has to know which one is active.
 */
export function useT(): <K extends keyof Strings>(key: K) => string {
  const locale = useActiveLocale();
  return (key) => translate(locale, key);
}

/** `tx("Continue learning")` — the whole-site counterpart of `t()`. */
export function useTx(): (english: string) => string {
  const locale = useActiveLocale();
  return (english) => translateText(locale, english);
}
