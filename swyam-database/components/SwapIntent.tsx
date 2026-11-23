import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Bot,
  Check,
  GraduationCap,
  Languages,
  Loader2,
  Star,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { initialsAvatar } from "../lib/avatar";
import {
  FORMAT_LABEL,
  HUMAN_FORMATS,
  LEVEL_LABEL,
  SKILL_LEVELS,
  SWAP_PLANS,
  findTrainers,
  listSkills,
  listTeachSkills,
  requestTraining,
  type LearningFormat,
  type SkillRef,
  type SkillLevel,
  type SwapPlan,
  type TrainerMatch,
} from "../lib/skillswap";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";

/**
 * The front door of SkillSwap.
 *
 * The old page opened on a list of mirror matches, which assumed you already
 * knew what you had to trade. Under the certified model the first question is
 * simpler and more honest: are you here to learn, or to teach? Everything
 * after that follows from the answer.
 *
 * Learning is a funnel — skill, level, plan, then the trainers who are
 * actually certified to teach it. Teaching is a standing offer, so it shows
 * where you are on the ladder rather than a wizard.
 */

export type Intent = "learn" | "teach";

/* ── Learn ───────────────────────────────────────────────────────── */

export function LearnFlow({ onNote }: { onNote: (tone: "ok" | "bad", text: string) => void }) {
  const tx = useTx();
  const { profileId } = useAuth();
  const qc = useQueryClient();

  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState<SkillLevel>("beginner");
  const [plan, setPlan] = useState<SwapPlan>("basic");
  const [format, setFormat] = useState<LearningFormat>(HUMAN_FORMATS[0]!);
  /*
   * The one branch that changes what step three even is. Self-paced is not a
   * way of meeting a trainer, so it cannot live in the dropdown below the
   * trainer list -- picking it there asked a real person to teach a lesson
   * the learner never planned to attend.
   */
  const [alone, setAlone] = useState(false);
  const [asked, setAsked] = useState<Set<string>>(new Set());

  const skills = useQuery({ queryKey: ["skills-catalogue"], queryFn: listSkills });
  const myTeaching = useQuery({
    queryKey: ["teach-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled: Boolean(profileId),
  });

  // Only run the matcher once a skill is chosen: "everyone certified in
  // anything" is not a useful answer to "who can teach me this".
  const trainers = useQuery({
    queryKey: ["trainers", profileId, skillId, plan],
    queryFn: () => findTrainers(profileId!, skillId, plan),
    enabled: Boolean(profileId) && Boolean(skillId),
  });

  // Real trainers on screen (never mock mentors); only a bucket of the count leaves this component.
  const trainerCount = trainers.data?.length ?? 0;
  useEffect(() => {
    if (trainerCount > 0) {
      track(EV.MENTOR_VIEWED, {
        trainerCount: trainerCount === 1 ? "1" : trainerCount <= 5 ? "2-5" : "6+",
      });
    }
  }, [skillId, trainerCount]);

  // Something certified I could trade back, which turns a paid engagement
  // into a free swap.
  const tradeable = (myTeaching.data ?? []).filter(
    (t) => t.verificationState === "verified" || t.verificationState === "expert_verified",
  );

  const request = useMutation({
    mutationFn: (t: TrainerMatch) =>
      requestTraining(profileId!, {
        trainerId: t.trainerId,
        skillId: t.skillId,
        // Offer something back only if they want it and I can prove it.
        offeredSkillId: t.isMutual && tradeable[0] ? tradeable[0].skill.id : null,
        format,
      }),
    onSuccess: (_r, t) => {
      track(EV.SKILL_SWAP_REQUESTED, { role: "learn" });
      setAsked((prev) => new Set(prev).add(t.trainerId));
      onNote("ok", `Request sent to ${t.displayName}.`);
      void qc.invalidateQueries({ queryKey: ["swap-requests", profileId] });
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  return (
    <div className="space-y-8">
      {/* Step 1 — what, and where you are with it */}
      <div className="panel p-6">
        <p className="kicker">{tx("Step one")}</p>
        <h2 className="mt-2 font-display text-xl tracking-tight text-ink">
          {tx("What do you want to learn?")}
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wider text-ink-mute">
              {tx("Skill")}
            </span>
            <select
              value={skillId}
              onChange={(e) => {
                if (e.target.value) track(EV.SKILL_SEARCHED, { surface: "skillswap" });
                setSkillId(e.target.value);
              }}
              className="input w-full"
            >
              <option value="">{tx("Choose a skill\u2026")}</option>
              {(skills.data ?? []).map((sk) => (
                <option key={sk.id} value={sk.id}>
                  {sk.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wider text-ink-mute">
              {tx("Your level right now")}
            </span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as SkillLevel)}
              className="input w-full"
            >
              {SKILL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Step 2 — the plan, which decides who is eligible */}
      <div>
        <p className="kicker">{tx("Step two")}</p>
        <h2 className="mt-2 font-display text-xl tracking-tight text-ink">
          {tx("Choose a learning plan")}
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {SWAP_PLANS.map((p) => {
            const active = plan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                aria-pressed={active}
                className={`card p-6 text-left transition-colors ${
                  active ? "!border-saffron-500 ring-1 ring-saffron-500" : "hover:!border-ink-line"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg tracking-tight text-ink">{p.name}</span>
                  <span
                    className={`chip ${p.id === "advanced" ? "!bg-brand-navy !text-paper-light" : "!bg-emeraldx-400 !text-paper-light"}`}
                  >
                    {p.price}
                  </span>
                </div>
                <p className="mt-2 font-body text-sm text-ink-soft">{p.blurb}</p>
                {/*
                 * Both plans end in a certificate, and they are not the same
                 * certificate. Saying only "Certificate" on one card and
                 * nothing on the other made Basic look like practice; saying
                 * "Certificate" on both would be worse, because one carries a
                 * public serial and the other does not.
                 */}
                <div className="mt-4 rounded-xl border border-ink-line bg-paper p-3">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-saffron-600">
                    <Award size={11} aria-hidden /> {p.certificate.name}
                  </p>
                  <p className="mt-1 font-body text-[12px] leading-snug text-ink-soft">
                    {p.certificate.what}
                  </p>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {p.includes.map((i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 font-body text-[13px] text-ink-mute"
                    >
                      <Check size={13} className="mt-[3px] shrink-0 text-saffron-500" aria-hidden />
                      {i}
                    </li>
                  ))}
                </ul>
                {active && (
                  <p className="mt-4 flex items-center gap-1.5 font-body text-[12px] font-medium text-saffron-500">
                    <Check size={12} aria-hidden /> {tx("Selected")}
                  </p>
                )}
              </button>
            );
          })}
        </div>
        {plan === "advanced" && (
          <p className="mt-3 font-body text-[12px] text-ink-mute">
            {tx(
              "Advanced shows only trainers who are expert-verified in this skill. Payment is taken when the trainer accepts, not now.",
            )}
          </p>
        )}
      </div>

      {/* Step 3 — who can actually teach it */}
      <div>
        <p className="kicker">{tx("Step three")}</p>
        <h2 className="mt-2 flex items-center gap-2 font-display text-xl tracking-tight text-ink">
          <Users size={17} className="text-saffron-500" aria-hidden />
          {alone ? tx("Learn it on your own") : tx("Matched trainers")}
        </h2>

        {/* Two genuinely different products, so the choice comes first. */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              id: "with",
              on: !alone,
              title: tx("With a trainer"),
              detail: tx("Somebody certified in this skill teaches you, at a time you both agree."),
            },
            {
              id: "alone",
              on: alone,
              title: tx("On my own, with AI"),
              detail: tx(
                "No trainer and nothing to book. Your mentor writes the modules and guides you while you work.",
              ),
            },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setAlone(o.id === "alone")}
              aria-pressed={o.on}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                o.on
                  ? "border-saffron-500 bg-saffron-50"
                  : "border-ink-line bg-paper-light hover:border-saffron-200"
              }`}
            >
              <p className="font-body text-[14px] font-semibold text-ink">{o.title}</p>
              <p className="mt-1 font-body text-[12px] leading-snug text-ink-soft">{o.detail}</p>
            </button>
          ))}
        </div>

        {alone ? (
          <SelfPacedPanel skill={skills.data?.find((k) => k.id === skillId) ?? null} />
        ) : !skillId ? (
          <p className="mt-4 font-body text-sm text-ink-mute">
            Choose a skill above and we&apos;ll rank the people certified to teach it.
          </p>
        ) : trainers.isLoading ? (
          <p className="mt-4 flex items-center gap-2 font-body text-sm text-ink-mute">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Matching…
          </p>
        ) : (trainers.data ?? []).length === 0 ? (
          <div className="panel mt-4 p-6">
            <h3 className="font-display text-lg tracking-tight text-ink">
              {tx("Nobody is certified in this yet")}
            </h3>
            <p className="mt-2 max-w-xl font-body text-sm text-ink-soft">
              {plan === "advanced"
                ? "No expert-verified trainer for this skill. Try the Basic plan, which accepts any certified trainer."
                : "This skill has no certified trainer on the platform yet. You can still learn it from a course and sit the same assessment — the certificate is identical."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setAlone(true)} className="btn-primary !py-2.5 !text-xs">
                <Bot size={13} aria-hidden /> {tx("Learn it with an AI mentor")}
              </button>
              <Link to="/courses" className="btn-ghost !py-2.5 !text-xs">
                {tx("Find a course instead")} <ArrowRight size={13} aria-hidden />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <label className="mt-4 block max-w-xs">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wider text-ink-mute">
                How you&apos;d like to meet
              </span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as LearningFormat)}
                className="input w-full"
              >
                {HUMAN_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(trainers.data ?? []).map((t) => (
                <TrainerCard
                  key={`${t.trainerId}-${t.skillId}`}
                  trainer={t}
                  asked={asked.has(t.trainerId)}
                  busy={request.isPending && request.variables?.trainerId === t.trainerId}
                  onAsk={() => request.mutate(t)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TrainerCard({
  trainer,
  asked,
  busy,
  onAsk,
}: {
  trainer: TrainerMatch;
  asked: boolean;
  busy: boolean;
  onAsk: () => void;
}) {
  const tx = useTx();
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <img
          loading="lazy"
          decoding="async"
          src={trainer.avatarUrl ?? initialsAvatar(trainer.displayName)}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full border border-ink-line object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{trainer.displayName}</p>
          {trainer.headline && (
            <p className="mt-0.5 line-clamp-2 font-body text-[13px] text-ink-mute">
              {trainer.headline}
            </p>
          )}
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold text-saffron-500 tabular-nums">
          {Math.round(trainer.score)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`chip ${trainer.isMaster ? "!bg-brand-navy !text-paper-light" : "!bg-emeraldx-400 !text-paper-light"}`}
        >
          <BadgeCheck size={11} aria-hidden />
          {trainer.isMaster ? "Master Trainer" : "Certified"}
        </span>
        <span className="chip">{trainer.skillName}</span>
        {trainer.sharesLanguage && (
          <span className="chip">
            <Languages size={11} aria-hidden /> {tx("Shared language")}
          </span>
        )}
        {trainer.isMutual && (
          <span className="chip">
            <Users size={11} aria-hidden /> {tx("Wants what you teach")}
          </span>
        )}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-ink-line pt-3 font-body text-[12px] text-ink-mute">
        <div className="flex items-center gap-1.5">
          <GraduationCap size={12} aria-hidden />
          <dt className="sr-only">{tx("Trainings completed")}</dt>
          <dd>{trainer.trainingsCompleted} trained</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Star size={12} aria-hidden />
          <dt className="sr-only">{tx("Reliability")}</dt>
          <dd>{trainer.reliability}% reliable</dd>
        </div>
      </dl>

      <button
        onClick={onAsk}
        disabled={asked || busy}
        className="btn-primary mt-4 w-full !py-2.5 !text-xs disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 size={13} className="animate-spin" aria-hidden /> Sending…
          </>
        ) : asked ? (
          <>
            <Check size={13} aria-hidden /> {tx("Request sent")}
          </>
        ) : (
          <>
            {tx("Ask to learn")} <ArrowRight size={13} aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}

/* ── Teach ───────────────────────────────────────────────────────── */

/**
 * The teaching side.
 *
 * Not a wizard, because there is nothing to walk through: either you are
 * certified in something or you are not, and if you are not, the route there
 * is a course and its assessment. So this shows the ladder honestly, with the
 * next step from wherever you stand.
 */
export function TeachFlow() {
  const tx = useTx();
  const { profileId } = useAuth();

  const teaching = useQuery({
    queryKey: ["teach-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled: Boolean(profileId),
  });

  const rows = teaching.data ?? [];
  const certified = rows.filter(
    (t) => t.verificationState === "verified" || t.verificationState === "expert_verified",
  );
  const pending = rows.filter(
    (t) => t.verificationState !== "verified" && t.verificationState !== "expert_verified",
  );

  return (
    <div className="space-y-8">
      <div className="panel p-6">
        <p className="kicker">{tx("Where you stand")}</p>
        <h2 className="mt-2 font-display text-xl tracking-tight text-ink">
          {certified.length > 0
            ? `You can teach ${certified.length} skill${certified.length === 1 ? "" : "s"}`
            : "You are not certified to teach yet"}
        </h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-ink-soft">
          {tx(
            "Teaching on SkillSwap is a license, not a checkbox. A learner can only request a skill you are verified in \u2014 which is what makes the certificate worth anything to the person receiving it.",
          )}
        </p>

        {certified.length === 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/courses" className="btn-primary !py-2.5 !text-xs">
              {tx("Finish a course and its assessment")} <ArrowRight size={13} aria-hidden />
            </Link>
            <Link to="/passport" className="btn-ghost !py-2.5 !text-xs">
              {tx("See what counts as proof")}
            </Link>
          </div>
        )}
      </div>

      {certified.length > 0 && (
        <div>
          <h3 className="font-display text-lg tracking-tight text-ink">
            {tx("Licensed to teach")}
          </h3>
          <div className="mt-4 space-y-2">
            {certified.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line p-4"
              >
                <div>
                  <p className="font-medium text-ink">{t.skill.name}</p>
                  <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                    {LEVEL_LABEL[t.level]}
                  </p>
                </div>
                <span
                  className={`chip ${t.verificationState === "expert_verified" ? "!bg-brand-navy !text-paper-light" : "!bg-emeraldx-400 !text-paper-light"}`}
                >
                  <BadgeCheck size={11} aria-hidden />
                  {t.verificationState === "expert_verified" ? "Master Trainer" : "Certified"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="font-display text-lg tracking-tight text-ink">
            {tx("Listed, not yet certified")}
          </h3>
          <p className="mt-1.5 font-body text-sm text-ink-mute">
            {tx("These are on your profile but cannot be requested until they are verified.")}
          </p>
          <div className="mt-4 space-y-2">
            {pending.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-ink-line p-4"
              >
                <div>
                  <p className="font-medium text-ink">{t.skill.name}</p>
                  <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                    {LEVEL_LABEL[t.level]}
                  </p>
                </div>
                <span className="chip">{tx("Self-declared")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel p-6">
        <p className="kicker">{tx("The ladder")}</p>
        <h3 className="mt-2 font-display text-lg tracking-tight text-ink">
          {tx("How Master Trainer is reached")}
        </h3>
        <ol className="mt-4 space-y-3">
          {[
            { n: 1, t: "Get certified", d: "Finish a course and pass its assessment." },
            { n: 2, t: "Teach", d: "Learners request you; each session is a training." },
            {
              n: 3,
              t: "Ten successful trainings",
              d: "A training counts when the learner passes their own assessment afterward.",
            },
            {
              n: 4,
              t: "Master Trainer",
              d: "Granted after review — completing ten does not grant it automatically.",
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-saffron-100 font-display text-[11px] text-saffron-500">
                {s.n}
              </span>
              <div>
                <p className="font-medium text-ink">{s.t}</p>
                <p className="font-body text-[13px] text-ink-mute">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * What step three becomes when the learner is doing it alone.
 *
 * Deliberately shows no people. The whole failure this replaces was a page
 * that answered "I want to learn this by myself" with a list of trainers to
 * book, and the fix is not a smaller list — it is no list.
 */
function SelfPacedPanel({ skill }: { skill: SkillRef | null }) {
  const tx = useTx();

  if (!skill) {
    return (
      <p className="mt-4 font-body text-sm text-ink-mute">
        {tx("Choose a skill above and your mentor will build the plan for it.")}
      </p>
    );
  }

  return (
    <div className="panel mt-4 p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron-500/12 text-saffron-600"
        >
          <Bot size={19} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg tracking-tight text-ink">
            {tx("Your mentor for")} {skill.name}
          </h3>
          <p className="mt-1.5 max-w-xl font-body text-sm leading-relaxed text-ink-soft">
            {tx(
              "It writes the modules in the order they should be learnt, sets practice you can actually do, and answers while you work. It will not do the practice for you — the assessment at the end is the same one everybody sits.",
            )}
          </p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          tx("Modules in the right order"),
          tx("Practice, not just reading"),
          tx("Guidance, never the answer"),
        ].map((t) => (
          <li key={t} className="flex items-start gap-2 font-body text-[12px] text-ink-soft">
            <Check size={12} className="mt-0.5 shrink-0 text-saffron-500" aria-hidden />
            {t}
          </li>
        ))}
      </ul>

      <Link
        to="/mentor/$slug"
        params={{ slug: skill.slug }}
        className="btn-primary mt-6 !py-2.5 !text-xs"
      >
        {tx("Open my mentor")} <ArrowRight size={13} aria-hidden />
      </Link>
    </div>
  );
}
