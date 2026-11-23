import { motion } from "framer-motion";
import { BadgeCheck, Globe, ShieldCheck } from "lucide-react";
import { initialsAvatar } from "../lib/avatar";
import { LEVEL_LABEL, VERIFICATION_LABEL, type SkillLevel } from "../lib/skillswap";
import type { PassportSkill } from "../lib/skillswap";
import { useTx } from "../lib/i18n";

/**
 * The Skill Passport, drawn as an actual passport.
 *
 * The metaphor is doing real work here, not decoration. A passport is
 * something you hand to a stranger who has no reason to trust you, and it
 * carries: an identity page with a photograph, a machine-readable line, an
 * issuing authority, a document number, and stamps for where you have been.
 *
 * Every one of those maps onto something this platform actually knows — so
 * the design is honest rather than skeuomorphic for its own sake. The stamps
 * are earned skills; the document number is the share slug; the MRZ encodes
 * the handle and level so it can be read back.
 */

/** The two-line machine-readable zone across the bottom of a data page. */
function mrz(handle: string, name: string, level: number, skills: number): [string, string] {
  const pad = (s: string, n: number) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "<")
      .slice(0, n)
      .padEnd(n, "<");
  const line1 = `P<IND${pad(name.replace(/\s+/g, "<"), 31)}`;
  const line2 = `${pad(handle, 14)}IND${String(level).padStart(2, "0")}<${String(skills).padStart(2, "0")}<<<<<<<<<<<<<<`;
  return [line1, line2.slice(0, 36)];
}

export interface PassportBookProps {
  name: string;
  handle: string;
  headline: string | null;
  region: string | null;
  avatarUrl: string | null;
  level: number;
  xp: number;
  skills: PassportSkill[];
  swapsCompleted: number;
  sessionsCompleted: number;
  issuedOn: string;
  documentNumber: string | null;
}

