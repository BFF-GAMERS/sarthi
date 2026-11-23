import { useEffect } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { startTranslator } from "../lib/translate/engine";

/** Runs the live translator whenever a language other than English is chosen. Draws nothing. */
export default function LiveTranslate() {
  const { prefs } = usePreferences();
  const lang = prefs.locale;
  useEffect(() => {
    if (!lang || lang === "en") return;
    return startTranslator(lang);
  }, [lang]);
  return null;
}
