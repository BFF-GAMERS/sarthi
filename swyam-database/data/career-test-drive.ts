/**
 * Career test drive: a few real mini-tasks per career, each 3 to 5 minutes.
 *
 * Seeded by hand against the live career_paths slugs (checked 2026-10-06).
 * Nothing here is a test of the learner and nothing is sent anywhere: the
 * answers explain themselves, the learner says how it felt, and a summary
 * points at existing courses.
 */

export const DRIVE_LABELS = [
  "A taste, not a test of you",
  "Not a certificate",
  "No hiring signal",
  "Stays on this device",
] as const;

/** The career_paths slugs that exist today. Seeds must be a subset. */
export const CAREER_SLUGS = [
  "backend-engineer",
  "data-analyst",
  "digital-marketer",
  "frontend-engineer",
  "ml-engineer",
  "product-manager",
  "ux-designer",
  "video-editor",
] as const;

export interface DriveMaterial {
  kind: "table" | "code" | "list";
  title: string;
  header?: string[];
  rows?: string[][];
  lines?: string[];
}

export interface DriveOption {
  text: string;
  /** Shown after checking, for every option, so wrong picks teach too. */
  why: string;
}

export interface DriveTask {
  id: string;
  title: string;
  minutes: 3 | 4 | 5;
  /** The everyday skill this exercises, shown in the summary. */
  skill: string;
  scenario: string;
  material?: DriveMaterial;
  prompt: string;
  kind: "choice" | "selfcheck";
  /** choice */
  options?: DriveOption[];
  answer?: number;
  /** selfcheck */
  placeholder?: string;
  model?: string;
  rubric?: string[];
}

export interface DriveCourse {
  /** A catalogue id in `courses` (src/data/mock.ts). */
  id: string;
  label: string;
}

export interface DriveCareer {
  slug: string;
  intro: string;
  tasks: DriveTask[];
  courses: DriveCourse[];
}

