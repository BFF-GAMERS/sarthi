import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Compass,
  Download,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { Reveal } from "../components/Reveal";
import { SloganPlate, BlockPrintRule } from "../components/Ornaments";
import PillTabs from "../components/PillTabs";
import { CourseCard } from "../components/Cards";
import { courses } from "../data/mock";
import { SUPPORTED_LANGUAGES } from "../lib/languages";
import { useTx } from "../lib/i18n";
import CoachFeedback from "../components/CoachFeedback";
import { clearCoachPrefill, loadCoachPrefill } from "../lib/coach";
import {
  blockId,
  clearProgress,
  toggleBlock,
  useWeekProgress,
  weekSummary,
} from "../lib/coach-progress";
import {
  PROFILE_TYPES,
  coachFor,
  setProfileType,
  typesForRole,
  useProfileType,
  type ProfileType,
} from "../lib/profile-type";
import {
  BUDGETS,
  COLLEGE_INTERESTS,
  MODES,
  SCHOOL_INTERESTS,
  SCHOOL_LEVELS,
  STREAMS,
  deleteCoach,
  extractMarks,
  generatePlan,
  loadCoach,
  percentOf,
  saveCoach,
  type CoachInputs,
  type CoachMode,
  type CoachPlan,
  type CoachRecord,
  type SubjectMark,
} from "../lib/coach";

/**
 * The AI coach.
 *
 * One page, two names. A school student sees the "AI Study Coach"; a college
 * student sees the "AI Career & Learning Coach". The questions differ, the
 * plan differs, the promise is the same: here is what to focus on next.
 *
 * The page is built around three things the brief is firm about and this
 * file is firm about too:
 *
 *  - Consent first. Nothing is asked for until the student has read, in
 *    plain words, what the marks are used for and that they can delete them.
 *  - Never a report card. The bands are strength / steady / focus, the colour
 *    for "focus" is a warm marigold and not a red, and every subject gets an
 *    encouraging line. A student who did badly in one paper should leave
 *    this page knowing what to do on Monday, not how they rank.
 *  - Theirs to delete. The marks live on this device only, and the delete
 *    button removes everything — inputs, plan, consent — in one press.
 */

type Tab = "overview" | "subjects" | "plan" | "practice" | "courses" | "path";

const CONSENT =
  "Your marks are used only to create your learning recommendations. They are kept on this device, never shown to anyone else, and you can delete them anytime.";

const EMPTY = (mode: CoachMode, language: string): CoachInputs => ({
  mode,
  level: mode === "school" ? "Class 10" : "",
  marks: [
    { subject: "", max: 100, scored: 0 },
    { subject: "", max: 100, scored: 0 },
    { subject: "", max: 100, scored: 0 },
  ],
  interests: [],
  goal: "",
  city: "",
  language,
  budget: "free",
  learningMode: "any",
});

export default function Coach() {
  const tx = useTx();
  const navigate = useNavigate();
  const { user, ready, profileId } = useAuth();
  const { prefs } = usePreferences();
  const type = useProfileType(user?.email, user?.role, profileId);

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);
  if (!ready || !user) return null;

  const which = coachFor(type);

  // A student-role account that has not said which kind of student yet.
  if (!type) return <PickType email={user.email} role={user.role} profileId={profileId} />;

  // Job seekers and professionals get the other coach, which is the CV
  // review, the job matches and the passport — already built, elsewhere.
  if (which === "career") return <CareerCoachPointer />;
  if (!which) return <NotForThisAccount />;

  return <StudentCoach email={user.email} mode={which} defaultLanguage={prefs.locale} />;
}

/* ── Choosing who you are ────────────────────────────────────────── */

