/* One language, one chunk. `dict` is hand-written; `text` mirrors src/lib/i18n.generated.json (bn, hi, ur). */
import type { Strings } from "../../i18n-core";

/** Site chrome. */
const chrome: Partial<Strings> = {
  courses: "ପାଠ୍ୟକ୍ରମ",
  jobs: "ଚାକିରି ଓ ଇଣ୍ଟର୍ନସିପ୍",
  community: "ସମ୍ପ୍ରଦାୟ",
  explore: "ଅନ୍ୱେଷଣ",
  dashboard: "ଡ୍ୟାସବୋର୍ଡ",
  profile: "ମୋ ପ୍ରୋଫାଇଲ୍",
  messages: "ବାର୍ତ୍ତା",
  notifications: "ବିଜ୍ଞପ୍ତି",
  settings: "ସେଟିଂସ୍",
  cart: "କାର୍ଟ",
  rewards: "ପୁରସ୍କାର",
  passport: "ସ୍କିଲ୍ ପାସପୋର୍ଟ",
  search: "ଖୋଜନ୍ତୁ",
  menu: "ମେନୁ",
  logIn: "ଲଗ୍ ଇନ୍",
  joinFree: "ମାଗଣାରେ ଯୋଗ ଦିଅନ୍ତୁ",
  logOut: "ଲଗ୍ ଆଉଟ୍",
  free: "ମାଗଣା",
  enroll: "ନାମ ଲେଖାନ୍ତୁ",
  enrolled: "ନାମ ଲେଖାଯାଇଛି",
  addToCart: "କାର୍ଟରେ ଯୋଡ଼ନ୍ତୁ",
  back: "ପଛକୁ",
  next: "ପରବର୍ତ୍ତୀ",
  loading: "ଲୋଡ୍ ହେଉଛି…",
  language: "ଭାଷା",
  discover: "ଅନ୍ୱେଷଣ",
  forYou: "ଆପଣଙ୍କ ପାଇଁ",
  mission: "ଆମ ଲକ୍ଷ୍ୟ",
};

/** Home page. */
const home: Partial<Strings> = {
  heroTitle1: "ଏକ କୌଶଳ ଶିଖନ୍ତୁ।",
  heroTitle2: "ଚାକିରି ପାଆନ୍ତୁ।",
  heroLede:
    "ପାଠ୍ୟକ୍ରମ, ଇଣ୍ଟର୍ନସିପ୍ ଓ ଚାକିରି — ସବୁ ଏକ ସ୍ଥାନରେ, ଆପଣଙ୍କ ଜିଲ୍ଲାରୁ ଆପଣଙ୍କ କାମ ପର୍ଯ୍ୟନ୍ତ। ମାନ୍ୟତାପ୍ରାପ୍ତ ସଂସ୍ଥାରୁ ଶିଖନ୍ତୁ, ନିଯୁକ୍ତିଦାତା ପ୍ରକୃତରେ ପଢ଼ୁଥିବା ପ୍ରମାଣପତ୍ର ପାଆନ୍ତୁ, ଏବଂ ପ୍ରକୃତ ପଦ ପାଇଁ ଏକ ସ୍ଥାନରୁ ଆବେଦନ କରନ୍ତୁ।",
  getStarted: "ମାଗଣାରେ ଆରମ୍ଭ କରନ୍ତୁ",
  browseCourses: "ପାଠ୍ୟକ୍ରମ ଦେଖନ୍ତୁ",
  learners: "1.4 କୋଟି ଶିକ୍ଷାର୍ଥୀ",
  alreadySkilling: "ପୂର୍ବରୁ ଶିଖୁଛନ୍ତି",
  trainingPartners: "ତାଲିମ ଭାଗୀଦାର",
  placementRate: "ପ୍ଲେସମେଣ୍ଟ ହାର",
};

export const dict: Partial<Strings> = { ...chrome, ...home };

/** Whole-site strings, keyed by their English source. */
export const text: Record<string, string> = {};
