# Swyam — AI learning for CBSE Classes 8–12

Free learning platform: courses → modules → YouTube lectures, Sarthi AI notes, likely exam questions, quizzes, Sarthi voice tutor (English / Hindi / Hinglish), SkillPoints rewards, study planner, and separate Student / Parent / Teacher dashboards.

No database: accounts, progress and AI-made chapter material are stored in the browser (localStorage). A small Node server keeps the API keys private and calls Gemini / YouTube.

## Run it

```bash
npm install
npm run build
npm start            # → http://127.0.0.1:8787  (app + AI server in one)
```

For development with hot reload: `npm run dev` (Vite on :5173 + API server on :8787).

## Keys (`.env`, never committed)

| Key | What it does | Where |
|---|---|---|
| `GEMINI_API_KEY` | Sarthi answers, chapter notes, quizzes, exam questions | Google AI Studio |
| `GEMINI_MODEL` | default `gemini-3.5-flash-lite` (falls back to `gemini-flash-lite-latest`) | — |
| `YOUTUBE_API_KEY` | picks the most-watched lectures per chapter | Google Cloud Console → enable **YouTube Data API v3** → Credentials → API key (free, no billing) |

Without `YOUTUBE_API_KEY` each lecture shows a "Find on YouTube" search link instead of an embedded video.

### Fill every chapter's lectures in advance

```bash
npm run fetch-videos               # Maths, Science, Physics, Chemistry, Social Science, Classes 8–12
npm run fetch-videos -- --class 10 # one class
npm run fetch-videos -- --all      # also Biology
```

Results go to `server/cache/videos.json` and are shared by every student. The free YouTube quota covers about 99 chapters a day; the script stops cleanly and continues where it left off when you run it again.

## How content works

- `src/data/syllabus.json` — chapter list for Classes 8–12 (verify against current NCERT books).
- `src/data/curriculum.ts` — hand-written chapters (Class 10 Science 1–2, Maths 1).
- Every other chapter: the first time a student opens it, Sarthi writes notes, summary, likely exam questions and a 6-question quiz, which are then cached in that browser.

## Honest limits

- Accounts and progress live on one device/browser. A parent or teacher sees a student's progress only on the device where the student studies. Role checks are local, not server-verified.
- AI-written notes and "most likely in exams" questions are predictions; students should cross-check with NCERT.
- Voice uses the browser's speech engine (best in Chrome/Edge). Hindi voice output depends on the voices installed on the device.