export default function PassportBook(props: PassportBookProps) {
  const tx = useTx();
  const {
    name,
    handle,
    headline,
    region,
    avatarUrl,
    level,
    xp,
    skills,
    swapsCompleted,
    sessionsCompleted,
    issuedOn,
    documentNumber,
  } = props;

  const [line1, line2] = mrz(handle || name, name, level, skills.length);
  // Verified means verified. Counting everything that is merely *not*
  // self-declared swept "evidence submitted" and "assessed" in with it, so the
  // passport claimed a check that the swap gate — which requires
  // verified/expert_verified — would then refuse.
  const verified = skills.filter(
    (s) => s.verification === "verified" || s.verification === "expert_verified",
  );

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-float)]">
      {/* ── Cover band ─────────────────────────────────────────── */}
      <div className="relative bg-[#16213e] px-6 py-5 text-[#e8d9a0] sm:px-8">
        <div className="jaali pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.32em] opacity-80">
              {tx("\u092d\u093e\u0930\u0924 \u00b7 India")}
            </p>
            <p className="mt-1 font-display text-lg tracking-[0.16em]">{tx("Skill Passport")}</p>
          </div>
          <Globe size={30} strokeWidth={1} className="opacity-70" aria-hidden />
        </div>
      </div>

      {/* ── Data page ──────────────────────────────────────────── */}
      <div className="relative bg-[#fbf8f0] px-6 py-6 sm:px-8">
        {/* The faint guilloché wash real documents use to resist copying. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          aria-hidden
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#16213e 0 1px,transparent 1px 9px),repeating-linear-gradient(-45deg,#16213e 0 1px,transparent 1px 9px)",
          }}
        />

        <div className="relative flex flex-col gap-6 sm:flex-row">
          {/* Photograph */}
          <div className="shrink-0">
            <img
              src={avatarUrl || initialsAvatar(name)}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-32 w-[6.5rem] rounded-sm border border-[#16213e]/25 object-cover grayscale-[0.15]"
            />
            <p className="mt-2 text-center font-mono text-[8px] uppercase tracking-[0.18em] text-[#16213e]/55">
              {tx("Holder")}
            </p>
          </div>

          {/* Fields, set the way a data page sets them */}
          <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <Field label="Surname / Given names" value={name} wide />
            <Field label="Handle" value={handle ? `@${handle}` : "—"} />
            <Field label="Nationality" value="Indian" />
            <Field label="Place of residence" value={region ?? "—"} />
            <Field label="Skill level" value={`Level ${level} · ${xp} XP`} />
            <Field label="Date of issue" value={issuedOn} />
            <Field
              label="Document no."
              value={documentNumber ? documentNumber.slice(0, 12).toUpperCase() : "—"}
              mono
            />
            {headline && <Field label="Occupation" value={headline} wide />}
          </dl>
        </div>

        {/* Machine-readable zone */}
        <div className="relative mt-6 overflow-x-auto border-t border-dashed border-[#16213e]/25 pt-4">
          <pre className="whitespace-pre font-mono text-[11px] leading-[1.5] tracking-[0.14em] text-[#16213e]/80 sm:text-[13px]">
            {line1}
            {"\n"}
            {line2}
          </pre>
        </div>
      </div>

      {/* ── Stamp page ─────────────────────────────────────────── */}
      <div className="relative bg-[#f4efe2] px-6 py-7 sm:px-8">
        <div className="ikat pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#16213e]/60">
            Endorsements · {verified.length} verified of {skills.length}
          </p>

          {skills.length === 0 ? (
            <p className="mt-4 font-body text-sm text-[#16213e]/60">
              {tx("No stamps yet. Skills you teach appear here as they are verified.")}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-4">
              {skills.slice(0, 12).map((s, i) => (
                <Stamp key={`${s.name}-${i}`} skill={s} index={i} />
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-6 border-t border-[#16213e]/15 pt-4">
            <Stat label="Swaps completed" value={swapsCompleted} />
            <Stat label="Sessions taught" value={sessionsCompleted} />
            <Stat label="Skills carried" value={skills.length} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  wide,
  mono,
}: {
  label: string;
  value: string;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <dt className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#16213e]/50">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate text-[#16213e] ${
          mono ? "font-mono text-[13px] tracking-wide" : "font-body text-[15px] font-medium"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-xl leading-none text-[#16213e] tabular-nums">{value}</p>
      <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#16213e]/55">
        {label}
      </p>
    </div>
  );
}

/**
 * An entry stamp for one skill.
 *
 * Rotated slightly and alternating in colour, because a page of identical
 * upright stamps reads as a table rather than a record of things that
 * happened at different times. A verified skill gets the solid ink; a
 * self-declared one is faded, which is the honest distinction.
 */
function Stamp({ skill, index }: { skill: PassportSkill; index: number }) {
  const isVerified = skill.verification === "verified" || skill.verification === "expert_verified";
  // Between the two: evidence is on file but the ladder is not finished. It
  // earns darker ink than a bare claim, and no tick.
  const inProgress =
    !isVerified &&
    (skill.verification === "evidence_submitted" || skill.verification === "assessed");
  const tilt = [-7, 5, -3, 8, -5, 3][index % 6] ?? 0;
  const ink = isVerified ? "#8c2205" : "#16213e";

  return (
    <motion.div
      initial={{ scale: 0.8, rotate: tilt * 2 }}
      whileInView={{ scale: 1, rotate: tilt }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      style={{ color: ink, borderColor: ink, opacity: isVerified ? 0.9 : inProgress ? 0.7 : 0.45 }}
      className="rounded-md border-2 px-3.5 py-2 text-center"
      title={`${skill.name} — ${VERIFICATION_LABEL[skill.verification] ?? skill.verification}`}
    >
      <p className="flex items-center justify-center gap-1 font-display text-[13px] font-semibold leading-none tracking-wide">
        {isVerified && <BadgeCheck size={11} aria-hidden />}
        {skill.name}
      </p>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em]">
        {LEVEL_LABEL[skill.level as SkillLevel] ?? skill.level}
        {skill.evidenceCount > 0 && ` · ${skill.evidenceCount} proof`}
      </p>
      <p className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] opacity-75">
        {isVerified ? (
          <span className="inline-flex items-center gap-0.5">
            <ShieldCheck size={8} aria-hidden /> verified
          </span>
        ) : (
          "self-declared"
        )}
      </p>
    </motion.div>
  );
}
