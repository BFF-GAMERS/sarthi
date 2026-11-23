import { initialsAvatar } from "../lib/avatar";
import type { Opportunity } from "../lib/opportunities";
/*
 * Social proof in this file is zero on purpose.
 *
 * Ratings, review counts, enrolment and applicant numbers, placement rates
 * and named testimonials were all invented when this catalogue was seeded.
 * On a site where somebody chooses a trade to spend a year learning, an
 * invented "78% placed" is not decoration -- it is the thing they decide on.
 *
 * The fields are kept and set to zero rather than deleted, so the real
 * numbers can flow in from the database later and every screen has one
 * honest condition to render against: nothing yet.
 */

// Central mock data layer for स्वYAM.
// Swap these exports for Supabase/API calls when wiring a real backend.

export type Role = "student" | "recruiter" | "institute";

export interface Organization {
  id: string;
  name: string;
  type: "company" | "institute";
  logo: string;
  cover: string;
  about: string;
  gallery: string[];
  website: string;
  contact: string;
  location: string;
  rating: number;
  reviews: { author: string; avatar: string; rating: number; text: string }[];
  facilities: string[];
  placementRate: number;
  avgPackage: string;
  successStories: { name: string; avatar: string; story: string; role: string }[];
  trainers?: { name: string; avatar: string; expertise: string }[];
  certifications: string[];
  eligibility: string;
  teamSize?: string;
  culture?: string[];
}

export const COURSE_GROUPS = [
  "Technology",
  "Skilled Trades",
  "Business",
  "Creative Arts",
  "Healthcare",
  "Hospitality",
  "Competitive Exams",
] as const;

export type CourseGroup = (typeof COURSE_GROUPS)[number];

export interface Course {
  id: string;
  title: string;
  orgId: string;
  hero: string;
  gallery: string[];
  overview: string;
  outcomes: string[];
  duration: string;
  fees: string;
  scholarship: boolean;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  trainer: { name: string; avatar: string; bio: string };
  rating: number;
  reviewCount: number;
  reviews: { author: string; avatar: string; rating: number; text: string }[];
  curriculum: { module: string; topics: string[] }[];
  projects: string[];
  certification: string;
  placementAssistance: boolean;
  category: string;
  /** Top-level tab the course is filed under on the catalog page. */
  group: CourseGroup;
  mode: "Online" | "Offline" | "Hybrid";
  free: boolean;
  enrolled: number;
  state: string;
  city: string;
  /*
    Facts an institute can add. Every one is optional and rendered only when
    present — the course page says "ask the institute" for a missing one
    rather than guessing a date or a seat count that nobody gave it.
  */
  /** ISO date of the next cohort. */
  startsOn?: string;
  /** Seats in that cohort. */
  seats?: number;
  hoursPerWeek?: number;
  /** Language of instruction, e.g. "Hindi and English". */
  language?: string;
  prerequisites?: string[];
  equipment?: string[];
  /** The institute's own refund terms, if it has stated them. */
  refundPolicy?: string;
  faqs?: { q: string; a: string }[];
  /** When this listing was last checked or changed, ISO. */
  updatedAt?: string;
}

export interface Mentor {
  id: string;
  name: string;
  avatar: string;
  role: string;
  company: string;
  expertise: string[];
  mentees: number;
  rating: number;
}

export interface Post {
  id: string;
  author: string;
  avatar: string;
  role: string;
  time: string;
  text: string;
  image?: string;
  likes: number;
  comments: { author: string; avatar: string; text: string }[];
  shares: number;
  tag?: string;
}

export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  role: string;
  online: boolean;
  unread: number;
  messages: { fromMe: boolean; text: string; time: string; attachment?: string }[];
}

