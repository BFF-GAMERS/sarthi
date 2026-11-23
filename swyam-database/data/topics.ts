/** Extra content topics: skill categories, schemes and events. */

export interface NicheSkill {
  id: string;
  title: string;
  /** Key into the icon map on the skills page. */
  icon: string;
  description: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  demand: "Very high" | "High" | "Steady";
  salary: string;
  duration: string;
  /** What you can actually do once you have the skill. */
  competencies: string[];
  recommendedCourses: string[];
}

export interface SkillCategory {
  id: string;
  name: string;
  /** Short label used on card stickers. */
  short: string;
  tagline: string;
  skills: NicheSkill[];
}

export const skillCategories: SkillCategory[] = [
  {
    id: "programming",
    name: "Programming",
    short: "Code",
    tagline:
      "The foundation under every software role — pick one language, go deep, and the rest get easier.",
    skills: [
      {
        id: "python",
        title: "Python",
        icon: "code",
        description:
          "The most forgiving first language and the default choice for automation, data work and AI. Readable enough to learn quickly, deep enough to build a career on.",
        level: "Beginner",
        demand: "Very high",
        salary: "₹4.0 – 12.0 LPA",
        duration: "3 months",
        competencies: ["Core syntax", "Pandas & NumPy", "Automation scripting", "Flask / FastAPI"],
        recommendedCourses: [
          "Python for Absolute Beginners",
          "Automate Your Job with Python",
          "Data Analysis with Pandas",
        ],
      },
      {
        id: "java",
        title: "Java",
        icon: "coffee",
        description:
          "Still the backbone of banking, enterprise and Android systems in India. Verbose by design, which makes large codebases maintainable across big teams.",
        level: "Intermediate",
        demand: "High",
        salary: "₹4.5 – 14.0 LPA",
        duration: "4 months",
        competencies: ["OOP fundamentals", "Collections framework", "Spring Boot", "JUnit testing"],
        recommendedCourses: [
          "Java Fundamentals",
          "Spring Boot REST APIs",
          "Data Structures in Java",
        ],
      },
      {
        id: "cpp",
        title: "C++",
        icon: "cpu",
        description:
          "Where performance is non-negotiable — embedded systems, game engines and competitive programming. Teaches you what the machine is actually doing.",
        level: "Advanced",
        demand: "Steady",
        salary: "₹5.0 – 16.0 LPA",
        duration: "5 months",
        competencies: ["Pointers & memory", "STL containers", "Templates", "Concurrency"],
        recommendedCourses: ["Modern C++ Essentials", "DSA with C++", "Embedded C++ Basics"],
      },
      {
        id: "javascript",
        title: "JavaScript",
        icon: "braces",
        description:
          "The only language that runs natively in every browser, and increasingly on the server too. The fastest route from learning to a visible, shareable project.",
        level: "Beginner",
        demand: "Very high",
        salary: "₹3.6 – 11.0 LPA",
        duration: "3 months",
        competencies: ["DOM manipulation", "Async & promises", "ES2023 syntax", "Node.js basics"],
        recommendedCourses: [
          "JavaScript from Scratch",
          "Async JavaScript Deep Dive",
          "Build 5 Browser Projects",
        ],
      },
      {
        id: "typescript",
        title: "TypeScript",
        icon: "file-code",
        description:
          "JavaScript with a type system bolted on — now the default for serious frontend work. Catches at compile time the bugs that used to reach production.",
        level: "Intermediate",
        demand: "Very high",
        salary: "₹5.0 – 15.0 LPA",
        duration: "2 months",
        competencies: ["Type annotations", "Generics", "Utility types", "Typed React"],
        recommendedCourses: [
          "TypeScript for JavaScript Developers",
          "Typed React Patterns",
          "Advanced Generics",
        ],
      },
    ],
  },
  {
    id: "ai",
    name: "Artificial Intelligence",
    short: "AI",
    tagline:
      "The fastest-growing hiring category in India — and the one where a strong portfolio outruns a degree.",
    skills: [
      {
        id: "machine-learning",
        title: "Machine Learning",
        icon: "brain",
        description:
          "Train models that find patterns in data and predict outcomes. The groundwork every other AI specialization is built on top of.",
        level: "Intermediate",
        demand: "Very high",
        salary: "₹6.0 – 18.0 LPA",
        duration: "5 months",
        competencies: [
          "Regression & classification",
          "Feature engineering",
          "Scikit-learn",
          "Model evaluation",
        ],
        recommendedCourses: [
          "Machine Learning Foundations",
          "Applied ML with Scikit-learn",
          "Feature Engineering in Practice",
        ],
      },
      {
        id: "deep-learning",
        title: "Deep Learning",
        icon: "network",
        description:
          "Neural networks for problems too messy for classical methods — images, speech and language. Compute-hungry, but the results speak for themselves.",
        level: "Advanced",
        demand: "Very high",
        salary: "₹8.0 – 24.0 LPA",
        duration: "6 months",
        competencies: [
          "Neural network architecture",
          "PyTorch",
          "Transfer learning",
          "Model fine-tuning",
        ],
        recommendedCourses: [
          "Deep Learning with PyTorch",
          "Neural Networks from First Principles",
          "Fine-tuning Pretrained Models",
        ],
      },
      {
        id: "prompt-engineering",
        title: "Prompt Engineering",
        icon: "message-square-code",
        description:
          "Get reliable, repeatable output from large language models. The lowest barrier to entry in AI, and increasingly a line item in non-technical job descriptions too.",
        level: "Beginner",
        demand: "Very high",
        salary: "₹4.0 – 14.0 LPA",
        duration: "6 weeks",
        competencies: [
          "Prompt structure",
          "Few-shot examples",
          "Evaluation & testing",
          "RAG basics",
        ],
        recommendedCourses: [
          "Practical Prompt Engineering",
          "Building with LLM APIs",
          "Retrieval-Augmented Generation",
        ],
      },
      {
        id: "computer-vision",
        title: "Computer Vision",
        icon: "scan-eye",
        description:
          "Teach systems to interpret images and video — quality inspection on factory lines, document scanning, and safety monitoring on sites.",
        level: "Advanced",
        demand: "High",
        salary: "₹7.0 – 20.0 LPA",
        duration: "5 months",
        competencies: ["OpenCV", "Object detection", "Image segmentation", "Dataset labeling"],
        recommendedCourses: [
          "Computer Vision with OpenCV",
          "Object Detection in Production",
          "Image Data Pipelines",
        ],
      },
    ],
  },
  {
    id: "design",
    name: "Design",
    short: "Design",
    tagline:
      "A portfolio decides these roles, not a certificate. Four tools cover almost every brief you will be handed.",
    skills: [
      {
        id: "figma",
        title: "Figma",
        icon: "figma",
        description:
          "The industry standard for interface design and prototyping. Collaborative by default, which is why nearly every product team in India has standardized on it.",
        level: "Beginner",
        demand: "Very high",
        salary: "₹3.5 – 12.0 LPA",
        duration: "2 months",
        competencies: ["Auto-layout", "Components & variants", "Prototyping", "Developer handoff"],
        recommendedCourses: [
          "Figma Essentials",
          "Design Systems in Figma",
          "Prototyping for Handoff",
        ],
      },
      {
        id: "photoshop",
        title: "Photoshop",
        icon: "image",
        description:
          "Still unmatched for photo retouching, compositing and print-ready artwork. Essential for anyone working in advertising, e-commerce or photography.",
        level: "Intermediate",
        demand: "High",
        salary: "₹2.8 – 8.0 LPA",
        duration: "3 months",
        competencies: ["Layer masking", "Retouching", "Color correction", "Print export"],
        recommendedCourses: [
          "Photoshop for Designers",
          "Product Photo Retouching",
          "Compositing Masterclass",
        ],
      },
      {
        id: "illustrator",
        title: "Illustrator",
        icon: "pen-tool",
        description:
          "Vector work that scales from a business card to a hoarding without losing a pixel — logos, icons, packaging and illustration.",
        level: "Intermediate",
        demand: "High",
        salary: "₹3.0 – 9.0 LPA",
        duration: "3 months",
        competencies: ["Pen tool mastery", "Logo construction", "Typography", "Print preparation"],
        recommendedCourses: [
          "Illustrator Fundamentals",
          "Logo Design Practice",
          "Vector Illustration Studio",
        ],
      },
      {
        id: "canva",
        title: "Canva",
        icon: "layout-template",
        description:
          "The fastest way to produce presentable marketing collateral without formal design training. Widely expected in small-business and social media roles.",
        level: "Beginner",
        demand: "Steady",
        salary: "₹1.8 – 5.0 LPA",
        duration: "3 weeks",
        competencies: ["Template systems", "Brand kits", "Social formats", "Quick video edits"],
        recommendedCourses: [
          "Canva for Social Media",
          "Brand Kits in Canva",
          "Presentation Design Basics",
        ],
      },
    ],
  },
  {
    id: "business",
    name: "Business",
    short: "Business",
    tagline:
      "Commercial skills that transfer across every industry — and the ones most often missing from technical CVs.",
    skills: [
      {
        id: "marketing",
        title: "Marketing",
        icon: "megaphone",
        description:
          "Understand who the customer is, where they are, and what makes them act. Digital channels have made the whole discipline measurable.",
        level: "Beginner",
        demand: "Very high",
        salary: "₹3.0 – 12.0 LPA",
        duration: "3 months",
        competencies: ["Campaign planning", "SEO & content", "Paid ads", "Analytics"],
        recommendedCourses: [
          "Digital Marketing Foundations",
          "Performance Marketing",
          "Content & SEO Strategy",
        ],
      },
      {
        id: "sales",
        title: "Sales",
        icon: "handshake",
        description:
          "The most consistently available entry-level career in India, and one of the few where performance visibly beats pedigree.",
        level: "Beginner",
        demand: "Very high",
        salary: "₹2.4 – 10.0 LPA",
        duration: "2 months",
        competencies: ["Lead qualification", "Objection handling", "CRM discipline", "Negotiation"],
        recommendedCourses: [
          "Field Sales Fundamentals",
          "B2B Sales Playbook",
          "Negotiation Skills",
        ],
      },
      {
        id: "finance",
        title: "Finance",
        icon: "indian-rupee",
        description:
          "Read a balance sheet, build a budget, and understand where money actually goes. Useful in a finance role and indispensable in any leadership one.",
        level: "Intermediate",
        demand: "High",
        salary: "₹3.5 – 14.0 LPA",
        duration: "4 months",
        competencies: [
          "Accounting basics",
          "Excel modeling",
          "GST & compliance",
          "Financial analysis",
        ],
        recommendedCourses: [
          "Accounting for Non-Accountants",
          "Financial Modeling in Excel",
          "GST Compliance Essentials",
        ],
      },
      {
        id: "communication",
        title: "Communication",
        icon: "messages-square",
        description:
          "Write a clear email, run a useful meeting, and explain your work to someone outside your team. The skill most often cited in promotion decisions.",
        level: "Beginner",
        demand: "Very high",
        salary: "Applies across every role",
        duration: "6 weeks",
        competencies: [
          "Business writing",
          "Active listening",
          "Presentation structure",
          "Client email etiquette",
        ],
        recommendedCourses: [
          "Business Communication",
          "Writing That Gets Read",
          "Speaking to Stakeholders",
        ],
      },
    ],
  },
  {
    id: "soft-skills",
    name: "Soft Skills",
    short: "Human",
    tagline:
      "What decides whether you get promoted after you have been hired. Harder to teach, harder still to fake.",
    skills: [
      {
        id: "leadership",
        title: "Leadership",
        icon: "flag",
        description:
          "Set direction, make decisions with incomplete information, and take responsibility for outcomes you did not personally produce.",
        level: "Advanced",
        demand: "High",
        salary: "Unlocks senior bands",
        duration: "3 months",
        competencies: [
          "Delegation",
          "Feedback conversations",
          "Decision-making",
          "Conflict resolution",
        ],
        recommendedCourses: [
          "First-Time Managers",
          "Difficult Conversations",
          "Leading Without Authority",
        ],
      },
      {
        id: "teamwork",
        title: "Teamwork",
        icon: "users",
        description:
          "Do your part reliably, ask for help early, and make the people around you more effective. Every hiring manager screens for it.",
        level: "Beginner",
        demand: "Very high",
        salary: "Applies across every role",
        duration: "4 weeks",
        competencies: [
          "Collaboration tools",
          "Giving credit",
          "Handover discipline",
          "Cross-team coordination",
        ],
        recommendedCourses: [
          "Working in Teams",
          "Collaboration Tools at Work",
          "Remote Team Etiquette",
        ],
      },
      {
        id: "time-management",
        title: "Time Management",
        icon: "clock",
        description:
          "Decide what actually matters this week and protect the hours to do it. The difference between busy and productive.",
        level: "Beginner",
        demand: "Very high",
        salary: "Applies across every role",
        duration: "3 weeks",
        competencies: ["Prioritization", "Deep work blocks", "Realistic estimation", "Saying no"],
        recommendedCourses: [
          "Productivity Fundamentals",
          "Planning Your Week",
          "Estimating Work Honestly",
        ],
      },
      {
        id: "public-speaking",
        title: "Public Speaking",
        icon: "mic",
        description:
          "Hold a room, structure an argument, and survive the questions afterward. Compounding value in interviews, demos and client meetings.",
        level: "Intermediate",
        demand: "High",
        salary: "Applies across every role",
        duration: "6 weeks",
        competencies: ["Talk structure", "Stage presence", "Slide discipline", "Handling Q&A"],
        recommendedCourses: [
          "Public Speaking Bootcamp",
          "Presenting with Confidence",
          "Storytelling for Work",
        ],
      },
      {
        id: "problem-solving",
        title: "Problem Solving",
        icon: "lightbulb",
        description:
          "Break a vague complaint into a defined problem, test what you assume, and work toward a fix you can defend.",
        level: "Intermediate",
        demand: "Very high",
        salary: "Applies across every role",
        duration: "6 weeks",
        competencies: [
          "Root-cause analysis",
          "Structured thinking",
          "Hypothesis testing",
          "Trade-off reasoning",
        ],
        recommendedCourses: [
          "Structured Problem Solving",
          "Root Cause Analysis",
          "Critical Thinking at Work",
        ],
      },
    ],
  },
];

