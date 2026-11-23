import { useEffect } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { loadLocale } from "../lib/i18n-core";

/*
 * Start fetching the saved language before React has hydrated.
 *
 * The bootstrap script stamps the saved locale on <html lang> ahead of any
 * bundle, so by the time this module evaluates the answer is already in the
 * document. The request then runs alongside hydration and the translated
 * strings are usually ready for the first interactive frame. English (and any
 * language with no chunk) is a no-op.
 */
if (typeof document !== "undefined") void loadLocale(document.documentElement.lang);

/**
 * Keeps the active language's strings loaded as the preference changes.
 * Draws nothing; `useT` / `useTx` re-render when the chunk arrives.
 */
export default function LocaleLoader() {
  const { prefs } = usePreferences();
  useEffect(() => {
    void loadLocale(prefs.locale);
  }, [prefs.locale]);
  return null;
}