export interface AppNotification {
  id: string;
  type: "message" | "job" | "internship" | "course" | "interview" | "certificate" | "ai";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/* ── Employer factory ─────────────────────────────────────────────
   Small and mid-size employers hiring through the platform. The
   factory fills the long-form fields every org profile renders, so
   each entry below stays short and readable. */
interface EmployerSeed {
  id: string;
  name: string;
  location: string;
  about: string;
  website: string;
  contact: string;
  rating: number;
  placementRate: number;
  teamSize: string;
  culture: string[];
  facilities: string[];
  avgPackage: string;
  logo: string;
  cover: string;
  gallery: string[];
}

const employer = (s: EmployerSeed): Organization => ({
  type: "company",
  eligibility: "Open to any candidate who meets the role requirements. No registration fee, ever.",
  certifications: ["Verified employer on स्वYAM", "GST & PAN on record"],
  reviews: [],
  successStories: [],
  ...s,
});

export const organizations: Organization[] = [
  {
    id: "org-swayam",
    name: "\u0938\u094D\u0935YAM",
    type: "company",
    logo: initialsAvatar("Swayam"),
    cover: u("photo-1521737604893-d14cc237f11d"),
    about:
      "The platform itself. We build the skilling, SkillSwap and career tooling used across India \u2014 and we hire interns onto the same team that ships it. Every intern works on something that reaches real learners, not a sandbox project.",
    gallery: [
      u("photo-1522071820081-009f0129c71c", 900),
      u("photo-1531482615713-2afd69097998", 900),
      u("photo-1600880292203-757bb62b4baf", 900),
      u("photo-1517245386807-bb43f82c33c4", 900),
    ],
    website: "https://www.swyam.online",
    contact: "",
    location: "Remote \u00b7 Pan-India",
    rating: 0,
    reviews: [],
    facilities: [
      "Fully remote",
      "Paid stipend",
      "1:1 mentor",
      "Flexible around college hours",
      "Letter of recommendation on completion",
    ],
    placementRate: 0,
    avgPackage: "",
    successStories: [],
    certifications: ["Verified employer"],
    eligibility:
      "Open to students and self-taught learners alike. No degree requirement \u2014 we look at what you have built and what you are teaching on SkillSwap.",
    teamSize: "Small, remote, senior",
    culture: ["Remote-first", "Written over meetings", "Ship small, ship often"],
  },
  {
    id: "org-nsti-delhi",
    name: "NSTI Delhi — National Skill Training Institute",
    type: "institute",
    logo: initialsAvatar("NSTI Delhi — National Skill Training Institute"),
    cover: u("photo-1522661067900-ab829854a57f"),
    about:
      "A Government of India training institute under the Directorate General of Training, running NSQF-aligned vocational programs in electronics, IT, manufacturing and renewable energy.",
    gallery: [
      u("photo-1637589316488-6d4c41b335cd", 900),
      u("photo-1686624386665-4cd01b96d0f6", 900),
      u("photo-1742934027823-7ab9021e470e", 900),
      u("photo-1637589308599-3478cc55510d", 900),
    ],
    website: "https://nstidelhi.dgt.gov.in",
    contact: "Apply through स्वYAM",
    location: "Pusa Complex, New Delhi",
    rating: 0,
    reviews: [],
    facilities: [
      "Smart Classrooms",
      "IoT & Robotics Lab",
      "Free Wi-Fi Campus",
      "Hostel",
      "Placement Cell",
      "Library",
    ],
    placementRate: 0,
    avgPackage: "",
    successStories: [],
    trainers: [
      {
        name: "Dr. R. Venkatesh",
        avatar: initialsAvatar("Dr. R. Venkatesh"),
        expertise: "Industrial Automation · 18 yrs",
      },
      {
        name: "Meera Iyer",
        avatar: initialsAvatar("Meera Iyer"),
        expertise: "Electronics & IoT · 12 yrs",
      },
    ],
    certifications: ["NSQF Level 4-6", "NCVET Recognized", "ISO 9001:2015"],
    eligibility: "Class 10 / 12 pass or ITI equivalent. Age 16–35 for PMKVY-sponsored seats.",
  },
  {
    id: "org-techmahindra",
    name: "Tech Mahindra SMART Academy",
    type: "institute",
    logo: initialsAvatar("Tech Mahindra SMART Academy"),
    cover: u("photo-1577962917302-cd874c4e31d2"),
    about:
      "CSR-funded skill academies running certification programs in digital technologies and healthcare.",
    gallery: [
      u("flagged/photo-1576485436509-a7d286952b65", 900),
      u("photo-1666718623430-da207b018ea3", 900),
      u("photo-1572521165329-b197f9ea3da6", 900),
    ],
    website: "https://smart-academy.in",
    contact: "Apply through स्वYAM",
    location: "Hyderabad · Pune · Delhi NCR",
    rating: 0,
    reviews: [],
    facilities: ["Cloud Labs", "Design Studio", "Interview Prep Cell", "Cafeteria", "Scholarships"],
    placementRate: 0,
    avgPackage: "",
    successStories: [],
    trainers: [
      {
        name: "Sanjay Kapoor",
        avatar: initialsAvatar("Sanjay Kapoor"),
        expertise: "Cloud & DevOps · 15 yrs",
      },
    ],
    certifications: ["NASSCOM FutureSkills", "AWS Academy Partner", "NSDC Partner"],
    eligibility: "Graduates or final-year students. Basic computer literacy required.",
  },
  {
    id: "org-larsen",
    name: "L&T Construction Skills Training Institute",
    type: "institute",
    logo: initialsAvatar("L&T Construction Skills Training Institute"),
    cover: u("photo-1594233666755-d1cb282abd25"),
    about:
      "Residential construction-trade training in formwork, electrical wiring, welding and plumbing.",
    gallery: [
      u("photo-1524069290683-0457abfe42c3", 900),
      u("photo-1741591648726-125c0d39f2c8", 900),
    ],
    website: "https://lntcsti.com",
    contact: "Apply through स्वYAM",
    location: "Chennai · Ahmedabad · Panvel · Kolkata",
    rating: 0,
    reviews: [],
    facilities: ["Residential Campus", "Free Meals", "Practical Yards", "Safety Training Ground"],
    placementRate: 0,
    avgPackage: "",
    successStories: [],
    trainers: [
      {
        name: "B. Rajan",
        avatar: initialsAvatar("B. Rajan"),
        expertise: "Formwork & Scaffolding · 22 yrs",
      },
    ],
    certifications: ["NSQF Aligned", "CIDC Certified"],
    eligibility: "Class 8 pass, age 18–30. Rural and economically weaker sections prioritized.",
  },
  {
    id: "org-zomato",
    name: "Zomato",
    type: "company",
    logo: initialsAvatar("Zomato"),
    cover: u("photo-1704433725206-d447f91447e6"),
    about:
      "A food delivery platform that hires across operations, logistics and engineering, and runs apprenticeships under NAPS.",
    gallery: [
      u("photo-1666718622024-dc6bdc808bda", 900),
      u("photo-1666718622041-368b70a1b087", 900),
      u("photo-1666718621307-1e864744cfef", 900),
    ],
    website: "https://zomato.com/careers",
    contact: "Apply through स्वYAM",
    location: "Gurugram, Haryana",
    rating: 0,
    reviews: [],
    facilities: ["Cafeteria", "Gym", "Flexible Hours", "Health Insurance"],
    placementRate: 0,
    avgPackage: "",
    successStories: [],
    certifications: ["NAPS Registered Employer"],
    eligibility: "",
    teamSize: "5,000+ employees",
    culture: ["Ownership-first", "Move fast", "Customer obsession", "Flat hierarchy"],
  },
  {
    id: "org-tatapower",
    name: "Tata Power Renewables",
    type: "company",
    logo: initialsAvatar("Tata Power Renewables"),
    cover: u("photo-1569173675610-42c361a86e37"),
    about:
      "A renewable energy company that hires solar technicians, electrical engineers and O&M specialists, with apprentice-to-hire pathways.",
    gallery: [
      u("photo-1514392181188-8f5d54262fa5", 900),
      u("photo-1741591648176-5c759ca268b8", 900),
    ],
    website: "https://tatapower.com/careers",
    contact: "Apply through स्वYAM",
    location: "Mumbai · Pan-India sites",
    rating: 0,
    reviews: [],
    facilities: ["Site Accommodation", "Safety Gear Provided", "Medical Cover", "PF & Gratuity"],
    placementRate: 0,
    avgPackage: "",
    successStories: [],
    certifications: [],
    eligibility: "",
    teamSize: "12,000+ employees",
    culture: ["Safety first", "Sustainability", "Integrity", "Care for communities"],
  },
  {
    id: "org-bharatprecision",
    name: "Bharat Precision Components",
    type: "company",
    logo: initialsAvatar("Bharat Precision Components"),
    cover: u("photo-1741437137939-e5d4b5a29be5"),
    about:
      "Tier-1 auto component manufacturer supplying precision machined parts to India's largest OEMs. Our Pune and Chakan plants run 60+ CNC turning and machining centers, and we hire NSQF-certified operators directly from training institutes.",
    gallery: [
      u("photo-1604177091072-b7b677a077f6", 900),
      u("photo-1742280925364-82d23a1da08b", 900),
      u("photo-1742934027823-7ab9021e470e", 900),
    ],
    website: "",
    contact: "",
    location: "Pune & Chakan, Maharashtra",
    rating: 0,
    reviews: [],
    facilities: [
      "Subsidized Canteen",
      "Transport Facility",
      "Safety Gear Provided",
      "On-site Medical Room",
      "Skill Upgrade Sponsorship",
    ],
    placementRate: 0,
    avgPackage: "",
    successStories: [],
    certifications: ["IATF 16949:2016", "ISO 14001", "NAPS Registered Employer"],
    eligibility: "",
    teamSize: "900+ employees",
    culture: ["Quality obsession", "Safety first", "Shop-floor respect", "Continuous improvement"],
  },
  employer({
    id: "org-vidya-tutors",
    name: "Vidya Home Tutors",
    location: "Lucknow, Uttar Pradesh",
    about:
      "A tutoring network matching school students across Lucknow with subject teachers for home and online batches. Tutors set their own slots and are paid monthly per batch.",
    website: "vidyahometutors.in",
    contact: "careers@vidyahometutors.in",
    rating: 0,
    placementRate: 0,
    teamSize: "120+ tutors",
    culture: ["Flexible hours", "Paid monthly", "Teach close to home"],
    facilities: [
      "Batch allocation support",
      "Study material provided",
      "Parent coordination handled",
    ],
    avgPackage: "",
    logo: u("photo-1637589316488-6d4c41b335cd", 200),
    cover: u("photo-1569173675610-42c361a86e37"),
    gallery: [
      u("photo-1637589316488-6d4c41b335cd", 800),
      u("photo-1569173675610-42c361a86e37", 800),
    ],
  }),
  employer({
    id: "org-aarogya-clinic",
    name: "Aarogya Multispeciality Clinic",
    location: "Pune, Maharashtra",
    about:
      "A 30-bed neighborhood clinic with OPD, diagnostics and pharmacy under one roof. Front-office and support staff are hired locally and trained in-house.",
    website: "aarogyaclinic.in",
    contact: "hr@aarogyaclinic.in",
    rating: 0,
    placementRate: 0,
    teamSize: "60–80 staff",
    culture: ["Fixed shifts", "ESI & PF from day one", "Uniform provided"],
    facilities: ["Staff canteen", "On-site training", "Annual health check"],
    avgPackage: "",
    logo: u("photo-1666718623430-da207b018ea3", 200),
    cover: u("photo-1666718623429-4d0fe8a1662c"),
    gallery: [u("photo-1666718623430-da207b018ea3", 800)],
  }),
  employer({
    id: "org-sahyog-services",
    name: "Sahyog Business Services",
    location: "Jaipur, Rajasthan",
    about:
      "A back-office services firm handling data entry, document digitization and record verification for banks, insurers and state departments.",
    website: "sahyogservices.in",
    contact: "jobs@sahyogservices.in",
    rating: 0,
    placementRate: 0,
    teamSize: "200+ employees",
    culture: ["Day shift only", "Overtime paid", "Quiet workspace"],
    facilities: ["Air-conditioned floor", "Typing training for freshers", "Cab for late shifts"],
    avgPackage: "",
    logo: u("photo-1577962917302-cd874c4e31d2", 200),
    cover: u("photo-1666718621307-1e864744cfef"),
    gallery: [u("photo-1577962917302-cd874c4e31d2", 800)],
  }),
  employer({
    id: "org-greenmart",
    name: "Greenmart Supermarket",
    location: "Ahmedabad, Gujarat",
    about:
      "A neighborhood supermarket chain with 14 stores across Ahmedabad, hiring floor, billing and stock staff from the surrounding localities.",
    website: "greenmart.co.in",
    contact: "stores@greenmart.co.in",
    rating: 0,
    placementRate: 0,
    teamSize: "450+ across stores",
    culture: ["Work near home", "Staff discount", "Rotational weekly off"],
    facilities: ["Uniform provided", "Staff room", "Festival bonus"],
    avgPackage: "",
    logo: u("photo-1704433725206-d447f91447e6", 200),
    cover: u("photo-1742280925364-82d23a1da08b"),
    gallery: [u("photo-1704433725206-d447f91447e6", 800)],
  }),
  employer({
    id: "org-brew-corner",
    name: "Brew Corner Cafe",
    location: "Bengaluru, Karnataka",
    about:
      "An independent cafe group running six outlets across Bengaluru. Shifts are short and stackable, which suits students and part-time candidates.",
    website: "brewcorner.in",
    contact: "hiring@brewcorner.in",
    rating: 0,
    placementRate: 0,
    teamSize: "90+ staff",
    culture: ["Split shifts available", "Tips shared equally", "Free staff meal"],
    facilities: ["Barista training", "Uniform provided", "Flexible weekly off"],
    avgPackage: "",
    logo: u("photo-1742203106871-e38c00104c40", 200),
    cover: u("photo-1741183396027-543ebe665c5b"),
    gallery: [u("photo-1742203106871-e38c00104c40", 800)],
  }),
  employer({
    id: "org-suraksha-advisors",
    name: "Suraksha Insurance Advisors",
    location: "Mumbai, Maharashtra",
    about:
      "A licensed insurance advisory firm selling health and term policies across Mumbai. Field executives work assigned pin codes on a fixed base plus incentives.",
    website: "surakshaadvisors.in",
    contact: "talent@surakshaadvisors.in",
    rating: 0,
    placementRate: 0,
    teamSize: "150+ advisors",
    culture: ["Fixed base + incentive", "Territory ownership", "Weekly targets"],
    facilities: ["IRDAI certification sponsored", "Travel allowance", "Sales training"],
    avgPackage: "",
    logo: u("photo-1742280924174-02fce8662acb", 200),
    cover: u("photo-1666718622537-6748ca5322e2"),
    gallery: [u("photo-1742280924174-02fce8662acb", 800)],
  }),
  employer({
    id: "org-meridian-corp",
    name: "Meridian Corporate Services",
    location: "New Delhi, Delhi",
    about:
      "A corporate services company providing accounting, compliance and administrative support to small and mid-size businesses. Office roles have clear progression.",
    website: "meridiancorp.in",
    contact: "careers@meridiancorp.in",
    rating: 0,
    placementRate: 0,
    teamSize: "80–100 employees",
    culture: ["Five-day week", "Structured reviews", "Learning budget"],
    facilities: ["Metro-connected office", "PF & gratuity", "Paid leave"],
    avgPackage: "",
    logo: u("photo-1637589308599-3478cc55510d", 200),
    cover: u("flagged/photo-1576485436509-a7d286952b65"),
    gallery: [u("photo-1637589308599-3478cc55510d", 800)],
  }),
  employer({
    id: "org-pixelwala",
    name: "Pixelwala Design Studio",
    location: "Remote-first · Bengaluru, Karnataka",
    about:
      "A brand and product design studio working with Indian D2C and SaaS companies. The team is remote-first with an optional Bengaluru studio.",
    website: "pixelwala.design",
    contact: "hello@pixelwala.design",
    rating: 0,
    placementRate: 0,
    teamSize: "25–40 designers",
    culture: ["Remote-first", "Portfolio over pedigree", "Async design reviews"],
    facilities: ["Home-office stipend", "Figma & Adobe licenses", "Quarterly design offsite"],
    avgPackage: "",
    logo: u("photo-1741275271679-3c72f5fc39df", 200),
    cover: u("photo-1741591645560-938e091848f2"),
    gallery: [u("photo-1741275271679-3c72f5fc39df", 800)],
  }),
  employer({
    id: "org-reelworks",
    name: "Reelworks Media",
    location: "Mumbai, Maharashtra",
    about:
      "A video production house making short-form content, advertisements and documentary work for brands and streaming platforms.",
    website: "reelworks.media",
    contact: "jobs@reelworks.media",
    rating: 0,
    placementRate: 0,
    teamSize: "40–60 crew",
    culture: ["Project-based teams", "Credit on every film", "Hybrid edit weeks"],
    facilities: ["Edit suites with color grading", "Equipment library", "Mentored assists"],
    avgPackage: "",
    logo: u("photo-1748944078380-3d12ffee7378", 200),
    cover: u("photo-1742203101775-d2344f8ecd3d"),
    gallery: [u("photo-1748944078380-3d12ffee7378", 800)],
  }),
  employer({
    id: "org-brandbaaja",
    name: "BrandBaaja Digital",
    location: "Bengaluru, Karnataka",
    about:
      "A digital marketing agency running social, performance and content campaigns for consumer brands across India.",
    website: "brandbaaja.in",
    contact: "careers@brandbaaja.in",
    rating: 0,
    placementRate: 0,
    teamSize: "70–90 employees",
    culture: ["Hybrid weeks", "Own your accounts", "Fast feedback loops"],
    facilities: ["Paid certifications", "Creative asset library", "A mentor per pod"],
    avgPackage: "",
    logo: u("photo-1566112718365-4c8ccbedc3d9", 200),
    cover: u("photo-1572521165329-b197f9ea3da6"),
    gallery: [u("photo-1566112718365-4c8ccbedc3d9", 800)],
  }),
  employer({
    id: "org-inkwell",
    name: "Inkwell Content Labs",
    location: "Remote · Registered in Pune, Maharashtra",
    about:
      "A content studio producing long-form articles, newsletters and product documentation for technology and education clients.",
    website: "inkwelllabs.in",
    contact: "write@inkwelllabs.in",
    rating: 0,
    placementRate: 0,
    teamSize: "20–35 writers & editors",
    culture: ["Fully remote", "Editor-led feedback", "Byline on published work"],
    facilities: ["Research tool access", "Flexible deadlines", "Paid upskilling"],
    avgPackage: "",
    logo: u("photo-1741183397580-3b16cbf6995c", 200),
    cover: u("photo-1666718623430-da207b018ea3"),
    gallery: [u("photo-1741183397580-3b16cbf6995c", 800)],
  }),
  employer({
    id: "org-nexus-web",
    name: "Nexus Web Solutions",
    location: "Pune, Maharashtra",
    about:
      "A product engineering company building web and mobile applications for logistics, fintech and healthcare clients.",
    website: "nexusweb.in",
    contact: "engineering@nexusweb.in",
    rating: 0,
    placementRate: 0,
    teamSize: "120–160 engineers",
    culture: ["Code review culture", "Hybrid or fully remote", "Ship every sprint"],
    facilities: ["Paid cloud certifications", "Internal tech talks", "Machine of your choice"],
    avgPackage: "",
    logo: u("photo-1521401415461-83e7162b8e64", 200),
    cover: u("photo-1571260899304-425eee4c7efc"),
    gallery: [u("photo-1521401415461-83e7162b8e64", 800)],
  }),
  employer({
    id: "org-opendesk",
    name: "OpenDesk Freelance Network",
    location: "Remote · Pan-India",
    about:
      "A vetted freelance marketplace matching independent designers, writers and developers with short-term client briefs. Payment is milestone-based and escrow-protected.",
    website: "opendesk.work",
    contact: "support@opendesk.work",
    rating: 0,
    placementRate: 0,
    teamSize: "3,000+ freelancers",
    culture: ["Choose your own briefs", "Escrow-protected payouts", "Rate your clients"],
    facilities: ["Milestone escrow", "Dispute resolution", "Free portfolio hosting"],
    avgPackage: "",
    logo: u("photo-1666718622041-368b70a1b087", 200),
    cover: u("photo-1741183397580-3b16cbf6995c"),
    gallery: [u("photo-1666718622041-368b70a1b087", 800)],
  }),
  employer({
    id: "org-shubh-moments",
    name: "Shubh Moments Photography",
    location: "Chennai, Tamil Nadu",
    about:
      "A wedding and event photography studio covering shoots across Tamil Nadu. Photographers are booked per event with equipment provided.",
    website: "shubhmoments.in",
    contact: "book@shubhmoments.in",
    rating: 0,
    placementRate: 0,
    teamSize: "30+ photographers",
    culture: ["Per-event pay", "Weekend-heavy calendar", "Portfolio building"],
    facilities: ["Camera & lens library", "Travel reimbursed", "Post-processing team"],
    avgPackage: "",
    logo: u("photo-1594233666755-d1cb282abd25", 200),
    cover: u("photo-1524069290683-0457abfe42c3"),
    gallery: [u("photo-1594233666755-d1cb282abd25", 800)],
  }),
  employer({
    id: "org-utsav-events",
    name: "Utsav Event Managers",
    location: "Kolkata, West Bengal",
    about:
      "An event management company handling weddings, corporate offsites and exhibitions. Event assistants are hired per event and paid the same week.",
    website: "utsavevents.in",
    contact: "crew@utsavevents.in",
    rating: 0,
    placementRate: 0,
    teamSize: "50 core staff + event crew",
    culture: ["Per-event pay", "Work in your own city", "Quick payouts"],
    facilities: ["Meals on event days", "Travel arranged", "Crew uniform"],
    avgPackage: "",
    logo: u("photo-1571260899304-425eee4c7efc", 200),
    cover: u("photo-1704433725206-d447f91447e6"),
    gallery: [u("photo-1571260899304-425eee4c7efc", 800)],
  }),
  employer({
    id: "org-quickship",
    name: "QuickShip Logistics",
    location: "Delhi NCR",
    about:
      "A warehousing and last-mile logistics operator running fulfillment centers across NCR with flexible part-time shifts.",
    website: "quickship.in",
    contact: "shifts@quickship.in",
    rating: 0,
    placementRate: 0,
    teamSize: "600+ across centers",
    culture: ["Pick your own shift", "Weekly payout", "Work close to home"],
    facilities: ["Shift meal", "Safety gear provided", "Pick-up from metro station"],
    avgPackage: "",
    logo: u("photo-1741437137939-e5d4b5a29be5", 200),
    cover: u("photo-1604177091072-b7b677a077f6"),
    gallery: [u("photo-1741437137939-e5d4b5a29be5", 800)],
  }),
];

/* ── Course catalog ───────────────────────────────────────────────
   The factory fills the long-form fields the course detail page
   renders, so each entry below stays focused on what differs. */
type CourseSeed = Omit<Course, "gallery" | "reviews" | "enrolled" | "scholarship"> &
  Partial<Pick<Course, "gallery" | "reviews" | "enrolled" | "scholarship">>;

const mkCourse = (s: CourseSeed): Course => ({
  gallery: [s.hero],
  scholarship: s.free,
  enrolled: 0,
  reviews: [],
  ...s,
});

export const courses: Course[] = [
  mkCourse({
    id: "course-prompt-engineering",
    title: "Prompt Engineering for Generative AI",
    orgId: "org-techmahindra",
    hero: u("photo-1737641624486-7846df8528dc"),
    overview:
      "Get reliable, repeatable output from large language models instead of hoping for a good answer. You will learn prompt structure, evaluation and retrieval, then ship a working AI assistant of your own.",
    outcomes: [
      "Write structured prompts that produce consistent output",
      "Evaluate and compare model responses against a test set",
      "Build a retrieval-augmented assistant over your own documents",
      "Estimate and control API token costs",
    ],
    duration: "6 weeks · 8 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Ananya Rao",
      avatar: initialsAvatar("Ananya Rao"),
      bio: "Applied AI lead with six years building LLM features for Indian fintech and edtech products.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Foundations",
        topics: ["How LLMs generate text", "Tokens and context windows", "Zero-shot vs few-shot"],
      },
      {
        module: "Structured prompting",
        topics: ["Role and task framing", "Output schemas", "Chain-of-thought patterns"],
      },
      {
        module: "Evaluation",
        topics: ["Building a test set", "Scoring rubrics", "Regression testing prompts"],
      },
      {
        module: "Building with APIs",
        topics: ["Calling model APIs", "Retrieval-augmented generation", "Cost control"],
      },
    ],
    projects: [
      "A domain-specific FAQ assistant",
      "A prompt evaluation harness",
      "A resume-review bot",
    ],
    certification: "स्वYAM — Generative AI Practitioner",
    placementAssistance: true,
    category: "IT & Software",
    group: "Technology",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Telangana",
    city: "Online",
  }),
  mkCourse({
    // Content lives in db/courses/10_python-programming-for-beginners.sql. Written and tested by the
    // स्वYAM team: there is no named trainer to credit, so none is invented.
    id: "course-python-programming",
    title: "Python Programming for Beginners",
    orgId: "org-swayam",
    hero: u("photo-1526379095098-d400fd0bf935"),
    overview:
      "Learn Python from your very first line of code to small real projects. Every lesson shows working code with the output it really prints, and each module ends in a project you build yourself.",
    outcomes: [
      "Write, run and debug Python programs on a computer or a phone",
      "Use loops, lists, dictionaries and functions to solve everyday problems",
      "Read and write files, CSV and JSON, and handle errors cleanly",
      "Build and share small projects such as a GST bill and a shop stock manager",
    ],
    duration: "About 16 hours · self-paced",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "स्वYAM Learning Team",
      avatar: initialsAvatar("Swayam"),
      bio: "Written and tested by the स्वYAM team. Every code example in the course was run, and the output you see is the output it printed.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Getting Started with Python",
        topics: ["Your first program", "Variables and types", "Input, comments and errors"],
      },
      {
        module: "Making Decisions and Repeating Work",
        topics: ["if, elif and else", "while and for loops", "break and continue"],
      },
      {
        module: "Working with Collections of Data",
        topics: ["Strings in depth", "Lists and comprehensions", "Tuples, sets and dictionaries"],
      },
      {
        module: "Functions and Modules",
        topics: ["Writing functions", "Scope", "math, random, datetime and pip"],
      },
      {
        module: "Files, Errors and Objects",
        topics: ["Text and CSV files", "try and except", "Classes and inheritance"],
      },
      {
        module: "Real Projects and Next Steps",
        topics: ["JSON and automation", "A first look at pandas", "Git, GitHub and a portfolio"],
      },
    ],
    projects: [
      "A mobile recharge bill",
      "A class marks report",
      "A shop bill calculator with GST",
      "An expense tracker saved to CSV",
      "A kirana shop stock manager",
    ],
    certification: "स्वYAM — Python Programming (Beginner)",
    placementAssistance: false,
    category: "IT & Software",
    group: "Technology",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Haryana",
    city: "Online",
  }),
  mkCourse({
    id: "course-full-stack",
    title: "Full Stack Web Development",
    orgId: "org-nexus-web",
    hero: u("photo-1534665482403-a909d0d97c67"),
    overview:
      "Go from a blank editor to a deployed application. Frontend with React, a real API and database behind it, authentication that works, and a deploy pipeline you understand end to end.",
    outcomes: [
      "Build responsive interfaces with React and TypeScript",
      "Design and expose a REST API backed by a database",
      "Implement authentication and protected routes",
      "Deploy and monitor a production application",
    ],
    duration: "6 months · 12 hrs/week",
    fees: "₹2,999",
    difficulty: "Intermediate",
    trainer: {
      name: "Rahul Menon",
      avatar: initialsAvatar("Rahul Menon"),
      bio: "Staff engineer who has shipped logistics and fintech products used by millions of users.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Frontend core",
        topics: [
          "HTML, CSS & responsive layout",
          "JavaScript essentials",
          "React components & state",
        ],
      },
      {
        module: "TypeScript & tooling",
        topics: ["Types and generics", "Build tools", "Git workflows"],
      },
      {
        module: "Backend",
        topics: ["REST API design", "PostgreSQL & queries", "Authentication & sessions"],
      },
      { module: "Ship it", topics: ["Testing", "CI/CD pipelines", "Deployment & monitoring"] },
    ],
    projects: [
      "A job board with search and auth",
      "A REST API with role-based access",
      "A deployed portfolio site",
    ],
    certification: "NSQF Level 5 — Full Stack Developer",
    placementAssistance: true,
    category: "IT & Software",
    group: "Technology",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Maharashtra",
    city: "Pune",
  }),
  mkCourse({
    id: "course-uiux-figma",
    title: "UI/UX Design with Figma",
    orgId: "org-pixelwala",
    hero: u("photo-1648109941110-d30f859426ea"),
    overview:
      "Learn the craft behind interfaces people can actually use — research, wireframes, visual hierarchy and a design system — all built in Figma and handed off the way engineering teams expect.",
    outcomes: [
      "Run lightweight user research and turn it into decisions",
      "Build reusable components with auto-layout and variants",
      "Prototype flows and test them with real users",
      "Prepare a developer-ready handoff",
    ],
    duration: "3 months · 8 hrs/week",
    fees: "₹2,999",
    difficulty: "Beginner",
    trainer: {
      name: "Sanya Kapoor",
      avatar: initialsAvatar("Sanya Kapoor"),
      bio: "Product designer who has built design systems for D2C and SaaS teams across India.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Design foundations",
        topics: ["Layout & spacing", "Typography", "Color and contrast"],
      },
      { module: "Figma craft", topics: ["Auto-layout", "Components & variants", "Design tokens"] },
      { module: "UX process", topics: ["User interviews", "Wireframing", "Usability testing"] },
      { module: "Handoff", topics: ["Prototyping", "Spec annotation", "Working with developers"] },
    ],
    projects: ["A mobile app redesign", "A reusable design system", "A tested checkout flow"],
    certification: "स्वYAM — Certified UI/UX Designer",
    placementAssistance: true,
    category: "Design & Creative",
    group: "Technology",
    mode: "Online",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Online",
  }),
  mkCourse({
    id: "course-data-analytics",
    title: "Data Analytics (Excel, SQL & Power BI)",
    orgId: "org-techmahindra",
    hero: u("photo-1762558978967-709b17a00415"),
    overview:
      "The three tools most analyst job descriptions actually ask for. Clean messy data in Excel, query it properly in SQL, and build dashboards in Power BI that someone will use every morning.",
    outcomes: [
      "Clean and model data with advanced Excel functions",
      "Write SQL joins, aggregations and window functions",
      "Build interactive Power BI dashboards",
      "Present findings to a non-technical audience",
    ],
    duration: "4 months · 10 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Vikram Desai",
      avatar: initialsAvatar("Vikram Desai"),
      bio: "Analytics lead who has built reporting for retail and logistics operations teams.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Excel for analysts",
        topics: ["Lookups & pivot tables", "Power Query", "Data cleaning"],
      },
      { module: "SQL", topics: ["SELECT & filtering", "Joins", "Window functions"] },
      { module: "Power BI", topics: ["Data modeling", "DAX basics", "Dashboard design"] },
      {
        module: "Communicating results",
        topics: ["Chart selection", "Executive summaries", "Storytelling with data"],
      },
    ],
    projects: [
      "A sales performance dashboard",
      "A SQL analysis of delivery delays",
      "A cleaned survey dataset",
    ],
    certification: "NSQF Level 4 — Data Analytics Associate",
    placementAssistance: true,
    category: "Data & Operations",
    group: "Technology",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Telangana",
    city: "Online",
  }),
  mkCourse({
    id: "course-digital-marketing",
    title: "Digital Marketing & SEO",
    orgId: "org-brandbaaja",
    hero: u("photo-1599658880436-c61792e70672"),
    overview:
      "Plan campaigns that can be measured. Search, content, paid ads and analytics — taught on live brand accounts so you leave with numbers you can point at, not just theory.",
    outcomes: [
      "Run keyword research and on-page SEO",
      "Plan and launch paid campaigns on Meta and Google",
      "Build a content calendar that ranks",
      "Report performance against real business goals",
    ],
    duration: "3 months · 8 hrs/week",
    fees: "₹2,499",
    difficulty: "Beginner",
    trainer: {
      name: "Neha Bhatt",
      avatar: initialsAvatar("Neha Bhatt"),
      bio: "Performance marketer managing paid budgets for consumer brands across India.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Foundations", topics: ["Marketing funnels", "Audience research", "Positioning"] },
      {
        module: "SEO",
        topics: ["Keyword research", "On-page optimization", "Technical SEO basics"],
      },
      { module: "Paid media", topics: ["Meta Ads", "Google Ads", "Budget & bidding"] },
      { module: "Measurement", topics: ["GA4", "Attribution", "Reporting to clients"] },
    ],
    projects: [
      "An SEO audit of a live site",
      "A paid campaign with a real budget",
      "A monthly performance report",
    ],
    certification: "स्वYAM — Digital Marketing Specialist",
    placementAssistance: true,
    category: "Sales & Marketing",
    group: "Technology",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Bengaluru",
  }),
  mkCourse({
    id: "course-financial-literacy",
    title: "Financial Literacy & Stock Market Investing",
    orgId: "org-meridian-corp",
    hero: u("photo-1645226880663-81561dcab0ae"),
    overview:
      "Understand where your money goes before you try to grow it. Budgeting, tax, insurance and debt first — then how equity markets, mutual funds and SIPs actually work, without the tips-and-tricks noise.",
    outcomes: [
      "Build a personal budget and emergency fund",
      "Read a company balance sheet and P&L",
      "Understand risk, diversification and asset allocation",
      "Choose between direct equity, mutual funds and SIPs",
    ],
    duration: "8 weeks · 6 hrs/week",
    fees: "₹2,999",
    difficulty: "Beginner",
    trainer: {
      name: "Arjun Iyer",
      avatar: initialsAvatar("Arjun Iyer"),
      bio: "SEBI-registered investment adviser with a decade in equity research.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Personal finance",
        topics: ["Budgeting", "Emergency funds", "Insurance & tax basics"],
      },
      { module: "How markets work", topics: ["Exchanges & brokers", "Order types", "Indices"] },
      {
        module: "Analyzing companies",
        topics: ["Reading financial statements", "Valuation basics", "Red flags"],
      },
      {
        module: "Building a portfolio",
        topics: ["Risk & diversification", "Mutual funds & SIPs", "Long-term discipline"],
      },
    ],
    projects: [
      "A personal budget and savings plan",
      "A company analysis note",
      "A model long-term portfolio",
    ],
    certification: "स्वYAM — Financial Literacy Certificate",
    placementAssistance: false,
    category: "Finance",
    group: "Business",
    mode: "Online",
    free: false,
    enrolled: 0,
    state: "Delhi",
    city: "Online",
  }),
  mkCourse({
    id: "course-video-editing",
    title: "Video Editing & Motion Graphics",
    orgId: "org-reelworks",
    hero: u("photo-1779896412277-c4fd15c7a89c"),
    overview:
      "Cut footage that holds attention. Editing rhythm, color, sound design and motion graphics in Premiere Pro and After Effects, taught the way a production house actually works.",
    outcomes: [
      "Assemble a rough cut from a director's brief",
      "Color grade and mix audio to broadcast standard",
      "Create motion graphics and animated titles",
      "Export correctly for every platform and aspect ratio",
    ],
    duration: "4 months · 10 hrs/week",
    fees: "₹2,999",
    difficulty: "Intermediate",
    trainer: {
      name: "Kabir Sen",
      avatar: initialsAvatar("Kabir Sen"),
      bio: "Editor on advertising and documentary work for streaming platforms.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Editing craft",
        topics: ["Timeline workflow", "Pacing & rhythm", "Story structure"],
      },
      { module: "Premiere Pro", topics: ["Multicam editing", "Transitions", "Proxy workflows"] },
      { module: "Color & sound", topics: ["Color grading", "Audio cleanup", "Sound design"] },
      { module: "After Effects", topics: ["Keyframes", "Animated titles", "Basic compositing"] },
    ],
    projects: [
      "A 60-second brand film",
      "An animated title sequence",
      "A short-form social edit pack",
    ],
    certification: "स्वYAM — Video Editor (Professional)",
    placementAssistance: true,
    category: "Media & Content",
    group: "Creative Arts",
    mode: "Offline",
    free: false,
    enrolled: 0,
    state: "Maharashtra",
    city: "Mumbai",
  }),
  mkCourse({
    id: "course-graphic-design",
    title: "Graphic Design (Adobe Photoshop & Illustrator)",
    orgId: "org-pixelwala",
    hero: u("photo-1572044162444-ad60f128bdea"),
    overview:
      "The two tools every design brief still assumes you know. Raster work in Photoshop, vector work in Illustrator, and the typography and layout judgment that separates a designer from a tool operator.",
    outcomes: [
      "Retouch and composite images to a professional standard",
      "Build logos and icons as clean, scalable vectors",
      "Apply typography and layout principles with intent",
      "Prepare artwork correctly for print and screen",
    ],
    duration: "4 months · 8 hrs/week",
    fees: "₹2,499",
    difficulty: "Beginner",
    trainer: {
      name: "Meera Joshi",
      avatar: initialsAvatar("Meera Joshi"),
      bio: "Brand designer working on packaging and identity for consumer companies.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Design principles", topics: ["Composition", "Color theory", "Typography"] },
      { module: "Photoshop", topics: ["Layers & masking", "Retouching", "Compositing"] },
      { module: "Illustrator", topics: ["Pen tool", "Logo construction", "Iconography"] },
      {
        module: "Production",
        topics: ["Print preparation", "Export settings", "Brand guidelines"],
      },
    ],
    projects: ["A complete brand identity", "A packaging design", "A retouched product catalog"],
    certification: "NSQF Level 4 — Graphic Designer",
    placementAssistance: true,
    category: "Design & Creative",
    group: "Creative Arts",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Bengaluru",
  }),
  mkCourse({
    id: "course-public-speaking",
    title: "Public Speaking & Professional Communication",
    orgId: "org-meridian-corp",
    hero: u("photo-1715610258704-e8f9f5710fe0"),
    overview:
      "Hold a room, write an email people act on, and survive the questions afterward. Structured practice with recorded feedback, because this is a skill you build by doing it badly first.",
    outcomes: [
      "Structure a talk that holds attention",
      "Write clear, professional business emails",
      "Handle questions and pushback under pressure",
      "Present confidently to clients and leadership",
    ],
    duration: "6 weeks · 5 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Deepa Krishnan",
      avatar: initialsAvatar("Deepa Krishnan"),
      bio: "Communication coach who trains graduate hires at IT and consulting firms.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Speaking foundations",
        topics: ["Voice & pace", "Body language", "Managing nerves"],
      },
      {
        module: "Structuring a talk",
        topics: ["Opening lines", "Narrative arc", "Closing with a call to action"],
      },
      {
        module: "Business writing",
        topics: ["Email etiquette", "Concise writing", "Meeting notes"],
      },
      {
        module: "Under pressure",
        topics: ["Handling Q&A", "Difficult conversations", "Interview answers"],
      },
    ],
    projects: [
      "A recorded five-minute talk",
      "A written client proposal",
      "A mock interview session",
    ],
    certification: "स्वYAM — Professional Communication Certificate",
    placementAssistance: false,
    category: "Education & Training",
    group: "Business",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Delhi",
    city: "Online",
  }),
  mkCourse({
    id: "course-entrepreneurship",
    title: "Entrepreneurship & Startup Fundamentals",
    orgId: "org-brandbaaja",
    hero: u("photo-1753184863498-72e77c60888b"),
    overview:
      "Test an idea before you quit anything. Customer discovery, unit economics, registration and compliance in India, and how funding actually works — ending with a pitch you have defended in front of a panel.",
    outcomes: [
      "Validate an idea through customer interviews",
      "Model unit economics and a realistic runway",
      "Register a company and understand basic compliance",
      "Build and deliver an investor pitch",
    ],
    duration: "3 months · 7 hrs/week",
    fees: "₹2,499",
    difficulty: "Intermediate",
    trainer: {
      name: "Rohan Gupta",
      avatar: initialsAvatar("Rohan Gupta"),
      bio: "Founder of two bootstrapped businesses and a mentor at state startup incubators.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Idea to validation",
        topics: ["Problem interviews", "Market sizing", "MVP scoping"],
      },
      { module: "Business model", topics: ["Unit economics", "Pricing", "Runway planning"] },
      {
        module: "Setting up in India",
        topics: ["Company registration", "GST & compliance", "Founder agreements"],
      },
      {
        module: "Raising money",
        topics: ["Bootstrapping vs funding", "Pitch decks", "Investor conversations"],
      },
    ],
    projects: ["A validated problem statement", "A financial model", "A ten-slide pitch deck"],
    certification: "स्वYAM — Startup Fundamentals Certificate",
    placementAssistance: false,
    category: "Entrepreneurship",
    group: "Business",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Bengaluru",
  }),
  mkCourse({
    id: "course-robotics-iot",
    title: "Robotics & IoT using Arduino/ESP32",
    orgId: "org-bharatprecision",
    hero: u("photo-1604177091072-b7b677a077f6"),
    overview:
      "Build things that move and things that report. Sensors, motors, microcontroller programming and cloud connectivity — every module ends with hardware on your desk that works.",
    outcomes: [
      "Program Arduino and ESP32 boards in embedded C",
      "Wire and calibrate sensors and motor drivers",
      "Connect devices to the cloud over Wi-Fi and MQTT",
      "Design and build a working robot from scratch",
    ],
    duration: "5 months · 10 hrs/week",
    fees: "₹2,999",
    difficulty: "Intermediate",
    trainer: {
      name: "Suresh Patel",
      avatar: initialsAvatar("Suresh Patel"),
      bio: "Embedded systems engineer with fifteen years in industrial automation.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Electronics basics",
        topics: ["Circuits & breadboarding", "Reading datasheets", "Power management"],
      },
      {
        module: "Microcontrollers",
        topics: ["Arduino programming", "ESP32 & Wi-Fi", "Interrupts & timers"],
      },
      {
        module: "Sensors & actuators",
        topics: ["Sensor calibration", "Motor drivers", "Servo control"],
      },
      {
        module: "IoT & robotics",
        topics: ["MQTT & cloud dashboards", "Line-following logic", "Enclosure design"],
      },
    ],
    projects: [
      "A line-following robot",
      "A cloud-connected weather station",
      "A smart home automation node",
    ],
    certification: "NSQF Level 5 — IoT & Robotics Technician",
    placementAssistance: true,
    category: "Robotics & IoT",
    group: "Technology",
    mode: "Offline",
    free: false,
    enrolled: 0,
    state: "Delhi",
    city: "New Delhi",
  }),
  mkCourse({
    id: "course-3d-printing",
    title: "3D Printing & Product Design",
    orgId: "org-bharatprecision",
    hero: u("photo-1741437137939-e5d4b5a29be5"),
    overview:
      "Take a product from sketch to a part you can hold. CAD modeling, design for manufacturability, slicing and printing — plus the finishing work that separates a prototype from a demo piece.",
    outcomes: [
      "Model parts in parametric CAD",
      "Design for additive manufacturing constraints",
      "Slice, print and troubleshoot FDM and resin jobs",
      "Finish and assemble a multi-part prototype",
    ],
    duration: "4 months · 9 hrs/week",
    fees: "₹2,999",
    difficulty: "Intermediate",
    trainer: {
      name: "Kavita Rao",
      avatar: initialsAvatar("Kavita Rao"),
      bio: "Product designer running a rapid prototyping workshop for hardware startups.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Design thinking", topics: ["Sketching", "User needs", "Iteration"] },
      { module: "CAD modeling", topics: ["Parametric design", "Assemblies", "Tolerances"] },
      {
        module: "Printing",
        topics: ["FDM vs resin", "Slicing settings", "Troubleshooting failures"],
      },
      { module: "Finishing", topics: ["Post-processing", "Painting", "Assembly & testing"] },
    ],
    projects: [
      "A functional enclosure",
      "A multi-part mechanical assembly",
      "A finished product prototype",
    ],
    certification: "NSQF Level 4 — Additive Manufacturing Technician",
    placementAssistance: true,
    category: "Manufacturing",
    group: "Technology",
    mode: "Offline",
    free: false,
    enrolled: 0,
    state: "Delhi",
    city: "New Delhi",
  }),
  mkCourse({
    id: "course-solar-energy",
    title: "Renewable Energy & Solar Technology",
    orgId: "org-tatapower",
    hero: u("photo-1569173675610-42c361a86e37"),
    overview:
      "One of the fastest-hiring trades in the country. Site survey, system sizing, mounting, wiring and commissioning — taught on live rigs, with height and electrical safety treated as non-negotiable.",
    outcomes: [
      "Survey a site and size a rooftop solar system",
      "Install mounting structures, panels and inverters",
      "Complete DC and AC wiring safely to code",
      "Commission a system and hand it over to a customer",
    ],
    duration: "5 months · 12 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Manish Yadav",
      avatar: initialsAvatar("Manish Yadav"),
      bio: "Commissioning engineer who has delivered over 400 rooftop installations across north India.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Solar fundamentals", topics: ["PV physics", "System types", "Site survey"] },
      {
        module: "System design",
        topics: ["Load calculation", "String sizing", "Inverter selection"],
      },
      { module: "Installation", topics: ["Mounting structures", "DC/AC wiring", "Earthing"] },
      {
        module: "Commissioning & safety",
        topics: ["Testing", "Work-at-height safety", "Customer handover"],
      },
    ],
    projects: [
      "A full rooftop system design",
      "A live installation on a training rig",
      "A commissioning report",
    ],
    certification: "NSQF Level 4 — Solar PV Installer (Suryamitra)",
    placementAssistance: true,
    category: "Renewable Energy",
    group: "Skilled Trades",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Rajasthan",
    city: "Jaipur",
  }),
  mkCourse({
    id: "course-hospitality",
    title: "Hotel & Hospitality Management",
    orgId: "org-brew-corner",
    hero: u("photo-1742203106871-e38c00104c40"),
    overview:
      "Front office, food and beverage service, housekeeping standards and guest recovery. A practical grounding for hotel, restaurant and cruise roles, with a supervised industry attachment at the end.",
    outcomes: [
      "Run front-office check-in, billing and guest requests",
      "Deliver food and beverage service to hotel standard",
      "Apply housekeeping and hygiene protocols",
      "Handle complaints and service recovery calmly",
    ],
    duration: "6 months · 10 hrs/week",
    fees: "₹2,999",
    difficulty: "Beginner",
    trainer: {
      name: "Rakesh Nambiar",
      avatar: initialsAvatar("Rakesh Nambiar"),
      bio: "Former front-office manager at a five-star property, now training hospitality entrants.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Front office", topics: ["Reservations", "Check-in & billing", "Guest relations"] },
      { module: "Food & beverage", topics: ["Service styles", "Menu knowledge", "Table setup"] },
      { module: "Housekeeping", topics: ["Room standards", "Hygiene protocols", "Inventory"] },
      {
        module: "Guest experience",
        topics: ["Complaint handling", "Upselling", "Industry attachment"],
      },
    ],
    projects: [
      "A front-office simulation",
      "A banquet service plan",
      "A supervised industry attachment",
    ],
    certification: "NSQF Level 4 — Hospitality Operations Associate",
    placementAssistance: true,
    category: "Retail & Hospitality",
    group: "Hospitality",
    mode: "Offline",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Bengaluru",
  }),
  mkCourse({
    id: "course-healthcare-firstaid",
    title: "Healthcare & First Aid Certification",
    orgId: "org-aarogya-clinic",
    hero: u("photo-1666718623430-da207b018ea3"),
    overview:
      "Know what to do in the first ten minutes. CPR, bleeding control, burns, fractures and emergency response, plus the patient-care and infection-control basics every clinic support role expects.",
    outcomes: [
      "Perform CPR and use an AED confidently",
      "Manage bleeding, burns, fractures and shock",
      "Follow infection control and hygiene protocols",
      "Record vitals and assist with basic patient care",
    ],
    duration: "10 weeks · 8 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Dr. Leena Fernandes",
      avatar: initialsAvatar("Dr. Leena Fernandes"),
      bio: "Emergency physician who runs first-responder training for schools and workplaces.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Emergency response",
        topics: ["Scene assessment", "CPR & AED", "Recovery position"],
      },
      { module: "Common injuries", topics: ["Bleeding control", "Burns", "Fractures & splinting"] },
      {
        module: "Patient care",
        topics: ["Recording vitals", "Mobility assistance", "Communication with patients"],
      },
      {
        module: "Clinical hygiene",
        topics: ["Infection control", "Waste handling", "PPE protocols"],
      },
    ],
    projects: [
      "A supervised CPR assessment",
      "An emergency response drill",
      "A workplace first-aid audit",
    ],
    certification: "NSQF Level 3 — First Aid & Patient Care Assistant",
    placementAssistance: true,
    category: "Healthcare",
    group: "Healthcare",
    mode: "Hybrid",
    free: true,
    enrolled: 0,
    state: "Maharashtra",
    city: "Pune",
  }),
  /* ── Skilled Trades ─────────────────────────────────────────── */
  mkCourse({
    id: "course-plumbing",
    title: "Plumbing Technician",
    orgId: "org-nsti-delhi",
    hero: u("photo-1742934027823-7ab9021e470e"),
    overview:
      "Pipe fitting, fixture installation and leak diagnosis for homes and small commercial sites. Every module ends on a live rig, and the trade license paperwork is walked through at the end.",
    outcomes: [
      "Cut, thread and join PVC, CPVC and GI pipe correctly",
      "Install and service taps, cisterns, geysers and drainage",
      "Diagnose leaks, blockages and low-pressure faults",
    ],
    duration: "4 months · 12 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Ramesh Chauhan",
      avatar: initialsAvatar("Ramesh Chauhan"),
      bio: "Master plumber with twenty years on residential and hotel projects across Delhi NCR.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Materials & tools",
        topics: ["Pipe types", "Threading & jointing", "Tool safety"],
      },
      {
        module: "Installation",
        topics: ["Water supply lines", "Sanitary fixtures", "Geyser fitting"],
      },
      { module: "Repair & service", topics: ["Leak detection", "Drain clearing", "Costing a job"] },
    ],
    projects: ["A full bathroom supply-and-drain layout", "A supervised live repair callout"],
    certification: "NSQF Level 4 — Plumber (General)",
    placementAssistance: true,
    category: "Plumbing",
    group: "Skilled Trades",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Delhi",
    city: "New Delhi",
  }),
  mkCourse({
    id: "course-carpentry",
    title: "Carpentry & Furniture Making",
    orgId: "org-nsti-delhi",
    hero: u("flagged/photo-1576485436509-a7d286952b65"),
    overview:
      "Joinery, finishing and modular furniture work. You learn on hand tools first, then power tools, and finish with a piece you keep.",
    outcomes: [
      "Cut accurate joints by hand and with power tools",
      "Read furniture drawings and produce a cutting list",
      "Sand, stain and finish surfaces to sale quality",
    ],
    duration: "5 months · 12 hrs/week",
    fees: "₹2,499",
    difficulty: "Beginner",
    trainer: {
      name: "Anil Kumbhar",
      avatar: initialsAvatar("Anil Kumbhar"),
      bio: "Furniture maker running a modular workshop supplying builders in Pune.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Hand tools", topics: ["Measuring & marking", "Sawing", "Chisel work"] },
      { module: "Joinery", topics: ["Mortise & tenon", "Dovetails", "Dowel joints"] },
      { module: "Finishing", topics: ["Sanding", "Staining & polish", "Hardware fitting"] },
    ],
    projects: ["A jointed side table", "A modular wardrobe shutter set"],
    certification: "NSQF Level 4 — Carpenter (Wooden Furniture)",
    placementAssistance: true,
    category: "Carpentry",
    group: "Skilled Trades",
    mode: "Offline",
    free: false,
    enrolled: 0,
    state: "Delhi",
    city: "New Delhi",
  }),
  mkCourse({
    id: "course-electrical-technician",
    title: "Electrical Technician",
    orgId: "org-tatapower",
    hero: u("flagged/photo-1574097656146-0b43b7660cb6"),
    overview:
      "Domestic and light commercial wiring done to code. Load calculation, distribution boards, earthing and fault finding — with electrical safety treated as the first subject, not the last.",
    outcomes: [
      "Wire a distribution board and size protective devices",
      "Calculate load and select correct cable ratings",
      "Trace and repair faults with a multimeter and megger",
    ],
    duration: "5 months · 12 hrs/week",
    fees: "Free",
    difficulty: "Intermediate",
    trainer: {
      name: "Sandeep Rathore",
      avatar: initialsAvatar("Sandeep Rathore"),
      bio: "Licensed electrical supervisor who has commissioned commercial installations for fifteen years.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Fundamentals",
        topics: ["Ohm's law in practice", "AC circuits", "Safety & lockout"],
      },
      { module: "Installation", topics: ["Conduit & wiring", "Distribution boards", "Earthing"] },
      {
        module: "Fault finding",
        topics: ["Multimeter use", "Insulation testing", "Load balancing"],
      },
    ],
    projects: ["A wired demonstration panel", "A supervised domestic rewiring job"],
    certification: "NSQF Level 4 — Electrician (Domestic)",
    placementAssistance: true,
    category: "Electrical Technician",
    group: "Skilled Trades",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Maharashtra",
    city: "Mumbai",
  }),
  mkCourse({
    id: "course-welding",
    title: "Welding & Fabrication",
    orgId: "org-bharatprecision",
    hero: u("photo-1741437137939-e5d4b5a29be5"),
    overview:
      "Arc, MIG and TIG welding on mild steel and stainless, plus the fabrication math behind a clean joint. Weld quality is assessed against visual inspection standards, not opinion.",
    outcomes: [
      "Produce sound butt and fillet welds in multiple positions",
      "Set current, gas and travel speed for the material",
      "Read fabrication drawings and mark out accurately",
    ],
    duration: "4 months · 14 hrs/week",
    fees: "Free",
    difficulty: "Intermediate",
    trainer: {
      name: "Gurpreet Singh",
      avatar: initialsAvatar("Gurpreet Singh"),
      bio: "Certified welding inspector who trains fabricators for structural and pressure work.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Safety & setup", topics: ["PPE", "Fume control", "Machine setup"] },
      { module: "Processes", topics: ["Shielded metal arc", "MIG", "TIG on stainless"] },
      {
        module: "Fabrication",
        topics: ["Drawing interpretation", "Marking out", "Weld inspection"],
      },
    ],
    projects: ["A welded steel frame to drawing", "A stainless joint passing visual inspection"],
    certification: "NSQF Level 4 — Welder (Gas & Arc)",
    placementAssistance: true,
    category: "Welding",
    group: "Skilled Trades",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Delhi",
    city: "New Delhi",
  }),
  mkCourse({
    id: "course-house-painting",
    title: "House Painting & Surface Finishing",
    orgId: "org-nsti-delhi",
    hero: u("photo-1666718621307-1e864744cfef"),
    overview:
      "Surface preparation, putty work, texture finishes and spray application. Includes estimating paint quantity and quoting a room, which is where most independent painters lose money.",
    outcomes: [
      "Prepare and prime walls to a defect-free finish",
      "Apply emulsion, enamel and texture coatings evenly",
      "Estimate material quantity and quote a job accurately",
    ],
    duration: "3 months · 10 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Vijay Salunke",
      avatar: initialsAvatar("Vijay Salunke"),
      bio: "Painting contractor handling residential and showroom finishing projects.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Preparation", topics: ["Surface cleaning", "Putty & sanding", "Priming"] },
      {
        module: "Application",
        topics: ["Brush & roller technique", "Spray guns", "Texture finishes"],
      },
      { module: "Running the job", topics: ["Quantity estimation", "Quoting", "Site safety"] },
    ],
    projects: ["A fully finished sample room", "A written quotation for a two-bedroom flat"],
    certification: "NSQF Level 3 — Painter (Building & Decorative)",
    placementAssistance: true,
    category: "House Painting",
    group: "Skilled Trades",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Delhi",
    city: "New Delhi",
  }),

  /* ── Business ───────────────────────────────────────────────── */
  mkCourse({
    id: "course-sales",
    title: "Sales & Business Development",
    orgId: "org-suraksha-advisors",
    hero: u("photo-1572521165329-b197f9ea3da6"),
    overview:
      "Prospecting, qualification, objection handling and closing — taught with real call recordings and live role-play rather than scripts to memorize.",
    outcomes: [
      "Qualify leads against a repeatable framework",
      "Handle price and trust objections without discounting",
      "Run a disciplined pipeline in a CRM",
    ],
    duration: "2 months · 6 hrs/week",
    fees: "₹1,999",
    difficulty: "Beginner",
    trainer: {
      name: "Farhan Qureshi",
      avatar: initialsAvatar("Farhan Qureshi"),
      bio: "Sales head who has built field teams across insurance and B2B SaaS.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Prospecting", topics: ["Lead sourcing", "Cold calling", "First meetings"] },
      { module: "Selling", topics: ["Discovery questions", "Objection handling", "Negotiation"] },
      { module: "Discipline", topics: ["CRM hygiene", "Forecasting", "Follow-up cadence"] },
    ],
    projects: ["A recorded discovery call", "A worked pipeline review"],
    certification: "स्वYAM — Sales Professional Certificate",
    placementAssistance: true,
    category: "Sales",
    group: "Business",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Maharashtra",
    city: "Mumbai",
  }),
  mkCourse({
    id: "course-retail-management",
    title: "Retail Store Management",
    orgId: "org-greenmart",
    hero: u("photo-1704433725206-d447f91447e6"),
    overview:
      "Running a store floor: stock control, shrinkage, staff rostering, visual merchandising and daily reconciliation. Built from how supermarket branches actually operate.",
    outcomes: [
      "Manage inventory levels and control shrinkage",
      "Roster staff against footfall patterns",
      "Merchandise a floor to lift basket size",
    ],
    duration: "3 months · 8 hrs/week",
    fees: "₹2,999",
    difficulty: "Intermediate",
    trainer: {
      name: "Sunita Deshmukh",
      avatar: initialsAvatar("Sunita Deshmukh"),
      bio: "Regional retail manager overseeing fourteen supermarket branches.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Stock", topics: ["Inventory systems", "Shrinkage control", "Supplier returns"] },
      { module: "People", topics: ["Rostering", "Floor supervision", "Shift handover"] },
      {
        module: "Sales floor",
        topics: ["Visual merchandising", "Promotions", "Daily reconciliation"],
      },
    ],
    projects: ["A store layout and planogram", "A month-end stock reconciliation"],
    certification: "NSQF Level 4 — Retail Team Leader",
    placementAssistance: true,
    category: "Retail Management",
    group: "Business",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Gujarat",
    city: "Ahmedabad",
  }),
  mkCourse({
    id: "course-customer-service",
    title: "Customer Service Excellence",
    orgId: "org-techmahindra",
    hero: u("photo-1637589308599-3478cc55510d"),
    overview:
      "Voice and chat support done well — de-escalation, accurate logging and the judgment to know when to escalate. Includes call quality scoring against real rubrics.",
    outcomes: [
      "De-escalate an angry customer without conceding policy",
      "Log interactions so the next agent needs no context",
      "Meet resolution-time and quality targets consistently",
    ],
    duration: "6 weeks · 8 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Ritu Malhotra",
      avatar: initialsAvatar("Ritu Malhotra"),
      bio: "Quality lead who has trained support floors for telecom and banking processes.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Foundations", topics: ["Active listening", "Tone control", "Process knowledge"] },
      {
        module: "Difficult calls",
        topics: ["De-escalation", "Saying no clearly", "Escalation rules"],
      },
      { module: "Quality", topics: ["CRM logging", "Scoring rubrics", "Resolution metrics"] },
    ],
    projects: ["A scored mock call set", "A written escalation case note"],
    certification: "NSQF Level 3 — Customer Care Executive",
    placementAssistance: true,
    category: "Customer Service",
    group: "Business",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Telangana",
    city: "Online",
  }),

  /* ── Creative Arts ──────────────────────────────────────────── */
  mkCourse({
    id: "course-photography",
    title: "Photography & Photo Editing",
    orgId: "org-shubh-moments",
    hero: u("photo-1524069290683-0457abfe42c3"),
    overview:
      "Exposure, composition and light — then Lightroom. Weighted toward event and portrait work, because that is where the paying jobs are for new photographers in India.",
    outcomes: [
      "Shoot confidently in manual across changing light",
      "Light a portrait with one flash and a reflector",
      "Edit and deliver a consistent gallery in Lightroom",
    ],
    duration: "3 months · 8 hrs/week",
    fees: "₹2,499",
    difficulty: "Beginner",
    trainer: {
      name: "Karthik Subramanian",
      avatar: initialsAvatar("Karthik Subramanian"),
      bio: "Wedding and editorial photographer shooting across Tamil Nadu for a decade.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Camera craft", topics: ["Exposure triangle", "Focus modes", "Lens choice"] },
      { module: "Light", topics: ["Natural light", "Single-flash portraits", "Event lighting"] },
      { module: "Post", topics: ["Lightroom catalog", "Color consistency", "Client delivery"] },
    ],
    projects: ["A ten-image portrait series", "A full edited event gallery"],
    certification: "स्वYAM — Photography Practitioner",
    placementAssistance: true,
    category: "Photography",
    group: "Creative Arts",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Tamil Nadu",
    city: "Chennai",
  }),
  mkCourse({
    id: "course-motion-graphics",
    title: "Motion Graphics with After Effects",
    orgId: "org-reelworks",
    hero: u("photo-1742203101775-d2344f8ecd3d"),
    overview:
      "Animation principles applied to real deliverables — logo stings, explainer sequences and social templates that hold up at speed.",
    outcomes: [
      "Animate with easing that reads as intentional",
      "Build reusable templates with expressions",
      "Render efficiently for every delivery format",
    ],
    duration: "3 months · 9 hrs/week",
    fees: "₹2,999",
    difficulty: "Intermediate",
    trainer: {
      name: "Aditya Bose",
      avatar: initialsAvatar("Aditya Bose"),
      bio: "Motion designer producing title sequences and brand identity animation.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Principles", topics: ["Timing & spacing", "Easing curves", "Anticipation"] },
      { module: "After Effects", topics: ["Shape layers", "Masks & mattes", "Expressions"] },
      { module: "Delivery", topics: ["Template building", "Render settings", "Handoff"] },
    ],
    projects: ["A five-second logo sting", "A thirty-second explainer sequence"],
    certification: "स्वYAM — Motion Graphics Designer",
    placementAssistance: true,
    category: "Motion Graphics",
    group: "Creative Arts",
    mode: "Online",
    free: false,
    enrolled: 0,
    state: "Maharashtra",
    city: "Online",
  }),
  mkCourse({
    id: "course-content-creation",
    title: "Content Creation for Social Media",
    orgId: "org-brandbaaja",
    hero: u("photo-1741183396027-543ebe665c5b"),
    overview:
      "Scripting, shooting and editing short-form video on a phone, plus the distribution habits that decide whether anyone sees it. Built for creators and small-business owners alike.",
    outcomes: [
      "Script hooks that survive the first three seconds",
      "Shoot and edit publishable video on a phone",
      "Read analytics and adjust what you publish next",
    ],
    duration: "6 weeks · 6 hrs/week",
    fees: "₹2,499",
    difficulty: "Beginner",
    trainer: {
      name: "Ishita Roy",
      avatar: initialsAvatar("Ishita Roy"),
      bio: "Content strategist who has grown branded creator channels past a million followers.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Ideas", topics: ["Hook writing", "Content pillars", "Batching"] },
      {
        module: "Production",
        topics: ["Phone cinematography", "Lighting on a budget", "Mobile editing"],
      },
      { module: "Distribution", topics: ["Posting cadence", "Analytics", "Community replies"] },
    ],
    projects: ["A batch of five short-form videos", "A one-month content calendar"],
    certification: "स्वYAM — Content Creator Certificate",
    placementAssistance: false,
    category: "Content Creation",
    group: "Creative Arts",
    mode: "Online",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Online",
  }),

  /* ── Healthcare ─────────────────────────────────────────────── */
  mkCourse({
    id: "course-caregiver",
    title: "Caregiver & Home Attendant Training",
    orgId: "org-aarogya-clinic",
    hero: u("photo-1551731409-43eb3e517a1a"),
    overview:
      "Elderly and post-operative home care — mobility support, medication schedules, hygiene and the communication skills that make a family trust you in their home.",
    outcomes: [
      "Assist safely with mobility, bathing and feeding",
      "Follow medication schedules and spot warning signs",
      "Communicate clearly with families and doctors",
    ],
    duration: "3 months · 10 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Sister Mary Thomas",
      avatar: initialsAvatar("Sister Mary Thomas"),
      bio: "Senior nurse who has trained home-care attendants for over a decade.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Daily care", topics: ["Mobility assistance", "Personal hygiene", "Nutrition"] },
      { module: "Clinical basics", topics: ["Vitals", "Medication schedules", "Warning signs"] },
      { module: "In the home", topics: ["Family communication", "Record keeping", "Boundaries"] },
    ],
    projects: ["A supervised home-care placement", "A daily care log for one patient"],
    certification: "NSQF Level 3 — Home Health Aide",
    placementAssistance: true,
    category: "Caregiver Training",
    group: "Healthcare",
    mode: "Hybrid",
    free: true,
    enrolled: 0,
    state: "Maharashtra",
    city: "Pune",
  }),
  mkCourse({
    id: "course-nursing-assistant",
    title: "Nursing Assistant (GDA)",
    orgId: "org-aarogya-clinic",
    hero: u("photo-1666718623430-da207b018ea3"),
    overview:
      "The General Duty Assistant pathway — ward support, patient positioning, infection control and specimen handling, with a supervised hospital attachment.",
    outcomes: [
      "Support ward routines and patient positioning safely",
      "Follow infection-control and biomedical waste protocols",
      "Record observations accurately for the nursing team",
    ],
    duration: "6 months · 14 hrs/week",
    fees: "Free",
    difficulty: "Intermediate",
    trainer: {
      name: "Dr. Leena Fernandes",
      avatar: initialsAvatar("Dr. Leena Fernandes"),
      bio: "Emergency physician supervising general duty assistant training programs.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Ward support", topics: ["Patient positioning", "Bed making", "Mobility aids"] },
      { module: "Safety", topics: ["Infection control", "Waste segregation", "PPE"] },
      { module: "Clinical support", topics: ["Vitals charting", "Specimen handling", "Handover"] },
    ],
    projects: ["A supervised hospital attachment", "A completed patient observation chart"],
    certification: "NSQF Level 4 — General Duty Assistant",
    placementAssistance: true,
    category: "Nursing Assistant",
    group: "Healthcare",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Maharashtra",
    city: "Pune",
  }),
  mkCourse({
    id: "course-medical-reception",
    title: "Medical Reception & Records",
    orgId: "org-aarogya-clinic",
    hero: u("photo-1666718623429-4d0fe8a1662c"),
    overview:
      "Front desk work in a clinic: appointment flow, patient registration, insurance paperwork and medical records handling under confidentiality rules.",
    outcomes: [
      "Run an appointment queue without losing walk-ins",
      "Register patients and maintain accurate records",
      "Handle billing and insurance documentation",
    ],
    duration: "2 months · 8 hrs/week",
    fees: "₹1,999",
    difficulty: "Beginner",
    trainer: {
      name: "Pooja Menon",
      avatar: initialsAvatar("Pooja Menon"),
      bio: "Clinic operations manager running front-office teams across three centers.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Front desk",
        topics: ["Appointment systems", "Queue management", "Phone handling"],
      },
      { module: "Records", topics: ["Patient registration", "Confidentiality", "Filing systems"] },
      {
        module: "Money",
        topics: ["Billing entries", "Insurance paperwork", "Daily reconciliation"],
      },
    ],
    projects: ["A simulated clinic front-desk shift", "A records audit exercise"],
    certification: "NSQF Level 3 — Medical Front Office Assistant",
    placementAssistance: true,
    category: "Medical Reception",
    group: "Healthcare",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Maharashtra",
    city: "Pune",
  }),
  mkCourse({
    id: "course-healthcare-support",
    title: "Healthcare Support Services",
    orgId: "org-aarogya-clinic",
    hero: u("photo-1604177091072-b7b677a077f6"),
    overview:
      "The support functions a hospital runs on — sterilization, sample transport, equipment handling and patient movement — plus the safety rules governing each.",
    outcomes: [
      "Handle sterilization and equipment protocols correctly",
      "Transport samples and patients safely",
      "Work within hospital safety and hygiene standards",
    ],
    duration: "3 months · 10 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Naveen Pillai",
      avatar: initialsAvatar("Naveen Pillai"),
      bio: "Hospital operations supervisor managing support staff across two facilities.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Hygiene", topics: ["Sterilization", "Cleaning protocols", "Waste handling"] },
      { module: "Logistics", topics: ["Sample transport", "Patient movement", "Equipment care"] },
      { module: "Safety", topics: ["Manual handling", "Emergency codes", "Reporting"] },
    ],
    projects: ["A supervised support-services rotation", "A hygiene compliance checklist"],
    certification: "NSQF Level 3 — Hospital Support Assistant",
    placementAssistance: true,
    category: "Healthcare Support",
    group: "Healthcare",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Maharashtra",
    city: "Pune",
  }),

  /* ── Hospitality ────────────────────────────────────────────── */
  mkCourse({
    id: "course-food-service",
    title: "Food & Beverage Service",
    orgId: "org-brew-corner",
    hero: u("photo-1742203106871-e38c00104c40"),
    overview:
      "Restaurant and banquet service — table setup, order taking, service sequence and upselling — taught on a live floor rather than from a manual.",
    outcomes: [
      "Run a section through a full service without prompting",
      "Take and relay orders accurately at peak",
      "Upsell naturally without pressuring a guest",
    ],
    duration: "3 months · 10 hrs/week",
    fees: "₹2,999",
    difficulty: "Beginner",
    trainer: {
      name: "Joseph D'Souza",
      avatar: initialsAvatar("Joseph D'Souza"),
      bio: "Restaurant manager who has opened four outlets and trained their service teams.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Setup", topics: ["Table settings", "Mise en place", "Menu knowledge"] },
      { module: "Service", topics: ["Order taking", "Service sequence", "Wine & beverage basics"] },
      { module: "Guest experience", topics: ["Upselling", "Complaint handling", "Billing"] },
    ],
    projects: ["A full simulated dinner service", "A banquet setup plan"],
    certification: "NSQF Level 3 — F&B Service Steward",
    placementAssistance: true,
    category: "Food Service",
    group: "Hospitality",
    mode: "Offline",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Bengaluru",
  }),
  mkCourse({
    id: "course-front-office",
    title: "Hotel Front Office Operations",
    orgId: "org-brew-corner",
    hero: u("photo-1703745006226-98d4b948dc41"),
    overview:
      "Reservations, check-in, guest relations and night audit on a property management system. The desk sets a guest's impression, and this course treats it that way.",
    outcomes: [
      "Handle reservations and check-in on a PMS",
      "Manage guest requests and complaints at the desk",
      "Complete a night audit and shift handover",
    ],
    duration: "4 months · 10 hrs/week",
    fees: "₹2,499",
    difficulty: "Intermediate",
    trainer: {
      name: "Rakesh Nambiar",
      avatar: initialsAvatar("Rakesh Nambiar"),
      bio: "Former front-office manager at a five-star property, now training hospitality entrants.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Reservations", topics: ["PMS basics", "Rate plans", "Overbooking policy"] },
      {
        module: "The desk",
        topics: ["Check-in & check-out", "Guest relations", "Concierge basics"],
      },
      { module: "Controls", topics: ["Night audit", "Cash handling", "Shift handover"] },
    ],
    projects: ["A simulated front-desk shift", "A completed night audit report"],
    certification: "NSQF Level 4 — Front Office Associate",
    placementAssistance: true,
    category: "Front Office",
    group: "Hospitality",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "Karnataka",
    city: "Bengaluru",
  }),
  mkCourse({
    id: "course-housekeeping",
    title: "Housekeeping & Facility Standards",
    orgId: "org-brew-corner",
    hero: u("photo-1737825101103-c35677e6bd45"),
    overview:
      "Room servicing to hotel standard, linen and laundry control, chemical safety and inspection checklists — the operational backbone of any property.",
    outcomes: [
      "Service a room to inspection standard within time",
      "Handle cleaning chemicals and equipment safely",
      "Run linen, laundry and amenity inventory",
    ],
    duration: "3 months · 10 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Lalita Prasad",
      avatar: initialsAvatar("Lalita Prasad"),
      bio: "Executive housekeeper managing room operations for a 180-key property.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Room service", topics: ["Cleaning sequence", "Bed making", "Bathroom standards"] },
      { module: "Safety", topics: ["Chemical handling", "Equipment care", "Guest privacy"] },
      { module: "Control", topics: ["Linen inventory", "Laundry flow", "Inspection checklists"] },
    ],
    projects: ["A timed room-servicing assessment", "A floor inspection checklist"],
    certification: "NSQF Level 3 — Housekeeping Attendant",
    placementAssistance: true,
    category: "Housekeeping",
    group: "Hospitality",
    mode: "Offline",
    free: true,
    enrolled: 0,
    state: "Karnataka",
    city: "Bengaluru",
  }),
  mkCourse({
    id: "course-tourism",
    title: "Tourism & Travel Operations",
    orgId: "org-utsav-events",
    hero: u("photo-1594233666755-d1cb282abd25"),
    overview:
      "Itinerary planning, ticketing, group handling and destination knowledge for Indian and inbound travel, including the paperwork that trips up new agents.",
    outcomes: [
      "Build and cost a multi-day itinerary",
      "Handle ticketing, visas and travel documentation",
      "Manage a group tour on the ground",
    ],
    duration: "4 months · 8 hrs/week",
    fees: "₹2,499",
    difficulty: "Beginner",
    trainer: {
      name: "Debashish Sen",
      avatar: initialsAvatar("Debashish Sen"),
      bio: "Tour operator running domestic and inbound circuits for twelve years.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Planning", topics: ["Itinerary design", "Costing", "Supplier negotiation"] },
      { module: "Documentation", topics: ["Ticketing systems", "Visa basics", "Travel insurance"] },
      {
        module: "On tour",
        topics: ["Group handling", "Destination briefing", "Incident management"],
      },
    ],
    projects: ["A costed seven-day itinerary", "A group tour operations plan"],
    certification: "NSQF Level 4 — Travel Consultant",
    placementAssistance: true,
    category: "Tourism",
    group: "Hospitality",
    mode: "Hybrid",
    free: false,
    enrolled: 0,
    state: "West Bengal",
    city: "Kolkata",
  }),

  /* ── Competitive Exams ──────────────────────────────────────── */
  mkCourse({
    id: "course-ssc-prep",
    title: "SSC CGL & CHSL Preparation",
    orgId: "org-meridian-corp",
    hero: u("photo-1637589316488-6d4c41b335cd"),
    overview:
      "Full syllabus coverage for SSC CGL and CHSL — quantitative aptitude, reasoning, English and general awareness — with weekly full-length mocks and analysis.",
    outcomes: [
      "Cover the complete SSC quantitative and reasoning syllabus",
      "Build accuracy under sectional time pressure",
      "Analyze mock performance and fix weak areas",
    ],
    duration: "6 months · 15 hrs/week",
    fees: "Free",
    difficulty: "Intermediate",
    trainer: {
      name: "Alok Mishra",
      avatar: initialsAvatar("Alok Mishra"),
      bio: "SSC faculty who has coached selected candidates for over eight years.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Quantitative aptitude",
        topics: ["Arithmetic", "Algebra & geometry", "Data interpretation"],
      },
      {
        module: "Reasoning & English",
        topics: ["Verbal reasoning", "Non-verbal series", "Grammar & vocabulary"],
      },
      { module: "General awareness", topics: ["Polity & history", "Current affairs", "Static GK"] },
    ],
    projects: ["Twenty full-length mock tests", "A personal weak-area revision plan"],
    certification: "स्वYAM — SSC Foundation Certificate",
    placementAssistance: false,
    category: "SSC Preparation",
    group: "Competitive Exams",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Delhi",
    city: "Online",
  }),
  mkCourse({
    id: "course-banking-exams",
    title: "Banking Exams (IBPS & SBI PO)",
    orgId: "org-meridian-corp",
    hero: u("flagged/photo-1576485436509-a7d286952b65"),
    overview:
      "Prelims and mains preparation for IBPS PO, Clerk and SBI — reasoning, quantitative aptitude, English and banking awareness, plus interview practice for the final stage.",
    outcomes: [
      "Clear prelims-level sectional cutoffs consistently",
      "Handle mains-level data interpretation and puzzles",
      "Prepare for the descriptive paper and interview",
    ],
    duration: "6 months · 15 hrs/week",
    fees: "Free",
    difficulty: "Intermediate",
    trainer: {
      name: "Shalini Iyer",
      avatar: initialsAvatar("Shalini Iyer"),
      bio: "Former bank probationary officer now coaching banking aspirants full time.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Quantitative", topics: ["Data interpretation", "Arithmetic", "Speed techniques"] },
      { module: "Reasoning", topics: ["Puzzles & seating", "Syllogism", "Input-output"] },
      {
        module: "Banking & English",
        topics: ["Banking awareness", "Reading comprehension", "Descriptive writing"],
      },
    ],
    projects: ["Sectional and full mock series", "A mock interview with feedback"],
    certification: "स्वYAM — Banking Exam Foundation",
    placementAssistance: false,
    category: "Banking",
    group: "Competitive Exams",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Delhi",
    city: "Online",
  }),
  mkCourse({
    id: "course-railway-exams",
    title: "Railway Exams (RRB NTPC & Group D)",
    orgId: "org-meridian-corp",
    hero: u("photo-1495995424756-6a5a3f9e7543"),
    overview:
      "Targeted preparation for RRB NTPC and Group D — mathematics, general intelligence, general science and awareness — with practice calibrated to the actual paper pattern.",
    outcomes: [
      "Cover the RRB mathematics and reasoning syllabus",
      "Revise general science to the required depth",
      "Manage time across the full CBT paper",
    ],
    duration: "5 months · 12 hrs/week",
    fees: "Free",
    difficulty: "Beginner",
    trainer: {
      name: "Mahesh Tiwari",
      avatar: initialsAvatar("Mahesh Tiwari"),
      bio: "Railway exam faculty with a decade of NTPC and Group D coaching.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Mathematics", topics: ["Number system", "Percentage & ratio", "Mensuration"] },
      { module: "General intelligence", topics: ["Analogies", "Coding-decoding", "Series"] },
      {
        module: "Science & awareness",
        topics: ["Physics & chemistry basics", "Biology", "Current affairs"],
      },
    ],
    projects: ["Fifteen full CBT mock tests", "A subject-wise revision tracker"],
    certification: "स्वYAM — Railway Exam Foundation",
    placementAssistance: false,
    category: "Railway",
    group: "Competitive Exams",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Uttar Pradesh",
    city: "Online",
  }),
  mkCourse({
    id: "course-police-exams",
    title: "Police & Defence Recruitment Prep",
    orgId: "org-meridian-corp",
    hero: u("photo-1594233666755-d1cb282abd25"),
    overview:
      "Written preparation for state police and constable recruitment, combined with a structured physical training plan for the PET and PST stages.",
    outcomes: [
      "Cover the written syllabus for state police recruitment",
      "Train systematically for running, jumping and endurance standards",
      "Understand the document verification process",
    ],
    duration: "5 months · 14 hrs/week",
    fees: "Free",
    difficulty: "Intermediate",
    trainer: {
      name: "Inspector (Retd.) Balbir Singh",
      avatar: initialsAvatar("Inspector (Retd.) Balbir Singh"),
      bio: "Retired police inspector who runs recruitment preparation camps.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      { module: "Written paper", topics: ["General knowledge", "Reasoning", "Numerical ability"] },
      {
        module: "Physical standards",
        topics: ["Running program", "Strength training", "Injury prevention"],
      },
      {
        module: "Process",
        topics: ["Application steps", "Document verification", "Medical standards"],
      },
    ],
    projects: ["A twelve-week physical training log", "A full written mock series"],
    certification: "स्वYAM — Police Recruitment Preparation",
    placementAssistance: false,
    category: "Police",
    group: "Competitive Exams",
    mode: "Hybrid",
    free: true,
    enrolled: 0,
    state: "Rajasthan",
    city: "Jaipur",
  }),
  mkCourse({
    id: "course-upsc-basics",
    title: "UPSC Civil Services — Foundation",
    orgId: "org-meridian-corp",
    hero: u("photo-1741183397580-3b16cbf6995c"),
    overview:
      "An honest starting point for the civil services attempt — how the exam is structured, what the prelims syllabus really demands, and how to build a newspaper and note-making habit that survives two years.",
    outcomes: [
      "Understand the prelims, mains and interview structure",
      "Build a sustainable newspaper and note-making routine",
      "Cover NCERT-level polity, history, geography and economy",
    ],
    duration: "8 months · 18 hrs/week",
    fees: "Free",
    difficulty: "Advanced",
    trainer: {
      name: "Dr. Anand Vaidya",
      avatar: initialsAvatar("Dr. Anand Vaidya"),
      bio: "Civil services mentor who has guided candidates through prelims and mains for fifteen years.",
    },
    rating: 0,
    reviewCount: 0,
    curriculum: [
      {
        module: "Orientation",
        topics: ["Exam structure", "Optional subject choice", "Study planning"],
      },
      { module: "Core syllabus", topics: ["Polity", "Modern history", "Geography & economy"] },
      { module: "Method", topics: ["Newspaper reading", "Note making", "Answer writing basics"] },
    ],
    projects: ["A complete two-year study plan", "A graded answer-writing set"],
    certification: "स्वYAM — Civil Services Foundation",
    placementAssistance: false,
    category: "UPSC Basics",
    group: "Competitive Exams",
    mode: "Online",
    free: true,
    enrolled: 0,
    state: "Delhi",
    city: "Online",
  }),
];

