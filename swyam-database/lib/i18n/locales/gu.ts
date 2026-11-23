/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "કોર્સ",
  jobs: "નોકરી અને ઇન્ટર્નશિપ",
  community: "સમુદાય",
  explore: "શોધો",
  dashboard: "ડેશબોર્ડ",
  profile: "મારી પ્રોફાઇલ",
  messages: "સંદેશા",
  notifications: "સૂચનાઓ",
  settings: "સેટિંગ્સ",
  cart: "કાર્ટ",
  rewards: "ઇનામ",
  passport: "સ્કિલ પાસપોર્ટ",
  search: "શોધો",
  menu: "મેનૂ",
  logIn: "લોગ ઇન",
  joinFree: "મફત જોડાઓ",
  logOut: "લોગ આઉટ",
  free: "મફત",
  enroll: "પ્રવેશ લો",
  enrolled: "પ્રવેશ લીધો",
  addToCart: "કાર્ટમાં ઉમેરો",
  back: "પાછળ",
  next: "આગળ",
  loading: "લોડ થઈ રહ્યું છે…",
  language: "ભાષા",
  discover: "શોધો",
  forYou: "તમારા માટે",
  mission: "અમારું લક્ષ્ય",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "કૌશલ્ય શીખો.",
  heroTitle2: "નોકરી મેળવો.",
  heroLede:
    "કોર્સ, ઇન્ટર્નશિપ અને નોકરી — બધું એક જ જગ્યાએ, તમારા જિલ્લાથી તમારા કામ સુધી. માન્ય સંસ્થાઓ પાસેથી શીખો, નોકરીદાતાઓ ખરેખર વાંચે એવું પ્રમાણપત્ર મેળવો, અને સાચી જગ્યાઓ માટે એક જ જગ્યાએથી અરજી કરો.",
  getStarted: "મફત શરૂ કરો",
  browseCourses: "કોર્સ જુઓ",
  learners: "1.4 કરોડ શીખનારા",
  alreadySkilling: "પહેલેથી શીખી રહ્યા છે",
  trainingPartners: "તાલીમ ભાગીદારો",
  placementRate: "પ્લેસમેન્ટ દર",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