export const totalSkillCount = skillCategories.reduce((n, c) => n + c.skills.length, 0);

export interface Scheme {
  id: string;
  name: string;
  ministry: string;
  benefit: string;
  eligibility: string;
  how: string;
  /**
   * The government's own page for the scheme.
   *
   * Not decoration. Amounts, age bands and deadlines are changed by the
   * ministry, not by this file, and somebody deciding whether they qualify
   * for a stipend should be one click from the source rather than trusting a
   * summary that may be a year old.
   */
  official: string;
  /** Free to apply for and to use. Everything listed here currently is. */
  free: boolean;
}

export const schemes: Scheme[] = [
  {
    id: "sidh",
    name: "Skill India Digital Hub",
    ministry: "Ministry of Skill Development & Entrepreneurship",
    benefit:
      "Free online courses across hundreds of trades, a digital skill credential that employers can verify, and linked job and apprenticeship listings.",
    eligibility: "Any Indian citizen with an Aadhaar-linked mobile number. No age or income limit.",
    how: "Register with your mobile number on the Skill India Digital Hub and start any course free.",
    official: "https://www.skillindiadigital.gov.in/",
    free: true,
  },
  {
    id: "ncs",
    name: "National Career Service",
    ministry: "Ministry of Labour & Employment",
    benefit:
      "Free job matching, free career counseling, and free online courses. Also runs physical job fairs through Model Career Centers.",
    eligibility: "Open to every jobseeker. Employers register separately, also free.",
    how: "Register as a jobseeker on the NCS portal, or walk into any Model Career Center.",
    official: "https://www.ncs.gov.in/",
    free: true,
  },
  {
    id: "nats",
    name: "NATS — National Apprenticeship Training Scheme",
    ministry: "Ministry of Education",
    benefit:
      "One year of paid apprenticeship with an employer, with the government sharing the stipend, plus a certificate recognized across industry.",
    eligibility:
      "Graduates, diploma holders and 10+2 vocational passouts, generally within three years of finishing.",
    how: "Enroll on the NATS portal, upload your qualification, and apply to advertised placements.",
    official: "https://nats.education.gov.in/",
    free: true,
  },
  {
    id: "eshram",
    name: "e-SHRAM",
    ministry: "Ministry of Labour & Employment",
    benefit:
      "A Universal Account Number for unorganized workers, free accident insurance cover, and a single record used to route welfare schemes to you.",
    eligibility:
      "Unorganized workers aged 16 to 59 who are not members of EPFO or ESIC and not income-tax payers.",
    how: "Register free with Aadhaar and a linked mobile number at a CSC or on the e-SHRAM portal.",
    official: "https://eshram.gov.in/",
    free: true,
  },
  {
    id: "swayam-moe",
    name: "SWAYAM (Ministry of Education MOOCs)",
    ministry: "Ministry of Education",
    benefit:
      "Free university-level courses from IITs, IIMs and central universities, with optional credit transfer to your degree.",
    eligibility: "Open to anyone. Learning is free; only the optional proctored exam has a fee.",
    how: "Create an account on the SWAYAM portal and enroll in any running course.",
    official: "https://swayam.gov.in/",
    free: true,
  },
  {
    id: "nios",
    name: "NIOS — open schooling",
    ministry: "Ministry of Education",
    benefit:
      "Finish Class 10 or 12 while working, at your own pace, with a board certificate accepted for jobs and higher study.",
    eligibility:
      "Class 10 from age 14, Class 12 from age 15. No attendance requirement and no upper age limit.",
    how: "Register online with NIOS for the secondary or senior secondary stream and choose your exam session.",
    official: "https://www.nios.ac.in/",
    free: false,
  },
  {
    id: "skill-loan",
    name: "Skill Loan Scheme",
    ministry: "Ministry of Skill Development & Entrepreneurship / IBA",
    benefit:
      "Loans from ₹5,000 to ₹1.5 lakh for course fees at a recognized training institute. No collateral and no margin money.",
    eligibility:
      "Anyone admitted to a course run by an NSQF-aligned training partner, ITI, polytechnic or affiliated institute.",
    how: "Apply through the Vidya Lakshmi portal or directly at any scheduled bank with your admission letter.",
    official: "https://www.jansamarth.in/",
    free: true,
  },
  {
    id: "jss",
    name: "Jan Shikshan Sansthan",
    ministry: "Ministry of Skill Development & Entrepreneurship",
    benefit:
      "Free vocational training close to home — tailoring, beauty, food processing, repair trades — aimed at women and school dropouts.",
    eligibility:
      "Non-literate, neo-literate and school-dropout adults aged 15 to 45. Priority to women, SC/ST and OBC candidates.",
    how: "Walk into the Jan Shikshan Sansthan for your district and enroll in a running batch.",
    official: "https://jss.gov.in/",
    free: true,
  },
  {
    id: "cts-iti",
    name: "Craftsmen Training Scheme (ITIs)",
    ministry: "Directorate General of Training",
    benefit:
      "One or two years of hands-on trade training ending in a National Trade Certificate, the qualification most industrial employers ask for by name.",
    eligibility:
      "Usually Class 8 or 10 pass depending on the trade, minimum age 14. Government ITI fees are nominal.",
    how: "Apply in your state's ITI admission round, or through the DGT portal for national trades.",
    official: "https://dgt.gov.in/",
    free: false,
  },
  {
    id: "pm-internship",
    name: "PM Internship Scheme",
    ministry: "Ministry of Corporate Affairs",
    benefit:
      "A twelve-month internship at a large company with a monthly stipend, plus a one-time grant on joining.",
    eligibility:
      "Aged 21 to 24, not in full-time education or full-time work, family income within the scheme's limit.",
    how: "Register on the PM Internship portal, complete your profile, and apply to listed internships.",
    official: "https://pminternship.mca.gov.in/",
    free: true,
  },
  {
    id: "pmegp",
    name: "PMEGP",
    ministry: "Ministry of MSME / KVIC",
    benefit:
      "Subsidy of 15 to 35 percent of project cost to set up your own micro enterprise, with the bank funding the rest.",
    eligibility:
      "Aged 18 and above. Class 8 pass for projects above ₹10 lakh in manufacturing or ₹5 lakh in services.",
    how: "Apply on the KVIC PMEGP e-portal with your project report; the bank and the district committee decide.",
    official: "https://msme.gov.in/",
    free: true,
  },
  {
    id: "standup-india",
    name: "Stand-Up India",
    ministry: "Ministry of Finance",
    benefit:
      "Bank loans from ₹10 lakh to ₹1 crore to start a greenfield enterprise, with hand-holding support through the application.",
    eligibility:
      "SC, ST or women entrepreneurs aged 18 and above, for a first-time manufacturing, services or trading venture.",
    how: "Apply through the Stand-Up India portal or any scheduled commercial bank branch.",
    official: "https://www.standupmitra.in/",
    free: true,
  },
  {
    id: "pmkvy",
    name: "PMKVY 4.0",
    ministry: "Ministry of Skill Development & Entrepreneurship",
    benefit:
      "Free NSQF-aligned short-term training, assessment and certification, plus completion rewards.",
    eligibility: "Indian citizens aged 15–45 who are school/college dropouts or unemployed youth.",
    how: "Enroll through any PMKVY training center listed on the Skill India Digital Hub with Aadhaar and bank details.",
    official: "https://www.msde.gov.in/",
    free: true,
  },
  {
    id: "naps",
    name: "NAPS — National Apprenticeship Promotion Scheme",
    ministry: "Ministry of Skill Development & Entrepreneurship",
    benefit: "Government co-funds 25% of the stipend (up to ₹1,500/month) for apprentices.",
    eligibility: "Candidates above 14 years with minimum qualification set by the trade.",
    how: "Apply to any NAPS-tagged apprenticeship on the Internships page; the employer registers you.",
    official: "https://www.apprenticeshipindia.gov.in/",
    free: true,
  },
  {
    id: "mudra",
    name: "PM MUDRA Yojana",
    ministry: "Ministry of Finance",
    benefit:
      "Collateral-free loans: Shishu up to ₹50,000, Kishor up to ₹5 lakh, Tarun up to ₹10 lakh.",
    eligibility: "Non-farm micro enterprises and self-employed skilled workers.",
    how: "Apply at any scheduled bank, NBFC or MFI with your skill certificate and business plan.",
    official: "https://www.mudra.org.in/",
    free: true,
  },
  {
    id: "vishwakarma",
    name: "PM Vishwakarma",
    ministry: "Ministry of MSME",
    benefit:
      "Toolkit incentive of ₹15,000, skill training with stipend, and credit at concessional rates.",
    eligibility:
      "Artisans and craftspeople in 18 traditional trades — carpenter, blacksmith, potter, tailor and more.",
    how: "Register at a Common Service Center with Aadhaar; verification is done by your municipal body or gram panchayat.",
    official: "https://pmvishwakarma.gov.in/",
    free: true,
  },
  {
    id: "ddugky",
    name: "DDU-GKY",
    ministry: "Ministry of Rural Development",
    benefit: "Fully funded residential training with placement guarantee for rural youth.",
    eligibility: "Rural poor youth aged 15–35 (up to 45 for vulnerable groups).",
    how: "Enroll through an empanelled project implementing agency in your district.",
    official: "https://rural.gov.in/",
    free: true,
  },
  {
    id: "scholarship",
    name: "National Scholarship Portal",
    ministry: "Ministry of Education",
    benefit: "Pre- and post-matric scholarships covering fees and maintenance allowance.",
    eligibility: "Students meeting income and category criteria; varies by state scheme.",
    how: "Apply online on NSP with income, caste and institute verification each academic year.",
    official: "https://scholarships.gov.in/",
    free: true,
  },
];