/*
   Jobs and internships used to be seeded here, and were deleted: 858 lines
   of invented vacancies was a second, wrong answer to a question the
   database already answers. /jobs, /internships, /opportunities and search
   still read the real openings through listOpportunities().

   What follows is NOT that catalogue. It is a small, labelled set of
   SAMPLE openings with skill tags and nothing else: no pay, no deadline, no
   real employer, no detail page. The Home page mixes them in only while the
   live catalogue is thinner than SAMPLE_MIN_JOBS / SAMPLE_MIN_INTERNSHIPS,
   so the Evolution Lab's career journey and a first-time visitor's Intent
   Lane have material to work with. Every one carries id "sample:<slug>", is
   shown with a "Sample" label, and links to the list page rather than to a
   detail page that does not exist. The slugs match the Lab's persona
   fixtures (src/evolution/core/fixtures/journeys.ts).
*/
export const SAMPLE_MIN_JOBS = 12;
export const SAMPLE_MIN_INTERNSHIPS = 8;

export const isSampleOpening = (o: { id: string }): boolean => o.id.startsWith("sample:");

const SAMPLE_CITIES = ["Bengaluru", "Hyderabad", "Pune", "Delhi NCR", "Chennai", "Jaipur"];

function sample(
  slug: string,
  kind: "job" | "internship",
  title: string,
  skills: string[],
  summary: string,
  n: number,
): Opportunity {
  const city = SAMPLE_CITIES[n % SAMPLE_CITIES.length] as string;
  return {
    id: `sample:${slug}`,
    slug,
    title,
    kind,
    workMode: n % 3 === 0 ? "hybrid" : "onsite",
    location: city,
    region: null,
    summary,
    description: null,
    responsibilities: [],
    eligibility: null,
    payPeriod: "month",
    applyUrl: null,
    applyUrlStatus: null,
    applyUrlCheckedAt: null,
    details: {},
    skills,
    openings: 1,
    applicationCount: 0,
    salaryMin: null,
    salaryMax: null,
    stipend: null,
    isPaid: true,
    durationWeeks: kind === "internship" ? 12 : null,
    hoursPerWeek: null,
    deadline: null,
    postedAt: null,
    updatedAt: null,
    employer: {
      id: `sample-employer-${n}`,
      slug: `sample-employer-${n}`,
      name: "Sample employer",
      logoUrl: null,
      industry: null,
      headquarters: city,
      isVerified: false,
    },
  } as Opportunity;
}

