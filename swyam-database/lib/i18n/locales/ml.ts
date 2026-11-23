/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "കോഴ്‌സുകൾ",
  jobs: "ജോലിയും ഇന്റേൺഷിപ്പും",
  community: "സമൂഹം",
  explore: "കണ്ടെത്തുക",
  dashboard: "ഡാഷ്‌ബോർഡ്",
  profile: "എന്റെ പ്രൊഫൈൽ",
  messages: "സന്ദേശങ്ങൾ",
  notifications: "അറിയിപ്പുകൾ",
  settings: "ക്രമീകരണങ്ങൾ",
  cart: "കാർട്ട്",
  rewards: "പ്രതിഫലം",
  passport: "സ്കിൽ പാസ്‌പോർട്ട്",
  search: "തിരയുക",
  menu: "മെനു",
  logIn: "ലോഗിൻ",
  joinFree: "സൗജന്യമായി ചേരുക",
  logOut: "ലോഗ് ഔട്ട്",
  free: "സൗജന്യം",
  enroll: "ചേരുക",
  enrolled: "ചേർന്നു",
  addToCart: "കാർട്ടിൽ ചേർക്കുക",
  back: "പിന്നോട്ട്",
  next: "അടുത്തത്",
  loading: "ലോഡ് ചെയ്യുന്നു…",
  language: "ഭാഷ",
  discover: "കണ്ടെത്തുക",
  forYou: "നിങ്ങൾക്കായി",
  mission: "ഞങ്ങളുടെ ലക്ഷ്യം",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "ഒരു നൈപുണ്യം പഠിക്കൂ.",
  heroTitle2: "ജോലി നേടൂ.",
  heroLede:
    "കോഴ്‌സുകൾ, ഇന്റേൺഷിപ്പ്, ജോലി — എല്ലാം ഒരിടത്ത്, നിങ്ങളുടെ ജില്ല മുതൽ നിങ്ങളുടെ തൊഴിൽ വരെ. അംഗീകൃത സ്ഥാപനങ്ങളിൽ പഠിക്കൂ, തൊഴിലുടമകൾ ശരിക്കും വായിക്കുന്ന സർട്ടിഫിക്കറ്റ് നേടൂ, യഥാർത്ഥ ഒഴിവുകളിലേക്ക് ഒരിടത്തുനിന്നുതന്നെ അപേക്ഷിക്കൂ.",
  getStarted: "സൗജന്യമായി തുടങ്ങൂ",
  browseCourses: "കോഴ്‌സുകൾ കാണൂ",
  learners: "1.4 കോടി പഠിതാക്കൾ",
  alreadySkilling: "ഇതിനകം പഠിക്കുന്നു",
  trainingPartners: "പരിശീലന പങ്കാളികൾ",
  placementRate: "പ്ലേസ്‌മെന്റ് നിരക്ക്",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
