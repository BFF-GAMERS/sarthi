import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { describeMatch, useDetail } from "../lib/a11y";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Repeat2,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { initialsAvatar } from "../lib/avatar";
import {
  FORMAT_LABEL,
  LEVEL_LABEL,
  type ActiveSwap,
  HUMAN_FORMATS,
  type LearningFormat,
  type MatchBreakdown,
  type SwapMatch,
  type SwapRequest,
} from "../lib/skillswap";
import { useTx } from "../lib/i18n";
import { useUndoable } from "./undo/useUndoable";
import { InlineUndo } from "./undo/UndoHost";
import IcebreakerDrafts from "./swap/IcebreakerDrafts";
import SessionPlaybook from "./swap/SessionPlaybook";

/* ── Shared bits ─────────────────────────────────────────────────── */

export function Avatar({
  src,
  name,
  size = 44,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  return (
    <img
      loading="lazy"
      decoding="async"
      src={src || initialsAvatar(name)}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover ring-1 ring-ink-line"
    />
  );
}

/**
 * The trade itself, stated as a swap rather than two separate facts.
 *
 * Reads left-to-right as "they give you X, you give them Y", which is the
 * whole proposition — a member should not have to work out who owes what.
 */
export function SwapLine({
  theyTeach,
  youTeach,
  theirName,
}: {
  /** Null when this side of the trade is empty — a learner offering nothing. */
  theyTeach: string | null;
  youTeach: string | null;
  theirName: string;
}) {
  const tx = useTx();
  return (
    <div className="rounded-[var(--radius-control)] border border-ink-line bg-paper p-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <p className="datum !text-[9px]">{tx("You learn")}</p>
          <p className="mt-0.5 truncate font-display text-sm font-medium leading-tight text-ink">
            {theyTeach ?? <span className="text-ink-mute">&mdash;</span>}
          </p>
        </div>
        <ArrowLeftRight size={15} className="shrink-0 text-saffron-500" aria-hidden />
        <div className="min-w-0 text-right">
          <p className="datum !text-[9px]">{tx("You teach")}</p>
          <p className="mt-0.5 truncate font-display text-sm font-medium leading-tight text-ink">
            {youTeach ?? <span className="text-ink-mute">{tx("Nothing yet")}</span>}
          </p>
        </div>
      </div>
      <p className="sr-only">
        {youTeach
          ? `${theirName} teaches you ${theyTeach}; you teach them ${youTeach}.`
          : `${theirName} teaches you ${theyTeach}. You are not teaching anything in return.`}
      </p>
    </div>
  );
}

const BREAKDOWN_ROWS: Array<{ key: keyof Omit<MatchBreakdown, "max">; label: string }> = [
  { key: "skillFit", label: "Skill fit" },
  { key: "goalFit", label: "Goal fit" },
  { key: "language", label: "Shared language" },
  { key: "availability", label: "Availability" },
  { key: "format", label: "Format" },
  { key: "evidence", label: "Evidence" },
  { key: "reputation", label: "Reputation" },
];

/**
 * Why this match scored what it did.
 *
 * A bare percentage tells someone nothing about what to do next, so every
 * component of the score is shown against its ceiling — a low "evidence" row
 * is a prompt to add proof, not a mystery.
 */
function ScoreBreakdown({ breakdown }: { breakdown: MatchBreakdown }) {
  return (
    <dl className="mt-3 space-y-1.5">
      {BREAKDOWN_ROWS.map((row) => {
        const got = breakdown[row.key];
        const max = breakdown.max[row.key];
        const pct = max > 0 ? Math.round((got / max) * 100) : 0;
        return (
          <div key={row.key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2">
            <dt className="font-body text-[11px] text-ink-mute">{row.label}</dt>
            <dd className="h-1.5 overflow-hidden rounded-full bg-paper-dim">
              <motion.span
                className="block h-full rounded-full bg-saffron-500"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </dd>
            <dd className="text-right font-mono text-[10px] tabular-nums text-ink-mute">
              {Math.round(got)}/{max}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ── Match card ──────────────────────────────────────────────────── */

export function MatchCard({
  match,
  onRequest,
  pending,
  alreadyRequested,
}: {
  match: SwapMatch;
  onRequest: (match: SwapMatch, message: string, format: LearningFormat) => Promise<void>;
  pending: boolean;
  alreadyRequested: boolean;
}) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState<LearningFormat>("video");
  const undoable = useUndoable();
  const locked = pending || undoable.phase !== "idle";

  return (
    <article className="card flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <Avatar src={match.avatarUrl} name={match.displayName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg leading-tight tracking-tight text-ink">
                {match.displayName}
              </h3>
              {match.handle && (
                <Link
                  to="/u/$handle"
                  params={{ handle: match.handle }}
                  className="block truncate font-mono text-[11px] text-ink-mute transition-colors hover:text-saffron-600"
                >
                  @{match.handle}
                </Link>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="font-display text-2xl leading-none text-saffron-500 tabular-nums">
                {match.score}
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                match
              </span>
            </div>
          </div>
          {match.headline && (
            <p className="mt-1.5 line-clamp-2 font-body text-[13px] leading-snug text-ink-soft">
              {match.headline}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {match.isMutual && (
              <span className="chip-accent">
                <Repeat2 size={11} aria-hidden /> {tx("Mutual")}
              </span>
            )}
            {match.region && (
              <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink-mute">
                <MapPin size={11} aria-hidden /> {match.region}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <SwapLine
          theyTeach={match.theyTeach.name}
          youTeach={match.youTeach?.name ?? null}
          theirName={match.displayName}
        />
      </div>

      {match.breakdown && (
        <div className="mt-3">
          <button
            onClick={() => setShowWhy((v) => !v)}
            aria-expanded={showWhy}
            className="font-body text-[11px] font-medium uppercase tracking-[0.1em] text-ink-mute transition-colors hover:text-saffron-600"
          >
            {showWhy ? "Hide" : "Why this match?"}
          </button>
          {showWhy && <ScoreBreakdown breakdown={match.breakdown} />}
        </div>
      )}

      <div className="mt-auto pt-4">
        {alreadyRequested ? (
          <p className="inline-flex items-center gap-1.5 font-body text-[13px] font-medium text-emeraldx-400">
            <Check size={14} aria-hidden /> {tx("Request sent")}
          </p>
        ) : open ? (
          <div className="space-y-3">
            <label className="block">
              <span className="datum">{tx("Add a note")}</span>
              <textarea
                id={`swap-note-${match.candidateId}`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={`Hi ${match.displayName.split(" ")[0]} — I'd love to learn ${match.theyTeach.name}.${match.youTeach ? ` I can teach you ${match.youTeach.name}.` : ""}`}
                className="input mt-1 resize-none !text-[13px]"
              />
            </label>
            <IcebreakerDrafts
              learnSkill={match.theyTeach.name}
              teachSkill={match.youTeach?.name}
              value={message}
              onChange={setMessage}
              textareaId={`swap-note-${match.candidateId}`}
            />
            <label className="block">
              <span className="datum">{tx("Format")}</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as LearningFormat)}
                className="input mt-1 !py-2 !text-[13px]"
              >
                {HUMAN_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                {...undoable.controlProps}
                onClick={() => {
                  if (locked) return;
                  // Not sent yet: the request goes when the undo window closes.
                  undoable.start({
                    id: `swap:${match.candidateId}`,
                    label: tx("Request queued"),
                    undoneLabel: tx("Request not sent"),
                    commit: () => onRequest(match, message, format),
                  });
                }}
                aria-disabled={locked || undefined}
                aria-busy={pending || undoable.working || undefined}
                className="btn-primary min-h-11 flex-1 !py-2.5 !text-xs aria-disabled:cursor-default aria-disabled:opacity-70"
              >
                {pending || undoable.working ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : undoable.queued || undoable.phase === "done" ? (
                  <Check size={14} aria-hidden />
                ) : (
                  <Send size={14} aria-hidden />
                )}
                {pending || undoable.working
                  ? tx("Working…")
                  : undoable.queued
                    ? tx("Request queued")
                    : undoable.phase === "done"
                      ? tx("Done")
                      : "Send request"}
              </button>
              {!undoable.queued && (
                <button
                  onClick={() => setOpen(false)}
                  className="btn-ghost min-h-11 !px-4 !py-2.5 !text-xs"
                >
                  {tx("Cancel")}
                </button>
              )}
            </div>
            {undoable.queued && <InlineUndo onUndo={undoable.undo} what={tx("swap request")} />}
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className="btn-primary w-full !py-2.5 !text-xs">
            {tx("Propose this swap")} <ArrowUpRight size={14} aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

/* ── Request card ────────────────────────────────────────────────── */

const REQUEST_TONE: Record<string, string> = {
  pending: "border-saffron-200 bg-saffron-50 text-saffron-600",
  accepted: "border-emeraldx-400/30 bg-emeraldx-400/10 text-emeraldx-400",
  declined: "border-ink-line bg-paper text-ink-mute",
  withdrawn: "border-ink-line bg-paper text-ink-mute",
  expired: "border-ink-line bg-paper text-ink-mute",
};

export function RequestCard({
  request,
  onAccept,
  onDecline,
  onWithdraw,
  onMessage,
  pending,
}: {
  request: SwapRequest;
  onAccept: (r: SwapRequest) => Promise<void>;
  onDecline: (r: SwapRequest) => Promise<void>;
  onWithdraw: (r: SwapRequest) => Promise<void>;
  onMessage: (r: SwapRequest) => Promise<void>;
  pending: boolean;
}) {
  const tx = useTx();
  const detail = useDetail();
  const incoming = request.direction === "incoming";
  // On an incoming request the other person offered what they teach, and asked
  // for what you teach — so the labels flip relative to the stored columns.
  // A learner may have offered nothing back, which is normal under the
  // certified model — so say so rather than printing a placeholder skill.
  const offered = request.offeredSkill?.name ?? null;
  const theyTeach = incoming ? offered : request.requestedSkill.name;
  const youTeach = incoming ? request.requestedSkill.name : offered;

  return (
    <article className="card-flat p-5">
      <div className="flex items-start gap-3">
        <Avatar src={request.counterpart.avatarUrl} name={request.counterpart.displayName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base leading-tight tracking-tight text-ink">
              {request.counterpart.displayName}
            </h3>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-body text-[10px] font-medium uppercase tracking-wide ${
                REQUEST_TONE[request.state] ?? REQUEST_TONE["declined"]
              }`}
            >
              {request.state}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
              {incoming ? "asked you" : "you asked"}
            </span>
          </div>
          <p className="mt-0.5 font-body text-[12px] text-ink-mute">
            {FORMAT_LABEL[request.proposedFormat]}
            {request.matchScore !== null && ` · ${request.matchScore} match`}
          </p>
          {detail && request.matchScore !== null && (
            <p className="sr-only">
              {describeMatch(request.matchScore, theyTeach ?? "a skill", youTeach ?? "a skill")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <SwapLine
          theyTeach={theyTeach}
          youTeach={youTeach}
          theirName={request.counterpart.displayName}
        />
      </div>

      {request.message && (
        <p className="mt-3 border-l-[3px] border-saffron-500 pl-3 font-editorial text-[15px] leading-snug text-ink-soft">
          {request.message}
        </p>
      )}
      {request.responseNote && (
        <p className="mt-3 font-body text-[12px] text-ink-mute">
          <span className="font-semibold uppercase tracking-wide">{tx("Reply:")}</span>{" "}
          {request.responseNote}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {request.state === "pending" && incoming && (
          <>
            <button
              onClick={() => void onAccept(request)}
              disabled={pending}
              className="btn-primary !px-4 !py-2 !text-xs disabled:opacity-60"
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <Check size={13} aria-hidden />
              )}
              Accept swap
            </button>
            <button
              onClick={() => void onDecline(request)}
              disabled={pending}
              className="btn-ghost !px-4 !py-2 !text-xs disabled:opacity-60"
            >
              <X size={13} aria-hidden /> {tx("Decline")}
            </button>
          </>
        )}
        {request.state === "pending" && !incoming && (
          <button
            onClick={() => void onWithdraw(request)}
            disabled={pending}
            className="btn-ghost !px-4 !py-2 !text-xs disabled:opacity-60"
          >
            <Undo2 size={13} aria-hidden /> {tx("Withdraw")}
          </button>
        )}
        <button onClick={() => void onMessage(request)} className="btn-ghost !px-4 !py-2 !text-xs">
          <MessageSquare size={13} aria-hidden /> {tx("Message")}
        </button>
      </div>
    </article>
  );
}

/* ── Active swap card ────────────────────────────────────────────── */

export function SwapCard({
  swap,
  onMessage,
}: {
  swap: ActiveSwap;
  onMessage: (s: ActiveSwap) => Promise<void>;
}) {
  const tx = useTx();
  const [plan, setPlan] = useState(false);
  const pct =
    swap.sessionsPlanned > 0
      ? Math.min(100, Math.round((swap.sessionsCompleted / swap.sessionsPlanned) * 100))
      : 0;

  return (
    <article className="card p-5">
      <div className="flex items-start gap-3">
        <Avatar src={swap.partner.avatarUrl} name={swap.partner.displayName} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base leading-tight tracking-tight text-ink">
            {swap.partner.displayName}
          </h3>
          <p className="font-body text-[12px] text-ink-mute">
            {FORMAT_LABEL[swap.format]} ·{" "}
            {swap.state === "active" ? (
              <span className="text-emeraldx-400">{tx("Active")}</span>
            ) : (
              swap.state
            )}
          </p>
        </div>
        {swap.state === "completed" && (
          <BadgeCheck size={18} className="shrink-0 text-emeraldx-400" aria-hidden />
        )}
      </div>

      <div className="mt-3">
        <SwapLine
          theyTeach={swap.theyTeach.name}
          youTeach={swap.youTeach.name}
          theirName={swap.partner.displayName}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between font-body text-[11px]">
          <span className="inline-flex items-center gap-1 text-ink-mute">
            <Clock size={11} aria-hidden /> {tx("Sessions")}
          </span>
          <span className="font-mono tabular-nums text-ink">
            {swap.sessionsCompleted}/{swap.sessionsPlanned}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-dim">
          <motion.span
            className="block h-full rounded-full bg-saffron-500"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <button
        onClick={() => void onMessage(swap)}
        className="btn-ghost mt-4 w-full !py-2.5 !text-xs"
      >
        <MessageSquare size={13} aria-hidden /> {tx("Open chat")}
      </button>
      {swap.state === "active" && (
        <>
          <button
            type="button"
            onClick={() => setPlan((v) => !v)}
            aria-expanded={plan}
            className="btn-ghost mt-2 w-full !py-2.5 !text-xs"
          >
            <CalendarClock size={13} aria-hidden /> {tx("Session plan")}
          </button>
          {plan && (
            <SessionPlaybook
              manual
              teachSkill={swap.youTeach.name}
              learnSkill={swap.theyTeach.name}
              onClose={() => setPlan(false)}
            />
          )}
        </>
      )}
    </article>
  );
}

/* ── Level pill, shared by the profile lists ─────────────────────── */

export function LevelPill({ level }: { level: keyof typeof LEVEL_LABEL }) {
  return <span className="chip">{LEVEL_LABEL[level]}</span>;
}