const SAMPLE_ROWS: ReadonlyArray<
  readonly [string, "job" | "internship", string, string[], string]
> = [
  [
    "junior-analyst",
    "job",
    "Junior Data Analyst",
    ["Excel", "SQL", "Data analysis", "Communication"],
    "Clean data, build weekly reports and explain the numbers to the team.",
  ],
  [
    "support-associate",
    "job",
    "Customer Support Associate",
    ["Customer support", "Communication", "English", "MS Office"],
    "Answer customers by phone and chat and keep the ticket log tidy.",
  ],
  [
    "sales-trainee",
    "job",
    "Sales Trainee",
    ["Sales", "Communication", "Excel", "English"],
    "Learn the pipeline: calls, follow-ups and a simple sales sheet.",
  ],
  [
    "data-entry",
    "job",
    "Data Entry Operator",
    ["Data entry", "Excel", "MS Office"],
    "Enter and check records accurately against source documents.",
  ],
  [
    "hr-assistant",
    "job",
    "HR Assistant",
    ["Communication", "Excel", "MS Office", "Recruitment"],
    "Schedule interviews, keep the candidate sheet and support onboarding.",
  ],
  [
    "accounts-executive",
    "job",
    "Accounts Executive",
    ["Tally", "Excel", "Accounting", "MS Office"],
    "Day-to-day bookkeeping, vouchers and month-end reconciliations.",
  ],
  [
    "retail-associate",
    "job",
    "Retail Sales Associate",
    ["Customer support", "Sales", "Communication"],
    "Help customers on the shop floor and keep stock counts right.",
  ],
  [
    "marketing-associate",
    "job",
    "Digital Marketing Associate",
    ["Marketing", "Social media", "Canva", "Content writing"],
    "Plan and publish campaigns and report what worked.",
  ],
  [
    "front-desk-executive",
    "job",
    "Front Desk Executive",
    ["Communication", "English", "MS Office", "Customer support"],
    "First point of contact for visitors, calls and bookings.",
  ],
  [
    "python-support-engineer",
    "job",
    "Python Support Engineer",
    ["Python", "SQL", "Customer support", "Communication"],
    "Debug customer issues with small scripts and database queries.",
  ],
  [
    "junior-designer",
    "job",
    "Junior Graphic Designer",
    ["Design", "Canva", "Photoshop", "Communication"],
    "Turn briefs into social posts, flyers and simple brand kits.",
  ],
  [
    "inside-sales-executive",
    "job",
    "Inside Sales Executive",
    ["Sales", "Communication", "English", "CRM tools"],
    "Qualify leads over the phone and book demos for the field team.",
  ],
  [
    "operations-coordinator",
    "job",
    "Operations Coordinator",
    ["Excel", "Communication", "Logistics", "MS Office"],
    "Track orders and deliveries and keep the daily dispatch sheet.",
  ],
  [
    "marketing-intern",
    "internship",
    "Marketing Intern",
    ["Marketing", "Social media", "Communication", "Canva"],
    "Draft posts, track engagement and help run one small campaign.",
  ],
  [
    "design-intern",
    "internship",
    "Design Intern",
    ["Design", "Canva", "Photoshop", "Communication"],
    "Support the design team with layouts, edits and asset prep.",
  ],
  [
    "content-intern",
    "internship",
    "Content Writing Intern",
    ["Content writing", "English", "Social media", "Communication"],
    "Write short articles and captions with an editor's feedback.",
  ],
  [
    "data-analytics-intern",
    "internship",
    "Data Analytics Intern",
    ["Excel", "SQL", "Python", "Data analysis"],
    "Clean datasets and build a small dashboard under a mentor.",
  ],
  [
    "hr-intern",
    "internship",
    "HR Operations Intern",
    ["Communication", "Recruitment", "MS Office", "Excel"],
    "Help screen applications and keep the hiring tracker current.",
  ],
  [
    "sales-intern",
    "internship",
    "Sales Intern",
    ["Sales", "Communication", "English"],
    "Shadow calls, log leads and learn how a deal moves.",
  ],
  [
    "accounts-intern",
    "internship",
    "Accounts Intern",
    ["Tally", "Excel", "Accounting"],
    "Enter vouchers and learn month-end close with a senior accountant.",
  ],
  [
    "web-intern",
    "internship",
    "Web Development Intern",
    ["Web development", "JavaScript", "Communication"],
    "Fix small front-end issues and ship one feature with review.",
  ],
  [
    "support-intern",
    "internship",
    "Customer Support Intern",
    ["Customer support", "Communication", "English"],
    "Handle first-line queries with a buddy and a script to start from.",
  ],
];

