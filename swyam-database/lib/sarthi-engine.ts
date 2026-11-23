import { courses, organizations, orgById } from "@/data/mock";
import { payLine, type Opportunity } from "@/lib/opportunities";
import { schemes, skillCategories } from "@/data/topics";

/**
 * Sarthi — the local career assistant engine.
 *
 * Deliberately deterministic and offline, like the Skill Matcher endpoint: it
 * classifies the question by intent, pulls matching records out of the
 * platform's own catalogue, and renders a markdown answer. Answers are always
 * grounded in courses, employers, stipends and schemes that exist on the site —
 * it can never invent a course ID or hallucinate a scheme.
 *
 * Swapping in a hosted model means replacing `answer()` only; the route and the
 * client contract are unchanged.
 */

/* ── Language framing ─────────────────────────────────────────────────
   Only the surrounding labels are translated. Catalogue data (course
   titles, employer names, salaries, NSQF levels) is always shown in its
   original form, so nothing is ever mistranslated. */

interface Strings {
  greeting: (name: string) => string;
  courses: string;
  schemes: string;
  internships: string;
  jobs: string;
  institutes: string;
  eligibility: string;
  benefit: string;
  howToApply: string;
  duration: string;
  fee: string;
  free: string;
  stipend: string;
  salary: string;
  nothingFound: string;
  more: (where: string) => string;
  askMore: string;
  /**
   * SkillSwap label. Optional so the eight existing language records stay
   * valid; `stringsFor` fills the English wording in where a translation
   * hasn't been written yet, which is honest rather than machine-translated.
   */
  swap?: string;
}

const EN: Strings = {
  greeting: (n) =>
    `Namaste ${n}! I can help with courses, schemes, internships, jobs, resumes and interviews.`,
  courses: "Courses that fit",
  schemes: "Government schemes",
  internships: "Apprenticeships & internships",
  jobs: "Openings you can apply to",
  institutes: "Training partners",
  eligibility: "Who qualifies",
  benefit: "What you get",
  howToApply: "How to apply",
  duration: "Duration",
  fee: "Fee",
  free: "Free",
  stipend: "Stipend",
  salary: "Salary",
  nothingFound: "I could not find an exact match in the catalog.",
  more: (w) => `Browse everything on the **${w}** page.`,
  askMore: "Want me to go deeper on any one of these?",
  swap: "SkillSwap — trade a skill you have for one you want",
};

