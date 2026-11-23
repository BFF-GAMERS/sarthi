import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { SUPPORTED_LANGUAGES } from "../lib/languages";
import { TRANSLATED_LOCALES, useTx } from "../lib/i18n";
import { listSkills, type SkillRef } from "../lib/skillswap";
import { completeOnboarding, needsOnboarding, setOnboardingStep } from "../lib/onboarding";
import {
  CERTIFY_CHOICES,
  CLASS_BANDS,
  COLLEGE_GOALS,
  DELIVERY_MODES,
  EXPERIENCE_BANDS,
  FIELDS,
  SCHOOL_HELP,
  SCHOOL_SUBJECTS,
  SUPPORT_NEEDS,
  clearDraft,
  loadDraft,
  saveDraft,
  stepsFor,
  type OnboardingAnswers,
} from "../lib/onboarding-flow";
import { setProfileType, typesForRole, type ProfileType } from "../lib/profile-type";
import { CITY_NAMES } from "../lib/location";
import { createAlert } from "../lib/job-alerts";
import { createCompanyForMe } from "../lib/company";
import { saveCoachPrefill } from "../lib/coach";
import { startTour } from "./Tour";
import { useToast } from "./Toast";
import type { Role } from "../data/mock";

/**
 * The first five minutes.
 *
 * The version this replaces asked everybody the same six questions — name,
 * look, accessibility, teach, learn, goal — and then dropped them on a
 * dashboard that could not use most of the answers. A Class 9 student was
 * asked what they could teach; a recruiter was asked what they wanted to
 * learn.
 *
 * This one asks who you are first and then asks only what follows from that,
 * one decision per screen. Every answer is written somewhere real: the class
 * and subjects prefill the coach, the skills become passport entries, the
 * city and role become a job alert that fires on its own, the company becomes
 * a company row with this person as its owner. Nothing is required, every
 * step can be skipped, answers save themselves as they are given, and "save
 * and exit" comes back to the same screen — on this device from local
 * storage, on another from `profiles.onboarding_step`.
 *
 * The last screen is not a form. It is what was built.
 */
