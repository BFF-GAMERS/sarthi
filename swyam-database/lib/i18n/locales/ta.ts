/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "படிப்புகள்",
  jobs: "வேலை & பயிற்சி",
  community: "சமூகம்",
  explore: "ஆராயுங்கள்",
  dashboard: "டாஷ்போர்டு",
  profile: "என் சுயவிவரம்",
  messages: "செய்திகள்",
  notifications: "அறிவிப்புகள்",
  settings: "அமைப்புகள்",
  cart: "கூடை",
  rewards: "வெகுமதிகள்",
  passport: "திறன் கடவுச்சீட்டு",
  search: "தேடு",
  menu: "மெனு",
  logIn: "உள்நுழை",
  joinFree: "இலவசமாக இணைக",
  logOut: "வெளியேறு",
  free: "இலவசம்",
  enroll: "சேரவும்",
  enrolled: "சேர்ந்தது",
  addToCart: "கூடையில் சேர்",
  back: "பின்",
  next: "அடுத்து",
  loading: "ஏற்றுகிறது…",
  language: "மொழி",
  discover: "கண்டறி",
  forYou: "உங்களுக்காக",
  mission: "எங்கள் நோக்கம்",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "ஒரு திறனைக் கற்றுக்கொள்.",
  heroTitle2: "வேலை பெறு.",
  heroLede:
    "படிப்புகள், பயிற்சி மற்றும் வேலை — அனைத்தும் ஒரே இடத்தில், உங்கள் மாவட்டத்திலிருந்து உங்கள் தொழில் வரை. அங்கீகரிக்கப்பட்ட நிறுவனங்களில் பயிலுங்கள், முதலாளிகள் உண்மையில் படிக்கும் சான்றிதழ் பெறுங்கள், உண்மையான பணியிடங்களுக்கு ஒரே இடத்தில் விண்ணப்பியுங்கள்.",
  getStarted: "இலவசமாகத் தொடங்கு",
  browseCourses: "படிப்புகளைப் பார்",
  learners: "1.4 கோடி கற்பவர்கள்",
  alreadySkilling: "ஏற்கனவே கற்கின்றனர்",
  trainingPartners: "பயிற்சி கூட்டாளிகள்",
  placementRate: "வேலைவாய்ப்பு விகிதம்",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