const STRINGS: Record<string, Strings> = {
  en: EN,
  hi: {
    greeting: (n) =>
      `नमस्ते ${n}! मैं कोर्स, सरकारी योजनाओं, इंटर्नशिप, नौकरियों, रिज़्यूमे और इंटरव्यू में मदद कर सकता हूँ।`,
    courses: "आपके लिए कोर्स",
    schemes: "सरकारी योजनाएँ",
    internships: "अप्रेंटिसशिप और इंटर्नशिप",
    jobs: "नौकरियाँ",
    institutes: "प्रशिक्षण संस्थान",
    eligibility: "पात्रता",
    benefit: "लाभ",
    howToApply: "आवेदन कैसे करें",
    duration: "अवधि",
    fee: "शुल्क",
    free: "निःशुल्क",
    stipend: "स्टाइपेंड",
    salary: "वेतन",
    nothingFound: "मुझे सूची में इससे मिलता-जुलता कुछ नहीं मिला।",
    more: (w) => `पूरी सूची **${w}** पेज पर देखें।`,
    askMore: "इनमें से किसी एक के बारे में और बताऊँ?",
    swap: "स्किलस्वैप — अपना हुनर दीजिए, नया हुनर सीखिए",
  },
  mr: {
    greeting: (n) =>
      `नमस्कार ${n}! मी कोर्स, सरकारी योजना, इंटर्नशिप, नोकऱ्या, रेझ्युमे आणि मुलाखतीत मदत करू शकतो.`,
    courses: "तुमच्यासाठी कोर्स",
    schemes: "सरकारी योजना",
    internships: "अप्रेंटिसशिप आणि इंटर्नशिप",
    jobs: "नोकऱ्या",
    institutes: "प्रशिक्षण संस्था",
    eligibility: "पात्रता",
    benefit: "लाभ",
    howToApply: "अर्ज कसा करावा",
    duration: "कालावधी",
    fee: "शुल्क",
    free: "मोफत",
    stipend: "विद्यावेतन",
    salary: "पगार",
    nothingFound: "यादीत नेमके जुळणारे काही सापडले नाही.",
    more: (w) => `संपूर्ण यादी **${w}** पानावर पहा.`,
    askMore: "यापैकी एकाबद्दल अधिक सांगू का?",
    swap: "स्किलस्वॅप — तुमचे कौशल्य द्या, नवीन शिका",
  },
  bn: {
    greeting: (n) =>
      `নমস্কার ${n}! আমি কোর্স, সরকারি প্রকল্প, ইন্টার্নশিপ, চাকরি, রেজিউমে ও ইন্টারভিউয়ে সাহায্য করতে পারি।`,
    courses: "আপনার জন্য কোর্স",
    schemes: "সরকারি প্রকল্প",
    internships: "অ্যাপ্রেন্টিসশিপ ও ইন্টার্নশিপ",
    jobs: "চাকরি",
    institutes: "প্রশিক্ষণ কেন্দ্র",
    eligibility: "যোগ্যতা",
    benefit: "সুবিধা",
    howToApply: "আবেদন পদ্ধতি",
    duration: "সময়কাল",
    fee: "ফি",
    free: "বিনামূল্যে",
    stipend: "উপবৃত্তি",
    salary: "বেতন",
    nothingFound: "তালিকায় ঠিক মিল পাওয়া গেল না।",
    more: (w) => `সম্পূর্ণ তালিকা **${w}** পাতায় দেখুন।`,
    askMore: "এর মধ্যে কোনটি নিয়ে আরও বলব?",
    swap: "স্কিলসোয়াপ — নিজের দক্ষতা দিন, নতুন শিখুন",
  },
  pa: {
    greeting: (n) =>
      `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${n}! ਮੈਂ ਕੋਰਸ, ਸਰਕਾਰੀ ਸਕੀਮਾਂ, ਇੰਟਰਨਸ਼ਿਪ, ਨੌਕਰੀਆਂ, ਰਿਜ਼ਿਊਮੇ ਅਤੇ ਇੰਟਰਵਿਊ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।`,
    courses: "ਤੁਹਾਡੇ ਲਈ ਕੋਰਸ",
    schemes: "ਸਰਕਾਰੀ ਸਕੀਮਾਂ",
    internships: "ਅਪ੍ਰੈਂਟਿਸਸ਼ਿਪ ਅਤੇ ਇੰਟਰਨਸ਼ਿਪ",
    jobs: "ਨੌਕਰੀਆਂ",
    institutes: "ਸਿਖਲਾਈ ਸੰਸਥਾਵਾਂ",
    eligibility: "ਯੋਗਤਾ",
    benefit: "ਲਾਭ",
    howToApply: "ਅਰਜ਼ੀ ਕਿਵੇਂ ਦੇਣੀ ਹੈ",
    duration: "ਮਿਆਦ",
    fee: "ਫੀਸ",
    free: "ਮੁਫ਼ਤ",
    stipend: "ਵਜ਼ੀਫ਼ਾ",
    salary: "ਤਨਖਾਹ",
    nothingFound: "ਸੂਚੀ ਵਿੱਚ ਬਿਲਕੁਲ ਮੇਲ ਖਾਂਦਾ ਕੁਝ ਨਹੀਂ ਮਿਲਿਆ।",
    more: (w) => `ਪੂਰੀ ਸੂਚੀ **${w}** ਪੰਨੇ ਉੱਤੇ ਵੇਖੋ।`,
    askMore: "ਇਹਨਾਂ ਵਿੱਚੋਂ ਕਿਸੇ ਇੱਕ ਬਾਰੇ ਹੋਰ ਦੱਸਾਂ?",
    swap: "ਸਕਿੱਲਸਵੈਪ — ਆਪਣਾ ਹੁਨਰ ਦਿਓ, ਨਵਾਂ ਸਿੱਖੋ",
  },
  ta: {
    greeting: (n) =>
      `வணக்கம் ${n}! படிப்புகள், அரசு திட்டங்கள், பயிற்சி, வேலைகள், ரெஸ்யூமே மற்றும் நேர்காணலில் உதவ முடியும்.`,
    courses: "உங்களுக்கான படிப்புகள்",
    schemes: "அரசு திட்டங்கள்",
    internships: "பயிற்சி வாய்ப்புகள்",
    jobs: "வேலை வாய்ப்புகள்",
    institutes: "பயிற்சி நிறுவனங்கள்",
    eligibility: "தகுதி",
    benefit: "பயன்",
    howToApply: "விண்ணப்பிக்கும் முறை",
    duration: "காலம்",
    fee: "கட்டணம்",
    free: "இலவசம்",
    stipend: "உதவித்தொகை",
    salary: "சம்பளம்",
    nothingFound: "பட்டியலில் சரியாகப் பொருந்துவது கிடைக்கவில்லை.",
    more: (w) => `முழு பட்டியலை **${w}** பக்கத்தில் பாருங்கள்.`,
    askMore: "இவற்றில் ஒன்றைப் பற்றி மேலும் சொல்லட்டுமா?",
    swap: "ஸ்கில்ஸ்வாப் — உங்கள் திறனைத் தந்து புதியதைக் கற்றுக்கொள்ளுங்கள்",
  },
  te: {
    greeting: (n) =>
      `నమస్కారం ${n}! కోర్సులు, ప్రభుత్వ పథకాలు, ఇంటర్న్‌షిప్‌లు, ఉద్యోగాలు, రెజ్యూమె మరియు ఇంటర్వ్యూలో సహాయం చేయగలను.`,
    courses: "మీకు సరిపోయే కోర్సులు",
    schemes: "ప్రభుత్వ పథకాలు",
    internships: "అప్రెంటిస్‌షిప్ & ఇంటర్న్‌షిప్",
    jobs: "ఉద్యోగ అవకాశాలు",
    institutes: "శిక్షణ సంస్థలు",
    eligibility: "అర్హత",
    benefit: "ప్రయోజనం",
    howToApply: "ఎలా దరఖాస్తు చేయాలి",
    duration: "వ్యవధి",
    fee: "రుసుము",
    free: "ఉచితం",
    stipend: "స్టైపెండ్",
    salary: "జీతం",
    nothingFound: "జాబితాలో సరిగ్గా సరిపోయేది దొరకలేదు.",
    more: (w) => `పూర్తి జాబితాను **${w}** పేజీలో చూడండి.`,
    askMore: "వీటిలో ఒకదాని గురించి మరింత చెప్పమంటారా?",
    swap: "స్కిల్‌స్వాప్ — మీ నైపుణ్యాన్ని ఇచ్చి కొత్తది నేర్చుకోండి",
  },
  gu: {
    greeting: (n) =>
      `નમસ્તે ${n}! હું કોર્સ, સરકારી યોજનાઓ, ઇન્ટર્નશિપ, નોકરીઓ, રિઝ્યુમે અને ઇન્ટરવ્યૂમાં મદદ કરી શકું છું.`,
    courses: "તમારા માટે કોર્સ",
    schemes: "સરકારી યોજનાઓ",
    internships: "એપ્રેન્ટિસશિપ અને ઇન્ટર્નશિપ",
    jobs: "નોકરીની તકો",
    institutes: "તાલીમ સંસ્થાઓ",
    eligibility: "પાત્રતા",
    benefit: "લાભ",
    howToApply: "અરજી કેવી રીતે કરવી",
    duration: "સમયગાળો",
    fee: "ફી",
    free: "મફત",
    stipend: "સ્ટાઇપેન્ડ",
    salary: "પગાર",
    nothingFound: "યાદીમાં બરાબર મળતું કંઈ મળ્યું નહીં.",
    more: (w) => `સંપૂર્ણ યાદી **${w}** પેજ પર જુઓ.`,
    askMore: "આમાંથી કોઈ એક વિશે વધુ કહું?",
    swap: "સ્કિલસ્વૅપ — તમારું કૌશલ્ય આપો, નવું શીખો",
  },
  kn: {
    greeting: (n) =>
      `ನಮಸ್ಕಾರ ${n}! ಕೋರ್ಸ್‌ಗಳು, ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು, ಇಂಟರ್ನ್‌ಶಿಪ್, ಉದ್ಯೋಗ, ರೆಸ್ಯೂಮೆ ಮತ್ತು ಸಂದರ್ಶನದಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.`,
    courses: "ನಿಮಗೆ ಸೂಕ್ತ ಕೋರ್ಸ್‌ಗಳು",
    schemes: "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು",
    internships: "ಅಪ್ರೆಂಟಿಸ್‌ಶಿಪ್ ಮತ್ತು ಇಂಟರ್ನ್‌ಶಿಪ್",
    jobs: "ಉದ್ಯೋಗ ಅವಕಾಶಗಳು",
    institutes: "ತರಬೇತಿ ಸಂಸ್ಥೆಗಳು",
    eligibility: "ಅರ್ಹತೆ",
    benefit: "ಪ್ರಯೋಜನ",
    howToApply: "ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ವಿಧಾನ",
    duration: "ಅವಧಿ",
    fee: "ಶುಲ್ಕ",
    free: "ಉಚಿತ",
    stipend: "ಶಿಷ್ಯವೇತನ",
    salary: "ಸಂಬಳ",
    nothingFound: "ಪಟ್ಟಿಯಲ್ಲಿ ಸರಿಯಾಗಿ ಹೊಂದುವುದು ಸಿಗಲಿಲ್ಲ.",
    more: (w) => `ಪೂರ್ಣ ಪಟ್ಟಿಯನ್ನು **${w}** ಪುಟದಲ್ಲಿ ನೋಡಿ.`,
    askMore: "ಇವುಗಳಲ್ಲಿ ಒಂದರ ಬಗ್ಗೆ ಹೆಚ್ಚು ಹೇಳಲೇ?",
    swap: "ಸ್ಕಿಲ್‌ಸ್ವಾಪ್ — ನಿಮ್ಮ ಕೌಶಲ ಕೊಟ್ಟು ಹೊಸದು ಕಲಿಯಿರಿ",
  },
  ml: {
    greeting: (n) =>
      `നമസ്കാരം ${n}! കോഴ്‌സുകൾ, സർക്കാർ പദ്ധതികൾ, ഇന്റേൺഷിപ്പ്, ജോലി, റെസ്യൂമെ, ഇന്റർവ്യൂ എന്നിവയിൽ സഹായിക്കാം.`,
    courses: "നിങ്ങൾക്ക് ചേരുന്ന കോഴ്‌സുകൾ",
    schemes: "സർക്കാർ പദ്ധതികൾ",
    internships: "അപ്രന്റിസ്ഷിപ്പും ഇന്റേൺഷിപ്പും",
    jobs: "ജോലി അവസരങ്ങൾ",
    institutes: "പരിശീലന സ്ഥാപനങ്ങൾ",
    eligibility: "യോഗ്യത",
    benefit: "പ്രയോജനം",
    howToApply: "എങ്ങനെ അപേക്ഷിക്കാം",
    duration: "കാലാവധി",
    fee: "ഫീസ്",
    free: "സൗജന്യം",
    stipend: "സ്റ്റൈപ്പൻഡ്",
    salary: "ശമ്പളം",
    nothingFound: "പട്ടികയിൽ കൃത്യമായി ചേരുന്നത് കണ്ടെത്താനായില്ല.",
    more: (w) => `പൂർണ്ണ പട്ടിക **${w}** പേജിൽ കാണുക.`,
    askMore: "ഇവയിൽ ഒന്നിനെക്കുറിച്ച് കൂടുതൽ പറയട്ടെ?",
    swap: "സ്കിൽസ്വാപ്പ് — നിങ്ങളുടെ കഴിവ് നൽകി പുതിയത് പഠിക്കൂ",
  },
  or: {
    greeting: (n) =>
      `ନମସ୍କାର ${n}! ମୁଁ କୋର୍ସ, ସରକାରୀ ଯୋଜନା, ଇଣ୍ଟର୍ନଶିପ୍, ଚାକିରି, ରିଜ୍ୟୁମେ ଓ ଇଣ୍ଟରଭ୍ୟୁରେ ସାହାଯ୍ୟ କରିପାରିବି।`,
    courses: "ଆପଣଙ୍କ ପାଇଁ କୋର୍ସ",
    schemes: "ସରକାରୀ ଯୋଜନା",
    internships: "ଆପ୍ରେଣ୍ଟିସଶିପ୍ ଓ ଇଣ୍ଟର୍ନଶିପ୍",
    jobs: "ଚାକିରି ସୁଯୋଗ",
    institutes: "ପ୍ରଶିକ୍ଷଣ ସଂସ୍ଥା",
    eligibility: "ଯୋଗ୍ୟତା",
    benefit: "ଲାଭ",
    howToApply: "କିପରି ଆବେଦନ କରିବେ",
    duration: "ଅବଧି",
    fee: "ଶୁଳ୍କ",
    free: "ମାଗଣା",
    stipend: "ଷ୍ଟାଇପେଣ୍ଡ",
    salary: "ଦରମା",
    nothingFound: "ତାଲିକାରେ ଠିକ୍ ମେଳ ଖାଉଥିବା କିଛି ମିଳିଲା ନାହିଁ।",
    more: (w) => `ସମ୍ପୂର୍ଣ୍ଣ ତାଲିକା **${w}** ପୃଷ୍ଠାରେ ଦେଖନ୍ତୁ।`,
    askMore: "ଏଥିମଧ୍ୟରୁ ଗୋଟିଏ ବିଷୟରେ ଅଧିକ କହିବି କି?",
    swap: "ସ୍କିଲସ୍ୱାପ୍ — ନିଜ କୌଶଳ ଦିଅନ୍ତୁ, ନୂଆ ଶିଖନ୍ତୁ",
  },
  as: {
    greeting: (n) =>
      `নমস্কাৰ ${n}! মই পাঠ্যক্ৰম, চৰকাৰী আঁচনি, ইণ্টাৰ্নশ্বিপ, চাকৰি, ৰেজিউমে আৰু সাক্ষাৎকাৰত সহায় কৰিব পাৰোঁ।`,
    courses: "আপোনাৰ বাবে পাঠ্যক্ৰম",
    schemes: "চৰকাৰী আঁচনি",
    internships: "এপ্ৰেণ্টিচশ্বিপ আৰু ইণ্টাৰ্নশ্বিপ",
    jobs: "চাকৰিৰ সুযোগ",
    institutes: "প্ৰশিক্ষণ প্ৰতিষ্ঠান",
    eligibility: "যোগ্যতা",
    benefit: "সুবিধা",
    howToApply: "কেনেকৈ আবেদন কৰিব",
    duration: "সময়সীমা",
    fee: "মাচুল",
    free: "বিনামূলীয়া",
    stipend: "বৃত্তি",
    salary: "দৰমহা",
    nothingFound: "তালিকাত ঠিক মিলা কিবা পোৱা নগ‘ল।",
    more: (w) => `সম্পূৰ্ণ তালিকা **${w}** পৃষ্ঠাত চাওক।`,
    askMore: "ইয়াৰে এটাৰ বিষয়ে অধিক ক‘ম নেকি?",
    swap: "স্কিলছোৱাপ — নিজৰ দক্ষতা দি নতুন শিকক",
  },
  ur: {
    greeting: (n) =>
      `السلام علیکم ${n}! میں کورسز، سرکاری اسکیموں، انٹرن شپ، نوکریوں، ریزیومے اور انٹرویو میں مدد کر سکتا ہوں۔`,
    courses: "آپ کے لیے کورسز",
    schemes: "سرکاری اسکیمیں",
    internships: "اپرنٹس شپ اور انٹرن شپ",
    jobs: "ملازمت کے مواقع",
    institutes: "تربیتی ادارے",
    eligibility: "اہلیت",
    benefit: "فائدہ",
    howToApply: "درخواست کیسے دیں",
    duration: "مدت",
    fee: "فیس",
    free: "مفت",
    stipend: "وظیفہ",
    salary: "تنخواہ",
    nothingFound: "فہرست میں بالکل مطابقت رکھنے والا کچھ نہیں ملا۔",
    more: (w) => `مکمل فہرست **${w}** صفحے پر دیکھیں۔`,
    askMore: "کیا ان میں سے کسی ایک کے بارے میں مزید بتاؤں؟",
    swap: "اسکل سویپ — اپنی مہارت دیں، نئی سیکھیں",
  },
  ne: {
    greeting: (n) =>
      `नमस्ते ${n}! म कोर्स, सरकारी योजना, इन्टर्नशिप, जागिर, रेजुमे र अन्तर्वार्तामा सहयोग गर्न सक्छु।`,
    courses: "तपाईंका लागि कोर्स",
    schemes: "सरकारी योजनाहरू",
    internships: "अप्रेन्टिसशिप र इन्टर्नशिप",
    jobs: "जागिरका अवसर",
    institutes: "तालिम संस्थाहरू",
    eligibility: "योग्यता",
    benefit: "लाभ",
    howToApply: "कसरी आवेदन दिने",
    duration: "अवधि",
    fee: "शुल्क",
    free: "निःशुल्क",
    stipend: "भत्ता",
    salary: "तलब",
    nothingFound: "सूचीमा ठ्याक्कै मिल्ने केही भेटिएन।",
    more: (w) => `पूरा सूची **${w}** पृष्ठमा हेर्नुहोस्।`,
    askMore: "यीमध्ये कुनै एकबारे थप भनौं?",
    swap: "स्किलस्वाप — आफ्नो सीप दिनुहोस्, नयाँ सिक्नुहोस्",
  },
};

