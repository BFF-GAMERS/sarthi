/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "कोर्स",
  jobs: "नोकरी आणि इंटर्नशिप",
  community: "समुदाय",
  explore: "शोधा",
  dashboard: "डॅशबोर्ड",
  profile: "माझे प्रोफाइल",
  messages: "संदेश",
  notifications: "सूचना",
  settings: "सेटिंग्ज",
  cart: "कार्ट",
  rewards: "बक्षिसे",
  passport: "स्किल पासपोर्ट",
  search: "शोधा",
  menu: "मेनू",
  logIn: "लॉग इन",
  joinFree: "मोफत सामील व्हा",
  logOut: "लॉग आउट",
  free: "मोफत",
  enroll: "प्रवेश घ्या",
  enrolled: "प्रवेशित",
  addToCart: "कार्टमध्ये टाका",
  back: "मागे",
  next: "पुढे",
  loading: "लोड होत आहे…",
  language: "भाषा",
  discover: "शोधा",
  forYou: "तुमच्यासाठी",
  mission: "आमचे ध्येय",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "कौशल्य शिका.",
  heroTitle2: "नोकरी मिळवा.",
  heroLede:
    "कोर्स, इंटर्नशिप आणि नोकरी — सर्व एका ठिकाणी, तुमच्या जिल्ह्यापासून तुमच्या कामापर्यंत. मान्यताप्राप्त संस्थांकडून शिका, नियोक्ते खरोखर वाचतील असे प्रमाणपत्र मिळवा, आणि खऱ्या जागांसाठी एकाच ठिकाणाहून अर्ज करा.",
  getStarted: "मोफत सुरू करा",
  browseCourses: "कोर्स पाहा",
  learners: "1.4 कोटी शिकणारे",
  alreadySkilling: "आधीच शिकत आहेत",
  trainingPartners: "प्रशिक्षण भागीदार",
  placementRate: "प्लेसमेंट दर",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