/** Labelled sample openings with skill tags only. See the note above for why they exist. */
export const sampleOpenings: ReadonlyArray<Opportunity> = SAMPLE_ROWS.map(
  ([slug, kind, title, skills, summary], i) => sample(slug, kind, title, skills, summary, i),
);

export const mentors: Mentor[] = [
  {
    id: "mentor-1",
    name: "Sanjay Kapoor",
    avatar: initialsAvatar("Sanjay Kapoor"),
    role: "Cloud Architect",
    company: "Tech Mahindra",
    expertise: ["Cloud", "DevOps", "Career switching"],
    mentees: 148,
    rating: 0,
  },
  {
    id: "mentor-2",
    name: "Meera Iyer",
    avatar: initialsAvatar("Meera Iyer"),
    role: "Renewable Energy Trainer",
    company: "NSTI Delhi",
    expertise: ["Solar", "Green jobs", "Govt schemes"],
    mentees: 96,
    rating: 0,
  },
  {
    id: "mentor-3",
    name: "Ananya Krishnan",
    avatar: initialsAvatar("Ananya Krishnan"),
    role: "Analytics Lead",
    company: "Flipkart",
    expertise: ["Data analytics", "Interviews", "Portfolios"],
    mentees: 210,
    rating: 0,
  },
  {
    id: "mentor-4",
    name: "B. Rajan",
    avatar: initialsAvatar("B. Rajan"),
    role: "Master Trainer",
    company: "L&T CSTI",
    expertise: ["Construction trades", "Site careers"],
    mentees: 75,
    rating: 0,
  },
];

