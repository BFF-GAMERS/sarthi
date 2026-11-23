/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "ಕೋರ್ಸ್‌ಗಳು",
  jobs: "ಉದ್ಯೋಗ ಮತ್ತು ಇಂಟರ್ನ್‌ಶಿಪ್",
  community: "ಸಮುದಾಯ",
  explore: "ಅನ್ವೇಷಿಸಿ",
  dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
  profile: "ನನ್ನ ಪ್ರೊಫೈಲ್",
  messages: "ಸಂದೇಶಗಳು",
  notifications: "ಅಧಿಸೂಚನೆಗಳು",
  settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
  cart: "ಕಾರ್ಟ್",
  rewards: "ಬಹುಮಾನಗಳು",
  passport: "ಸ್ಕಿಲ್ ಪಾಸ್‌ಪೋರ್ಟ್",
  search: "ಹುಡುಕಿ",
  menu: "ಮೆನು",
  logIn: "ಲಾಗಿನ್",
  joinFree: "ಉಚಿತವಾಗಿ ಸೇರಿ",
  logOut: "ಲಾಗ್ ಔಟ್",
  free: "ಉಚಿತ",
  enroll: "ಸೇರಿ",
  enrolled: "ಸೇರಿದ್ದೀರಿ",
  addToCart: "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ",
  back: "ಹಿಂದೆ",
  next: "ಮುಂದೆ",
  loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
  language: "ಭಾಷೆ",
  discover: "ಅನ್ವೇಷಿಸಿ",
  forYou: "ನಿಮಗಾಗಿ",
  mission: "ನಮ್ಮ ಗುರಿ",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "ಕೌಶಲ್ಯ ಕಲಿಯಿರಿ.",
  heroTitle2: "ಉದ್ಯೋಗ ಪಡೆಯಿರಿ.",
  heroLede:
    "ಕೋರ್ಸ್‌ಗಳು, ಇಂಟರ್ನ್‌ಶಿಪ್ ಮತ್ತು ಉದ್ಯೋಗ — ಎಲ್ಲವೂ ಒಂದೇ ಕಡೆ, ನಿಮ್ಮ ಜಿಲ್ಲೆಯಿಂದ ನಿಮ್ಮ ವೃತ್ತಿಯವರೆಗೆ. ಮಾನ್ಯತೆ ಪಡೆದ ಸಂಸ್ಥೆಗಳಲ್ಲಿ ಕಲಿಯಿರಿ, ಉದ್ಯೋಗದಾತರು ನಿಜವಾಗಿ ಓದುವ ಪ್ರಮಾಣಪತ್ರ ಗಳಿಸಿ, ಮತ್ತು ನಿಜವಾದ ಹುದ್ದೆಗಳಿಗೆ ಒಂದೇ ಕಡೆಯಿಂದ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ.",
  getStarted: "ಉಚಿತವಾಗಿ ಪ್ರಾರಂಭಿಸಿ",
  browseCourses: "ಕೋರ್ಸ್‌ಗಳನ್ನು ನೋಡಿ",
  learners: "1.4 ಕೋಟಿ ಕಲಿಯುವವರು",
  alreadySkilling: "ಈಗಾಗಲೇ ಕಲಿಯುತ್ತಿದ್ದಾರೆ",
  trainingPartners: "ತರಬೇತಿ ಪಾಲುದಾರರು",
  placementRate: "ಪ್ಲೇಸ್‌ಮೆಂಟ್ ದರ",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
