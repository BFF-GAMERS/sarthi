# SWYAM — Context Pack for Codebenders

Give this file to Codebenders **along with** the master build prompt. It contains ONLY what's
necessary to build the app in that prompt, in Swyam's existing visual style, **fully offline**.

---

## 0. HARD RULES (read first)

1. **NO backend. No Supabase, no Firebase, no server database.** The app must run fully **offline**.
2. **All data lives in code** — hardcoded TypeScript/JSON in `src/data/`. User-specific state
   (progress, SkillPoints, who's logged in, parent/child link) → **`localStorage` only**.
3. **No real secure auth** is possible offline. The three "logins" (Student / Teacher / Parent)
   are **role selection stored in localStorage**, not backend-verified accounts. Build them as
   separate dashboards switched by a locally-stored role. Do not pretend it's secure server auth.
4. **Match Swyam's existing look** (Section 2) exactly — same palette, fonts, component feel.
5. **AI = on-device/offline only** (Section 4). No paid API calls by default.
6. Do NOT claim a feature works unless it actually runs offline with the hardcoded data.

> **Note on the master prompt:** it describes a K-12 CBSE *tutoring* app (Board→Class→Subject→
> Chapter→Lecture). The existing Swyam codebase is a *vocational/careers* app. So: **reuse the
> DESIGN + the offline patterns below, but build the K-12 structure fresh** — do not copy the
> old vocational courses, jobs, SkillSwap, mentors, etc.

---

## 1. STACK & CONVENTIONS (to replicate the feel; a fresh simpler setup is fine)

- **React 19 + TypeScript + Vite + Tailwind CSS v4.**
- Tailwind v4 is **CSS-first**: no `tailwind.config.js`. Design tokens live in a `@theme { }`
  block inside the main CSS file. (Original uses TanStack Start/SSR — for an offline build a
  plain Vite SPA is simpler and fine.)
- **UI is custom** — no shadcn/MUI/Radix. Just Tailwind utilities + a set of custom component
  classes + **lucide-react** icons + **framer-motion** for motion.
- Fonts are **self-hosted `.woff2`** (not Google Fonts).

---

## 2. DESIGN SYSTEM — the look to match (THIS is the important part)

Swyam is an **editorial / print-inspired, warm-paper-and-terracotta, distinctly-Indian** brand.
Hairline borders instead of heavy shadows (in light). Anti-generic, premium, calm.

### Two theme registers (toggle via a `data-mode` attribute on `<html>`)
- **Light = "paper"** (`data-mode="millennial"`): warm cream paper, navy ink, terracotta accent,
  editorial serif, near-square corners, **no shadows** (hairlines + tiny hover lift).
- **Dark = "street poster"** (`data-mode="genz"`): deep-navy ground, bright saffron/orange accent,
  condensed signboard fonts, rounded corners, glows.
> For a simpler offline build you may ship **light "paper" as default** and dark as optional.

### COLORS — LIGHT (paper) — the defaults
```
Surfaces:  paper #f6f1e7 · card #fdfbf6 · dim #efe8da · deep #e7dfd0
Text(ink): #1b2230 (main) · #454b5c (soft) · #5c6171 (muted) · hairline border #d9d0c0
Accent(terracotta): primary #a8251d · hover #8e1e17 · light #b6322a · tint #f8ebe8 / #f0d6d2
Tags only (not UI chrome): marigold #9a6206 · peacock #0e6b74 · rani #b02364 · indigo #2f3f8f · emerald #16563a
Semantic: primary=#a8251d, primary-text #ffffff, danger #b42318, bg=paper, card=#fdfbf6, ring=#a8251d
```

### COLORS — DARK (genz) overrides
```
Surfaces:  bg #0d0f15 · card #171c2a · dim #121520 · deep #272f45 · raised #1e2434
Text:      #f4f3ef (main) · #c9cad2 (soft) · #9599a8 (muted) · border #2d3242
Accent(orange): primary #f05a22 · electric #ff6a2e · light #ff8c62 · on-accent #0d0f15
Tags: marigold #e0a63a · peacock #3fb8c3 · rani #f26aa6 · indigo #8c9cf0 · emerald #2bc384 · danger #ff9e90
```

### TYPOGRAPHY (self-host these OFL fonts as .woff2)
```
Display/Headings: Newsreader (serif, light theme)  ·  Teko (condensed, dark theme)
Body:             Instrument Sans (light)           ·  Hind (dark)
Mono:             JetBrains Mono
Devanagari:       Noto Sans Devanagari  → used for the "स्व" wordmark + Hindi
Also available:   Bricolage Grotesque (heavy display)
```

### SHAPE / SPACING / MOTION
```
Radius:  base 0.875rem · card 1rem(dark)/0.25rem(light) · control 0.625rem/0.25rem · pill 999px
Shadow:  LIGHT = none (use 1px hairline border + 2–4px translateY on hover)
         DARK  = soft card shadow + orange accent glow
Rhythm:  stack-sm 1rem · stack 2rem · stack-lg 3.5rem · section padding ~5–7rem · container max 80rem
Texture: subtle SVG paper-grain overlay (~3% opacity) on body; optional Indian-motif patterns (jaali/ikat)
Motion:  framer-motion, gentle; hover-lift, press-scale, reveal-on-scroll, animated numbers
```

### BRAND / LOGO
- Wordmark is **text only, no icon**: "**स्व**" (Devanagari) + "**YAM**" (Latin) joined as one word.
  The wordmark *is* the logo.

### COMPONENT CLASS VOCABULARY (recreate these as the building blocks)
```
Cards/surfaces: .card · .card-flat · .panel · .glass · .tonal
Buttons:        .btn-primary · .btn-ghost · .btn-dark · .btn-text
Chips/tags:     .chip · .chip-accent · .filter-pill · .badge-soft · .sticker
Inputs:         .input · .field-rule
Nav:            .nav-island · .nav-link  (also a bottom nav for mobile)
Type:           .kicker · .type-hero · .type-xl · .type-lg · .type-md · .section-title · .stat-figure
```
Build a single `/design` style-guide page showing all of the above (the original has one).

---

## 3. OFFLINE DATA PATTERN (how to store everything without a DB)

- Put all content in **`src/data/*.ts`** as typed exports (the original app already uses a big
  `src/data/mock.ts` as the "swap this for the API later" seam — follow that pattern).
- For the K-12 app, model it as the master prompt wants and hardcode it:
  ```ts
  // src/data/curriculum.ts
  Board → Class → Subject → Chapter → { lectures[], notes, quiz[], practice[] }
  // lecture = { title, youtubeId, durationMin }  (embed real YouTube IDs; never fake them)
  // note    = { heading, body[], definitions[], formulas[], examples[], summary }
  // quiz    = { question, options[], correctIndex, explanation }
  ```
- **User state in localStorage** (namespaced keys), e.g. `swyam.role`, `swyam.session`,
  `swyam.progress`, `swyam.skillpoints`, `swyam.parentLink`. Read/write through one small
  `src/lib/store.ts` helper so it's swappable later.
- Progress sharing across the 3 dashboards works because **all three read the same localStorage**
  on the same device (good enough for an offline demo — state it honestly, don't claim real-time sync).

---

## 4. AI — OFFLINE / ON-DEVICE ONLY (no paid APIs by default)

- The original app ships a **local, deterministic Sarthi engine** that answers from its own
  content with **zero external API calls** — use that approach for "Sarthi AI": retrieve from the
  hardcoded notes/chapters and compose an answer. It can explain concepts, give practice Qs, and
  explain wrong answers **without** calling any cloud model.
- **Quizzes/notes**: pre-write them in `src/data/` (do NOT generate live from an LLM — that needs
  a paid/limited API). Treat AI as "retrieve + template from local content."
- **Voice**: offline, use the **browser's built-in Web Speech API** — `SpeechRecognition` (mic in)
  and `speechSynthesis` (spoken out). Free, no keys, works for Hindi/English in-browser. Build the
  mic button + listening/speaking indicators around that. Do NOT build fake mic buttons.
- If an online model is ever wired later, the original uses Gemini **server-side only**
  (`gemini-flash-lite` tier) — but that is **out of scope for the offline build**.

---

## 5. WHAT TO IGNORE from the existing app (don't copy these)

SkillSwap / skill bartering, jobs & internships feed, mentors, companies/employers, the vocational
40-course catalog, Supabase (84 tables), Firebase auth bridge, Sarvam phone-call voice, Adzuna jobs,
the "Evolution" adaptive-UI system, payments/coupons. **None of these are needed** for the K-12
learning app in the master prompt. Take only the **design system + offline + local-AI patterns**.

---

## 6. BUILD ORDER (offline-adjusted)

1. Design system + `/design` page (palette, fonts, components above).
2. Role picker → 3 dashboards (Student / Teacher / Parent) switched by localStorage role.
3. Student learning hub: Board→Class→Subject→Chapter→Lecture(YouTube embed)→AI notes→quiz, all from `src/data/`.
4. Sarthi AI (local retrieval) + Web Speech voice, inside chapter pages.
5. Progress + SkillPoints + rewards store (localStorage).
6. Parent & Teacher dashboards reading the same localStorage progress.
7. Study planner + weak-topic view (computed from local quiz results).

Keep CBSE only. Ship working core before polish.
