import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  Loader2,
  MessageSquare,
  Users,
  Video,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { initialsAvatar } from "../lib/avatar";
import {
  acceptSwapRequest,
  declineSwapRequest,
  listMySessions,
  listRequests,
  listSwaps,
  listTeachSkills,
  openConversationWith,
  rescheduleSession,
  setSessionState,
  watchMySessions,
  type SwapSession,
} from "../lib/skillswap";
import { getStanding } from "../lib/standing";
import { useTx } from "../lib/i18n";

/**
 * Two dashboards, because learning and teaching are different jobs.
 *
 * A learner wants to know what they asked for and when it happens. A trainer
 * wants to know who is waiting on them and whether their students are
 * passing. A single screen serving both ends up serving neither, so the
 * question is asked once and the answer opens its own dashboard.
 */

/* ── The first question ──────────────────────────────────────────── */

export function SwapChoice({ onChoose }: { onChoose: (mode: "learn" | "train") => void }) {
  const tx = useTx();
  const { profileId } = useAuth();

  // Somebody already licensed to teach probably came here to teach, so that
  // card is the suggested one — a hint, never a decision.
  const teaching = useQuery({
    queryKey: ["teach-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled: Boolean(profileId),
  });
  const licensed = (teaching.data ?? []).filter(
    (t) => t.verificationState === "verified" || t.verificationState === "expert_verified",
  ).length;

  const cards = [
    {
      id: "learn" as const,
      icon: <GraduationCap size={26} aria-hidden />,
      title: "I want to learn",
      blurb: "Find someone certified to teach the skill you are after, free or one to one.",
      points: ["Matched to certified trainers", "Basic is free", "Certificate at the end"],
      suggested: licensed === 0,
    },
    {
      id: "train" as const,
      icon: <Users size={26} aria-hidden />,
      title: "I want to train",
      blurb: "Teach what you are certified in, and build a record toward Master Trainer.",
      points: [
        licensed > 0
          ? `Licensed in ${licensed} skill${licensed === 1 ? "" : "s"}`
          : "Needs a certification first",
        "Students request you",
        "Ten trainings, then review",
      ],
      suggested: licensed > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl py-6">
      <p className="kicker text-center">{tx("Before we start")}</p>
      <h2 className="mt-3 text-center font-display text-2xl tracking-tight text-ink sm:text-3xl">
        {tx("What brings you to SkillSwap?")}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center font-body text-sm text-ink-soft">
        {tx(
          "You can switch whenever you like \u2014 this only decides which dashboard opens first.",
        )}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => onChoose(c.id)}
            className="card group p-6 text-left transition-colors hover:!border-saffron-500"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-saffron-100 text-saffron-500">
              {c.icon}
            </span>
            <span className="mt-4 flex items-center gap-2">
              <span className="font-display text-lg tracking-tight text-ink">{c.title}</span>
              {c.suggested && <span className="chip">{tx("Suggested")}</span>}
            </span>
            <span className="mt-2 block font-body text-sm text-ink-soft">{c.blurb}</span>
            <ul className="mt-4 space-y-1.5">
              {c.points.map((p) => (
                <li key={p} className="flex items-start gap-2 font-body text-[13px] text-ink-mute">
                  <Check size={13} className="mt-[3px] shrink-0 text-saffron-500" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <span className="mt-5 flex items-center gap-1.5 font-body text-xs font-medium text-saffron-500">
              {tx("Open this dashboard")} <ArrowRight size={13} aria-hidden />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Shared pieces ───────────────────────────────────────────────── */

function when(iso: string | null): string {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return sameDay
    ? `Today, ${time}`
    : `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

/**
 * A session, from whichever side you are on.
 *
 * The host gets the controls that move it along; the guest gets a join button
 * and the truth about whether it has started.
 */
/**
 * One scheduled training, from either side of it.
 *
 * Written so a person who has never used the site can tell what to do without
 * being taught: the row says the time in their own timezone, how long until
 * it, and exactly one obvious next action. Both people see the same row from
 * their own angle — "You are teaching" or "Taught by" — off one row in the
 * database, so there is no version of this where the two of them disagree
 * about when it is.
 */
/**
 * One training session, seen from whichever side you are on.
 *
 * The two roles are not symmetrical and the UI should not pretend they are.
 * The trainer owns the session: they set the time and they decide when it
 * begins. The learner is a guest — they need to know when it is, what form it
 * takes, and how to get in once it starts. Giving the learner a "Start" button
 * and a time picker, as this did, invited two people to each schedule the same
 * hour and each believe they were in charge of it.
 *
 * The action also follows the format agreed when the request was sent. A chat
 * session opens the thread; only a video session opens a call. Offering a
 * Jitsi link for a chat lesson is simply the wrong door.
 */
function SessionRow({
  session,
  onOpenRoom,
  onNote,
}: {
  session: SwapSession;
  onOpenRoom: (s: SwapSession) => void;
  onNote: (tone: "ok" | "bad", text: string) => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const live = session.state === "live";
  const done = session.state === "completed";
  const host = session.hosting;
  const [picking, setPicking] = useState(false);
  const [details, setDetails] = useState(false);
  const [when_, setWhen] = useState("");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["my-sessions"] });
    void qc.invalidateQueries({ queryKey: ["member-metrics"] });
  };

  const move = useMutation({
    mutationFn: (state: "live" | "completed") => setSessionState(session.id, state),
    onSuccess: (_r, state) => {
      onNote(
        "ok",
        state === "live"
          ? tx("Session started. Your learner can join now.")
          : tx("Session completed. It counts toward both your records."),
      );
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const moveTime = useMutation({
    mutationFn: () => rescheduleSession(session.id, new Date(when_)),
    onSuccess: () => {
      setPicking(false);
      onNote("ok", tx("Time set. Your learner sees it in their own timezone."));
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const startsIn = (() => {
    if (!session.scheduledStart) return tx("no time set yet");
    const mins = Math.round((new Date(session.scheduledStart).getTime() - Date.now()) / 60000);
    if (mins < -60) return tx("was earlier");
    if (mins < 0) return tx("starting now");
    if (mins < 60) return `${tx("in")} ${mins} ${tx("min")}`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${tx("in")} ${hrs} ${hrs === 1 ? tx("hour") : tx("hours")}`;
    return `${tx("in")} ${Math.round(hrs / 24)} ${tx("days")}`;
  })();

  const FORMAT: Record<string, { label: string; how: string }> = {
    video: { label: tx("Video call"), how: tx("Opens a private call in a new tab.") },
    chat: { label: tx("Chat"), how: tx("Happens in your message thread — no call.") },
    in_person: { label: tx("In person"), how: tx("Agree the place in your thread beforehand.") },
    project: { label: tx("Project work"), how: tx("Worked through in your thread.") },
    // Only reachable for rows created before self-paced left this dropdown.
    self_paced: { label: tx("Self-paced"), how: tx("No trainer — your AI mentor guides this.") },
  };
  const fmt = FORMAT[session.format] ?? FORMAT["video"]!;
  const isCall = session.format === "video";

  return (
    <div className="rounded-2xl border border-ink-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            <span className="truncate">{session.title}</span>
            <span className="chip !text-[10px]">{fmt.label}</span>
            {live && (
              <span className="chip !bg-red-700 !text-white">
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {tx("Live now")}
              </span>
            )}
            {done && <span className="chip">{tx("Completed")}</span>}
          </p>
          <p className="mt-0.5 font-body text-[12px] text-ink-mute">
            {host ? tx("You are teaching") : tx("Taught by")} {session.counterpartName} ·{" "}
            <Clock size={11} className="inline" aria-hidden /> {when(session.scheduledStart)}
            {!done ? ` · ${startsIn}` : ""} · {session.durationMinutes}m
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!done && !isCall && (
            <Link to="/messages" className="btn-primary !py-2 !text-xs">
              <MessageSquare size={13} aria-hidden /> {tx("Open thread")}
            </Link>
          )}

          {!done && isCall && host && (
            <button
              onClick={() => {
                if (!live) move.mutate("live");
                onOpenRoom(session);
              }}
              className="btn-primary !py-2 !text-xs"
            >
              <Video size={13} aria-hidden /> {live ? tx("Rejoin") : tx("Start session")}
            </button>
          )}

          {!done && isCall && !host && (
            <button
              onClick={() => onOpenRoom(session)}
              disabled={!live}
              title={live ? undefined : tx("Your trainer has not started it yet")}
              className="btn-primary !py-2 !text-xs disabled:opacity-45"
            >
              <Video size={13} aria-hidden />
              {live ? tx("Join now") : tx("Waiting to start")}
            </button>
          )}

          <button
            onClick={() => setDetails((v) => !v)}
            aria-expanded={details}
            className="btn-ghost !py-2 !text-xs"
          >
            {tx("Details")}
          </button>

          {host && !done && (
            <button
              onClick={() => {
                setPicking((v) => !v);
                setWhen(
                  session.scheduledStart
                    ? new Date(
                        new Date(session.scheduledStart).getTime() -
                          new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : "",
                );
              }}
              className="btn-ghost !py-2 !text-xs"
            >
              {tx("Set time")}
            </button>
          )}

          {host && live && !done && (
            <button
              onClick={() => move.mutate("completed")}
              disabled={move.isPending}
              className="btn-ghost !py-2 !text-xs"
            >
              {move.isPending ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                tx("End session")
              )}
            </button>
          )}
        </div>
      </div>

      {details && (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-ink-line pt-3 sm:grid-cols-2">
          {[
            [tx("Skill"), session.skill],
            [
              tx("With"),
              `${session.counterpartName} · ${host ? tx("your learner") : tx("your trainer")}`,
            ],
            [
              tx("When"),
              session.scheduledStart
                ? new Date(session.scheduledStart).toLocaleString(undefined, {
                    dateStyle: "full",
                    timeStyle: "short",
                  })
                : tx("Your trainer has not set a time yet"),
            ],
            [tx("Length"), `${session.durationMinutes} ${tx("minutes")}`],
            [tx("Format"), `${fmt.label} — ${fmt.how}`],
            [
              tx("Who starts it"),
              host ? tx("You do — your learner joins after that") : tx("Your trainer does"),
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">{k}</dt>
              <dd className="font-body text-[13px] text-ink-soft">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {picking && host && !done && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-line pt-3">
          <div>
            <label
              htmlFor={`when-${session.id}`}
              className="mb-1 block font-body text-[11px] text-ink-mute"
            >
              {tx("When will you teach this?")}
            </label>
            <input
              id={`when-${session.id}`}
              type="datetime-local"
              value={when_}
              onChange={(e) => setWhen(e.target.value)}
              className="input !py-2 !text-[13px]"
            />
          </div>
          <button
            onClick={() => moveTime.mutate()}
            disabled={!when_ || moveTime.isPending}
            className="btn-primary !py-2 !text-xs disabled:opacity-50"
          >
            {moveTime.isPending && <Loader2 size={12} className="animate-spin" aria-hidden />}
            {tx("Save time")}
          </button>
          <button onClick={() => setPicking(false)} className="btn-ghost !py-2 !text-xs">
            {tx("Cancel")}
          </button>
          <p className="w-full font-body text-[11px] text-ink-mute">
            {tx("Set in your timezone. Your learner sees the same moment in theirs.")}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Learner ─────────────────────────────────────────────────────── */

export function LearnerDashboard({
  onOpenRoom,
  onNote,
}: {
  onOpenRoom: (s: SwapSession) => void;
  onNote: (tone: "ok" | "bad", text: string) => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const { profileId } = useAuth();
  const enabled = Boolean(profileId);

  const requests = useQuery({
    queryKey: ["swap-requests", profileId],
    queryFn: () => listRequests(profileId!),
    enabled,
  });
  const sessions = useQuery({
    queryKey: ["my-sessions", profileId],
    queryFn: () => listMySessions(profileId!),
    enabled,
  });

  /*
   * Live session updates.
   *
   * The two people are in different browsers. Without this, one presses
   * "Start the call" and the other keeps looking at a scheduled row until it
   * occurs to them to reload — which is exactly when somebody concludes the
   * site is broken and gives up. `sessions` is published to realtime, so the
   * row flips to "Live now" on its own.
   */
  useEffect(
    () =>
      watchMySessions(() => {
        void qc.invalidateQueries({ queryKey: ["my-sessions", profileId] });
      }),
    [qc, profileId],
  );

  const swaps = useQuery({
    queryKey: ["swaps", profileId],
    queryFn: () => listSwaps(profileId!),
    enabled,
  });
  const standing = useQuery({
    queryKey: ["standing", profileId],
    queryFn: () => getStanding(profileId!),
    enabled,
  });

  const mine = (requests.data ?? []).filter((r) => r.direction === "outgoing");
  const pending = mine.filter((r) => r.state === "pending");
  const attending = (sessions.data ?? []).filter((s) => !s.hosting && s.state !== "completed");
  const st = standing.data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Requests out", value: pending.length },
          { label: "Sessions ahead", value: attending.length },
          { label: "Trainers", value: (swaps.data ?? []).length },
          { label: "Skills verified", value: st?.skillsVerified ?? 0 },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="font-display text-2xl leading-none text-ink">{s.value}</p>
            <p className="mt-1.5 font-body text-[11px] uppercase tracking-wider text-ink-mute">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
          <Video size={17} className="text-saffron-500" aria-hidden /> {tx("Your sessions")}
        </h3>
        {attending.length === 0 ? (
          <p className="mt-3 font-body text-sm text-ink-mute">
            {tx("Nothing scheduled. A session appears here as soon as a trainer accepts you.")}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {attending.map((s) => (
              <SessionRow key={s.id} session={s} onOpenRoom={onOpenRoom} onNote={onNote} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg tracking-tight text-ink">
          {tx("Requests you have sent")}
        </h3>
        {mine.length === 0 ? (
          <p className="mt-3 font-body text-sm text-ink-mute">
            None yet. Pick a skill and we&apos;ll rank the trainers certified to teach it.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {mine.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={r.counterpart.avatarUrl ?? initialsAvatar(r.counterpart.displayName)}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.counterpart.displayName}</p>
                    <p className="font-body text-[12px] text-ink-mute">
                      Teaching {r.requestedSkill.name}
                      {r.offeredSkill && ` · you teach ${r.offeredSkill.name}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`chip shrink-0 ${r.state === "accepted" ? "!bg-emeraldx-400 !text-paper-light" : ""}`}
                >
                  {r.state}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg tracking-tight text-ink">
          {tx("Toward certification")}
        </h3>
        <div className="panel mt-4 p-5">
          <p className="font-body text-sm text-ink-soft">
            {tx("A certificate unlocks at")} <strong className="text-ink">90%</strong>{" "}
            {tx(
              "on the skill assessment. Below that you get one retake, then the material reopens.",
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/courses" className="btn-ghost !py-2 !text-xs">
              <BookOpen size={13} aria-hidden /> {tx("Study the material")}
            </Link>
            <Link to="/passport" className="btn-ghost !py-2 !text-xs">
              <BadgeCheck size={13} aria-hidden /> {tx("See your passport")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Trainer ─────────────────────────────────────────────────────── */

export function TrainerDashboard({
  onOpenRoom,
  onNote,
}: {
  onOpenRoom: (s: SwapSession) => void;
  onNote: (tone: "ok" | "bad", text: string) => void;
}) {
  const tx = useTx();
  const { profileId } = useAuth();
  const qc = useQueryClient();
  const enabled = Boolean(profileId);

  const requests = useQuery({
    queryKey: ["swap-requests", profileId],
    queryFn: () => listRequests(profileId!),
    enabled,
  });
  const sessions = useQuery({
    queryKey: ["my-sessions", profileId],
    queryFn: () => listMySessions(profileId!),
    enabled,
  });

  /*
   * Live session updates.
   *
   * The two people are in different browsers. Without this, one presses
   * "Start the call" and the other keeps looking at a scheduled row until it
   * occurs to them to reload — which is exactly when somebody concludes the
   * site is broken and gives up. `sessions` is published to realtime, so the
   * row flips to "Live now" on its own.
   */
  useEffect(
    () =>
      watchMySessions(() => {
        void qc.invalidateQueries({ queryKey: ["my-sessions", profileId] });
      }),
    [qc, profileId],
  );

  const teaching = useQuery({
    queryKey: ["teach-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled,
  });
  const standing = useQuery({
    queryKey: ["standing", profileId],
    queryFn: () => getStanding(profileId!),
    enabled,
  });

  const incoming = (requests.data ?? []).filter(
    (r) => r.direction === "incoming" && r.state === "pending",
  );
  const hosting = (sessions.data ?? []).filter((s) => s.hosting && s.state !== "completed");
  const licensed = (teaching.data ?? []).filter(
    (t) => t.verificationState === "verified" || t.verificationState === "expert_verified",
  );
  const st = standing.data;

  const respond = useMutation({
    mutationFn: (v: { id: string; accept: boolean }) =>
      v.accept ? acceptSwapRequest(v.id) : declineSwapRequest(v.id),
    onSuccess: (_r, v) => {
      onNote("ok", v.accept ? "Accepted — a session and a thread are open." : "Request declined.");
      void qc.invalidateQueries({ queryKey: ["swap-requests", profileId] });
      void qc.invalidateQueries({ queryKey: ["my-sessions", profileId] });
      // Accepting changes the counters on this very screen — "waiting on you"
      // drops, a session appears, and the swap joins the list. Without these
      // the trainer watches their own dashboard contradict what they just did.
      void qc.invalidateQueries({ queryKey: ["standing", profileId] });
      void qc.invalidateQueries({ queryKey: ["swaps", profileId] });
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const message = useMutation({
    mutationFn: (otherId: string) => openConversationWith(otherId),
    onSuccess: () => onNote("ok", "Thread open in Messages."),
    onError: (e: Error) => onNote("bad", e.message),
  });

  const doneCount = st?.trainingsCompleted ?? 0;
  const needed = st?.trainingsRequired ?? 10;
  const pct = Math.min(100, Math.round((doneCount / Math.max(needed, 1)) * 100));

  return (
    <div className="space-y-8">
      {licensed.length === 0 && (
        <div className="panel p-6">
          <h3 className="font-display text-lg tracking-tight text-ink">
            {tx("You are not licensed to teach yet")}
          </h3>
          <p className="mt-2 max-w-2xl font-body text-sm text-ink-soft">
            {tx(
              "A learner can only request a skill you are certified in. Finish a course and score 90% on its assessment, and the license follows automatically.",
            )}
          </p>
          <Link to="/courses" className="btn-primary mt-4 !py-2.5 !text-xs">
            {tx("Find a course")} <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Waiting on you", value: incoming.length },
          { label: "Sessions to run", value: hosting.length },
          { label: "Licensed skills", value: licensed.length },
          { label: "Trainings done", value: doneCount },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="font-display text-2xl leading-none text-ink">{s.value}</p>
            <p className="mt-1.5 font-body text-[11px] uppercase tracking-wider text-ink-mute">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* The ladder, stated honestly: eligible is not the same as promoted. */}
      <section className="panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg tracking-tight text-ink">
            {tx("Toward Master Trainer")}
          </h3>
          <span className="font-mono text-sm font-semibold text-saffron-500 tabular-nums">
            {doneCount} / {needed}
          </span>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper-dim"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={tx("Trainings completed toward Master Trainer")}
        >
          <div className="h-full rounded-full bg-saffron-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 font-body text-[12px] text-ink-mute">
          A training counts when the learner passes their own assessment afterward.{" "}
          {st?.trainerEligible
            ? "You are eligible — a reviewer grants the title."
            : `${Math.max(needed - doneCount, 0)} to go.`}
        </p>
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
          <Users size={17} className="text-saffron-500" aria-hidden /> {tx("Student requests")}
        </h3>
        {incoming.length === 0 ? (
          <p className="mt-3 font-body text-sm text-ink-mute">{tx("Nothing waiting on you.")}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="rounded-2xl border border-ink-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={r.counterpart.avatarUrl ?? initialsAvatar(r.counterpart.displayName)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{r.counterpart.displayName}</p>
                      <p className="font-body text-[12px] text-ink-mute">
                        Wants {r.requestedSkill.name}
                        {r.offeredSkill ? ` · offers ${r.offeredSkill.name}` : " · nothing offered"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => respond.mutate({ id: r.id, accept: true })}
                      disabled={respond.isPending}
                      className="btn-primary !py-2 !text-xs"
                    >
                      <Check size={13} aria-hidden /> {tx("Accept")}
                    </button>
                    <button
                      onClick={() => respond.mutate({ id: r.id, accept: false })}
                      disabled={respond.isPending}
                      className="btn-ghost !py-2 !text-xs"
                    >
                      <X size={13} aria-hidden /> {tx("Decline")}
                    </button>
                    <button
                      onClick={() => message.mutate(r.counterpart.id)}
                      className="btn-ghost !py-2 !text-xs"
                      aria-label={`Message ${r.counterpart.displayName}`}
                    >
                      <MessageSquare size={13} aria-hidden />
                    </button>
                  </div>
                </div>
                {r.message && (
                  <p className="mt-3 border-l-[3px] border-saffron-500 pl-3 font-editorial text-[15px] text-ink-soft">
                    {r.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
          <Video size={17} className="text-saffron-500" aria-hidden /> {tx("Sessions to run")}
        </h3>
        {hosting.length === 0 ? (
          <p className="mt-3 font-body text-sm text-ink-mute">{tx("Nothing scheduled.")}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {hosting.map((s) => (
              <SessionRow key={s.id} session={s} onOpenRoom={onOpenRoom} onNote={onNote} />
            ))}
          </div>
        )}
      </section>

      {licensed.length > 0 && (
        <section>
          <h3 className="font-display text-lg tracking-tight text-ink">
            {tx("What you are licensed to teach")}
          </h3>
          <div className="mt-4 space-y-2">
            {licensed.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line p-4"
              >
                <p className="font-medium text-ink">{t.skill.name}</p>
                <span
                  className={`chip ${t.verificationState === "expert_verified" ? "!bg-brand-navy !text-paper-light" : "!bg-emeraldx-400 !text-paper-light"}`}
                >
                  <BadgeCheck size={11} aria-hidden />
                  {t.verificationState === "expert_verified" ? "Master Trainer" : "Certified"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