export default function Onboarding() {
  const tx = useTx();
  const { profileId, user, ready } = useAuth();
  const { prefs, set } = usePreferences();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [a, setA] = useState<OnboardingAnswers>({});

  const email = user?.email ?? "";
  const role: Role = user?.role ?? "student";
  // A recruiter or institute account answered the first question by signing
  // up as one; a student account has not.
  const askType = role === "student";

  const due = useQuery({
    queryKey: ["needs-onboarding", profileId],
    queryFn: () => needsOnboarding(profileId!),
    enabled: ready && Boolean(profileId),
    staleTime: Infinity,
  });

  // The skills catalogue is used by two of the five flows; warm it once so
  // the picker is never an empty box with a spinner in it.
  useEffect(() => {
    void qc.prefetchQuery({ queryKey: ["skills-catalogue"], queryFn: listSkills });
  }, [qc]);

  useEffect(() => {
    if (due.data !== true || !email) return;
    const saved = loadDraft(email);
    setA((v) => ({
      locale: prefs.locale,
      ...(askType ? {} : { type: role === "recruiter" ? "recruiter" : "institute" }),
      ...saved?.answers,
      ...v,
    }));
    if (saved?.step) setStep(saved.step);
    setOpen(true);
  }, [due.data, email, role, askType, prefs.locale]);

  const steps = useMemo(() => stepsFor(a.type, askType), [a.type, askType]);
  const current = steps[Math.min(step, steps.length - 1)];
  const last = current?.id === "done";

  const patch = (p: Partial<OnboardingAnswers>) => {
    setA((v) => {
      const next = { ...v, ...p };
      if (email) saveDraft(email, next, step);
      return next;
    });
  };

  const goTo = (n: number) => {
    const clamped = Math.max(0, Math.min(n, steps.length - 1));
    setStep(clamped);
    if (email) saveDraft(email, a, clamped);
  };

  const close = () => {
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["needs-onboarding", profileId] });
    for (const key of [
      "teach-skills",
      "learn-skills",
      "swap-matches",
      "member-metrics",
      "goal",
      "job-alerts",
      "employer-summary",
      "profile-detail",
    ]) {
      void qc.invalidateQueries({ queryKey: [key, profileId] });
    }
  };

  /** Save and exit: the step goes to the database, the answers stay here. */
  const saveExit = useMutation({
    mutationFn: async () => {
      if (email) saveDraft(email, a, step);
      if (profileId) await setOnboardingStep(profileId, step);
    },
    onSuccess: () => {
      setOpen(false);
      toast({
        tone: "info",
        title: "Saved",
        body: "You can finish setting up any time — it opens where you left it.",
      });
    },
    onError: (e: Error) => setError(e.message),
  });

  /**
   * Finish: write everything, each answer to the place that reads it.
   *
   * The profile call is the one that must not fail. Everything after it is
   * best effort and reported rather than rolled back: somebody who has just
   * answered five questions should not be sent round again because a job
   * alert could not be created.
   */
  const finish = useMutation({
    mutationFn: async () => {
      const notes: string[] = [];

      if (a.type) await setProfileType(email, a.type, profileId ?? undefined);

      const region = a.city || a.companyCity || a.instituteCity;
      await completeOnboarding({
        ...(a.locale ? { locale: a.locale } : {}),
        ...(region ? { region } : {}),
        ...(goalLine(a) ? { goal: goalLine(a) } : {}),
        ...(headlineFor(a) ? { headline: headlineFor(a) } : {}),
        ...(a.skillIds?.length ? { teach: a.skillIds } : {}),
      });

      // A job seeker's answers are a job alert, so the platform starts
      // working for them before they have browsed anything.
      if (
        (a.type === "jobseeker" || a.type === "professional") &&
        profileId &&
        (a.role || a.city)
      ) {
        try {
          await createAlert(profileId, {
            city: a.city?.trim() || null,
            skills: a.role ? [a.role.trim().toLowerCase()] : [],
            minPay: null,
            workMode: a.workMode && a.workMode !== "any" ? a.workMode : null,
            kind: null,
          });
        } catch {
          notes.push("alert");
        }
      }

      // A recruiter's answers are a company, with them as its owner.
      if (a.type === "recruiter" && a.companyName?.trim()) {
        try {
          await createCompanyForMe({
            name: a.companyName,
            industry: a.companyIndustry ?? null,
            headquarters: a.companyCity ?? null,
            website: a.companyWebsite ?? null,
          });
        } catch (e) {
          notes.push(e instanceof Error ? e.message : "company");
        }
      }

      // A student's answers are the coach's form, already filled in.
      if (email && (a.type === "school" || a.type === "college")) {
        saveCoachPrefill(email, {
          mode: a.type === "school" ? "school" : "college",
          ...(a.classBand ? { level: classLevel(a.classBand) } : {}),
          interests: [...(a.subjects ?? []), ...(a.fields ?? [])],
          ...(goalLine(a) ? { goal: goalLine(a) } : {}),
          ...(a.city ? { city: a.city } : {}),
          ...(a.degree ? { degree: a.degree } : {}),
          ...(a.branch ? { branch: a.branch } : {}),
          ...(a.year ? { year: a.year } : {}),
          ...(a.budget ? { budget: a.budget === "low" ? "under-3000" : a.budget } : {}),
          ...(a.mode ? { learningMode: a.mode } : {}),
          ...(a.locale ? { language: a.locale } : {}),
        });
      }

      return notes;
    },
    onSuccess: (notes) => {
      if (a.locale) set("locale", a.locale);
      if (email) clearDraft(email);
      close();
      if (notes.length > 0) {
        toast({
          tone: "info",
          title: "Set up — with one thing left",
          body:
            notes[0] === "alert"
              ? "Your job alert could not be created. You can set one from the Jobs page."
              : String(notes[0]),
        });
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  /*
   * Belt as well as braces. `data-lenis-prevent` gets the wheel to the
   * element that should scroll; this stops the page behind moving at all.
   * Above the early return, and keyed on `open`, because a hook after a
   * conditional return changes the hook count between renders.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !current) return null;

  const busy = finish.isPending || saveExit.isPending;
  const total = steps.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      data-lenis-prevent
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto overscroll-contain bg-ink/60 p-0 backdrop-blur-sm sm:p-4"
    >
      <div className="my-auto flex min-h-dvh w-full max-w-xl flex-col border-ink-line bg-paper-light sm:min-h-0 sm:rounded-3xl sm:border sm:shadow-[var(--shadow-float)]">
        {/* Where you are, and the way out that loses nothing. */}
        <div className="flex items-center gap-3 border-b border-ink-line px-5 py-3.5 sm:px-6">
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-saffron-500" : "bg-paper-deep/70"
                }`}
              />
            ))}
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-mute">
            {tx("Step")} {Math.min(step + 1, total)} {tx("of")} {total}
          </span>
          <button
            type="button"
            onClick={() => saveExit.mutate()}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-paper-dim hover:text-ink"
            aria-label={tx("Save and exit")}
            title={tx("Save and exit")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-5 py-6 sm:px-6">
          <h2 id="onboarding-title" className="font-display text-2xl font-semibold text-ink">
            {tx(current.title)}
          </h2>
          <p className="mt-1.5 font-body text-sm leading-relaxed text-ink-mute">
            {tx(current.blurb)}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
              className="mt-6"
            >
              <StepBody
                id={current.id}
                a={a}
                patch={patch}
                role={role}
                onFinish={() => finish.mutate()}
                busy={busy}
                onTour={() => {
                  finish.mutate(undefined, {
                    onSuccess: () => {
                      startTour();
                      void navigate({ to: "/dashboard" });
                    },
                  });
                }}
              />
            </motion.div>
          </AnimatePresence>

          {error && (
            <p role="alert" className="mt-4 font-body text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>

        {/* One decision, then forward. Nothing here is required. */}
        {!last && (
          <div className="sticky bottom-0 flex items-center gap-3 border-t border-ink-line bg-paper-light/95 px-5 py-3.5 backdrop-blur-sm sm:rounded-b-3xl sm:px-6">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                disabled={busy}
                className="btn-ghost !py-2.5 !text-xs"
              >
                <ArrowLeft size={14} aria-hidden /> {tx("Back")}
              </button>
            ) : (
              <span />
            )}
            <span className="flex-1" />
            {current.optional && (
              <button
                type="button"
                onClick={() => goTo(step + 1)}
                disabled={busy}
                className="font-body text-[12.5px] text-ink-mute underline underline-offset-4 hover:text-ink"
              >
                {tx("Skip this")}
              </button>
            )}
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              disabled={busy || (current.id === "who" && !a.type)}
              className="btn-primary !py-2.5 !text-xs disabled:opacity-50"
            >
              {tx("Continue")} <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── One screen per decision ─────────────────────────────────────── */

function StepBody({
  id,
  a,
  patch,
  role,
  onFinish,
  onTour,
  busy,
}: {
  id: string;
  a: OnboardingAnswers;
  patch: (p: Partial<OnboardingAnswers>) => void;
  role: Role;
  onFinish: () => void;
  onTour: () => void;
  busy: boolean;
}) {
  const tx = useTx();

  switch (id) {
    case "who":
      return (
        <Cards
          options={typesForRole(role).map((info) => ({
            id: info.id,
            label: tx(info.label),
            note: tx(info.purpose),
          }))}
          value={a.type ?? null}
          onPick={(v) => patch({ type: v as ProfileType })}
        />
      );

    /* ── School ── */
    case "class":
      return (
        <Cards
          options={CLASS_BANDS.map((c) => ({ id: c.id, label: tx(c.label) }))}
          value={a.classBand ?? null}
          onPick={(v) => patch({ classBand: v as OnboardingAnswers["classBand"] })}
        />
      );
    case "subjects":
      return (
        <Chips
          options={SCHOOL_SUBJECTS}
          value={a.subjects ?? []}
          onChange={(v) => patch({ subjects: v })}
        />
      );
    case "help":
      return (
        <Chips
          options={SCHOOL_HELP}
          value={a.helpWith ?? []}
          onChange={(v) => patch({ helpWith: v })}
        />
      );
    case "marks":
      return (
        <Cards
          options={[
            {
              id: "upload",
              label: tx("Photograph my marksheet"),
              note: tx("The coach reads the subjects and marks off it. You can correct anything."),
            },
            {
              id: "manual",
              label: tx("Type my marks in"),
              note: tx("Subject by subject. About three minutes."),
            },
            {
              id: "later",
              label: tx("Later"),
              note: tx("The rest of the site works without it."),
            },
          ]}
          value={a.marksChoice ?? null}
          onPick={(v) => patch({ marksChoice: v as OnboardingAnswers["marksChoice"] })}
        />
      );

    /* ── College ── */
    case "study":
      return (
        <div className="space-y-4">
          <Field label={tx("Degree or diploma")}>
            <input
              value={a.degree ?? ""}
              onChange={(e) => patch({ degree: e.target.value.slice(0, 60) })}
              placeholder={tx("e.g. B.Tech, BA, Polytechnic")}
              className="input mt-1.5 !text-[14px]"
            />
          </Field>
          <Field label={tx("Branch or subject")}>
            <input
              value={a.branch ?? ""}
              onChange={(e) => patch({ branch: e.target.value.slice(0, 60) })}
              placeholder={tx("e.g. Mechanical, Commerce")}
              className="input mt-1.5 !text-[14px]"
            />
          </Field>
          <Field label={tx("Year")}>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup">
              {["1st", "2nd", "3rd", "4th", "Final"].map((y) => (
                <Pill key={y} on={a.year === y} onClick={() => patch({ year: y })}>
                  {y}
                </Pill>
              ))}
            </div>
          </Field>
        </div>
      );
    case "goal":
      return (
        <Cards
          options={COLLEGE_GOALS.map((g) => ({ id: g, label: tx(g) }))}
          value={a.goal ?? null}
          onPick={(v) => patch({ goal: v })}
        />
      );
    case "field":
      return (
        <Chips options={FIELDS} value={a.fields ?? []} onChange={(v) => patch({ fields: v })} />
      );
    case "preference":
      return (
        <div className="space-y-4">
          <Field label={tx("Budget")}>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup">
              {[
                { id: "free", label: tx("Free only") },
                { id: "low", label: tx("Up to ₹3,000") },
                { id: "any", label: tx("Any") },
              ].map((b) => (
                <Pill
                  key={b.id}
                  on={a.budget === b.id}
                  onClick={() => patch({ budget: b.id as OnboardingAnswers["budget"] })}
                >
                  {b.label}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label={tx("How you want to learn")}>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup">
              {[
                { id: "online", label: tx("Online") },
                { id: "offline", label: tx("In person") },
                { id: "hybrid", label: tx("Either") },
              ].map((m) => (
                <Pill
                  key={m.id}
                  on={a.mode === m.id}
                  onClick={() => patch({ mode: m.id as OnboardingAnswers["mode"] })}
                >
                  {m.label}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label={tx("Your city")}>
            <CityInput value={a.city ?? ""} onChange={(v) => patch({ city: v })} />
          </Field>
        </div>
      );

    /* ── Job seeker and professional ── */
    case "work":
      return (
        <div className="space-y-4">
          <Field label={tx("Role you are looking for")}>
            <input
              value={a.role ?? ""}
              onChange={(e) => patch({ role: e.target.value.slice(0, 60) })}
              placeholder={tx("e.g. Electrician, Data entry, Delivery")}
              className="input mt-1.5 !text-[14px]"
            />
          </Field>
          <Field label={tx("Your city")}>
            <CityInput value={a.city ?? ""} onChange={(v) => patch({ city: v })} />
          </Field>
          <Field label={tx("How you want to work")}>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup">
              {[
                { id: "onsite", label: tx("In person") },
                { id: "hybrid", label: tx("Hybrid") },
                { id: "remote", label: tx("Remote") },
                { id: "any", label: tx("Any") },
              ].map((m) => (
                <Pill
                  key={m.id}
                  on={a.workMode === m.id}
                  onClick={() => patch({ workMode: m.id as OnboardingAnswers["workMode"] })}
                >
                  {m.label}
                </Pill>
              ))}
            </div>
          </Field>
          <p className="font-body text-[12px] leading-relaxed text-ink-mute">
            {tx("We turn this into a job alert, so you hear the day something matching is posted.")}
          </p>
        </div>
      );
    case "experience":
      return (
        <Cards
          options={EXPERIENCE_BANDS.map((e) => ({ id: e.id, label: tx(e.label) }))}
          value={a.experience ?? null}
          onPick={(v) => patch({ experience: v as OnboardingAnswers["experience"] })}
        />
      );
    case "support":
      return (
        <Chips
          options={SUPPORT_NEEDS}
          value={a.support ?? []}
          onChange={(v) => patch({ support: v })}
        />
      );

    /* ── Shared ── */
    case "skills":
      return <SkillPicker value={a.skillIds ?? []} onChange={(v) => patch({ skillIds: v })} />;
    case "language":
      return <LanguagePicker value={a.locale ?? "en"} onPick={(v) => patch({ locale: v })} />;

    /* ── Recruiter ── */
    case "company":
      return (
        <div className="space-y-4">
          <Field label={tx("Company name")}>
            <input
              value={a.companyName ?? ""}
              onChange={(e) => patch({ companyName: e.target.value.slice(0, 80) })}
              className="input mt-1.5 !text-[14px]"
            />
          </Field>
          <Field label={tx("Industry")}>
            <input
              value={a.companyIndustry ?? ""}
              onChange={(e) => patch({ companyIndustry: e.target.value.slice(0, 60) })}
              placeholder={tx("e.g. Solar, Retail, Logistics")}
              className="input mt-1.5 !text-[14px]"
            />
          </Field>
          <Field label={tx("City")}>
            <CityInput value={a.companyCity ?? ""} onChange={(v) => patch({ companyCity: v })} />
          </Field>
          <Field label={tx("Website")} optional>
            <input
              value={a.companyWebsite ?? ""}
              onChange={(e) => patch({ companyWebsite: e.target.value.slice(0, 120) })}
              placeholder="https://"
              className="input mt-1.5 !text-[14px]"
            />
          </Field>
        </div>
      );
    case "roles":
      return (
        <Field label={tx("The role you want to fill first")}>
          <input
            value={a.hiringFor ?? ""}
            onChange={(e) => patch({ hiringFor: e.target.value.slice(0, 80) })}
            placeholder={tx("e.g. Solar installation technician")}
            className="input mt-1.5 !text-[14px]"
          />
        </Field>
      );
    case "requirements":
      return (
        <Chips
          options={[
            tx("Verified skills"),
            tx("Completed courses"),
            tx("Projects to show"),
            tx("Lives nearby"),
            tx("Can start immediately"),
            tx("No experience needed"),
          ]}
          value={a.requirements ?? []}
          onChange={(v) => patch({ requirements: v })}
        />
      );
    case "verify":
      return (
        <div className="rounded-2xl border border-ink-line p-4">
          <p className="inline-flex items-center gap-2 font-body text-[14px] font-semibold text-ink">
            <BadgeCheck size={16} className="text-peacock" aria-hidden />{" "}
            {tx("What the tick means")}
          </p>
          <p className="mt-2 font-body text-[13.5px] leading-relaxed text-ink-soft">
            {tx(
              "A person on the स्वYAM team confirms that the company exists, is who it says it is, and can be contacted at the details it gave. It is not a check of pay or working conditions, and we say so on every listing.",
            )}
          </p>
          <p className="mt-2 font-body text-[13px] leading-relaxed text-ink-mute">
            {tx(
              "Your company starts unverified, and unverified is not a warning — it means nobody has checked yet. Write to us when you want it looked at.",
            )}
          </p>
          <Link
            to="/trust"
            className="mt-3 inline-block font-body text-[13px] text-saffron-600 underline"
          >
            {tx("Read the trust center")}
          </Link>
        </div>
      );

    /* ── Institute ── */
    case "institute":
      return (
        <div className="space-y-4">
          <Field label={tx("Institute name")}>
            <input
              value={a.instituteName ?? ""}
              onChange={(e) => patch({ instituteName: e.target.value.slice(0, 80) })}
              className="input mt-1.5 !text-[14px]"
            />
          </Field>
          <Field label={tx("City")}>
            <CityInput
              value={a.instituteCity ?? ""}
              onChange={(v) => patch({ instituteCity: v })}
            />
          </Field>
        </div>
      );
    case "delivery":
      return (
        <Chips
          options={DELIVERY_MODES}
          value={a.deliveryModes ?? []}
          onChange={(v) => patch({ deliveryModes: v })}
        />
      );
    case "teaching":
      return (
        <Chips options={FIELDS} value={a.teaches ?? []} onChange={(v) => patch({ teaches: v })} />
      );
    case "certificates":
      return (
        <Cards
          options={CERTIFY_CHOICES.map((c) => ({ id: c.id, label: tx(c.label) }))}
          value={a.certifies ?? null}
          onPick={(v) => patch({ certifies: v as OnboardingAnswers["certifies"] })}
        />
      );

    case "done":
      return <Ready a={a} onFinish={onFinish} onTour={onTour} busy={busy} />;

    default:
      return null;
  }
}

/* ── The last screen: what was built ─────────────────────────────── */

function Ready({
  a,
  onFinish,
  onTour,
  busy,
}: {
  a: OnboardingAnswers;
  onFinish: () => void;
  onTour: () => void;
  busy: boolean;
}) {
  const tx = useTx();
  const school = a.type === "school";
  const college = a.type === "college";
  const working = a.type === "jobseeker" || a.type === "professional";
  const recruiter = a.type === "recruiter";

  const title = school
    ? tx("Your Study Coach is ready")
    : college
      ? tx("Your career roadmap is ready")
      : working
        ? tx("Let's get you job-ready")
        : recruiter
          ? tx("Your hiring workspace is ready")
          : tx("Your institute workspace is ready");

  // Only what the answers actually produced. Nothing here is aspirational.
  const built: string[] = [];
  if (a.type) built.push(tx("A dashboard and navigation for your kind of member"));
  if (school && a.classBand) built.push(`${tx("A coach set up for")} ${a.classBand}`);
  if ((school || college) && (a.subjects?.length || a.fields?.length))
    built.push(tx("Your subjects and interests, already filled into the coach's form"));
  if (a.skillIds?.length) built.push(`${a.skillIds.length} ${tx("skills on your Skill Passport")}`);
  if (working && (a.role || a.city))
    built.push(tx("A job alert, so you hear the day a matching opening is posted"));
  if (recruiter && a.companyName) built.push(`${tx("A company page for")} ${a.companyName}`);
  if (goalLine(a)) built.push(`${tx("Your goal")}: ${goalLine(a)}`);
  if (a.locale && a.locale !== "en") built.push(tx("The site in your language"));

  const label = school
    ? tx("Build my study plan")
    : college
      ? tx("Build my roadmap")
      : working
        ? tx("See what is open")
        : recruiter
          ? tx("Go to my hiring workspace")
          : tx("Go to my dashboard");

  return (
    <div>
      <div className="rounded-2xl border border-saffron-200 bg-saffron-50/60 p-5">
        <p className="inline-flex items-center gap-2 font-display text-xl text-ink">
          <ClipboardList size={18} className="text-saffron-500" aria-hidden />
          {title}
        </p>
        {built.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {built.map((b) => (
              <li key={b} className="flex items-start gap-2 font-body text-[13.5px] text-ink-soft">
                <Check size={14} className="mt-0.5 shrink-0 text-emeraldx-400" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onFinish}
          disabled={busy}
          className="btn-primary w-full justify-center !py-3"
        >
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {label} <ArrowRight size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onTour}
          disabled={busy}
          className="btn-ghost w-full justify-center !py-2.5 !text-xs"
        >
          {tx("Show me around first")}
        </button>
      </div>
      <p className="mt-3 text-center font-body text-[11.5px] leading-relaxed text-ink-mute">
        {tx("Everything here can be changed later, from Settings or your profile.")}
      </p>
    </div>
  );
}

/* ── Small pieces ────────────────────────────────────────────────── */

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const tx = useTx();
  return (
    <label className="block">
      <span className="datum">
        {label}
        {optional && (
          <span className="font-normal normal-case text-ink-mute"> ({tx("optional")})</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`filter-pill !h-10 ${on ? "!bg-ink !text-paper" : ""}`}
    >
      {children}
    </button>
  );
}

/** One decision, as a stack of cards big enough for a thumb. */
function Cards({
  options,
  value,
  onPick,
}: {
  options: { id: string; label: string; note?: string }[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-2" role="radiogroup">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.id)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
              on
                ? "border-saffron-400 bg-saffron-50/70"
                : "border-ink-line hover:border-saffron-200"
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                on ? "border-saffron-500 bg-saffron-500 text-on-accent" : "border-ink-line"
              }`}
            >
              {on && <Check size={12} />}
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[14.5px] font-semibold text-ink">
                {o.label}
              </span>
              {o.note && (
                <span className="mt-0.5 block font-body text-[12.5px] leading-relaxed text-ink-mute">
                  {o.note}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Many answers, as chips. */
function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`filter-pill !h-10 ${on ? "!bg-ink !text-paper" : ""}`}
          >
            {on && <Check size={13} aria-hidden />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function CityInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tx = useTx();
  return (
    <>
      <input
        list="onboarding-cities"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 60))}
        placeholder={tx("Start typing")}
        autoComplete="off"
        className="input mt-1.5 !text-[14px]"
      />
      <datalist id="onboarding-cities">
        {CITY_NAMES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}

function SkillPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const tx = useTx();
  const [q, setQ] = useState("");
  const catalogue = useQuery({
    queryKey: ["skills-catalogue"],
    queryFn: listSkills,
    staleTime: 5 * 60_000,
  });
  const all: SkillRef[] = catalogue.data ?? [];
  const picked = all.filter((s) => value.includes(s.id));
  const suggestions = q.trim()
    ? all
        .filter(
          (s) => s.name.toLowerCase().includes(q.trim().toLowerCase()) && !value.includes(s.id),
        )
        .slice(0, 8)
    : all.filter((s) => !value.includes(s.id)).slice(0, 8);

  return (
    <div>
      {picked.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {picked.map((s) => (
            <span key={s.id} className="chip inline-flex items-center gap-1 !text-[12px]">
              {s.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== s.id))}
                aria-label={`${tx("Remove")} ${s.name}`}
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-ink/10"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tx("Search skills")}
        className="input !text-[14px]"
        autoComplete="off"
      />
      {catalogue.isLoading ? (
        <p className="mt-3 font-body text-[13px] text-ink-mute">{tx("Loading skills…")}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange([...value, s.id]);
                setQ("");
              }}
              className="filter-pill !h-9 !px-3 !text-[12.5px]"
            >
              <Plus size={12} aria-hidden /> {s.name}
            </button>
          ))}
          {suggestions.length === 0 && (
            <p className="font-body text-[13px] text-ink-mute">
              {tx("Nothing matches that. You can add it later from your profile.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LanguagePicker({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const tx = useTx();
  // Only the languages the interface is actually translated into. Offering
  // twenty-two and delivering one is the sort of promise this site does not make.
  const ready = SUPPORTED_LANGUAGES.filter((l) => TRANSLATED_LOCALES.has(l.code));
  return (
    <>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {ready.map((l) => (
          <Pill key={l.code} on={value === l.code} onClick={() => onPick(l.code)}>
            {l.native}
          </Pill>
        ))}
      </div>
      <p className="mt-3 font-body text-[12px] leading-relaxed text-ink-mute">
        {tx("More languages are being translated. Settings has the full list.")}
      </p>
    </>
  );
}

/* ── Mapping answers to the things that read them ────────────────── */

function goalLine(a: OnboardingAnswers): string {
  if (a.goal) return a.goal;
  if (a.helpWith?.length) return a.helpWith[0]!;
  if (a.role) return `Find work as a ${a.role}`;
  if (a.hiringFor) return `Hire: ${a.hiringFor}`;
  if (a.support?.length) return a.support[0]!;
  return "";
}

function headlineFor(a: OnboardingAnswers): string {
  if (a.type === "college" && a.degree) return [a.degree, a.branch].filter(Boolean).join(" · ");
  if ((a.type === "jobseeker" || a.type === "professional") && a.role) {
    const band = EXPERIENCE_BANDS.find((e) => e.id === a.experience)?.label;
    return [a.role, band].filter(Boolean).join(" · ");
  }
  if (a.type === "institute" && a.instituteName) return a.instituteName;
  return "";
}

function classLevel(band: NonNullable<OnboardingAnswers["classBand"]>): string {
  return band === "6-8" ? "Class 8" : band === "9-10" ? "Class 10" : "Class 12";
}