const banner = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

export interface SkillEvent {
  id: string;
  title: string;
  type:
    | "Job fair"
    | "Workshop"
    | "Webinar"
    | "Competition"
    | "Summit"
    | "Meetup"
    | "Bootcamp"
    | "Masterclass";
  /** "12 Sep 2026": day, short English month, year. The Events page parses it to split past from upcoming. */
  date: string;
  time: string;
  /** City name, or "Online" for remote events. */
  city: string;
  /** Full venue line, or the platform for online events. */
  venue: string;
  online: boolean;
  /** Organising body. */
  host: string;
  detail: string;
  banner: string;
}

export const events: SkillEvent[] = [
  {
    id: "e1",
    title: "Rozgar Mela — Delhi NCR",
    type: "Job fair",
    date: "12 Sep 2026",
    time: "9:00 AM – 5:00 PM",
    city: "New Delhi",
    venue: "Pragati Maidan, Hall 7, New Delhi",
    online: false,
    host: "NSDC × स्वYAM",
    detail:
      "84 employers hiring for solar, CNC, logistics and retail roles. Bring five printed copies of your resume and a photo ID.",
    banner: banner("flagged/photo-1576485436509-a7d286952b65"),
  },
  {
    id: "e2",
    title: "Rooftop Solar Hands-on Bootcamp",
    type: "Workshop",
    date: "18 Sep 2026",
    time: "10:00 AM – 4:30 PM",
    city: "Pune",
    venue: "NSTI Pune Training Yard, Shivajinagar",
    online: false,
    host: "NSTI Pune",
    detail:
      "Two-day practical camp covering mounting, string wiring and inverter commissioning on live rigs. Safety gear provided.",
    banner: banner("photo-1569173675610-42c361a86e37"),
  },
  {
    id: "e3",
    title: "Cracking Your First Tech Interview",
    type: "Webinar",
    date: "24 Sep 2026",
    time: "7:00 PM – 8:30 PM",
    city: "Online",
    venue: "Zoom · link emailed on registration",
    online: true,
    host: "Tech Mahindra Foundation",
    detail:
      "Live mock interviews and resume teardowns with working hiring managers. Free to attend, registration required.",
    banner: banner("photo-1637589308599-3478cc55510d"),
  },
  {
    id: "e4",
    title: "IndiaSkills Regional Round",
    type: "Competition",
    date: "02 Oct 2026",
    time: "8:30 AM – 6:00 PM",
    city: "Bengaluru",
    venue: "Bangalore International Exhibition Center, Bengaluru",
    online: false,
    host: "NSDC",
    detail:
      "Compete across 26 trades. Regional winners advance to the national round and WorldSkills selection.",
    banner: banner("photo-1741437137939-e5d4b5a29be5"),
  },
  {
    id: "e5",
    title: "EV Diagnostics Masterclass",
    type: "Masterclass",
    date: "09 Oct 2026",
    time: "11:00 AM – 3:00 PM",
    city: "Chennai",
    venue: "Ather Skill Lab, Guindy Industrial Estate, Chennai",
    online: false,
    host: "Ather Skill Lab",
    detail:
      "Battery pack teardown, BMS log reading and a high-voltage safety drill on production vehicles.",
    banner: banner("photo-1604177091072-b7b677a077f6"),
  },
  {
    id: "e6",
    title: "Women in Trades Career Day",
    type: "Job fair",
    date: "15 Oct 2026",
    time: "10:00 AM – 4:00 PM",
    city: "Ahmedabad",
    venue: "Gujarat University Convention Center, Ahmedabad",
    online: false,
    host: "स्वYAM",
    detail:
      "Employers with women-first policies, creche support and documented safe-transport commitments.",
    banner: banner("photo-1742203106871-e38c00104c40"),
  },
  {
    id: "e7",
    title: "AI & Innovation Summit 2026",
    type: "Summit",
    date: "22 Oct 2026",
    time: "9:30 AM – 6:00 PM",
    city: "Hyderabad",
    venue: "HICC Novotel, HITEC City, Hyderabad",
    online: false,
    host: "NASSCOM × स्वYAM",
    detail:
      "A full-day summit on applied AI in Indian industry — keynotes, live product demos and a hiring lounge with 30+ AI teams.",
    banner: banner("photo-1656970694566-cb16426e46ee"),
  },
  {
    id: "e8",
    title: "Startup Networking Meetup",
    type: "Meetup",
    date: "29 Oct 2026",
    time: "6:00 PM – 9:00 PM",
    city: "Bengaluru",
    venue: "Third Wave Coffee, Koramangala 5th Block, Bengaluru",
    online: false,
    host: "BrandBaaja Digital",
    detail:
      "An informal evening for founders, early employees and people looking to join a startup. Two-minute intros, then open networking.",
    banner: banner("photo-1572521165329-b197f9ea3da6"),
  },
  {
    id: "e9",
    title: "Resume & LinkedIn Workshop",
    type: "Workshop",
    date: "05 Nov 2026",
    time: "5:00 PM – 7:00 PM",
    city: "Online",
    venue: "Google Meet · link emailed on registration",
    online: true,
    host: "स्वYAM Careers",
    detail:
      "Rewrite your resume live with a recruiter reviewing it. Covers ATS formatting, project write-ups and LinkedIn headlines that get replies.",
    banner: banner("photo-1741183397580-3b16cbf6995c"),
  },
  {
    id: "e10",
    title: "UI/UX Design Bootcamp",
    type: "Bootcamp",
    date: "12 Nov 2026",
    time: "10:00 AM – 5:00 PM",
    city: "Pune",
    venue: "Pixelwala Studio, Baner Road, Pune",
    online: false,
    host: "Pixelwala Design Studio",
    detail:
      "A one-day intensive taking a brief from research to a clickable Figma prototype. Laptops required; Figma accounts are free.",
    banner: banner("photo-1741275271679-3c72f5fc39df"),
  },
  {
    id: "e11",
    title: "Hackathon Weekend",
    type: "Competition",
    date: "21 Nov 2026",
    time: "48 hours · starts 9:00 AM",
    city: "Pune",
    venue: "Nexus Web Solutions Campus, Hinjawadi Phase 2, Pune",
    online: false,
    host: "Nexus Web Solutions",
    detail:
      "Build a working product in 48 hours around civic-tech problem statements. Teams of up to four; meals, Wi-Fi and mentors provided.",
    banner: banner("photo-1521401415461-83e7162b8e64"),
  },
  {
    id: "e12",
    title: "Digital Marketing Masterclass",
    type: "Masterclass",
    date: "28 Nov 2026",
    time: "3:00 PM – 6:00 PM",
    city: "Online",
    venue: "Zoom · recording shared with attendees",
    online: true,
    host: "BrandBaaja Digital",
    detail:
      "Live campaign teardowns across search and social, with real budgets and real numbers on screen. Bring a brand you want reviewed.",
    banner: banner("photo-1566112718365-4c8ccbedc3d9"),
  },
  {
    id: "e13",
    title: "Entrepreneurship Pitch Competition",
    type: "Competition",
    date: "06 Dec 2026",
    time: "10:00 AM – 4:00 PM",
    city: "Mumbai",
    venue: "IIT Bombay Incubation Centre, Powai, Mumbai",
    online: false,
    host: "स्वYAM × State Startup Cell",
    detail:
      "Pitch to a panel of investors and operators. Top three teams receive seed grants and six months of incubation support.",
    banner: banner("photo-1666718622041-368b70a1b087"),
  },
];