const stringsFor = (code: string): Strings => ({
  swap: "SkillSwap — trade a skill you have for one you want",
  ...(STRINGS[code] ?? EN),
});

/* ── Text utilities ──────────────────────────────────────────────── */

const STOP = new Set([
  "i",
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "my",
  "me",
  "am",
  "is",
  "are",
  "was",
  "be",
  "do",
  "does",
  "can",
  "could",
  "should",
  "would",
  "will",
  "want",
  "need",
  "like",
  "how",
  "what",
  "which",
  "who",
  "where",
  "when",
  "why",
  "please",
  "help",
  "you",
  "your",
  "it",
  "that",
  "this",
  "there",
  "any",
  "some",
  "get",
  "got",
  "have",
  "has",
  "about",
  "from",
  "at",
  "as",
  "by",
  "so",
  "if",
  "but",
  "not",
  "no",
  "yes",
  "me",
  "we",
  "us",
  // Words that describe the *request* rather than the subject. Left in, they
  // matched half the catalogue and drowned out the actual trade.
  "course",
  "courses",
  "class",
  "classes",
  "training",
  "learn",
  "study",
  "job",
  "jobs",
  "work",
  "career",
  "near",
  "find",
  "show",
  "tell",
  "suits",
  "suit",
  "good",
  "best",
  "tips",
  "prep",
  "analyze",
  "analyse",
  "gap",
  "become",
  "looking",
  "interested",
]);

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

