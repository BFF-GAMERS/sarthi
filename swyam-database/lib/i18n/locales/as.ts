/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "পাঠ্যক্ৰম",
  jobs: "চাকৰি আৰু ইণ্টাৰ্নশ্বিপ",
  community: "সম্প্ৰদায়",
  explore: "অন্বেষণ",
  dashboard: "ডেশ্ববৰ্ড",
  profile: "মোৰ প্ৰ'ফাইল",
  messages: "বাৰ্তা",
  notifications: "জাননী",
  settings: "ছেটিংছ",
  cart: "কাৰ্ট",
  rewards: "পুৰস্কাৰ",
  passport: "স্কিল পাছপৰ্ট",
  search: "সন্ধান",
  menu: "মেনু",
  logIn: "লগ ইন",
  joinFree: "বিনামূলীয়াকৈ যোগ দিয়ক",
  logOut: "লগ আউট",
  free: "বিনামূলীয়া",
  enroll: "ভৰ্তি হওক",
  enrolled: "ভৰ্তি",
  addToCart: "কাৰ্টত যোগ কৰক",
  back: "পিছলৈ",
  next: "পৰৱৰ্তী",
  loading: "লোড হৈ আছে…",
  language: "ভাষা",
  discover: "অন্বেষণ",
  forYou: "আপোনাৰ বাবে",
  mission: "আমাৰ লক্ষ্য",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "এটা দক্ষতা শিকক।",
  heroTitle2: "চাকৰি পাওক।",
  heroLede:
    "পাঠ্যক্ৰম, ইণ্টাৰ্নশ্বিপ আৰু চাকৰি — সকলো এক ঠাইতে, আপোনাৰ জিলাৰ পৰা আপোনাৰ কামলৈ। স্বীকৃত প্ৰতিষ্ঠানৰ পৰা শিকক, নিয়োগকৰ্তাই সঁচাকৈ পঢ়া প্ৰমাণপত্ৰ পাওক, আৰু প্ৰকৃত পদৰ বাবে এক ঠাইৰ পৰাই আবেদন কৰক।",
  getStarted: "বিনামূলীয়াকৈ আৰম্ভ কৰক",
  browseCourses: "পাঠ্যক্ৰম চাওক",
  learners: "1.4 কোটি শিক্ষাৰ্থী",
  alreadySkilling: "ইতিমধ্যে শিকি আছে",
  trainingPartners: "প্ৰশিক্ষণ অংশীদাৰ",
  placementRate: "প্লেচমেণ্ট হাৰ",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