export const CAREER_TEST_DRIVE: DriveCareer[] = [
  {
    slug: "data-analyst",
    intro:
      "Three small jobs an analyst does in a normal week: check numbers, summarize fairly, say what changed.",
    courses: [{ id: "course-data-analytics", label: "Data analytics course" }],
    tasks: [
      {
        id: "da-error",
        title: "Spot the error in a sales table",
        minutes: 4,
        skill: "Checking numbers before trusting them",
        scenario:
          "A shop owner sends you this table and asks you to put it in a report. One row looks off.",
        material: {
          kind: "table",
          title: "Sales by region, last month",
          header: ["Region", "Orders", "Revenue (Rs)", "Average order (Rs)"],
          rows: [
            ["North", "40", "20,000", "500"],
            ["South", "25", "15,000", "600"],
            ["East", "30", "12,000", "400"],
            ["West", "20", "90,000", "450"],
          ],
        },
        prompt: "Which row does not add up?",
        kind: "choice",
        options: [
          { text: "North", why: "40 orders at Rs 500 is Rs 20,000. This row is fine." },
          { text: "South", why: "25 orders at Rs 600 is Rs 15,000. This row is fine." },
          { text: "East", why: "30 orders at Rs 400 is Rs 12,000. This row is fine." },
          {
            text: "West",
            why: "20 orders at Rs 450 is Rs 9,000, not Rs 90,000. It looks like an extra zero was typed. An analyst asks the owner before changing it.",
          },
        ],
        answer: 3,
      },
      {
        id: "da-average",
        title: "Pick the fairer summary",
        minutes: 4,
        skill: "Choosing a fair average",
        scenario:
          "A manager says orders take 35 minutes on average. A customer says theirs always take about 25.",
        material: {
          kind: "list",
          title: "Delivery times this week (minutes)",
          lines: ["22, 24, 25, 25, 26, 27, 95"],
        },
        prompt: "Which summary is the fairest?",
        kind: "choice",
        options: [
          {
            text: "The average is about 35 minutes, so say 35.",
            why: "The mean is about 35, but one 95-minute order pulls it up. Six of the seven orders took 27 minutes or less.",
          },
          {
            text: "The middle value is 25 minutes. Report that, and flag the one 95-minute order separately.",
            why: "The median (25) describes a typical order, and naming the slow one keeps the report honest. This is the fairest.",
          },
          {
            text: "Delete the 95 and never mention it.",
            why: "Dropping a data point silently hides a real problem. It might be a one-off or it might be a pattern.",
          },
        ],
        answer: 1,
      },
      {
        id: "da-finding",
        title: "Write the finding in two lines",
        minutes: 5,
        skill: "Saying what changed, and what to check next",
        scenario: "Your manager wants the headline from this chart before a meeting.",
        material: {
          kind: "table",
          title: "Weekly sign-ups",
          header: ["Week", "Sign-ups", "Note"],
          rows: [
            ["1", "120", ""],
            ["2", "130", ""],
            ["3", "125", ""],
            ["4", "128", ""],
            ["5", "60", "Sign-up form moved below the fold"],
            ["6", "62", ""],
          ],
        },
        prompt: "Write two lines: what changed, and what you would check next.",
        kind: "selfcheck",
        placeholder: "Sign-ups dropped from about ... to about ... in week ...",
        model:
          "Sign-ups fell by about half, from roughly 126 a week (weeks 1 to 4) to about 61 (weeks 5 and 6). It started the same week the form moved below the fold. Next I would check whether visitors also fell, to separate fewer visits from fewer sign-ups per visit, then test moving the form back.",
        rubric: [
          "I gave the size of the change with numbers",
          "I linked it to the form move without claiming it is proven",
          "I named one concrete next check",
        ],
      },
    ],
  },
  {
    slug: "backend-engineer",
    intro:
      "Three small jobs from a backend week: read a log, write a useful bug report, spot an unsafe query.",
    courses: [{ id: "course-full-stack", label: "Full-stack development course" }],
    tasks: [
      {
        id: "be-log",
        title: "Find the slow request",
        minutes: 4,
        skill: "Reading a log for the line that matters",
        scenario:
          "A user says the app froze for several seconds around 10:02. You have four log lines.",
        material: {
          kind: "code",
          title: "Server log",
          lines: [
            "10:02:11  GET /api/users/42            200   12ms",
            "10:02:14  GET /api/users/abc           500    3ms  TypeError: cannot read 'id' of undefined",
            "10:02:15  GET /api/users/42/orders     200  480ms",
            "10:02:19  GET /api/orders?limit=1000000 200 9120ms",
          ],
        },
        prompt: "Which line most likely explains the freeze?",
        kind: "choice",
        options: [
          { text: "Line 1", why: "A 12 ms success is the healthy baseline." },
          {
            text: "Line 2",
            why: "A real bug (bad input should give a 400, not crash), but it took 3 ms, so it did not freeze anything. Worth its own ticket.",
          },
          { text: "Line 3", why: "480 ms is a bit slow but not a multi-second freeze." },
          {
            text: "Line 4",
            why: "Asking for a million orders in one call took over 9 seconds. A limit cap or pagination is the usual fix.",
          },
        ],
        answer: 3,
      },
      {
        id: "be-report",
        title: "Write a two-line bug report",
        minutes: 4,
        skill: "Reporting a bug so someone else can fix it",
        scenario:
          "A tester found this: a Rs 50 cart with coupon FLAT100 applied shows a total of minus Rs 50.",
        prompt: "Write the bug report: a title, steps, expected and actual.",
        kind: "selfcheck",
        placeholder: "Title: ...\nSteps: ...\nExpected: ...\nActual: ...",
        model:
          "Title: Cart total goes negative (Rs -50) when FLAT100 is used on a Rs 50 cart. Steps: add one Rs 50 item, apply FLAT100. Expected: total Rs 0, since a discount cannot exceed the cart value. Actual: total Rs -50.",
        rubric: [
          "My steps are exact enough for someone else to repeat",
          "I said what was expected and what actually happened",
          "I used the real values (Rs 50, FLAT100, Rs -50)",
        ],
      },
      {
        id: "be-sql",
        title: "Which query is safe?",
        minutes: 4,
        skill: "Spotting unsafe database code",
        scenario: "A user types  ' OR '1'='1  into the email box of a login form.",
        material: {
          kind: "code",
          title: "Three ways to look up a user",
          lines: [
            'A:  db.query("SELECT * FROM users WHERE email = \'" + email + "\'")',
            'B:  db.query("SELECT * FROM users WHERE email = $1", [email])',
            'C:  db.query("SELECT * FROM users WHERE email = \'" + email.toLowerCase() + "\'")',
          ],
        },
        prompt: "Which version is safe from that input?",
        kind: "choice",
        options: [
          {
            text: "A",
            why: "The text is pasted into the SQL, so the quote characters change what the query means. Unsafe.",
          },
          {
            text: "B",
            why: "A parameterised query sends the value separately from the SQL, so it is only ever treated as data. This is the safe one.",
          },
          { text: "C", why: "Lower-casing does not remove quote characters. Still unsafe." },
        ],
        answer: 1,
      },
    ],
  },
  {
    slug: "frontend-engineer",
    intro:
      "Three small jobs from a frontend week: find a bug, pick the right element, debug a phone layout.",
    courses: [
      { id: "course-full-stack", label: "Full-stack development course" },
      { id: "course-uiux-figma", label: "UI/UX design course" },
    ],
    tasks: [
      {
        id: "fe-state",
        title: "Why does the counter not move?",
        minutes: 4,
        skill: "Reading a small component for the bug",
        scenario: "You click the button and the number never changes.",
        material: {
          kind: "code",
          title: "Counter.tsx",
          lines: [
            "function Counter() {",
            "  let count = 0;",
            "  return (",
            "    <button onClick={() => { count = count + 1; }}>",
            "      Clicked {count} times",
            "    </button>",
            "  );",
            "}",
          ],
        },
        prompt: "What is the problem?",
        kind: "choice",
        options: [
          {
            text: "count is an ordinary variable. React only re-draws when state changes, so it needs useState.",
            why: "Right. The variable does change, but nothing tells React to draw the screen again. useState does that.",
          },
          {
            text: "The button needs a type attribute.",
            why: "A type is good practice in forms, but it is not why the text stays the same.",
          },
          {
            text: "onClick should be spelled onclick.",
            why: "In React, onClick is the correct spelling.",
          },
        ],
        answer: 0,
      },
      {
        id: "fe-button",
        title: "Pick the right element",
        minutes: 3,
        skill: "Building controls that work for everyone",
        scenario:
          "A colleague needs a Save control that works with a keyboard and a screen reader.",
        material: {
          kind: "code",
          title: "Two versions",
          lines: [
            'A:  <div class="btn" onClick={save}>Save</div>',
            'B:  <button type="button" onClick={save}>Save</button>',
          ],
        },
        prompt: "Which is better, and why?",
        kind: "choice",
        options: [
          {
            text: "A, because the class makes it look like a button.",
            why: "It looks like a button, but a div cannot be reached with Tab and a screen reader will not call it a button.",
          },
          {
            text: "B, because a real button can be focused, pressed with Enter or Space, and is announced as a button.",
            why: "Right. The browser gives you all of that for free. Using the right element is the cheapest accessibility win.",
          },
        ],
        answer: 1,
      },
      {
        id: "fe-phone",
        title: "The button is cut off on a phone",
        minutes: 5,
        skill: "Debugging a layout on a small screen",
        scenario:
          "A sign-up page looks fine on a laptop. On a 390 px wide phone the Submit button is cut off at the right edge.",
        prompt: "List three things you would check first.",
        kind: "selfcheck",
        placeholder: "1. ...\n2. ...\n3. ...",
        model:
          "1. Fixed widths in pixels on the form or its container. 2. One wide element (a table, an image, a long unbroken string) pushing the page wider than the screen. 3. The viewport meta tag. Then I would open dev tools in phone mode and look for the element wider than 390 px.",
        rubric: [
          "I thought about fixed widths or overflow",
          "I thought about finding the one element that is too wide",
          "I would reproduce it in phone mode before changing code",
        ],
      },
    ],
  },
  {
    slug: "digital-marketer",
    intro: "Two small jobs from a marketing week: compare ads fairly and write a clear headline.",
    courses: [
      { id: "course-digital-marketing", label: "Digital marketing course" },
      { id: "course-content-creation", label: "Content creation course" },
    ],
    tasks: [
      {
        id: "dm-cost",
        title: "Which ad got sign-ups most cheaply?",
        minutes: 4,
        skill: "Comparing results by cost, not by clicks",
        scenario: "Three small ads ran last week. Your client asks which one to keep.",
        material: {
          kind: "table",
          title: "Ad results",
          header: ["Ad", "Spend (Rs)", "Clicks", "Sign-ups"],
          rows: [
            ["A", "5,000", "400", "20"],
            ["B", "5,000", "250", "25"],
            ["C", "2,000", "200", "8"],
          ],
        },
        prompt: "Which ad cost the least per sign-up?",
        kind: "choice",
        options: [
          {
            text: "Ad A (most clicks)",
            why: "5,000 / 20 is Rs 250 per sign-up. Lots of clicks, but not the cheapest sign-ups.",
          },
          {
            text: "Ad B",
            why: "5,000 / 25 is Rs 200 per sign-up, the lowest of the three. Fewer clicks, better ones.",
          },
          {
            text: "Ad C (lowest spend)",
            why: "2,000 / 8 is Rs 250 per sign-up. A small budget is not the same as a cheap result.",
          },
        ],
        answer: 1,
      },
      {
        id: "dm-headline",
        title: "Rewrite the headline",
        minutes: 4,
        skill: "Writing for one specific reader",
        scenario:
          "A tuition center in Pune runs the ad headline: Best Quality Education Services - Join Now!!! It is for parents of class 8 to 10 students.",
        prompt: "Write a clearer headline in ten words or fewer.",
        kind: "selfcheck",
        placeholder: "Your headline...",
        model:
          "Class 9 math feeling hard? Free trial class this Saturday, Pune. It names the reader, offers one specific thing, and says what to do next, without claiming to be the best.",
        rubric: [
          "It speaks to a clear reader (class 8 to 10 parents or students)",
          "It offers one specific thing, not a vague promise",
          "It avoids claims I cannot prove, like best",
        ],
      },
    ],
  },
  {
    slug: "ml-engineer",
    intro:
      "Three small jobs from a machine-learning week: question a number, catch a leak, explain an idea plainly.",
    courses: [
      { id: "course-data-analytics", label: "Data analytics course" },
      { id: "course-prompt-engineering", label: "Prompt engineering course" },
    ],
    tasks: [
      {
        id: "ml-accuracy",
        title: "Is 99% accurate good?",
        minutes: 4,
        skill: "Questioning a headline number",
        scenario:
          "A teammate says their fraud model is 99% accurate. Of 1,000 payments, 10 are fraud.",
        prompt: "What do you check first?",
        kind: "choice",
        options: [
          {
            text: "Whether it catches any of the 10 fraud cases.",
            why: "Right. A model that says not fraud every time is also 99% accurate and catches none. Accuracy hides this when one class is rare.",
          },
          {
            text: "Train it for longer.",
            why: "More training does not tell you whether the number means anything.",
          },
          {
            text: "Add more layers.",
            why: "A bigger model is a guess. First understand what 99% is measuring.",
          },
        ],
        answer: 0,
      },
      {
        id: "ml-leak",
        title: "Which column leaks the answer?",
        minutes: 4,
        skill: "Spotting data that would not exist yet",
        scenario: "You are predicting whether a student will pass, so a teacher can help early.",
        material: {
          kind: "list",
          title: "Columns in the data",
          lines: [
            "hours_studied",
            "attendance_percent",
            "previous_marks",
            "result_published (yes/no)",
            "passed (what we predict)",
          ],
        },
        prompt: "Which column should you remove before training, and why?",
        kind: "choice",
        options: [
          { text: "attendance_percent", why: "Known well before the exam, so it is a fair input." },
          { text: "hours_studied", why: "Known before the exam too. Fair." },
          {
            text: "result_published",
            why: "It is only known after the outcome. The model would learn to read it instead of learning anything useful. That is called a leak.",
          },
          { text: "previous_marks", why: "Known before the exam, so a fair input." },
        ],
        answer: 2,
      },
      {
        id: "ml-split",
        title: "Explain it to a shopkeeper",
        minutes: 5,
        skill: "Explaining a technical idea in plain words",
        scenario: "A shopkeeper asks why you keep some data aside and do not train on all of it.",
        prompt: "Explain in two or three sentences why we split data into training and test sets.",
        kind: "selfcheck",
        placeholder: "We keep some examples aside because...",
        model:
          "We hide some examples while the model learns, then test it on those. If it only does well on examples it has already seen, it may have memorized them rather than learned the pattern, like a student who memorized last year's paper.",
        rubric: [
          "I said some data is kept unseen",
          "I contrasted memorizing with learning",
          "I used plain words, no jargon",
        ],
      },
    ],
  },
  {
    slug: "product-manager",
    intro:
      "Three small jobs from a product week: choose what ships first, frame a problem, pick a fair measure.",
    courses: [
      { id: "course-entrepreneurship", label: "Entrepreneurship course" },
      { id: "course-data-analytics", label: "Data analytics course" },
    ],
    tasks: [
      {
        id: "pm-tickets",
        title: "Prioritize four tickets",
        minutes: 5,
        skill: "Choosing what to do first",
        scenario: "You have one engineer for five working days.",
        material: {
          kind: "table",
          title: "The queue",
          header: ["#", "Ticket", "Who it affects", "Effort"],
          rows: [
            ["1", "Login button broken on Android", "About 30% of users, no workaround", "1 day"],
            ["2", "Add dark mode", "12 people asked", "2 weeks"],
            ["3", "Typo in the footer", "Everyone, barely noticeable", "10 minutes"],
            ["4", "Search takes 3 seconds", "40% of users search daily", "1 week"],
          ],
        },
        prompt: "Which do you ship first?",
        kind: "choice",
        options: [
          {
            text: "Ticket 1: the broken login",
            why: "Right. It blocks people completely, affects many, and takes one day. The typo can ride along. Search is next.",
          },
          {
            text: "Ticket 2: dark mode",
            why: "Nice to have, but 12 requests and two weeks is the weakest case.",
          },
          {
            text: "Ticket 3: the typo",
            why: "Quick, but nobody is blocked. Do it alongside something bigger.",
          },
          {
            text: "Ticket 4: slow search",
            why: "A real problem and a good second choice, but it costs the whole week while login blocks people today.",
          },
        ],
        answer: 0,
      },
      {
        id: "pm-problem",
        title: "Write the problem in two lines",
        minutes: 4,
        skill: "Describing a problem without jumping to a fix",
        scenario:
          "A delivery app finds that 35% of new users leave at the address step, before they see any restaurants.",
        prompt: "Write the problem in two lines, without proposing a solution.",
        kind: "selfcheck",
        placeholder: "35% of new users...",
        model:
          "35% of new users leave at the address step, before they see any restaurants. We do not yet know whether the form is confusing, asking for location feels risky, or people just wanted to browse first.",
        rubric: [
          "I included the number and who it is about",
          "I said what we do not know yet",
          "I did not smuggle in a solution",
        ],
      },
      {
        id: "pm-measure",
        title: "How would you know it worked?",
        minutes: 3,
        skill: "Picking a measure that means something",
        scenario: "You added a Reorder button to the app.",
        prompt: "Which is the best sign it helped?",
        kind: "choice",
        options: [
          {
            text: "The number of taps on the button.",
            why: "Taps show curiosity. People can tap and still not order.",
          },
          {
            text: "The share of weekly orders placed with Reorder, and whether those customers order again within 30 days.",
            why: "Right. It measures real orders and whether the habit lasts.",
          },
          {
            text: "The number of app downloads.",
            why: "Downloads rise and fall for many reasons that have nothing to do with this button.",
          },
        ],
        answer: 1,
      },
    ],
  },
  {
    slug: "ux-designer",
    intro:
      "Two small jobs from a design week: find what confuses people, and fix a message that blames them.",
    courses: [
      { id: "course-uiux-figma", label: "UI/UX design course" },
      { id: "course-graphic-design", label: "Graphic design course" },
    ],
    tasks: [
      {
        id: "ux-cancel",
        title: "Why did people lose their typing?",
        minutes: 4,
        skill: "Finding the cause behind a usability problem",
        scenario: "In a test, three people tapped Cancel by mistake and lost what they had typed.",
        material: {
          kind: "list",
          title: "The sign-up screen",
          lines: [
            "Create account",
            "[ Email ]",
            "[ Password ]   (the rule appears only after you submit: 8+ characters, one number)",
            "[ Create account ]  [ Cancel ]   same size, same color, side by side",
          ],
        },
        prompt: "What is the likeliest cause?",
        kind: "choice",
        options: [
          {
            text: "Cancel looks as important as Create account and sits right next to it.",
            why: "Right. Equal weight and no distance invite mistakes. Make Cancel quieter or move it, and confirm before discarding typing.",
          },
          {
            text: "The title is too small.",
            why: "It might be, but it would not make anyone tap Cancel.",
          },
          {
            text: "The password field has no label.",
            why: "It has a label here. A different real issue, though: showing the rule only after submit is worth fixing too.",
          },
        ],
        answer: 0,
      },
      {
        id: "ux-error",
        title: "Write a kinder error message",
        minutes: 4,
        skill: "Writing messages that help",
        scenario:
          "A phone number field shows: Error 4021: Invalid input. The person typed 9 digits instead of 10.",
        prompt: "Rewrite the message.",
        kind: "selfcheck",
        placeholder: "Your message...",
        model: "Your phone number needs 10 digits and this one has 9. Please check and try again.",
        rubric: [
          "It says what went wrong in plain words",
          "It says how to fix it",
          "It does not blame the person or show a code",
        ],
      },
    ],
  },
  {
    slug: "video-editor",
    intro:
      "Three small jobs from an editing week: tighten a clip, order a short ad, fix what people cannot hear.",
    courses: [
      { id: "course-video-editing", label: "Video editing course" },
      { id: "course-motion-graphics", label: "Motion graphics course" },
    ],
    tasks: [
      {
        id: "ve-cut",
        title: "Tighten an interview clip",
        minutes: 3,
        skill: "Fixing pace without changing meaning",
        scenario:
          "The speaker says: and that is why, um, we started small. (3 second pause) We started with just two machines.",
        prompt: "Which edit works best?",
        kind: "choice",
        options: [
          {
            text: "Remove the um and shorten the pause to a short beat.",
            why: "Right. It keeps both thoughts and the speaker's voice, and the pace feels natural.",
          },
          {
            text: "Delete the whole first sentence.",
            why: "You lose the reason and the meaning changes.",
          },
          {
            text: "Leave it exactly as recorded.",
            why: "A three-second silence usually reads as a mistake on screen.",
          },
        ],
        answer: 0,
      },
      {
        id: "ve-order",
        title: "Order five clips for a 30-second ad",
        minutes: 5,
        skill: "Sequencing shots to tell a story",
        scenario: "A bakery ad. You have five clips.",
        material: {
          kind: "list",
          title: "The clips",
          lines: [
            "a) Close-up of dough being kneaded",
            "b) The shop sign",
            "c) A customer smiling as they take a bite",
            "d) A card with the price and address",
            "e) Wide shot of the shelf of breads",
          ],
        },
        prompt: "Write the order you would cut them in, with a short reason.",
        kind: "selfcheck",
        placeholder: "a, e, c, b, d because...",
        model:
          "a, e, c, b, d. Open on the moving close-up of dough to catch the eye in the first two seconds, then the wide shelf for variety, the customer's smile as the payoff, the sign so people recognize the shop, and the price and address card last so they know what to do.",
        rubric: [
          "My first shot would grab attention quickly",
          "The address or price comes at the end, so people know what to do",
          "I gave a reason for the order, not just a list",
        ],
      },
      {
        id: "ve-audio",
        title: "People cannot follow the speaker",
        minutes: 3,
        skill: "Fixing audio before picture",
        scenario:
          "The picture is sharp, but viewers say it is hard to follow. The background music is as loud as the speaker's voice.",
        prompt: "What do you adjust first?",
        kind: "choice",
        options: [
          {
            text: "Sharpen the video more.",
            why: "The picture is already sharp. Viewers cannot hear, not see.",
          },
          {
            text: "Lower the music under the voice.",
            why: "Right. Voice comes first. A common starting point is music clearly quieter than the speech.",
          },
          {
            text: "Add a second music track.",
            why: "More sound makes the voice harder to hear, not easier.",
          },
        ],
        answer: 1,
      },
    ],
  },
];

export const CAREER_TEST_DRIVE_BY_SLUG: Record<string, DriveCareer> = Object.fromEntries(
  CAREER_TEST_DRIVE.map((c) => [c.slug, c]),
);

export function driveFor(slug: string): DriveCareer | null {
  return CAREER_TEST_DRIVE_BY_SLUG[slug] ?? null;
}