function PickType({
  email,
  role,
  profileId,
}: {
  email: string;
  role: "student" | "recruiter" | "institute";
  profileId: string | null;
}) {
  const tx = useTx();
  const options = typesForRole(role);
  return (
    <div className="container-x pb-24 pt-32">
      <Reveal>
        <SloganPlate tone="saffron">{tx("One question first")}</SloganPlate>
        <h1 className="section-title mt-4">{tx("Which of these is you?")}</h1>
        <p className="mt-3 max-w-xl font-body text-[15px] text-ink-mute">
          {tx(
            "The coach asks different questions for each. You can change this later in Settings.",
          )}
        </p>
        <BlockPrintRule className="mt-5" />
      </Reveal>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setProfileType(email, o.id, profileId)}
            className="card p-5 text-left transition hover:border-saffron-300 focus-visible:ring-2 focus-visible:ring-saffron-500"
          >
            <span className="block font-display text-lg text-ink">{tx(o.label)}</span>
            <span className="mt-1 block font-body text-[13px] text-ink-mute">{tx(o.purpose)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CareerCoachPointer() {
  const tx = useTx();
  return (
    <div className="container-x pb-24 pt-32">
      <Reveal>
        <SloganPlate tone="saffron">{tx("Skill & Job Coach")}</SloganPlate>
        <h1 className="section-title mt-4">
          {tx("Your coach is built around the job, not the marksheet")}
        </h1>
        <p className="mt-3 max-w-xl font-body text-[15px] text-ink-mute">
          {tx(
            "The study coach is for school and college students. For you, the useful tools are these three.",
          )}
        </p>
        <BlockPrintRule className="mt-5" />
      </Reveal>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/cv" className="card p-5 transition hover:border-saffron-300">
          <span className="block font-display text-lg text-ink">{tx("Improve my CV")}</span>
          <span className="mt-1 block font-body text-[13px] text-ink-mute">
            {tx("See what a screen would trip on before you apply.")}
          </span>
        </Link>
        <Link to="/jobs" className="card p-5 transition hover:border-saffron-300">
          <span className="block font-display text-lg text-ink">{tx("Jobs that match")}</span>
          <span className="mt-1 block font-body text-[13px] text-ink-mute">
            {tx("Openings with pay, location and a real employer.")}
          </span>
        </Link>
        <Link to="/passport" className="card p-5 transition hover:border-saffron-300">
          <span className="block font-display text-lg text-ink">
            {tx("Apply with Skill Passport")}
          </span>
          <span className="mt-1 block font-body text-[13px] text-ink-mute">
            {tx("Your proof, in one page anyone can check.")}
          </span>
        </Link>
      </div>
    </div>
  );
}

function NotForThisAccount() {
  const tx = useTx();
  return (
    <div className="container-x pb-24 pt-32">
      <h1 className="section-title">{tx("The coach is for students")}</h1>
      <p className="mt-3 font-body text-[15px] text-ink-mute">
        {tx("Recruiter and institute accounts have their own dashboard.")}{" "}
        <Link to="/dashboard" className="text-saffron-600 underline">
          {tx("Go to your dashboard")}
        </Link>
      </p>
    </div>
  );
}

/* ── The coach itself ────────────────────────────────────────────── */

function StudentCoach({
  email,
  mode,
  defaultLanguage,
}: {
  email: string;
  mode: CoachMode;
  defaultLanguage: string;
}) {
  const tx = useTx();
  const [record, setRecord] = useState<CoachRecord | null>(() => loadCoach(email));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const school = mode === "school";
  const name = school ? "AI Study Coach" : "AI Career & Learning Coach";

  const consent = () => {
    // Onboarding already asked the class, the subjects, the goal and the
    // city. Asking again two minutes later is the sort of form people close.
    const prefill = loadCoachPrefill(email);
    const r: CoachRecord = {
      inputs: {
        ...EMPTY(mode, defaultLanguage),
        ...(prefill && prefill.mode === mode ? prefill : {}),
      },
      plan: null,
      consentedAt: new Date().toISOString(),
    };
    clearCoachPrefill(email);
    saveCoach(email, r);
    setRecord(r);
  };

  const build = async (inputs: CoachInputs) => {
    setBusy(true);
    setError("");
    try {
      const plan = await generatePlan(inputs);
      const r: CoachRecord = {
        inputs,
        plan,
        consentedAt: record?.consentedAt ?? new Date().toISOString(),
      };
      saveCoach(email, r);
      setRecord(r);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the plan.");
    } finally {
      setBusy(false);
    }
  };

  const wipe = () => {
    if (
      !window.confirm(
        tx("Delete your marks, plan and answers from this device? This cannot be undone."),
      )
    )
      return;
    deleteCoach(email);
    // The ticks are part of the academic record too.
    clearProgress();
    setRecord(null);
    setEditing(false);
  };

  return (
    <div className="container-x pb-24 pt-32">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SloganPlate tone="saffron">{tx(name)}</SloganPlate>
            <h1 className="section-title mt-4">
              {record?.plan && !editing
                ? record.plan.snapshot.headline
                : tx("Here is what to focus on next")}
            </h1>
            <BlockPrintRule className="mt-5" />
          </div>
          {record?.plan && !editing && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-ghost !py-2.5 !text-xs"
              >
                <RefreshCw size={14} aria-hidden /> {tx("Update details")}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-ghost !py-2.5 !text-xs"
              >
                <Download size={14} aria-hidden /> {tx("Download my plan")}
              </button>
              <button
                type="button"
                onClick={wipe}
                className="btn-ghost !py-2.5 !text-xs text-saffron-700"
              >
                <Trash2 size={14} aria-hidden /> {tx("Delete my academic data")}
              </button>
            </div>
          )}
        </div>
      </Reveal>

      {!record && <Consent onAgree={consent} school={school} />}

      {record && (!record.plan || editing) && (
        <Form
          initial={record.inputs}
          school={school}
          busy={busy}
          error={error}
          onSubmit={build}
          onCancel={record.plan ? () => setEditing(false) : undefined}
        />
      )}

      {record?.plan && !editing && (
        <Results plan={record.plan} inputs={record.inputs} school={school} />
      )}
    </div>
  );
}

/* ── Consent ─────────────────────────────────────────────────────── */

function Consent({ onAgree, school }: { onAgree: () => void; school: boolean }) {
  const tx = useTx();
  return (
    <Reveal className="mt-8">
      <div className="card mx-auto max-w-xl p-6 sm:p-8">
        <span
          className="grid h-10 w-10 place-items-center rounded-full bg-saffron-50 text-saffron-600"
          aria-hidden
        >
          <Lock size={18} />
        </span>
        <h2 className="mt-4 font-display text-xl text-ink">{tx("Before you start")}</h2>
        <p className="mt-2 font-body text-[15px] leading-relaxed text-ink">{tx(CONSENT)}</p>
        <ul className="mt-4 space-y-2 font-body text-[13.5px] text-ink-mute">
          <li className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-saffron-600" aria-hidden />
            {tx("Marks are one input, not a judgment. The plan is about what to do next.")}
          </li>
          <li className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-saffron-600" aria-hidden />
            {tx("Nothing here is shown to recruiters, institutes or other members.")}
          </li>
          <li className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-saffron-600" aria-hidden />
            {school
              ? tx("No job pressure. This is about study, and a first look at what is out there.")
              : tx(
                  "Free and low-cost options come first. Nothing is guaranteed, and nothing pretends to be.",
                )}
          </li>
        </ul>
        <button type="button" onClick={onAgree} className="btn-primary mt-6 w-full sm:w-auto">
          {tx("I understand — build my learning plan")} <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </Reveal>
  );
}

/* ── The form ────────────────────────────────────────────────────── */

function Form({
  initial,
  school,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: CoachInputs;
  school: boolean;
  busy: boolean;
  error: string;
  onSubmit: (i: CoachInputs) => void;
  onCancel?: () => void;
}) {
  const tx = useTx();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<CoachInputs>(initial);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CoachInputs>(k: K, val: CoachInputs[K]) =>
    setV((p) => ({ ...p, [k]: val }));
  const setMark = (i: number, patch: Partial<SubjectMark>) =>
    setV((p) => ({ ...p, marks: p.marks.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  const classNum = Number((v.level.match(/\d+/) ?? [])[0] ?? 0);
  const validMarks = v.marks.filter((m) => m.subject.trim() && m.max > 0);
  const canGo = [
    v.level.trim().length > 0 && (school || (v.degree ?? "").trim().length > 0),
    validMarks.length >= 1,
    true,
  ];

  const upload = async (file: File) => {
    setReading(true);
    setReadNote("");
    try {
      const out = await extractMarks(file);
      if (out.marks.length === 0) {
        setReadNote(
          out.notes ||
            tx("Could not read any marks from that photo. Try a clearer one, or type them in."),
        );
      } else {
        setV((p) => ({
          ...p,
          marks: out.marks,
          level: p.level || out.level || p.level,
          board: p.board || out.board || p.board,
        }));
        setReadNote(
          `${tx("Read")} ${out.marks.length} ${tx("subjects. Check them below before you continue.")}${out.notes ? ` ${out.notes}` : ""}`,
        );
      }
    } catch (e) {
      setReadNote(e instanceof Error ? e.message : tx("Could not read the marksheet."));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const interests = school ? SCHOOL_INTERESTS : COLLEGE_INTERESTS;
  const toggleInterest = (s: string) =>
    set(
      "interests",
      v.interests.includes(s)
        ? v.interests.filter((x) => x !== s)
        : [...v.interests, s].slice(0, 6),
    );

  const steps = [tx("About you"), tx("Your marks"), tx("Your goals")];

  return (
    <Reveal className="mt-8">
      <div className="mx-auto max-w-2xl">
        {/* Step strip */}
        <ol className="flex items-center gap-2 font-body text-[12px]" aria-label={tx("Steps")}>
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
                  i < step
                    ? "bg-saffron-500 text-on-accent"
                    : i === step
                      ? "bg-ink text-white"
                      : "bg-paper-dim text-ink-mute"
                }`}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check size={12} aria-hidden /> : i + 1}
              </span>
              <span className={i === step ? "text-ink" : "text-ink-mute"}>{s}</span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-ink-line" aria-hidden />}
            </li>
          ))}
        </ol>

        <div className="card mt-4 p-5 sm:p-7">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl text-ink">{tx("About you")}</h2>
              {school ? (
                <Field label={tx("Class")}>
                  <select
                    value={v.level}
                    onChange={(e) => set("level", e.target.value)}
                    className="input"
                  >
                    {SCHOOL_LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={tx("Degree")}>
                    <input
                      value={v.degree ?? ""}
                      onChange={(e) => {
                        set("degree", e.target.value);
                        set("level", `${e.target.value}${v.year ? `, ${v.year}` : ""}`);
                      }}
                      className="input"
                      placeholder={tx("B.Com, BCA, Diploma in Mechanical…")}
                    />
                  </Field>
                  <Field label={tx("Branch / major")}>
                    <input
                      value={v.branch ?? ""}
                      onChange={(e) => set("branch", e.target.value)}
                      className="input"
                      placeholder={tx("Optional")}
                    />
                  </Field>
                  <Field label={tx("Year / semester")}>
                    <input
                      value={v.year ?? ""}
                      onChange={(e) => {
                        set("year", e.target.value);
                        set(
                          "level",
                          `${v.degree ?? ""}${e.target.value ? `, ${e.target.value}` : ""}`,
                        );
                      }}
                      className="input"
                      placeholder={tx("2nd year · 4th semester")}
                    />
                  </Field>
                  <Field label={tx("University / college")}>
                    <input
                      value={v.board ?? ""}
                      onChange={(e) => set("board", e.target.value)}
                      className="input"
                      placeholder={tx("Optional")}
                    />
                  </Field>
                </div>
              )}
              {school && (
                <Field label={tx("Board")}>
                  <input
                    value={v.board ?? ""}
                    onChange={(e) => set("board", e.target.value)}
                    className="input"
                    placeholder={tx("CBSE, ICSE, State board — optional")}
                  />
                </Field>
              )}
              {school && classNum >= 9 && (
                <Field label={tx("Stream")}>
                  <select
                    value={v.stream ?? STREAMS[0]}
                    onChange={(e) => set("stream", e.target.value)}
                    className="input"
                  >
                    {STREAMS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={tx("City")}>
                  <input
                    value={v.city}
                    onChange={(e) => set("city", e.target.value)}
                    className="input"
                    placeholder={tx("Where you live")}
                  />
                </Field>
                <Field label={tx("Language for the plan")}>
                  <select
                    value={v.language}
                    onChange={(e) => set("language", e.target.value)}
                    className="input"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.native}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={tx("Budget for courses")}>
                  <Chips
                    items={BUDGETS.map((b) => ({ id: b.id, label: tx(b.label) }))}
                    value={v.budget}
                    onChange={(id) => set("budget", id as CoachInputs["budget"])}
                  />
                </Field>
                <Field label={tx("How you prefer to learn")}>
                  <Chips
                    items={MODES.map((m) => ({ id: m.id, label: tx(m.label) }))}
                    value={v.learningMode}
                    onChange={(id) => set("learningMode", id as CoachInputs["learningMode"])}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl text-ink">{tx("Your marks")}</h2>
              <p className="font-body text-[13.5px] text-ink-mute">
                {tx("Take a photo of your marksheet, or type the subjects in. Either works.")}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={reading}
                  className="btn-ghost w-full justify-center sm:w-auto"
                >
                  {reading ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Camera size={16} aria-hidden />
                  )}
                  {reading ? tx("Reading…") : tx("Upload marksheet photo")}
                </button>
                <span className="font-body text-[12px] text-ink-mute">
                  {tx("JPG or PNG. The photo is read once and not kept.")}
                </span>
              </div>
              {readNote && (
                <p className="rounded-lg bg-paper-dim px-3 py-2 font-body text-[13px] text-ink">
                  {readNote}
                </p>
              )}

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_5rem_5rem_2rem] gap-2 px-1 font-body text-[11px] uppercase tracking-wide text-ink-mute">
                  <span>{tx("Subject")}</span>
                  <span>{tx("Scored")}</span>
                  <span>{tx("Out of")}</span>
                  <span />
                </div>
                {v.marks.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5rem_5rem_2rem] items-center gap-2">
                    <input
                      value={m.subject}
                      onChange={(e) => setMark(i, { subject: e.target.value })}
                      className="input"
                      placeholder={tx("Maths")}
                      aria-label={tx("Subject")}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={m.scored}
                      onChange={(e) => setMark(i, { scored: Number(e.target.value) })}
                      className="input"
                      aria-label={tx("Scored")}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={m.max}
                      onChange={(e) => setMark(i, { max: Number(e.target.value) })}
                      className="input"
                      aria-label={tx("Out of")}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setV((p) => ({ ...p, marks: p.marks.filter((_, j) => j !== i) }))
                      }
                      className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-paper-dim hover:text-ink"
                      aria-label={tx("Remove subject")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setV((p) => ({
                      ...p,
                      marks: [...p.marks, { subject: "", max: 100, scored: 0 }],
                    }))
                  }
                  className="btn-ghost !py-2 !text-xs"
                >
                  <Plus size={14} aria-hidden /> {tx("Add a subject")}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl text-ink">{tx("Your goals")}</h2>
              <Field label={tx("What do you enjoy? Pick up to six")}>
                <div className="flex flex-wrap gap-2">
                  {interests.map((s) => {
                    const on = v.interests.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleInterest(s)}
                        aria-pressed={on}
                        className={`chip !text-[12px] ${on ? "!bg-saffron-500 !text-on-accent" : ""}`}
                      >
                        {tx(s)}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field
                label={
                  school
                    ? tx("What would you like to get better at, or become?")
                    : tx("Career goal")
                }
              >
                <input
                  value={v.goal}
                  onChange={(e) => set("goal", e.target.value)}
                  className="input"
                  placeholder={
                    school
                      ? tx("Better at math · become an engineer · not sure yet")
                      : tx("Frontend developer · data analyst · not sure yet")
                  }
                />
              </Field>
              {!school && (
                <>
                  <Field label={tx("Target role or industry")}>
                    <input
                      value={v.targetRole ?? ""}
                      onChange={(e) => set("targetRole", e.target.value)}
                      className="input"
                      placeholder={tx("Optional")}
                    />
                  </Field>
                  <Field label={tx("Skills you already have")}>
                    <input
                      value={(v.skills ?? []).join(", ")}
                      onChange={(e) =>
                        set(
                          "skills",
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      className="input"
                      placeholder={tx("Excel, Python, Tally — separate with commas")}
                    />
                  </Field>
                  <Field label={tx("Projects or internships so far")}>
                    <textarea
                      value={v.projects ?? ""}
                      onChange={(e) => set("projects", e.target.value)}
                      className="input min-h-[5rem]"
                      placeholder={tx("A line or two. Optional.")}
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          {error && (
            <p
              className="mt-4 rounded-lg bg-saffron-50 px-3 py-2 font-body text-[13px] text-saffron-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="btn-ghost !py-2.5"
                >
                  <ArrowLeft size={14} aria-hidden /> {tx("Back")}
                </button>
              )}
              {onCancel && (
                <button type="button" onClick={onCancel} className="btn-ghost !py-2.5">
                  {tx("Cancel")}
                </button>
              )}
            </div>
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canGo[step]}
                className="btn-primary w-full sm:w-auto"
              >
                {tx("Next")} <ArrowRight size={16} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSubmit({ ...v, marks: validMarks })}
                disabled={busy || validMarks.length === 0}
                className="btn-primary w-full sm:w-auto"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles size={16} aria-hidden />
                )}
                {busy ? tx("Building your plan…") : tx("Build my learning plan")}
              </button>
            )}
          </div>
        </div>

        {busy && <Skeleton />}
      </div>
    </Reveal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-[12.5px] font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

function Chips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          onClick={() => onChange(it.id)}
          className={`chip !text-[12px] ${value === it.id ? "!bg-ink !text-paper" : ""}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card animate-pulse p-5">
          <div className="h-4 w-1/3 rounded bg-paper-dim" />
          <div className="mt-3 h-3 w-full rounded bg-paper-dim" />
          <div className="mt-2 h-3 w-5/6 rounded bg-paper-dim" />
        </div>
      ))}
    </div>
  );
}

/* ── Results ─────────────────────────────────────────────────────── */

const BAND = {
  strength: { label: "Strength", bar: "bg-saffron-500", chip: "bg-saffron-50 text-saffron-700" },
  steady: { label: "Steady", bar: "bg-peacock", chip: "bg-[#e6f2f3] text-peacock" },
  focus: { label: "Focus next", bar: "bg-marigold", chip: "bg-[#fbf3e3] text-marigold-600" },
} as const;

function Results({
  plan,
  inputs,
  school,
}: {
  plan: CoachPlan;
  inputs: CoachInputs;
  school: boolean;
}) {
  const tx = useTx();
  const [tab, setTab] = useState<Tab>("overview");

  // A #hash from the role navigation lands on the right tab.
  useEffect(() => {
    const h = (window.location.hash || "").replace("#", "") as Tab;
    if (["overview", "subjects", "plan", "practice", "courses", "path"].includes(h)) setTab(h);
  }, []);

  const tabs = [
    { id: "overview" as const, label: tx("Overview") },
    { id: "subjects" as const, label: tx("Subjects"), count: plan.subjects.length },
    { id: "plan" as const, label: tx("Study plan") },
    { id: "practice" as const, label: tx("Practice"), count: plan.quizzes.length },
    { id: "courses" as const, label: tx("Courses"), count: plan.recommendedCourses.length },
    { id: "path" as const, label: school ? tx("Careers") : tx("Roadmap") },
  ];

  return (
    <div className="mt-6">
      <p className="max-w-2xl font-body text-[15px] leading-relaxed text-ink">
        {plan.snapshot.summary}
      </p>
      <p className="mt-2 font-body text-[12px] text-ink-mute">
        {tx("Based on")} {plan.subjects.length} {tx("subjects")} · {tx("plan made")}{" "}
        {new Date(plan.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
        · {tx("kept on this device only")}
      </p>

      <PillTabs
        tabs={tabs}
        selected={tab}
        onSelect={setTab}
        layoutGroup="coach-tabs"
        className="mt-6 print:hidden"
        ariaLabel={tx("Sections of your plan")}
      />

      <div className="mt-6">
        {tab === "overview" && <Overview plan={plan} school={school} />}
        {tab === "subjects" && <Subjects plan={plan} />}
        {tab === "plan" && <StudyPlan plan={plan} />}
        {tab === "practice" && <Practice plan={plan} />}
        {tab === "courses" && <Courses plan={plan} inputs={inputs} />}
        {tab === "path" && <Path plan={plan} school={school} />}
      </div>

      <CoachFeedback kind={school ? "school" : inputs.mode === "college" ? "college" : "career"} />

      <div className="card mt-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="font-display text-lg text-ink">
            {tx("Want to talk it through with a person?")}
          </p>
          <p className="font-body text-[13px] text-ink-mute">
            {tx("A mentor or counsellor can look at this plan with you. No charge.")}
          </p>
        </div>
        <Link to="/contact" search={{ reason: "mentor" }} className="btn-primary shrink-0">
          <Users size={16} aria-hidden /> {tx("Talk to a mentor")}
        </Link>
      </div>
    </div>
  );
}

function Overview({ plan, school }: { plan: CoachPlan; school: boolean }) {
  const tx = useTx();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <div className="card p-5">
          <p className="datum">{tx("Your strengths")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.strengths.map((s) => (
              <span key={s} className="chip !bg-saffron-50 !text-saffron-700">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="datum">{tx("Focus next")}</p>
          <ul className="mt-3 space-y-3">
            {plan.focusAreas.map((f) => (
              <li key={f.subject} className="rounded-lg bg-paper-dim p-3">
                <p className="font-body text-[14px] font-semibold text-ink">{f.subject}</p>
                <p className="font-body text-[13px] text-ink-mute">{f.why}</p>
                <p className="mt-1 font-body text-[13px] text-ink">
                  <span className="font-semibold text-saffron-700">{tx("This week:")}</span>{" "}
                  {f.firstStep}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <p className="datum">{tx("Do this week")}</p>
          <ol className="mt-3 space-y-2">
            {plan.nextActions.map((a, i) => (
              <li key={i} className="flex gap-3 font-body text-[14px] text-ink">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <aside className="space-y-4">
        {plan.snapshot.overallPercent !== null && (
          <div className="card p-5">
            <p className="datum">{tx("Overall")}</p>
            <p className="mt-1 font-display text-4xl text-ink">{plan.snapshot.overallPercent}%</p>
            <p className="font-body text-[12.5px] text-ink-mute">
              {tx("Average across your subjects. One number, not the whole story.")}
            </p>
          </div>
        )}
        <div className="card p-5">
          <p className="datum">{tx("A note from your coach")}</p>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-ink">
            {plan.encouragement}
          </p>
        </div>
        {plan.timeManagement.length > 0 && (
          <div className="card p-5">
            <p className="datum">{tx("Managing your time")}</p>
            <ul className="mt-2 space-y-1.5 font-body text-[13px] text-ink">
              {plan.timeManagement.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check size={14} className="mt-1 shrink-0 text-saffron-600" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        {school && (
          <p className="px-1 font-body text-[12px] text-ink-mute">
            {tx("Marks are one indicator. They do not define you, and this plan does not either.")}
          </p>
        )}
      </aside>
    </div>
  );
}

function Subjects({ plan }: { plan: CoachPlan }) {
  const tx = useTx();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {plan.subjects.map((s) => {
        const b = BAND[s.band];
        return (
          <div key={s.subject} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-ink">{s.subject}</p>
                <p className="font-body text-[12.5px] text-ink-mute">
                  {s.scored} / {s.max}
                </p>
              </div>
              <span className={`chip !text-[11px] ${b.chip}`}>{tx(b.label)}</span>
            </div>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-dim"
              role="progressbar"
              aria-valuenow={s.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${s.subject} ${s.percent}%`}
            >
              <div className={`h-full ${b.bar}`} style={{ width: `${s.percent}%` }} />
            </div>
            <p className="mt-3 font-body text-[13.5px] text-ink">{s.note}</p>
            {plan.tips
              .filter((t) => t.subject.toLowerCase() === s.subject.toLowerCase())
              .map((t) => (
                <p
                  key={t.tip}
                  className="mt-2 rounded-lg bg-paper-dim px-3 py-2 font-body text-[13px] text-ink"
                >
                  <span className="font-semibold">{tx("Tip:")}</span> {t.tip}
                </p>
              ))}
            {plan.concepts
              .filter((c) => c.subject.toLowerCase() === s.subject.toLowerCase())
              .map((c) => (
                <div key={c.subject} className="mt-2">
                  <p className="font-body text-[11px] uppercase tracking-wide text-ink-mute">
                    {tx("Revise")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.items.map((it) => (
                      <span key={it} className="chip !text-[11px]">
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The week, and the ticks.
 *
 * A plan you cannot mark is a printout. Each block is a checkbox; the ticks
 * live on this device beside the plan itself and are what the dashboard
 * counts. Nothing is scored and nothing is lost by a missed week — the count
 * is simply the count.
 */
function StudyPlan({ plan }: { plan: CoachPlan }) {
  const tx = useTx();
  const ticked = useWeekProgress();
  const total = plan.weeklyPlan.reduce((n, d) => n + d.blocks.length, 0);
  const week = weekSummary(total);

  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-body text-[14px] font-semibold text-ink">
            {week.done === 0
              ? tx("Nothing ticked off this week yet")
              : week.done >= total && total > 0
                ? tx("Every block done. You kept a promise to yourself this week.")
                : `${week.done} ${tx("of")} ${total} ${tx("blocks done this week")}`}
          </p>
          <p className="mt-0.5 font-body text-[12px] text-ink-mute">
            {tx("Tick a block when you finish it. It is kept on this device only.")}
          </p>
        </div>
        <div className="w-full max-w-[12rem]">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-paper-deep"
            role="progressbar"
            aria-valuenow={week.done}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={tx("Blocks done this week")}
          >
            <span
              className="block h-full rounded-full bg-saffron-500 transition-[width] duration-500"
              style={{ width: `${week.percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plan.weeklyPlan.map((d) => (
          <div key={d.day} className="card p-4">
            <p className="font-display text-base text-ink">{d.day}</p>
            <ul className="mt-2 space-y-2">
              {d.blocks.map((b, i) => {
                const id = blockId(d.day, i);
                const done = ticked.includes(id);
                return (
                  <li key={i}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-lg p-2.5 transition-colors ${
                        done ? "bg-emeraldx-400/10" : "bg-paper-dim hover:bg-paper-deep/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleBlock(id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-saffron-500)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-body text-[11px] font-semibold text-saffron-700">
                          {b.minutes} {tx("min")}
                        </span>
                        <span
                          className={`mt-0.5 block font-body text-[13px] ${
                            done ? "text-ink-mute line-through" : "text-ink"
                          }`}
                        >
                          <span className="font-semibold">{b.subject}:</span> {b.task}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {plan.weeklyPlan.length === 0 && (
          <p className="font-body text-ink-mute">
            {tx("No weekly plan came back. Try updating your details.")}
          </p>
        )}
      </div>
    </>
  );
}

function Practice({ plan }: { plan: CoachPlan }) {
  const tx = useTx();
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div className="space-y-4">
      {plan.practice.length > 0 && (
        <div className="card p-5">
          <p className="datum">{tx("Practice tasks")}</p>
          <ul className="mt-3 space-y-2">
            {plan.practice.map((p, i) => (
              <li key={i} className="font-body text-[14px] text-ink">
                <span className="font-semibold">{p.subject}:</span> {p.task}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.quizzes.map((q, qi) => {
        const chosen = picked[qi];
        return (
          <div key={qi} className="card p-5">
            <p className="datum">{q.subject}</p>
            <p className="mt-2 font-body text-[15px] font-semibold text-ink">{q.question}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const state =
                  chosen === undefined
                    ? ""
                    : oi === q.answer
                      ? "!border-saffron-500 !bg-saffron-50"
                      : oi === chosen
                        ? "!border-ink-line !bg-paper-dim"
                        : "";
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={chosen !== undefined}
                    onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                    className={`rounded-lg border border-ink-line px-3 py-2.5 text-left font-body text-[13.5px] text-ink transition hover:border-saffron-300 disabled:cursor-default ${state}`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {chosen !== undefined && (
              <p className="mt-3 rounded-lg bg-paper-dim px-3 py-2 font-body text-[13px] text-ink">
                <span className="font-semibold">
                  {chosen === q.answer ? tx("Yes.") : tx("Not quite — and that is fine.")}
                </span>{" "}
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
      {plan.quizzes.length === 0 && plan.practice.length === 0 && (
        <p className="font-body text-ink-mute">
          {tx("No practice came back. Try updating your details.")}
        </p>
      )}
    </div>
  );
}

function Courses({ plan, inputs }: { plan: CoachPlan; inputs: CoachInputs }) {
  const tx = useTx();
  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), []);
  const recs = plan.recommendedCourses
    .map((r) => ({ ...r, course: byId.get(r.courseId) }))
    .filter((r) => r.course);
  return (
    <div>
      <p className="font-body text-[13px] text-ink-mute">
        {tx(
          "Matched on your marks, interests, goal, city, budget and language. Every course here is on the platform today.",
        )}
        {inputs.budget === "free" && ` ${tx("Only free courses were considered.")}`}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
        {recs.map((r) => (
          <div key={r.courseId} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="chip !bg-saffron-500 !text-[11px] !text-on-accent">
                {tx(r.label)}
              </span>
              {r.prerequisite && byId.get(r.prerequisite) && (
                <span className="font-body text-[12px] text-ink-mute">
                  {tx("after")}{" "}
                  <Link to="/courses/$id" params={{ id: r.prerequisite }} className="underline">
                    {byId.get(r.prerequisite)!.title}
                  </Link>
                </span>
              )}
            </div>
            <CourseCard course={r.course!} />
            <p className="px-1 font-body text-[13px] text-ink">
              <span className="font-semibold">{tx("Why:")}</span> {r.why}
            </p>
          </div>
        ))}
      </div>
      {recs.length === 0 && (
        <p className="mt-4 font-body text-ink-mute">
          {tx("Nothing in the catalog fit closely enough to recommend honestly. Browse")}{" "}
          <Link to="/courses" className="underline">
            {tx("all courses")}
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function Path({ plan, school }: { plan: CoachPlan; school: boolean }) {
  const tx = useTx();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {plan.streams && plan.streams.length > 0 && (
          <div className="card p-5">
            <p className="datum">{tx("Streams to consider")}</p>
            <ul className="mt-3 space-y-2">
              {plan.streams.map((s) => (
                <li key={s.name} className="flex items-start gap-3 rounded-lg bg-paper-dim p-3">
                  <span
                    className={`chip !text-[11px] ${s.fit === "strong" ? "!bg-saffron-50 !text-saffron-700" : ""}`}
                  >
                    {tx(
                      s.fit === "strong"
                        ? "Strong fit"
                        : s.fit === "possible"
                          ? "Possible"
                          : "Explore",
                    )}
                  </span>
                  <span>
                    <span className="font-body text-[14px] font-semibold text-ink">{s.name}</span>
                    <span className="block font-body text-[13px] text-ink-mute">{s.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="card p-5">
          <p className="datum">
            {school ? tx("Career directions to explore") : tx("Career directions")}
          </p>
          <ul className="mt-3 space-y-3">
            {plan.careerDirections.map((c) => (
              <li key={c.title}>
                <p className="font-body text-[14px] font-semibold text-ink">
                  <Compass size={14} className="mr-1 inline text-saffron-600" aria-hidden />
                  {c.title}
                </p>
                <p className="font-body text-[13px] text-ink-mute">{c.why}</p>
                <p className="font-body text-[13px] text-ink">
                  <span className="font-semibold text-saffron-700">{tx("First step:")}</span>{" "}
                  {c.firstStep}
                </p>
              </li>
            ))}
          </ul>
          <Link to="/careers" className="btn-ghost mt-4 !py-2 !text-xs">
            <BookOpen size={14} aria-hidden /> {tx("Explore careers")}
          </Link>
        </div>
      </div>
      <div className="card p-5">
        <p className="datum">{tx("My growth path")}</p>
        <ol className="mt-3 space-y-3">
          {plan.growthPath.map((g) => (
            <li key={g.step} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron-500 font-body text-[12px] font-semibold text-on-accent">
                {g.step}
              </span>
              <span>
                <span className="block font-body text-[14px] font-semibold text-ink">
                  {g.title}
                </span>
                <span className="block font-body text-[13px] text-ink-mute">{g.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
