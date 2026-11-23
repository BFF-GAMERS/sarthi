import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, ClipboardCheck, Target } from "lucide-react";
import AssessmentRunner from "./AssessmentRunner";
import { listSkillAssessments, type AssessmentSummary } from "../lib/assessments";
import {
  listLearnSkills,
  listTeachSkills,
  VERIFICATION_LABEL,
  type VerificationState,
} from "../lib/skillswap";
import { useTx } from "../lib/i18n";

/**
 * Your own square of the skill board, on the dashboard.
 *
 * The public board says what the platform can teach; this says where *you*
 * stand in it, and — the part that was missing everywhere else — what the next
 * move is. A skill sitting at "evidence submitted" looks finished until
 * something tells you it is one assessment away from letting you teach, and
 * until now nothing did: the Passport showed a state, SkillSwap silently
 * refused to match you, and no screen joined the two.
 */

/** Only these let you teach. Everything else is on the way there. */
const CAN_TEACH: VerificationState[] = ["verified", "expert_verified"];

export default function MySkillBoard({ profileId }: { profileId: string | null }) {
  const tx = useTx();
  const qc = useQueryClient();
  const enabled = Boolean(profileId);
  const [sitting, setSitting] = useState<AssessmentSummary | null>(null);

  const teach = useQuery({
    queryKey: ["teach-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled,
  });
  const learn = useQuery({
    queryKey: ["learn-skills", profileId],
    queryFn: () => listLearnSkills(profileId!),
    enabled,
  });

  const teaching = teach.data ?? [];
  const learning = learn.data ?? [];
  const verified = teaching.filter((t) => CAN_TEACH.includes(t.verificationState));
  const pending = teaching.filter((t) => !CAN_TEACH.includes(t.verificationState));

  // Which of the unproven skills can actually be proven today. Asked for
  // every skill on the board, because the answer is what turns "on the way"
  // from a status into a next move.
  const provable = useQuery({
    queryKey: [
      "skill-assessments",
      teaching
        .map((t) => t.skill.id)
        .sort()
        .join(","),
    ],
    queryFn: () => listSkillAssessments(teaching.map((t) => t.skill.id)),
    enabled: enabled && teaching.length > 0,
  });

  if (teach.isLoading) return null;

  return (
    <section className="card p-6">
      {sitting && (
        <AssessmentRunner
          assessment={sitting}
          onClose={() => setSitting(null)}
          onPassed={() => {
            // The verification stamp moves on the server, via the
            // skill_evidence recompute trigger. Refetch rather than guess.
            void qc.invalidateQueries({ queryKey: ["teach-skills", profileId] });
            void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="datum">{tx("Your skill board")}</p>
          <h2 className="mt-1 font-display text-xl tracking-tight text-ink">
            {verified.length > 0
              ? `${verified.length} ${verified.length === 1 ? tx("skill you can teach") : tx("skills you can teach")}`
              : tx("Nothing certified yet")}
          </h2>
        </div>
        <Link to="/board" className="btn-ghost shrink-0 !py-2 !text-xs">
          {tx("See the whole board")} <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>

      {teaching.length === 0 && learning.length === 0 ? (
        <p className="mt-4 font-body text-sm text-ink-soft">
          {tx("Add what you can teach and what you want to learn, and this fills in.")}{" "}
          <Link to="/skillswap" className="font-medium text-saffron-600 hover:underline">
            {tx("Start on SkillSwap")}
          </Link>
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {verified.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                {tx("Certified to teach")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {verified.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-1.5 rounded-full bg-emeraldx-400 px-2.5 py-1 font-body text-[12px] text-paper-light"
                  >
                    <BadgeCheck size={12} aria-hidden />
                    {t.skill.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                {tx("On the way")}
              </p>
              <ul className="mt-2 space-y-1.5">
                {pending.slice(0, 4).map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-ink-line bg-paper px-3 py-2"
                  >
                    <span className="font-body text-[13px] text-ink">{t.skill.name}</span>
                    <span className="font-body text-[11px] text-ink-mute">
                      {VERIFICATION_LABEL[t.verificationState]}
                    </span>
                    {/*
                      The sentence that was missing from every other screen —
                      and, where one exists, the assessment itself. It used to
                      say "Pass the course assessment" whether or not a course
                      existed, which for a skill like Photography was a
                      direction with nothing at the end of it.
                    */}
                    {t.verificationState !== "assessed" && provable.data?.[t.skill.id] ? (
                      <button
                        onClick={() => setSitting(provable.data![t.skill.id]!)}
                        className="btn-primary ml-auto shrink-0 !px-3 !py-1 !text-[11px]"
                      >
                        <ClipboardCheck size={11} aria-hidden /> {tx("Prove it now")}
                      </button>
                    ) : (
                      <span className="ml-auto font-body text-[11px] text-saffron-700">
                        {t.verificationState === "assessed"
                          ? tx("Finish a course in it")
                          : tx("Pass an assessment in it")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {learning.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                {tx("Learning")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {learning.slice(0, 8).map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-1.5 rounded-full border border-ink-line px-2.5 py-1 font-body text-[12px] text-ink-soft"
                  >
                    <Target size={11} aria-hidden />
                    {l.skill.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
