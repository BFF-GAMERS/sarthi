import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { getSupabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { isRtl, languageFor } from "../lib/languages";
import { DEFAULT_APPEARANCE, toAppearanceId, type AppearanceId } from "../appearance/registry";

/**
 * Every preference a member can set, in one place.
 *
 * These map one-to-one onto `user_preferences`, so a choice made on any
 * device follows the account. Signed-out visitors get the same controls with
 * the values kept in localStorage — accessibility settings are not something
 * to withhold until someone registers.
 *
 * Two groups:
 *
 *   Look — `interfaceMode` picks the design register. `genz` is the dark
 *   charcoal ground with the saffron action colour, which is स्वYAM's own
 *   identity; `millennial` is the warm paper alternative for anybody who
 *   reads better on light. They are shown to people as Dark and Light; the
 *   internal tokens keep their names. Only design tokens change, so the two
 *   can never structurally drift apart.
 *
 *   `themeChoice` is what the person actually picked: Light, Dark, or System.
 *   System (the default) follows the operating system and keeps following it
 *   live, so `interfaceMode` is always the *resolved* register and
 *   `themeChoice` is the preference behind it. Like `lowData`, the choice
 *   stays on the device: an account used on a dark laptop and a light phone
 *   should not fight over one answer.
 *
 *   Access — high contrast, larger text, a dyslexia-friendly face, stilled
 *   motion, captions, screen-reader hints and spoken navigation. Someone who
 *   needs three of these at once can have all three; they are independent
 *   switches, not a single "accessibility mode" that guesses.
 */

export type InterfaceMode = "millennial" | "genz";
export type ThemeChoice = "system" | "light" | "dark";

/** The register a choice resolves to; `systemDark` is the operating system's current answer. */
export function resolveInterfaceMode(choice: ThemeChoice, systemDark: boolean): InterfaceMode {
  return choice === "dark" || (choice === "system" && systemDark) ? "genz" : "millennial";
}

/** People see Gen Z and Millennial, the registers' own names. */
export const THEME_LABEL: Record<InterfaceMode, string> = {
  genz: "Gen Z",
  millennial: "Millennial",
};

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export interface Preferences {
  /** The resolved register. Read this to style; write `themeChoice` to change it. */
  interfaceMode: InterfaceMode;
  /** Light, Dark, or System (follow the device). */
  themeChoice: ThemeChoice;
  /** Language code from `SUPPORTED_LANGUAGES`. Drives Sarthi and `dir`. */
  locale: string;
  highContrast: boolean;
  /** 1 = normal. Scales the root font size, so the whole layout grows. */
  textScale: number;
  dyslexiaFont: boolean;
  reducedMotion: boolean;
  captionsDefault: boolean;
  screenReaderHints: boolean;
  /** Speak page headings and focus targets aloud as you move. */
  voiceNavigation: boolean;
  /**
   * Spend as little of their data as the page can manage.
   *
   * Not an accessibility switch and not a preference about looks: it is
   * about what a visit costs somebody. Photographs do not load, the ambient
   * field stops animating, and no page is fetched before it is asked for.
   * Every word, price, date and link stays exactly where it was — this
   * removes weight, never information.
   *
   * Undefined until it has been decided, so that the browser's own Save-Data
   * signal and a 2G connection can answer for a member who has never opened
   * Settings, without overriding one who has.
   */
  lowData: boolean | undefined;
  keyboardShortcuts: boolean;
  /**
   * Which SkillSwap dashboard to open.
   *
   * Null means never chosen, which is what makes the first visit ask instead
   * of guessing — and it lives on the account rather than the device, because
   * it says what you came to do, not which browser you used.
   */
  swapMode: "learn" | "train" | null;
  /**
   * How surfaces are made: Classic (the current look), Liquid Glass or Metallic. Like `lowData` and the
   * theme it stays on the device: it is a matter of taste and of what the device can afford, not of the
   * account. Glass and Metallic fall back to a flat look by themselves where they would cost too much
   * (see `useEffectiveAppearance`).
   */
  appearance: AppearanceId;
}

export const DEFAULT_PREFERENCES: Preferences = {
  // Until the page knows the device it renders the product's own dark skin
  // (what a server render shows); the pre-paint script and the provider then
  // resolve System against the operating system before anything is painted.
  interfaceMode: "genz",
  themeChoice: "system",
  locale: "en",
  highContrast: false,
  textScale: 1,
  dyslexiaFont: false,
  reducedMotion: false,
  captionsDefault: false,
  screenReaderHints: false,
  voiceNavigation: false,
  keyboardShortcuts: true,
  lowData: undefined,
  swapMode: null,
  appearance: DEFAULT_APPEARANCE,
};

const STORAGE_KEY = "swayam-preferences";
/** Kept for continuity with the earlier mode-only release. */
const LEGACY_MODE_KEY = "swayam-interface-mode";

interface PreferencesShape {
  prefs: Preferences;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
  /** Convenience for the navbar switch: flips the resolved register and keeps it explicit. */
  toggleMode: () => void;
}

const PreferencesContext = createContext<PreferencesShape | null>(null);

const isMode = (v: unknown): v is InterfaceMode => v === "genz" || v === "millennial";
const isChoice = (v: unknown): v is ThemeChoice => v === "system" || v === "light" || v === "dark";

/**
 * What a stored record means. Anything saved before `themeChoice` existed carries an explicit
 * `interfaceMode`, so that stays an explicit Light or Dark; nothing stored at all means System.
 */
function choiceFrom(stored: Partial<Preferences>): ThemeChoice {
  if (isChoice(stored.themeChoice)) return stored.themeChoice;
  if (isMode(stored.interfaceMode)) return stored.interfaceMode === "genz" ? "dark" : "light";
  return "system";
}

/**
 * Push the preferences onto the document.
 *
 * Everything is expressed as a data attribute or a CSS variable so the styling
 * lives in the stylesheet rather than in JavaScript, and so a preference can
 * never be "on" in state but absent from the page.
 */
function apply(p: Preferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset["mode"] = p.interfaceMode;
  root.dataset["contrast"] = p.highContrast ? "high" : "normal";
  root.dataset["dyslexia"] = p.dyslexiaFont ? "on" : "off";
  root.dataset["motion"] = p.reducedMotion ? "reduced" : "full";
  root.dataset["data"] = p.lowData ? "low" : "full";
  root.dataset["appearance"] = p.appearance;
  root.style.setProperty("--text-scale", String(p.textScale));
  root.lang = p.locale;
  root.dir = isRtl(p.locale) ? "rtl" : "ltr";
}

function readStored(): Partial<Preferences> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Partial<Preferences>;
    const legacy = localStorage.getItem(LEGACY_MODE_KEY);
    return isMode(legacy) ? { interfaceMode: legacy } : {};
  } catch {
    return {};
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { profileId } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Local first, so the controls are correct before any network round trip.
  useEffect(() => {
    const stored = readStored();
    const merged = { ...DEFAULT_PREFERENCES, ...stored };
    merged.themeChoice = choiceFrom(stored);
    merged.appearance = toAppearanceId(stored.appearance);
    merged.interfaceMode = resolveInterfaceMode(merged.themeChoice, systemPrefersDark());
    // Someone who asked their operating system for less motion gets it here
    // too, unless they have explicitly said otherwise on this device.
    if (stored.reducedMotion === undefined && typeof window !== "undefined") {
      merged.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    setPrefs(merged);
    apply(merged);
  }, []);

  // System means "whatever the device says", now and every time it changes (sunset, a quick-settings toggle).
  useEffect(() => {
    if (prefs.themeChoice !== "system" || typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () =>
      setPrefs((p) => {
        if (p.themeChoice !== "system") return p;
        const mode = resolveInterfaceMode("system", query.matches);
        if (mode === p.interfaceMode) return p;
        const next = { ...p, interfaceMode: mode };
        apply(next);
        return next;
      });
    follow();
    query.addEventListener("change", follow);
    // Some engines (and emulated media) skip the change event; coming back to the tab re-reads it.
    window.addEventListener("focus", follow);
    document.addEventListener("visibilitychange", follow);
    return () => {
      query.removeEventListener("change", follow);
      window.removeEventListener("focus", follow);
      document.removeEventListener("visibilitychange", follow);
    };
  }, [prefs.themeChoice]);

  // The stored account wins once we know who is signed in.
  /* Read inside the loader below without making it depend on every change. */
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !profileId) return;
    let live = true;

    void supabase
      .from("user_preferences")
      .select(
        "interface_mode, locale, high_contrast, text_scale, dyslexia_font, reduced_motion, captions_default, screen_reader_hints, voice_navigation, keyboard_shortcuts, swap_mode",
      )
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data }) => {
        if (!live || !data) return;
        const next: Preferences = {
          /*
           * Deliberately not read from the account.
           *
           * Every other preference here says something about the person, so
           * it should follow them between devices. This one says something
           * about the connection they are on right now — the same member is
           * on wifi at an institute and on 2G at home, and carrying one
           * answer to both places would be wrong in one of them. It stays on
           * the device, and the value already in memory is kept.
           */
          lowData: prefsRef.current.lowData,
          // A device choice as well, and there is no account column for it.
          appearance: prefsRef.current.appearance,
          /*
           * Light / Dark / System is a device choice too (see the header). The account column keeps
           * recording the register that was showing, but a new device starts from System rather than
           * from another device's answer.
           */
          themeChoice: prefsRef.current.themeChoice,
          interfaceMode: resolveInterfaceMode(prefsRef.current.themeChoice, systemPrefersDark()),
          locale: data.locale || "en",
          highContrast: data.high_contrast,
          textScale: Number(data.text_scale ?? 1),
          dyslexiaFont: data.dyslexia_font,
          reducedMotion: data.reduced_motion,
          captionsDefault: data.captions_default,
          screenReaderHints: data.screen_reader_hints,
          voiceNavigation: data.voice_navigation,
          keyboardShortcuts: data.keyboard_shortcuts,
          // The column is a checked text, so narrow rather than trust it:
          // a value written by an older client should not become a mode the
          // interface cannot render.
          swapMode:
            data.swap_mode === "learn" || data.swap_mode === "train" ? data.swap_mode : null,
        };
        setPrefs(next);
        apply(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* private mode */
        }
      });

    return () => {
      live = false;
    };
  }, [profileId]);

  const set = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        // One register, two ways in: asking for a choice resolves it; naming a register makes it explicit.
        if (key === "themeChoice") {
          next.interfaceMode = resolveInterfaceMode(value as ThemeChoice, systemPrefersDark());
        } else if (key === "interfaceMode") {
          next.themeChoice = value === "genz" ? "dark" : "light";
        }
        apply(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* private mode */
        }

        const supabase = getSupabase();
        if (supabase && profileId) {
          void supabase
            .from("user_preferences")
            .update({
              interface_mode: next.interfaceMode,
              locale: next.locale,
              high_contrast: next.highContrast,
              text_scale: next.textScale,
              dyslexia_font: next.dyslexiaFont,
              reduced_motion: next.reducedMotion,
              captions_default: next.captionsDefault,
              screen_reader_hints: next.screenReaderHints,
              voice_navigation: next.voiceNavigation,
              keyboard_shortcuts: next.keyboardShortcuts,
              swap_mode: next.swapMode,
            })
            .eq("profile_id", profileId);
        }
        return next;
      });
    },
    [profileId],
  );

  const reset = useCallback(() => {
    setPrefs(DEFAULT_PREFERENCES);
    apply(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    set("themeChoice", prefs.interfaceMode === "genz" ? "light" : "dark");
  }, [prefs.interfaceMode, set]);

  const value = useMemo(() => ({ prefs, set, reset, toggleMode }), [prefs, set, reset, toggleMode]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}

/** The interface mode on its own, for the navbar switch and the Light / Dark / System control. */
export function useTheme() {
  const { prefs, set, toggleMode } = usePreferences();
  return {
    /** The resolved register ("genz" is shown as Dark, "millennial" as Light). */
    mode: prefs.interfaceMode,
    choice: prefs.themeChoice,
    setChoice: (c: ThemeChoice) => set("themeChoice", c),
    toggle: toggleMode,
  };
}

/** The chosen language, resolved to its full record. */
export function useLanguage() {
  const { prefs, set } = usePreferences();
  return {
    code: prefs.locale,
    language: languageFor(prefs.locale),
    setLanguage: (code: string) => set("locale", code),
  };
}

/**
 * Runs before first paint so the saved look is already on the page.
 *
 * Without this a member who chose Dark, larger text or high contrast sees a
 * flash of the default on every single load — which for someone using high
 * contrast because they need it is not a cosmetic problem.
 *
 * With nothing stored (a first visit) the register follows the operating system's
 * `prefers-color-scheme`, so a device set to light never opens on a dark page.
 */
export const PREFERENCES_BOOTSTRAP_SCRIPT = `(function(){try{
var r=document.documentElement,s=localStorage.getItem('${STORAGE_KEY}'),p=s?JSON.parse(s):null;
if(!p){var m=localStorage.getItem('${LEGACY_MODE_KEY}');p=m?{interfaceMode:m}:{};}
var tc=p.themeChoice;
if(tc!=='light'&&tc!=='dark'&&tc!=='system'){tc=p.interfaceMode==='genz'?'dark':p.interfaceMode==='millennial'?'light':'system';}
var dk=tc==='dark'||(tc==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
r.dataset.mode=dk?'genz':'millennial';
r.dataset.contrast=p.highContrast?'high':'normal';
r.dataset.dyslexia=p.dyslexiaFont?'on':'off';
var ap=p.appearance;ap=(ap==='glass'||ap==='metal')?ap:'classic';r.dataset.appearance=ap;
if(ap!=='classic'){var nv=navigator,dm=nv.deviceMemory,hc=nv.hardwareConcurrency,mq=function(q){try{return window.matchMedia(q).matches}catch(e){return false}};
if(p.highContrast||(dm!==undefined&&dm<=2)||(hc!==undefined&&hc<=2)||mq('(prefers-reduced-transparency: reduce)')||mq('(prefers-contrast: more)')){r.dataset.appearanceLite='1';}}
var rm=p.reducedMotion;
if(rm===undefined){rm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
r.dataset.motion=rm?'reduced':'full';
var ld=p.lowData;
if(ld===undefined){var c=navigator.connection||{};ld=c.saveData===true||c.effectiveType==='2g'||c.effectiveType==='slow-2g';}
r.dataset.data=ld?'low':'full';
r.style.setProperty('--text-scale',String(p.textScale||1));
if(p.locale){r.lang=p.locale;r.dir=(['ur','ks','sd'].indexOf(p.locale)>=0)?'rtl':'ltr';}
}catch(e){document.documentElement.dataset.mode='genz';}})();
(function(){try{
var r=document.documentElement,b=JSON.parse(localStorage.getItem('swayam.evo.boot')||'null'),ok=/^[A-Za-z_]{1,32}$/;
if(b&&b.v===1&&ok.test(b.state)&&ok.test(b.nav)&&ok.test(b.layout)&&ok.test(b.density)){
r.dataset.evoState=b.state;r.dataset.evoNav=b.nav;r.dataset.evoLayout=b.layout;r.dataset.evoDensity=b.density;r.dataset.evoTier=String(b.tier|0);
}}catch(e){}})();`;
