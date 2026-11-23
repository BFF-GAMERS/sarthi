import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, GraduationCap, Loader2, Plus, Search, Target, Trash2, X } from "lucide-react";
import {
  addLearnSkill,
  addTeachSkill,
  listLearnSkills,
  listSkills,
  listTeachSkills,
  removeLearnSkill,
  removeTeachSkill,
  suggestSkill,
  FORMAT_LABEL,
  LEVEL_LABEL,
  LEVEL_PERCENT,
  SKILL_LEVELS,
  VERIFICATION_LABEL,
  type LearningFormat,
  type SkillLevel,
  type SkillRef,
} from "../lib/skillswap";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";

/**
 * The two lists that drive SkillSwap, rendered inside the existing profile.
 *
 * These are not a separate "SkillSwap profile": they write to `user_skills`
 * and `wanted_skills`, the same tables the matcher, the passport, the
 * dashboard and Sarthi all read. Editing here changes what the whole product
 * knows about a person.
 */

const FORMATS = Object.keys(FORMAT_LABEL) as LearningFormat[];

/* ── Skill picker ────────────────────────────────────────────────── */

/**
 * Type-to-filter over the approved skill catalogue.
 *
 * A plain `<select>` of a hundred-plus skills is unusable on a phone, and a
 * free-text field would fork the vocabulary — so this searches the catalogue
 * and only ever yields a real skill id.
 */