/**
 * Stem a token to its first six characters.
 *
 * Plain substring matching missed obvious pairs — "electrician" does not
 * contain "electrical", so a query about electrician work scored zero against
 * the Electrical category. Comparing six-character prefixes matches
 * electric/electrical/electrician/electronics without pulling in noise.
 */
const stem = (t: string) => (t.length > 6 ? t.slice(0, 6) : t);

const wordsOf = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);

/**
 * Inverse document frequency over the catalogue.
 *
 * Without this, a common word like "technician" counted as much as a rare,
 * highly specific one like "solar", so "solar technician" ranked every
 * *Technician* course above the actual solar course. Rare terms now carry
 * more weight, which is what makes the query specific in the first place.
 */
const CORPUS: string[] = [
  // Includes the long-form text, because that is what actually gets searched.
  // Building IDF from titles alone made words that are rare in titles but
  // everywhere in prose — "course", "work", "training" — look highly
  // distinctive, so they dominated the ranking.
  ...courses.map(
    (c) => `${c.title} ${c.category} ${c.group} ${c.overview} ${c.outcomes.join(" ")}`,
  ),
];

const DF = (() => {
  const df = new Map<string, number>();
  for (const doc of CORPUS) {
    for (const w of new Set(wordsOf(doc).map(stem))) df.set(w, (df.get(w) ?? 0) + 1);
  }
  return df;
})();