/* Empty on purpose: the seeded testimonials were invented. Real posts live in Community. */
export const posts: Post[] = [];

export const conversations: Conversation[] = [
  {
    id: "conv-1",
    name: "Neha Gupta (HR, Tata Power)",
    avatar: initialsAvatar("Neha Gupta (HR, Tata Power)"),
    role: "Recruiter",
    online: true,
    unread: 2,
    messages: [
      {
        fromMe: false,
        text: "Hi! I reviewed your profile — your solar certification looks great.",
        time: "10:02 AM",
      },
      {
        fromMe: true,
        text: "Thank you! I completed the NSQF L4 course last month with an A grade.",
        time: "10:05 AM",
      },
      {
        fromMe: false,
        text: "Perfect. Could you share your resume and certificate here?",
        time: "10:06 AM",
      },
      {
        fromMe: true,
        text: "Sure, attaching both.",
        time: "10:09 AM",
        attachment: "Resume_Solar_Tech.pdf",
      },
      {
        fromMe: false,
        text: "Received! Are you open to a site visit interview at our Noida facility this week?",
        time: "10:15 AM",
      },
      { fromMe: false, text: "We have slots Thursday and Friday morning.", time: "10:15 AM" },
    ],
  },
  {
    id: "conv-2",
    name: "Sanjay Kapoor",
    avatar: initialsAvatar("Sanjay Kapoor"),
    role: "Mentor · Cloud Architect",
    online: true,
    unread: 0,
    messages: [
      {
        fromMe: true,
        text: "Sir, I keep failing the VPC section of practice tests. Any advice?",
        time: "Yesterday",
      },
      {
        fromMe: false,
        text: "Draw it out by hand. Every time. Subnets, route tables, IGW, NAT. Do 5 diagrams and message me.",
        time: "Yesterday",
      },
      { fromMe: true, text: "Done 3 so far — it is finally clicking! 🙏", time: "9:20 AM" },
      {
        fromMe: false,
        text: "Great progress. Send me the diagrams tonight, we will review in our Friday call.",
        time: "9:45 AM",
      },
    ],
  },
  {
    id: "conv-3",
    name: "NSTI Delhi Admissions",
    avatar: initialsAvatar("NSTI Delhi Admissions"),
    role: "Training Institute",
    online: false,
    unread: 1,
    messages: [
      {
        fromMe: true,
        text: "Is the CNC course open for the April batch? I have NSQF L4 in fitter trade.",
        time: "Mon",
      },
      {
        fromMe: false,
        text: "Yes! Fitter L4 qualifies you directly. April batch has 12 seats left. Shall I share the application link?",
        time: "Mon",
      },
      {
        fromMe: false,
        text: "Also — you qualify for the EWS fee waiver based on your profile. 📋",
        time: "Tue",
      },
    ],
  },
  {
    id: "conv-4",
    name: "Priyanka Das (Zomato Careers)",
    avatar: initialsAvatar("Priyanka Das (Zomato Careers)"),
    role: "Recruiter",
    online: false,
    unread: 0,
    messages: [
      {
        fromMe: false,
        text: "Thanks for applying to Fleet Operations Intern! Your application is shortlisted. 🎉",
        time: "Last week",
      },
      { fromMe: true, text: "That is great news! What are the next steps?", time: "Last week" },
      {
        fromMe: false,
        text: "A 30-min case round: we give you a zone scenario, you optimize rider allocation. Prep tip: think cost per delivery.",
        time: "Last week",
      },
    ],
  },
];

