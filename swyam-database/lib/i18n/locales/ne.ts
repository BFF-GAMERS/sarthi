/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "कोर्सहरू",
  jobs: "जागिर र इन्टर्नशिप",
  community: "समुदाय",
  explore: "अन्वेषण",
  dashboard: "ड्यासबोर्ड",
  profile: "मेरो प्रोफाइल",
  messages: "सन्देश",
  notifications: "सूचनाहरू",
  settings: "सेटिङ",
  cart: "कार्ट",
  rewards: "पुरस्कार",
  passport: "स्किल पासपोर्ट",
  search: "खोज्नुहोस्",
  menu: "मेनु",
  logIn: "लग इन",
  joinFree: "निःशुल्क जोडिनुहोस्",
  logOut: "लग आउट",
  free: "निःशुल्क",
  enroll: "भर्ना हुनुहोस्",
  enrolled: "भर्ना भएको",
  addToCart: "कार्टमा राख्नुहोस्",
  back: "पछाडि",
  next: "अर्को",
  loading: "लोड हुँदैछ…",
  language: "भाषा",
  discover: "अन्वेषण",
  forYou: "तपाईंका लागि",
  mission: "हाम्रो लक्ष्य",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "सीप सिक्नुहोस्।",
  heroTitle2: "जागिर पाउनुहोस्।",
  heroLede:
    "कोर्स, इन्टर्नशिप र जागिर — सबै एकै ठाउँमा, तपाईंको जिल्लादेखि तपाईंको कामसम्म। मान्यताप्राप्त संस्थाबाट सिक्नुहोस्, रोजगारदाताले साँच्चै पढ्ने प्रमाणपत्र पाउनुहोस्, र वास्तविक पदका लागि एकै ठाउँबाट आवेदन दिनुहोस्।",
  getStarted: "निःशुल्क सुरु गर्नुहोस्",
  browseCourses: "कोर्स हेर्नुहोस्",
  learners: "1.4 करोड सिक्नेहरू",
  alreadySkilling: "पहिल्यै सिक्दैछन्",
  trainingPartners: "तालिम साझेदार",
  placementRate: "प्लेसमेन्ट दर",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