/** ~1 for an average term, higher for rare ones, ~0.35 for very common ones. */
function idf(token: string): number {
  const n = CORPUS.length;
  const d = DF.get(stem(token)) ?? 0;
  return Math.max(0.35, Math.min(2.2, Math.log((n + 1) / (d + 1)) / Math.log(12)));
}

/** How many query tokens appear in a haystack, with light weighting. */
function overlap(tokens: string[], haystack: string, weight = 1): number {
  const words = wordsOf(haystack);
  let score = 0;
  for (const t of tokens) {
    const st = stem(t);
    if (words.some((w) => w.startsWith(st) || t.startsWith(stem(w)))) score += weight * idf(t);
  }
  return score;
}

/** True when the query mentions the subject at all, not just a place name. */
function hasTopicalMatch(tokens: string[], haystacks: string[]): boolean {
  return haystacks.some((h) => overlap(tokens, h) > 0);
}

/* ── Intent detection ────────────────────────────────────────────── */

type Intent =
  | "greeting"
  | "scheme"
  | "resume"
  | "interview"
  | "skillgap"
  | "internship"
  | "job"
  | "institute"
  | "course"
  | "skillswap"
  | "capabilities";

const INTENT_HINTS: [Intent, RegExp][] = [
  // Each pattern also lists the equivalent term in the languages the chat
  // picker offers, so a question typed in Hindi, Marathi, Bengali, Punjabi or
  // Tamil routes to the same answer as its English counterpart.
  [
    "greeting",
    /\b(hi|hello|hey|namaste|namaskar|vanakkam|sat sri akal|good (morning|evening))\b|नमस्ते|नमस्कार|নমস্কার|ਸਤ ਸ੍ਰੀ ਅਕਾਲ|வணக்கம்/i,
  ],
  ["capabilities", /\b(what can you do|who are you|help me|options|features)\b|क्या कर सकते/i],
  /*
   * SkillSwap. Matched before the course/job patterns because "I want to learn
   * X and can teach Y" contains the word "learn" and would otherwise be
   * answered with a course list instead of a partner. Covers the romanised
   * Hindi people actually type ("sikha sakta hoon", "seekhna chahta hoon").
   */
  [
    "skillswap",
    /\b(skill ?swap|swap|exchange|barter|trade (a )?skill|teach .*(learn|in return)|learn .*(teach|in exchange)|partner to learn|study buddy|language exchange)\b|सिखा सकता|सीखना चाहता|sikha sakta|sikha sakti|seekhna chahta|seekhna chahti|sikhna chahta/i,
  ],
  [
    "scheme",
    /\b(scheme|schemes|pmkvy|naps|mudra|vishwakarma|ddu|gky|scholarship|subsidy|government (help|support|money)|loan)\b|योजना|स्कीम|छात्रवृत्ति|প্রকল্প|বৃত্তি|ਸਕੀਮ|ਯੋਜਨਾ|திட்டம்|உதவித்தொகை/i,
  ],
  ["resume", /\b(resume|cv|biodata|portfolio)\b|रिज़्यूमे|बायोडाटा|রেজিউমে|ਰਿਜ਼ਿਊਮੇ|ரெஸ்யூமே/i],
  [
    "interview",
    /\b(interview|hr round|mock|questions to expect)\b|इंटरव्यू|साक्षात्कार|ইন্টারভিউ|ਇੰਟਰਵਿਊ|நேர்காணல்/i,
  ],
  ["skillgap", /\b(skill gap|gap analysis|what.*(missing|lack)|analyze my skill|upskill)\b/i],
  [
    "internship",
    /\b(internship|internships|apprentice|apprenticeship|trainee)\b|इंटर्नशिप|अप्रेंटिस|ইন্টার্নশিপ|ਇੰਟਰਨਸ਼ਿਪ|பயிற்சி/i,
  ],
  [
    "job",
    /\b(job|jobs|vacancy|vacancies|opening|openings|hiring|placement|salary|package|pay)\b|नौकरी|वेतन|চাকরি|বেতন|ਨੌਕਰੀ|ਤਨਖਾਹ|வேலை|சம்பளம்/i,
  ],
  [
    "institute",
    /\b(institute|institutes|iti|nsti|training (centre|center|partner)|college)\b|संस्थान|आईटीआई|প্রতিষ্ঠান|ਸੰਸਥਾ|நிறுவனம்/i,
  ],
  [
    "course",
    /\b(course|courses|learn|study|training|certificate|diploma|class)\b|कोर्स|पाठ्यक्रम|प्रशिक्षण|কোর্স|প্রশিক্ষণ|ਕੋਰਸ|ਸਿਖਲਾਈ|படிப்பு|கோர்ஸ்/i,
  ],
];