export const notifications: AppNotification[] = [
  {
    id: "n1",
    type: "interview",
    title: "Interview invitation",
    body: "Tata Power Renewables invited you for a site interview — Thursday 10 AM, Noida.",
    time: "5 min ago",
    read: false,
  },
  {
    id: "n2",
    type: "message",
    title: "New message from Neha Gupta",
    body: '"Are you open to a site visit interview…"',
    time: "18 min ago",
    read: false,
  },
  {
    id: "n3",
    type: "job",
    title: "New job matches your profile",
    body: "Solar Installation Technician at Tata Power — 92% skill match.",
    time: "1 h ago",
    read: false,
  },
  {
    id: "n4",
    type: "ai",
    title: "AI Career Assistant",
    body: "Your resume score improved to 82/100 after adding the solar certification. 2 suggestions remain.",
    time: "3 h ago",
    read: true,
  },
  {
    id: "n5",
    type: "course",
    title: "Course deadline reminder",
    body: "Cloud Computing module 3 quiz closes tomorrow at 11:59 PM.",
    time: "6 h ago",
    read: true,
  },
  {
    id: "n6",
    type: "certificate",
    title: "Certificate issued 🎉",
    body: "Your NSQF Level 4 Solar PV Technician certificate is ready to download and share.",
    time: "1 d ago",
    read: true,
  },
  {
    id: "n7",
    type: "internship",
    title: "Application update",
    body: 'Zomato moved your Fleet Ops Intern application to "Case Round".',
    time: "2 d ago",
    read: true,
  },
];

export const orgById = (id: string) => organizations.find((o) => o.id === id)!;

/**
 * Empty until the platform can count its own.
 *
 * This held the national skilling programme's figures presented as this
 * site's own record. The home page renders nothing when the list is empty,
 * so real numbers can be added the day there are real numbers.
 */
export const stats: { label: string; value: number; suffix: string }[] = [];

export const categories = [
  "IT & Software",
  "Design & Creative",
  "Media & Content",
  "Sales & Marketing",
  "Customer Support",
  "Retail & Hospitality",
  "Delivery & Logistics",
  "Education & Training",
  "Administration",
  "Data & Operations",
  "Events & Photography",
  "Finance",
  "Healthcare",
  "Entrepreneurship",
  "Robotics & IoT",
  "Renewable Energy",
  "Manufacturing",
  "Electrical",
  "Construction",
  "Beauty & Wellness",
  "Operations",
];

export const states = [
  "Delhi",
  "Maharashtra",
  "Telangana",
  "Tamil Nadu",
  "Haryana",
  "Rajasthan",
  "Uttar Pradesh",
  "Karnataka",
  "Gujarat",
  "West Bengal",
];