function SkillPicker({
  skills,
  value,
  onChange,
  exclude,
}: {
  skills: SkillRef[];
  value: SkillRef | null;
  onChange: (s: SkillRef | null) => void;
  exclude: Set<string>;
}) {
  const tx = useTx();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const qc = useQueryClient();

  /**
   * Add whatever was typed, then select it.
   *
   * The catalogue is refetched rather than patched locally: the row may
   * already have existed under a different spelling, and the version the
   * database hands back is the one everyone else will match against.
   */
  const add = useMutation({
    mutationFn: (name: string) => suggestSkill(name),
    onSuccess: ({ skill }) => {
      setAddError("");
      void qc.invalidateQueries({ queryKey: ["skills-catalogue"] });
      onChange(skill);
      setQ("");
      setOpen(false);
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = skills.filter((s) => !exclude.has(s.id));
    if (!needle) return pool.slice(0, 8);
    return pool
      .filter(
        (s) =>
          s.name.toLowerCase().includes(needle) || s.categoryName.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [q, skills, exclude]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-saffron-200 bg-saffron-50 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block truncate font-body text-sm font-medium text-ink">
            {value.name}
          </span>
          <span className="block truncate font-body text-[11px] text-ink-mute">
            {value.categoryName}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQ("");
          }}
          aria-label={tx("Choose a different skill")}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-light hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute">
        <Search size={15} aria-hidden />
      </span>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Blur fires before the option's click, so closing is deferred.
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={tx("Search skills\u2026")}
        className="input !pl-9"
        aria-label={tx("Search skills")}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-control)] border border-ink-line bg-paper-light p-1 shadow-[var(--shadow-float)]">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                  // Clear the term as well as the list. The picker returns to
                  // its search state when the skill is removed or the form
                  // resets, and a stale query there sat offering to add the
                  // skill that was just added.
                  setQ("");
                }}
                className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-saffron-50"
              >
                <span className="block font-body text-sm font-medium text-ink">{s.name}</span>
                <span className="block font-body text-[11px] text-ink-mute">{s.categoryName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-[var(--radius-control)] border border-ink-line bg-paper-light p-2 shadow-[var(--shadow-float)]">
          <p className="px-1 pb-2 font-body text-[13px] text-ink-mute">
            Nothing in the catalogue matches &ldquo;{q.trim()}&rdquo;.
          </p>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => add.mutate(q.trim())}
            disabled={add.isPending}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-saffron-50 disabled:opacity-60"
          >
            {add.isPending ? (
              <Loader2 size={14} className="shrink-0 animate-spin text-ink-mute" aria-hidden />
            ) : (
              <Plus size={14} className="shrink-0 text-saffron-500" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block truncate font-body text-sm font-medium text-ink">
                Add &ldquo;{q.trim()}&rdquo;
              </span>
              <span className="block font-body text-[11px] text-ink-mute">
                {tx("Everyone can swap it once you do")}
              </span>
            </span>
          </button>
          {addError && (
            <p role="alert" className="px-3 pt-1 font-body text-[12px] text-saffron-500">
              {addError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FormatToggles({
  selected,
  onToggle,
}: {
  selected: LearningFormat[];
  onToggle: (f: LearningFormat) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FORMATS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onToggle(f)}
          aria-pressed={selected.includes(f)}
          className="filter-pill !px-3 !py-1.5 !text-[11px]"
        >
          {FORMAT_LABEL[f]}
        </button>
      ))}
    </div>
  );
}

function LevelSelect({
  value,
  onChange,
  label,
}: {
  value: SkillLevel;
  onChange: (l: SkillLevel) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="datum">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SkillLevel)}
        className="input mt-1 !py-2 !text-[13px]"
      >
        {SKILL_LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ── I CAN TEACH ─────────────────────────────────────────────────── */

export function TeachList({ profileId }: { profileId: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [skill, setSkill] = useState<SkillRef | null>(null);
  const [level, setLevel] = useState<SkillLevel>("intermediate");
  const [years, setYears] = useState("");
  const [blurb, setBlurb] = useState("");
  const [formats, setFormats] = useState<LearningFormat[]>(["chat", "video"]);
  const [error, setError] = useState("");

  const catalogue = useQuery({ queryKey: ["skills-catalogue"], queryFn: listSkills });
  const mine = useQuery({
    queryKey: ["teach-skills", profileId],
    queryFn: () => listTeachSkills(profileId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["teach-skills", profileId] });
    void qc.invalidateQueries({ queryKey: ["swap-matches", profileId] });
  };

  const add = useMutation({
    mutationFn: () =>
      addTeachSkill(profileId, {
        skillId: skill!.id,
        level,
        yearsExperience: years.trim() ? Number(years) : null,
        blurb: blurb.trim() || null,
        teachingFormats: formats.length ? formats : ["chat", "video"],
      }),
    onSuccess: () => {
      track(EV.SKILL_SWAP_REQUESTED, { role: "teach" });
      setAdding(false);
      setSkill(null);
      setYears("");
      setBlurb("");
      setError("");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const drop = useMutation({
    mutationFn: (id: string) => removeTeachSkill(id),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const owned = new Set((mine.data ?? []).map((t) => t.skill.id));

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
            <GraduationCap size={18} className="text-saffron-500" aria-hidden /> {tx("I can teach")}
          </h2>
          <p className="mt-1 font-body text-sm text-ink-mute">
            {tx("What you could sit down and show someone tomorrow.")}
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="btn-ghost shrink-0 !px-3 !py-2 !text-xs"
          >
            <Plus size={14} aria-hidden /> {tx("Add")}
          </button>
        )}
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-3 rounded-2xl border border-ink-line bg-paper p-4">
              <SkillPicker
                skills={catalogue.data ?? []}
                value={skill}
                onChange={setSkill}
                exclude={owned}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LevelSelect value={level} onChange={setLevel} label="Your level" />
                <label className="block">
                  <span className="datum">{tx("Years of experience")}</span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="0.5"
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    placeholder="2"
                    className="input mt-1 !py-2 !text-[13px]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="datum">{tx("How you'd teach it")}</span>
                <textarea
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  rows={2}
                  placeholder={tx("Start from a real project and debug it together.")}
                  className="input mt-1 resize-none !text-[13px]"
                />
              </label>
              <div>
                <span className="datum">{tx("Formats you're up for")}</span>
                <div className="mt-1.5">
                  <FormatToggles
                    selected={formats}
                    onToggle={(f) =>
                      setFormats((prev) =>
                        prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                      )
                    }
                  />
                </div>
              </div>
              {error && (
                <p role="alert" className="font-body text-[13px] text-saffron-700">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => add.mutate()}
                  disabled={!skill || add.isPending}
                  className="btn-primary !py-2.5 !text-xs disabled:opacity-50"
                >
                  {add.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  Add skill
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setError("");
                  }}
                  className="btn-ghost !py-2.5 !text-xs"
                >
                  {tx("Cancel")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-4">
        {mine.isLoading && (
          <p className="flex items-center gap-2 font-body text-sm text-ink-mute">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Loading…
          </p>
        )}
        {!mine.isLoading && (mine.data ?? []).length === 0 && (
          <p className="font-body text-sm text-ink-mute">
            {tx("Nothing here yet. Add one skill you could teach \u2014 that's half of a swap.")}
          </p>
        )}
        {(mine.data ?? []).map((t) => (
          <div key={t.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium text-ink">{t.skill.name}</span>
                <span className="ml-2 font-body text-[11px] text-ink-mute">
                  {LEVEL_LABEL[t.level]}
                  {t.yearsExperience ? ` · ${t.yearsExperience}y` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {t.verificationState !== "self_declared" && (
                  <span className="inline-flex items-center gap-1 font-body text-[10px] text-emeraldx-400">
                    <BadgeCheck size={11} aria-hidden />
                    {VERIFICATION_LABEL[t.verificationState]}
                  </span>
                )}
                <button
                  onClick={() => drop.mutate(t.id)}
                  aria-label={`Remove ${t.skill.name}`}
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-mute transition-colors hover:bg-saffron-50 hover:text-saffron-600"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper-dim">
              <motion.div
                className="h-full rounded-full bg-saffron-500"
                initial={{ width: 0 }}
                whileInView={{ width: `${LEVEL_PERCENT[t.level]}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            {t.blurb && (
              <p className="mt-1.5 font-body text-[12px] leading-snug text-ink-mute">{t.blurb}</p>
            )}
            {t.teachingFormats.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {t.teachingFormats.map((f) => (
                  <span key={f} className="chip !text-[10px]">
                    {FORMAT_LABEL[f]}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── I WANT TO LEARN ─────────────────────────────────────────────── */

export function LearnList({ profileId }: { profileId: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [skill, setSkill] = useState<SkillRef | null>(null);
  const [current, setCurrent] = useState<SkillLevel>("beginner");
  const [target, setTarget] = useState<SkillLevel>("intermediate");
  const [priority, setPriority] = useState(2);
  const [motivation, setMotivation] = useState("");
  const [formats, setFormats] = useState<LearningFormat[]>(["chat", "video"]);
  const [error, setError] = useState("");

  const catalogue = useQuery({ queryKey: ["skills-catalogue"], queryFn: listSkills });
  const mine = useQuery({
    queryKey: ["learn-skills", profileId],
    queryFn: () => listLearnSkills(profileId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["learn-skills", profileId] });
    void qc.invalidateQueries({ queryKey: ["swap-matches", profileId] });
  };

  const add = useMutation({
    mutationFn: () =>
      addLearnSkill(profileId, {
        skillId: skill!.id,
        currentLevel: current,
        targetLevel: target,
        priority,
        motivation: motivation.trim() || null,
        preferredFormats: formats.length ? formats : ["chat", "video"],
      }),
    onSuccess: () => {
      setAdding(false);
      setSkill(null);
      setMotivation("");
      setError("");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const drop = useMutation({
    mutationFn: (id: string) => removeLearnSkill(id),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const owned = new Set((mine.data ?? []).map((l) => l.skill.id));

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
            <Target size={18} className="text-saffron-500" aria-hidden /> {tx("I want to learn")}
          </h2>
          <p className="mt-1 font-body text-sm text-ink-mute">
            {tx("The other half of a swap \u2014 what you'd trade your time for.")}
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="btn-ghost shrink-0 !px-3 !py-2 !text-xs"
          >
            <Plus size={14} aria-hidden /> {tx("Add")}
          </button>
        )}
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-3 rounded-2xl border border-ink-line bg-paper p-4">
              <SkillPicker
                skills={catalogue.data ?? []}
                value={skill}
                onChange={setSkill}
                exclude={owned}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LevelSelect value={current} onChange={setCurrent} label="Where you are" />
                <LevelSelect value={target} onChange={setTarget} label="Where you want to get" />
              </div>
              <label className="block">
                <span className="datum">{tx("Priority")}</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="input mt-1 !py-2 !text-[13px]"
                >
                  <option value={1}>{tx("1 \u2014 Most important")}</option>
                  <option value={2}>{tx("2 \u2014 Would like to")}</option>
                  <option value={3}>{tx("3 \u2014 Someday")}</option>
                </select>
              </label>
              <label className="block">
                <span className="datum">{tx("Why this skill")}</span>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={2}
                  placeholder={tx("I keep handing off designs I can't build myself.")}
                  className="input mt-1 resize-none !text-[13px]"
                />
              </label>
              <div>
                <span className="datum">{tx("How you'd like to learn")}</span>
                <div className="mt-1.5">
                  <FormatToggles
                    selected={formats}
                    onToggle={(f) =>
                      setFormats((prev) =>
                        prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                      )
                    }
                  />
                </div>
              </div>
              {error && (
                <p role="alert" className="font-body text-[13px] text-saffron-700">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => add.mutate()}
                  disabled={!skill || add.isPending}
                  className="btn-primary !py-2.5 !text-xs disabled:opacity-50"
                >
                  {add.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  Add goal
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setError("");
                  }}
                  className="btn-ghost !py-2.5 !text-xs"
                >
                  {tx("Cancel")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-3">
        {mine.isLoading && (
          <p className="flex items-center gap-2 font-body text-sm text-ink-mute">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Loading…
          </p>
        )}
        {!mine.isLoading && (mine.data ?? []).length === 0 && (
          <p className="font-body text-sm text-ink-mute">
            {tx("Add one thing you want to learn and we can start finding you a partner.")}
          </p>
        )}
        {(mine.data ?? []).map((l) => (
          <div
            key={l.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-ink-line bg-paper p-3.5"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium text-ink">{l.skill.name}</span>
                {l.priority === 1 && (
                  <span className="chip-accent !text-[10px]">{tx("Top goal")}</span>
                )}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 font-body text-[12px] text-ink-mute">
                <GraduationCap size={12} aria-hidden />
                {LEVEL_LABEL[l.currentLevel]} → {LEVEL_LABEL[l.targetLevel]}
              </p>
              {l.motivation && (
                <p className="mt-1 font-body text-[12px] leading-snug text-ink-mute">
                  {l.motivation}
                </p>
              )}
            </div>
            <button
              onClick={() => drop.mutate(l.id)}
              aria-label={`Remove ${l.skill.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-saffron-50 hover:text-saffron-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
