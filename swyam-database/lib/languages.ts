/**
 * Languages the platform speaks.
 *
 * All 22 languages in the Eighth Schedule of the Constitution, plus English —
 * the same 23 rows as the `languages` table, mirrored here so the selector,
 * the voice layer and Sarthi work before (and without) a database round trip.
 *
 * `bcp47` is what the Web Speech API needs: a bare "hi" makes the browser fall
 * back to its own locale, which transcribes Hindi speech as English nonsense.
 * `dir` drives the RTL flip for Urdu, Kashmiri and Sindhi.
 *
 * `translated` marks the languages Sarthi has real label translations for. The
 * rest stay fully selectable — they read and speak in their own script — but
 * Sarthi's section labels remain English rather than being machine translated
 * into something a speaker would find wrong.
 */

export interface Language {
  code: string;
  label: string;
  native: string;
  bcp47: string;
  dir: "ltr" | "rtl";
  /** True when Sarthi's own labels exist in this language. */
  translated: boolean;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", label: "English", native: "English", bcp47: "en-IN", dir: "ltr", translated: true },
  { code: "hi", label: "Hindi", native: "हिन्दी", bcp47: "hi-IN", dir: "ltr", translated: true },
  { code: "bn", label: "Bengali", native: "বাংলা", bcp47: "bn-IN", dir: "ltr", translated: true },
  { code: "mr", label: "Marathi", native: "मराठी", bcp47: "mr-IN", dir: "ltr", translated: true },
  { code: "te", label: "Telugu", native: "తెలుగు", bcp47: "te-IN", dir: "ltr", translated: true },
  { code: "ta", label: "Tamil", native: "தமிழ்", bcp47: "ta-IN", dir: "ltr", translated: true },
  {
    code: "gu",
    label: "Gujarati",
    native: "ગુજરાતી",
    bcp47: "gu-IN",
    dir: "ltr",
    translated: true,
  },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", bcp47: "kn-IN", dir: "ltr", translated: true },
  {
    code: "ml",
    label: "Malayalam",
    native: "മലയാളം",
    bcp47: "ml-IN",
    dir: "ltr",
    translated: true,
  },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", bcp47: "pa-IN", dir: "ltr", translated: true },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ", bcp47: "or-IN", dir: "ltr", translated: true },
  {
    code: "as",
    label: "Assamese",
    native: "অসমীয়া",
    bcp47: "as-IN",
    dir: "ltr",
    translated: true,
  },
  { code: "ur", label: "Urdu", native: "اُردُو", bcp47: "ur-IN", dir: "rtl", translated: true },
  { code: "ne", label: "Nepali", native: "नेपाली", bcp47: "ne-NP", dir: "ltr", translated: true },
  {
    code: "sa",
    label: "Sanskrit",
    native: "संस्कृतम्",
    bcp47: "sa-IN",
    dir: "ltr",
    translated: false,
  },
  {
    code: "mai",
    label: "Maithili",
    native: "मैथिली",
    bcp47: "mai-IN",
    dir: "ltr",
    translated: false,
  },
  {
    code: "kok",
    label: "Konkani",
    native: "कोंकणी",
    bcp47: "kok-IN",
    dir: "ltr",
    translated: false,
  },
  { code: "sd", label: "Sindhi", native: "سنڌي", bcp47: "sd-IN", dir: "rtl", translated: false },
  { code: "ks", label: "Kashmiri", native: "کٲشُر", bcp47: "ks-IN", dir: "rtl", translated: false },
  { code: "doi", label: "Dogri", native: "डोगरी", bcp47: "doi-IN", dir: "ltr", translated: false },
  { code: "brx", label: "Bodo", native: "बड़ो", bcp47: "brx-IN", dir: "ltr", translated: false },
  {
    code: "mni",
    label: "Manipuri",
    native: "ꯃꯤꯇꯩꯂꯣꯟ",
    bcp47: "mni-IN",
    dir: "ltr",
    translated: false,
  },
  {
    code: "sat",
    label: "Santali",
    native: "ᱥᱟᱱᱛᱟᱲᱤ",
    bcp47: "sat-IN",
    dir: "ltr",
    translated: false,
  },
];

export type LanguageCode = string;

const BY_CODE = new Map(SUPPORTED_LANGUAGES.map((l) => [l.code, l] as const));

export function languageFor(code: string): Language {
  return BY_CODE.get(code) ?? SUPPORTED_LANGUAGES[0]!;
}

/** Speech tag for a language code, for both recognition and synthesis. */
export function speechTag(code: string): string {
  return languageFor(code).bcp47;
}

export function isRtl(code: string): boolean {
  return languageFor(code).dir === "rtl";
}