function detectIntent(text: string): Intent {
  for (const [intent, re] of INTENT_HINTS) if (re.test(text)) return intent;
  return "course";
}

/* ── Retrieval ───────────────────────────────────────────────────── */

function topCourses(tokens: string[], limit = 3) {
  const ranked = courses
    .map((c) => ({
      c,
      score:
        // Title, category and group are scored as ONE haystack. Some records
        // repeat the title in the category, and scoring the fields separately
        // counted such terms twice — which is how a generic "Technician" match
        // outranked a specific "Solar" one. Merging means each query term
        // counts once for the subject, whatever the data looks like.
        overlap(tokens, `${c.title} ${c.category} ${c.group}`, 5) +
        overlap(tokens, `${c.overview} ${c.outcomes.join(" ")}`, 1.5) +
        overlap(tokens, `${c.city} ${c.state}`, 1) +
        (c.free ? 0.4 : 0) +
        c.rating / 10,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((r, _i, arr) => r.score >= Math.max(2.5, arr[0]!.score * 0.35))
    .map((r) => r.c);
  return ranked.length
    ? ranked
    : // Nothing matched — offer well-rated free options rather
      // than dead-ending. The caller labels these as general suggestions.
      [...courses]
        .sort((a, b) => Number(b.free) - Number(a.free) || b.rating - a.rating)
        .slice(0, limit);
}

/**
 * The openings Sarthi may mention are the ones it is handed — the live rows
 * from the database, fetched by the route that calls `answer()`. It used to
 * rank a sample catalogue of ninety openings that had never been posted,
 * and quote their salaries. Handed nothing, it says nothing is listed.
 */
function topOpenings(
  openings: Opportunity[],
  kind: "job" | "internship",
  tokens: string[],
  limit = 3,
) {
  const pool = openings.filter((o) => o.kind === kind);
  const ranked = pool
    .map((o) => ({
      o,
      score:
        overlap(tokens, `${o.title} ${o.skills.join(" ")}`, 5) +
        overlap(tokens, `${o.summary ?? ""} ${o.description ?? ""}`, 1.5) +
        overlap(tokens, `${o.location ?? ""} ${o.workMode}`, 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((r, _i, arr) => r.score >= Math.max(2.5, arr[0]!.score * 0.35))
    .map((r) => r.o);
  return ranked.length ? ranked : pool.slice(0, limit);
}

function topSchemes(tokens: string[], limit = 2) {
  const scored = schemes
    .map((s) => ({
      s,
      score:
        overlap(tokens, s.name, 3) + overlap(tokens, s.benefit) + overlap(tokens, s.eligibility),
    }))
    .sort((a, b) => b.score - a.score);
  return (scored[0]!.score > 0 ? scored : scored.slice(0, limit)).slice(0, limit).map((r) => r.s);
}

/* ── Answer builders ─────────────────────────────────────────────── */

const money = (c: (typeof courses)[number], t: Strings) => (c.free ? `**${t.free}**` : c.fees);

function courseAnswer(tokens: string[], t: Strings): string {
  const picks = topCourses(tokens);
  if (!picks.length) return t.nothingFound;
  const lines = picks.map((c, i) => {
    const org = orgById(c.orgId);
    return `${i + 1}. **${c.title}** — ${org?.name ?? ""}\n   ${t.duration}: ${c.duration} · ${t.fee}: ${money(c, t)} · ${c.mode} · ${c.city}, ${c.state}`;
  });
  // Only surface a category tagline when the query really is about that
  // category — a loose token match used to attach an unrelated one-liner.
  const cat = skillCategories.find(
    (k) =>
      overlap(tokens, k.name, 2) + overlap(tokens, k.skills.map((s) => s.title).join(" ")) >= 2,
  );
  const topical = hasTopicalMatch(tokens, [
    picks.map((c) => `${c.title} ${c.category} ${c.group}`).join(" "),
  ]);

  return [
    `### ${t.courses}`,
    topical ? "" : `_${t.nothingFound}_\n`,
    lines.join("\n"),
    cat ? `\n_${cat.tagline}_` : "",
    `\n${t.more("Courses")}`,
    t.askMore,
  ]
    .filter(Boolean)
    .join("\n");
}

function jobAnswer(tokens: string[], t: Strings, openings: Opportunity[]): string {
  const picks = topOpenings(openings, "job", tokens);
  if (!picks.length) return `${t.nothingFound}\n\n${t.more("Jobs")}`;
  const lines = picks.map((o, i) => {
    const where = o.location ?? o.workMode;
    return `${i + 1}. **${o.title}** — ${o.employer?.name ?? ""}\n   ${t.salary}: ${payLine(o) ?? "—"} · ${where} · ${o.workMode.replace("_", " ")}`;
  });
  const topical = hasTopicalMatch(tokens, [
    picks.map((o) => `${o.title} ${o.skills.join(" ")}`).join(" "),
  ]);
  return [
    `### ${t.jobs}`,
    topical ? "" : `_${t.nothingFound}_\n`,
    lines.join("\n"),
    `\n${t.more("Jobs")}`,
    t.askMore,
  ]
    .filter(Boolean)
    .join("\n");
}

function internshipAnswer(tokens: string[], t: Strings, openings: Opportunity[]): string {
  const picks = topOpenings(openings, "internship", tokens);
  if (!picks.length) return `${t.nothingFound}\n\n${t.more("Internships")}`;
  const lines = picks.map((o, i) => {
    const where = o.location ?? o.workMode;
    const weeks = o.durationWeeks ? `${o.durationWeeks} weeks` : "—";
    return `${i + 1}. **${o.title}** — ${o.employer?.name ?? ""}\n   ${t.stipend}: ${payLine(o) ?? "—"} · ${t.duration}: ${weeks} · ${where} · ${o.workMode.replace("_", " ")}`;
  });
  const topical = hasTopicalMatch(tokens, [
    picks.map((o) => `${o.title} ${o.skills.join(" ")}`).join(" "),
  ]);
  return [
    `### ${t.internships}`,
    topical ? "" : `_${t.nothingFound}_\n`,
    lines.join("\n"),
    `\n${t.more("Internships")}`,
    t.askMore,
  ]
    .filter(Boolean)
    .join("\n");
}

function schemeAnswer(tokens: string[], t: Strings): string {
  const picks = topSchemes(tokens);
  const blocks = picks.map(
    (s) =>
      `**${s.name}**\n- ${t.benefit}: ${s.benefit}\n- ${t.eligibility}: ${s.eligibility}\n- ${t.howToApply}: ${s.how}`,
  );
  return [`### ${t.schemes}`, blocks.join("\n\n"), `\n${t.more("Schemes")}`, t.askMore].join("\n");
}

function instituteAnswer(tokens: string[], t: Strings): string {
  const picks = organizations
    .filter((o) => o.type === "institute")
    .map((o) => ({
      o,
      score: overlap(tokens, o.name, 3) + overlap(tokens, o.location, 2) + o.rating,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.o);
  const lines = picks.map((o, i) => `${i + 1}. **${o.name}** — ${o.location} · ★ ${o.rating}`);
  return [`### ${t.institutes}`, lines.join("\n"), `\n${t.askMore}`].join("\n");
}

function skillGapAnswer(tokens: string[], t: Strings, openings: Opportunity[]): string {
  const target = topOpenings(openings, "job", tokens, 1)[0];
  // Search courses with the matched role's own vocabulary rather than the raw
  // question. "Analyze my skill gap for data entry" reduces to two weak tokens,
  // which was enough to surface an unrelated course; the role's title and skill
  // list is a far stronger query.
  const courseQuery = target ? tokenize(`${target.title} ${target.skills.join(" ")}`) : tokens;
  const picks = topCourses(courseQuery, 2);
  const needed = target ? target.skills : (picks[0]?.outcomes.slice(0, 4) ?? []);
  const body = needed.map((s) => `- ${s}`).join("\n");
  return [
    `### ${target ? target.title : t.courses}`,
    needed.length ? `**${t.eligibility}:**\n${body}` : t.nothingFound,
    picks.length
      ? `\n**${t.courses}:**\n${picks.map((c) => `- ${c.title} (${c.duration})`).join("\n")}`
      : `\n${t.more("Courses")}`,
    `\n${t.askMore}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function resumeAnswer(t: Strings): string {
  return [
    "### Resume checklist",
    "1. **One page.** Recruiters scan for ~20 seconds.",
    "2. **Lead with the trade**, not a career objective — e.g. *Electrician · NSQF Level 4 · 6 months shop-floor experience*.",
    "3. **Quantify.** _Serviced 15 machines a week_ beats _responsible for maintenance_.",
    "4. **List certifications with the issuing body** (PMKVY, NCVT, Sector Skill Council) and the year.",
    "5. **Add your district and whether you can relocate** — most shortlisting is location-first.",
    "6. **Skip** photo, marital status, and every school grade below Class 10.",
    `\n${t.askMore}`,
  ].join("\n");
}

function interviewAnswer(t: Strings): string {
  return [
    "### Interview prep",
    "**Almost always asked**",
    "- Walk me through what you did in your training project.",
    "- A time a machine or task failed — what did you do?",
    "- Which tools have you actually handled yourself?",
    "- Are you willing to do shifts, and can you reach the site daily?",
    "",
    "**How to answer:** name the situation, the action *you* took, and the result — in that order, in under a minute.",
    "",
    "**Ask them back:** shift pattern, who trains you in month one, and whether the certificate is NCVT-recognized.",
    `\n${t.askMore}`,
  ].join("\n");
}

function capabilitiesAnswer(t: Strings): string {
  return [
    `- ${t.swap ?? "SkillSwap — trade a skill you have for one you want"}`,
    `- ${t.courses}`,
    `- ${t.schemes}`,
    `- ${t.internships}`,
    `- ${t.jobs}`,
    "- Resume feedback & interview prep",
    `\n${t.askMore}`,
  ].join("\n");
}

/**
 * SkillSwap fallback.
 *
 * The live version of this answer runs in the browser, where the signed-in
 * session can actually query matches (see `src/lib/sarthi-actions.ts`). This
 * server-side reply is what a signed-out visitor gets, so it explains the idea
 * and points at the page rather than pretending to have searched.
 */
function skillswapAnswer(t: Strings): string {
  return [
    "**SkillSwap** pairs you with someone whose skills are the mirror image of yours — they teach what you want to learn, you teach what they want to learn. No money changes hands.",
    "",
    "To get matched:",
    "1. Add what you **can teach** and what you **want to learn** on your profile.",
    "2. Open **SkillSwap** to see ranked partners, scored on skill fit, goals, shared language, availability and format.",
    "3. Send a request. When they accept, a shared chat opens and the swap begins.",
    "",
    'Tell me something like *"I can teach Python and want to learn UI design"* and I\'ll set it up for you.',
    "",
    t.more("SkillSwap"),
  ].join("\n");
}

/* ── Public entry point ──────────────────────────────────────────── */

/**
 * Produce a grounded markdown answer for the latest user message.
 *
 * `openings` are the live jobs and internships, fetched by the caller (see
 * `cachedOpenings`); without them the job and internship answers say that
 * nothing is listed rather than reciting a sample.
 */
export function answer(
  question: string,
  language = "en",
  userName = "friend",
  openings: Opportunity[] = [],
): string {
  const t = stringsFor(language);
  const text = question.trim();
  if (!text) return t.greeting(userName);

  const tokens = tokenize(text);
  const intent = detectIntent(text);

  switch (intent) {
    case "greeting":
      return `${t.greeting(userName)}\n\n${capabilitiesAnswer(t)}`;
    case "capabilities":
      return capabilitiesAnswer(t);
    case "skillswap":
      return skillswapAnswer(t);
    case "scheme":
      return schemeAnswer(tokens, t);
    case "resume":
      return resumeAnswer(t);
    case "interview":
      return interviewAnswer(t);
    case "skillgap":
      return skillGapAnswer(tokens, t, openings);
    case "internship":
      return internshipAnswer(tokens, t, openings);
    case "job":
      return jobAnswer(tokens, t, openings);
    case "institute":
      return instituteAnswer(tokens, t);
    case "course":
    default:
      return courseAnswer(tokens, t);
  }
}
