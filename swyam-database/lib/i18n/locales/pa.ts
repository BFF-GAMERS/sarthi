/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "ਕੋਰਸ",
  jobs: "ਨੌਕਰੀਆਂ ਤੇ ਇੰਟਰਨਸ਼ਿਪ",
  community: "ਭਾਈਚਾਰਾ",
  explore: "ਖੋਜੋ",
  dashboard: "ਡੈਸ਼ਬੋਰਡ",
  profile: "ਮੇਰੀ ਪ੍ਰੋਫਾਈਲ",
  messages: "ਸੁਨੇਹੇ",
  notifications: "ਸੂਚਨਾਵਾਂ",
  settings: "ਸੈਟਿੰਗਾਂ",
  cart: "ਕਾਰਟ",
  rewards: "ਇਨਾਮ",
  passport: "ਸਕਿੱਲ ਪਾਸਪੋਰਟ",
  search: "ਖੋਜੋ",
  menu: "ਮੀਨੂ",
  logIn: "ਲੌਗ ਇਨ",
  joinFree: "ਮੁਫ਼ਤ ਜੁੜੋ",
  logOut: "ਲੌਗ ਆਊਟ",
  free: "ਮੁਫ਼ਤ",
  enroll: "ਦਾਖ਼ਲਾ ਲਓ",
  enrolled: "ਦਾਖ਼ਲ",
  addToCart: "ਕਾਰਟ ਵਿੱਚ ਪਾਓ",
  back: "ਪਿੱਛੇ",
  next: "ਅੱਗੇ",
  loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
  language: "ਭਾਸ਼ਾ",
  discover: "ਖੋਜੋ",
  forYou: "ਤੁਹਾਡੇ ਲਈ",
  mission: "ਸਾਡਾ ਮਿਸ਼ਨ",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "ਹੁਨਰ ਸਿੱਖੋ।",
  heroTitle2: "ਨੌਕਰੀ ਪਾਓ।",
  heroLede:
    "ਕੋਰਸ, ਇੰਟਰਨਸ਼ਿਪ ਤੇ ਨੌਕਰੀ — ਸਭ ਇੱਕ ਥਾਂ, ਤੁਹਾਡੇ ਜ਼ਿਲ੍ਹੇ ਤੋਂ ਤੁਹਾਡੇ ਕੰਮ ਤੱਕ। ਮਾਨਤਾ ਪ੍ਰਾਪਤ ਸੰਸਥਾਵਾਂ ਤੋਂ ਸਿੱਖੋ, ਅਜਿਹਾ ਸਰਟੀਫਿਕੇਟ ਲਓ ਜੋ ਰੁਜ਼ਗਾਰਦਾਤਾ ਸੱਚਮੁੱਚ ਪੜ੍ਹਦੇ ਹਨ, ਅਤੇ ਅਸਲ ਅਸਾਮੀਆਂ ਲਈ ਇੱਕੋ ਥਾਂ ਤੋਂ ਅਰਜ਼ੀ ਦਿਓ।",
  getStarted: "ਮੁਫ਼ਤ ਸ਼ੁਰੂ ਕਰੋ",
  browseCourses: "ਕੋਰਸ ਵੇਖੋ",
  learners: "1.4 ਕਰੋੜ ਸਿੱਖਣ ਵਾਲੇ",
  alreadySkilling: "ਪਹਿਲਾਂ ਹੀ ਸਿੱਖ ਰਹੇ ਹਨ",
  trainingPartners: "ਸਿਖਲਾਈ ਭਾਈਵਾਲ",
  placementRate: "ਪਲੇਸਮੈਂਟ ਦਰ",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
