/**
 * Interface language.
 *
 * The language picker used to change three things: which voice Sarthi spoke
 * in, which labels its *answers* carried, and the `lang`/`dir` attributes on
 * the document. Everything a person actually reads on the page — the
 * navigation, the buttons, the empty states — stayed in English, so choosing
 * मराठी looked like it had done nothing.
 *
 * This is the missing half. Keys resolve per string, not per language, so a
 * dictionary that covers twelve of twenty terms shows twelve translated and
 * eight in English rather than falling back wholesale. That is the honest
 * behavior: a partly-translated interface is useful, a wrongly-translated one
 * is not.
 *
 * Nothing here is machine-translated: these tables are hand-checked. Anything they do not cover
 * is picked up on the page by the live translator (src/lib/translate/engine.ts). `coverage()`
 * exists — the marker is computed from the loaded dictionary rather than a boolean
 * somebody has to remember to update.
 *
 * Loading. Only the active language ships. English is the base and lives in
 * this file; every other language is its own chunk (`./i18n/locales/<code>`)
 * holding both its chrome dictionary and its whole-site table, fetched when
 * that language is chosen. Until the chunk arrives a string simply renders in
 * English, which is the same degradation a missing entry already had, and the
 * `useT`/`useTx` hooks re-render once the table lands.
 *
 * This file has no React in it so the loader can be tested on its own.
 */

/** Every translatable string in the site chrome. */
export interface Strings {
  courses: string;
  jobs: string;
  community: string;
  explore: string;
  dashboard: string;
  profile: string;
  messages: string;
  notifications: string;
  settings: string;
  cart: string;
  rewards: string;
  passport: string;
  search: string;
  menu: string;
  logIn: string;
  joinFree: string;
  logOut: string;
  free: string;
  enroll: string;
  enrolled: string;
  addToCart: string;
  back: string;
  next: string;
  loading: string;
  language: string;
  heroTitle1: string;
  heroTitle2: string;
  heroLede: string;
  getStarted: string;
  browseCourses: string;
  learners: string;
  alreadySkilling: string;
  trainingPartners: string;
  placementRate: string;
  /** Footer column headings. */
  discover: string;
  forYou: string;
  mission: string;
}

/**
 * English is the base, and the only complete set by definition — every other
 * dictionary is a partial overlay on it.
 */
const EN: Strings = {
  courses: "Courses",
  jobs: "Jobs & Internships",
  community: "Community",
  explore: "Explore",
  dashboard: "Dashboard",
  profile: "My Profile",
  messages: "Messages",
  notifications: "Notifications",
  settings: "Settings",
  cart: "Cart",
  rewards: "Rewards",
  passport: "Skill Passport",
  search: "Search",
  menu: "Menu",
  logIn: "Log in",
  joinFree: "Join free",
  logOut: "Log out",
  free: "Free",
  enroll: "Enroll",
  enrolled: "Enrolled",
  addToCart: "Add to cart",
  back: "Back",
  next: "Next",
  loading: "Loading…",
  language: "Language",
  heroTitle1: "Learn a skill.",
  heroTitle2: "Get hired.",
  heroLede:
    "One platform for courses, internships and jobs \u2014 from your district to your trade. Train with verified institutes, earn a certificate employers actually read, and apply to real openings in a single place.",
  getStarted: "Get started free",
  browseCourses: "Browse courses",
  learners: "1.4 crore learners",
  alreadySkilling: "already skilling",
  trainingPartners: "Training partners",
  placementRate: "Placement rate",
  discover: "Discover",
  forYou: "For you",
  mission: "The mission",
};

/** One language, as the chunk exports it. */
export interface LocaleBundle {
  /** The chrome dictionary — a partial overlay on `EN`. */
  dict: Partial<Strings>;
  /** The whole-site table, keyed by English source. Empty where there is none. */
  text: Record<string, string>;
}

/**
 * Every language that has a chunk. The keys are the list of "translated"
 * languages, so a new language is added here and nowhere else.
 *
 * SkillSwap is deliberately absent from every dictionary: it is the product's
 * name, and a translated product name is a different product.
 */
const LOADERS: Record<string, () => Promise<LocaleBundle>> = {
  hi: () => import("./i18n/locales/hi"),
  mr: () => import("./i18n/locales/mr"),
  bn: () => import("./i18n/locales/bn"),
  pa: () => import("./i18n/locales/pa"),
  ta: () => import("./i18n/locales/ta"),
  te: () => import("./i18n/locales/te"),
  gu: () => import("./i18n/locales/gu"),
  kn: () => import("./i18n/locales/kn"),
  ml: () => import("./i18n/locales/ml"),
  or: () => import("./i18n/locales/or"),
  as: () => import("./i18n/locales/as"),
  ur: () => import("./i18n/locales/ur"),
  ne: () => import("./i18n/locales/ne"),
};

/** Every language with at least one translated string. */
export const TRANSLATED_LOCALES = new Set(["en", ...Object.keys(LOADERS)]);

const bundles: Record<string, LocaleBundle> = {};
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

/** Bumps whenever a language arrives. `useSyncExternalStore` reads this. */
export const subscribeLocales = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const localeVersion = () => version;

/** True once this language's strings are in memory (English always is). */
export function isLocaleLoaded(code: string): boolean {
  return code === "en" || code in bundles;
}

/**
 * Fetch a language's chunk, once. Safe to call from anywhere, any number of
 * times; it never throws. If the network fails the promise resolves anyway and
 * the next call tries again, so the interface stays in English rather than
 * breaking.
 */
export function loadLocale(code: string): Promise<void> {
  const load = LOADERS[code];
  if (!load || code in bundles) return Promise.resolve();
  const existing = inflight.get(code);
  if (existing) return existing;
  const p = load()
    .then((m) => {
      bundles[code] = { dict: m.dict, text: m.text };
      version += 1;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* offline or a stale deploy: stay in English, retry on the next call */
    })
    .finally(() => {
      inflight.delete(code);
    });
  inflight.set(code, p);
  return p;
}

const KEY_COUNT = Object.keys(EN).length;

/**
 * How much of the chrome exists in this language, 0 to 1. A language whose
 * chunk has not been fetched yet reads as 0 — call `loadLocale` first.
 */
export function coverage(locale: string): number {
  if (locale === "en") return 1;
  const d = bundles[locale]?.dict;
  if (!d) return 0;
  return Object.values(d).filter(Boolean).length / KEY_COUNT;
}

/** Resolve one string, falling back to English for that key alone. */
export function translate<K extends keyof Strings>(locale: string, key: K): string {
  return bundles[locale]?.dict[key] ?? EN[key];
}

/**
 * The whole-site strings, keyed by their own English text.
 *
 * The hand-written dictionaries name each string, which is right for the
 * handful that appear everywhere. It does not scale to a whole site: the pages
 * hold several hundred more, and inventing a key for each one is work that
 * buys nothing. These are keyed by the English source instead, so extraction
 * and translation line up by construction and a missing entry falls back to
 * exactly the words that were there before.
 */
export function translateText(locale: string, english: string): string {
  return bundles[locale]?.text[english] ?? english;
}
