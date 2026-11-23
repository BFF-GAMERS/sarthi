/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "కోర్సులు",
  jobs: "ఉద్యోగాలు & ఇంటర్న్‌షిప్‌లు",
  community: "సముదాయం",
  explore: "అన్వేషించండి",
  dashboard: "డాష్‌బోర్డ్",
  profile: "నా ప్రొఫైల్",
  messages: "సందేశాలు",
  notifications: "నోటిఫికేషన్లు",
  settings: "సెట్టింగ్‌లు",
  cart: "కార్ట్",
  rewards: "రివార్డ్‌లు",
  passport: "స్కిల్ పాస్‌పోర్ట్",
  search: "వెతకండి",
  menu: "మెనూ",
  logIn: "లాగిన్",
  joinFree: "ఉచితంగా చేరండి",
  logOut: "లాగ్ అవుట్",
  free: "ఉచితం",
  enroll: "చేరండి",
  enrolled: "చేరారు",
  addToCart: "కార్ట్‌లో చేర్చు",
  back: "వెనుకకు",
  next: "తర్వాత",
  loading: "లోడ్ అవుతోంది…",
  language: "భాష",
  discover: "అన్వేషించండి",
  forYou: "మీ కోసం",
  mission: "మా లక్ష్యం",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "ఒక నైపుణ్యం నేర్చుకోండి.",
  heroTitle2: "ఉద్యోగం పొందండి.",
  heroLede:
    "కోర్సులు, ఇంటర్న్‌షిప్‌లు, ఉద్యోగాలు — అన్నీ ఒకే చోట, మీ జిల్లా నుండి మీ వృత్తి వరకు. గుర్తింపు పొందిన సంస్థల్లో నేర్చుకోండి, యజమానులు నిజంగా చదివే ధృవపత్రం పొందండి, నిజమైన ఖాళీలకు ఒకే చోట నుండి దరఖాస్తు చేయండి.",
  getStarted: "ఉచితంగా ప్రారంభించండి",
  browseCourses: "కోర్సులు చూడండి",
  learners: "1.4 కోట్ల అభ్యాసకులు",
  alreadySkilling: "ఇప్పటికే నేర్చుకుంటున్నారు",
  trainingPartners: "శిక్షణ భాగస్వాములు",
  placementRate: "ప్లేస్‌మెంట్ రేటు",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
