import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, ArrowRight, Inbox, Loader2, Repeat2, Users } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { LearnFlow, TeachFlow } from "../components/SwapIntent";
import { LearnerDashboard, SwapChoice, TrainerDashboard } from "../components/SwapDashboards";
import VideoRoom, { type RoomInfo } from "../components/VideoRoom";
import { usePreferences } from "../context/PreferencesContext";
import type { SwapSession } from "../lib/skillswap";
import { MatchCard, RequestCard, SwapCard } from "../components/SwapCards";
import SessionPlaybook from "../components/swap/SessionPlaybook";
import { isPlaybookHidden } from "../lib/swap-assist/playbook";
import { useAuth } from "../context/AuthContext";
import {
  acceptSwapRequest,
  declineSwapRequest,
  findMatches,
  listLearnSkills,
  listRequests,
  listSwaps,
  listTeachSkills,
  openConversationWith,
  sendSwapRequest,
  withdrawSwapRequest,
  type LearningFormat,
  type SwapMatch,
  type SwapRequest,
} from "../lib/skillswap";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";

export type SwapTab = "matches" | "requests" | "swaps";
type Tab = SwapTab;

/**
 * The first question, above the tabs.
 *
 * Learning and teaching are different jobs with different shapes — a funnel
 * versus a standing offer — so asking which one you are here for beats a
 * single list that has to serve both.
 */
type Intent = "learn" | "teach" | "mine";

/**
 * SkillSwap — the exchange layer of Swayam.
 *
 * Everything here runs on the same account, profile and skill records as the
 * rest of the site: a match is computed from the "I can teach" and "I want to
 * learn" lists on the profile page, and an accepted request opens a thread in
 * the existing Messages inbox.
 */
export default function SkillSwap({ initialTab }: { initialTab?: SwapTab } = {}) {
  const tx = useTx();
  const { user, profileId, ready, isRemote } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab ?? "matches");
  const { prefs, set } = usePreferences();
  const [room, setRoom] = useState<RoomInfo | null>(null);
  // Within a mode you can still reach the other side's tools.
  const [intent, setIntent] = useState<Intent>("learn");

  const mode = prefs.swapMode;
  const openRoom = (sess: SwapSession) =>
    setRoom({
      roomId: sess.roomId ?? sess.id,
      title: sess.title,
      displayName: user?.name ?? "Member",
    });
  const [banner, setBanner] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  // The optional 30-minute plan offered right after a swap is accepted.
  const [plan, setPlan] = useState<{ teach: string; learn: string | null } | null>(null);

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const enabled = Boolean(profileId) && isRemote;

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
  const matches = useQuery({
    queryKey: ["swap-matches", profileId],
    queryFn: () => findMatches(profileId!),
    enabled,
  });
  const requests = useQuery({
    queryKey: ["swap-requests", profileId],
    queryFn: () => listRequests(profileId!),
    enabled,
  });
  const swaps = useQuery({
    queryKey: ["swaps", profileId],
    queryFn: () => listSwaps(profileId!),
    enabled,
  });

  const say = (tone: "ok" | "bad", text: string) => setBanner({ tone, text });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["swap-requests", profileId] });
    void qc.invalidateQueries({ queryKey: ["swaps", profileId] });
    void qc.invalidateQueries({ queryKey: ["swap-matches", profileId] });
  };

  const send = useMutation({
    mutationFn: (v: { match: SwapMatch; message: string; format: LearningFormat }) =>
      sendSwapRequest(profileId!, {
        recipientId: v.match.candidateId,
        offeredSkillId: v.match.youTeach?.id ?? null,
        requestedSkillId: v.match.theyTeach.id,
        message: v.message.trim() || null,
        proposedFormat: v.format,
        matchScore: v.match.score,
      }),
    onSuccess: (_d, v) => {
      track(EV.SKILL_SWAP_REQUESTED, { role: "learn" });
      say("ok", `Request sent to ${v.match.displayName}.`);
      refreshAll();
    },
    onError: (e: Error) => say("bad", e.message),
  });

  const accept = useMutation({
    mutationFn: (r: SwapRequest) => acceptSwapRequest(r.id),
    onSuccess: (_d, r) => {
      say("ok", `Swap with ${r.counterpart.displayName} is on. Say hello in Messages.`);
      // Someone asked you for `requestedSkill`; what they offered back is what you learn.
      if (!isPlaybookHidden())
        setPlan({ teach: r.requestedSkill.name, learn: r.offeredSkill?.name ?? null });
      setTab("swaps");
      refreshAll();
    },
    onError: (e: Error) => say("bad", e.message),
  });

  const decline = useMutation({
    mutationFn: (r: SwapRequest) => declineSwapRequest(r.id),
    onSuccess: () => {
      say("ok", "Request declined.");
      refreshAll();
    },
    onError: (e: Error) => say("bad", e.message),
  });

  const withdraw = useMutation({
    mutationFn: (r: SwapRequest) => withdrawSwapRequest(r.id),
    onSuccess: () => {
      say("ok", "Request withdrawn.");
      refreshAll();
    },
    onError: (e: Error) => say("bad", e.message),
  });

  const message = useMutation({
    mutationFn: (otherId: string) => openConversationWith(otherId),
    onSuccess: () => navigate({ to: "/messages" }),
    onError: (e: Error) => say("bad", e.message),
  });

  /** Recipients you already have an open request with, to disable the button. */
  const requestedPairs = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests.data ?? []) {
      if (r.direction === "outgoing" && r.state === "pending") {
        set.add(`${r.recipientId}:${r.requestedSkill.id}`);
      }
    }
    return set;
  }, [requests.data]);

  const incoming = (requests.data ?? []).filter(
    (r) => r.direction === "incoming" && r.state === "pending",
  );
  const others = (requests.data ?? []).filter(
    (r) => !(r.direction === "incoming" && r.state === "pending"),
  );
  const activeSwaps = (swaps.data ?? []).filter((s) => s.state === "active");
  const pastSwaps = (swaps.data ?? []).filter((s) => s.state !== "active");

  const needsSetup =
    enabled &&
    !teach.isLoading &&
    !learn.isLoading &&
    ((teach.data ?? []).length === 0 || (learn.data ?? []).length === 0);

  if (!user) return null;

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "matches", label: "Matches", count: matches.data?.length ?? 0 },
    { id: "requests", label: "Requests", count: incoming.length },
    { id: "swaps", label: "Active swaps", count: activeSwaps.length },
  ];

  return (
    <div className="pb-24 pt-28">
      {/* Full-screen while a call is up: a video call is not a widget. */}
      {room && <VideoRoom room={room} onClose={() => setRoom(null)} />}
      <div className="container-x">
        <Reveal>
          <p className="kicker flex items-center gap-1.5">
            <Repeat2 size={12} aria-hidden /> SkillSwap
          </p>
          <h1 className="mt-3 section-title">
            {tx("Teach what you know.")}
            <span className="block text-saffron-500">{tx("Learn what you don't.")}</span>
          </h1>
          <p className="type-lede mt-4 max-w-2xl">
            Everyone here is both a teacher and a student. We read your{" "}
            <Link to="/profile" className="link-sweep font-medium text-saffron-500">
              profile
            </Link>{" "}
            — what you can teach and what you want to learn — and find the people whose lists are
            the mirror image of yours.
          </p>
        </Reveal>

        {!isRemote && (
          <p className="mt-8 rounded-[var(--radius-card)] border border-ink-line bg-paper-dim px-5 py-4 font-body text-sm text-ink-soft">
            SkillSwap needs a database connection. Copy{" "}
            <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env</code>{" "}
            {tx("and add your Supabase URL and publishable key, then reload.")}
          </p>
        )}

        <AnimatePresence>
          {banner && (
            <motion.p
              initial={{ y: -6 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              className={`mt-8 rounded-[var(--radius-control)] border px-4 py-3 font-body text-sm ${
                banner.tone === "ok"
                  ? "border-emeraldx-400/30 bg-emeraldx-400/10 text-emeraldx-400"
                  : "border-saffron-200 bg-saffron-50 text-saffron-700"
              }`}
            >
              {banner.text}
            </motion.p>
          )}
        </AnimatePresence>

        {plan && (
          <SessionPlaybook
            teachSkill={plan.teach}
            learnSkill={plan.learn}
            onClose={() => setPlan(null)}
          />
        )}

        {needsSetup && (
          <Reveal className="mt-8">
            <div className="panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg tracking-tight text-ink">
                  {tx("Finish your two lists first")}
                </h2>
                <p className="mt-1.5 max-w-xl font-body text-sm text-ink-soft">
                  A swap needs both halves: at least one skill you can teach, and one you want to
                  learn.{" "}
                  {(teach.data ?? []).length === 0 && "You haven't added anything you teach. "}
                  {(learn.data ?? []).length === 0 &&
                    "You haven't added anything you want to learn."}
                </p>
              </div>
              <Link to="/profile" className="btn-primary shrink-0 !py-2.5 !text-xs">
                {tx("Edit my skills")} <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </Reveal>
        )}

        {/* First visit: ask once, remember on the account. */}
        {mode === null ? (
          <SwapChoice onChoose={(m) => set("swapMode", m)} />
        ) : (
          <>
            {/*
              Mode decides everything below it. The secondary tabs are
              per-mode: a trainer has no use for the learner funnel, and
              showing both was what made the two dashboards look identical.
            */}
            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink-line pb-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "learn", label: "Learning" },
                    { id: "train", label: "Training" },
                  ] as Array<{ id: "learn" | "train"; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      set("swapMode", m.id);
                      // Each mode has its own default view; carrying the other
                      // mode's tab across is how a trainer ended up looking at
                      // "what do you want to learn".
                      setIntent(m.id === "learn" ? "learn" : "teach");
                    }}
                    aria-pressed={mode === m.id}
                    className="filter-pill"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  (mode === "learn"
                    ? [
                        { id: "learn", label: "Find a trainer" },
                        { id: "mine", label: "My swaps" },
                      ]
                    : [
                        { id: "teach", label: "My licenses" },
                        { id: "mine", label: "My swaps" },
                      ]) as Array<{ id: Intent; label: string }>
                ).map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setIntent(i.id)}
                    aria-pressed={intent === i.id}
                    className="filter-pill !text-[11px]"
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            </div>

            {/* The dashboard for the chosen mode */}
            <div className="mt-8">
              {mode === "learn" ? (
                <LearnerDashboard
                  onOpenRoom={openRoom}
                  onNote={(tone, text) => setBanner({ tone, text })}
                />
              ) : (
                <TrainerDashboard
                  onOpenRoom={openRoom}
                  onNote={(tone, text) => setBanner({ tone, text })}
                />
              )}
            </div>

            {/* Learner funnel: only ever in learning mode. */}
            {mode === "learn" && intent === "learn" && (
              <div className="mt-12 border-t border-ink-line pt-8">
                <LearnFlow onNote={(tone, text) => setBanner({ tone, text })} />
              </div>
            )}

            {/* Licences and the ladder: only ever in training mode. */}
            {mode === "train" && intent === "teach" && (
              <div className="mt-12 border-t border-ink-line pt-8">
                <TeachFlow />
              </div>
            )}
          </>
        )}

        {/* Tabs — only for the swaps already in motion */}
        <div
          className={`mt-10 flex flex-wrap gap-2 border-b border-ink-line pb-4 ${mode !== null && intent === "mine" ? "" : "hidden"}`}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "matches" && tab !== "matches")
                  track(EV.NAVIGATION_ITEM_CLICKED, { item: "MATCHES" });
                setTab(t.id);
              }}
              aria-pressed={tab === t.id}
              className="filter-pill"
            >
              {t.label}
              {t.count > 0 && (
                <span className="font-mono text-[10px] tabular-nums opacity-70">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className={`mt-8 ${mode !== null && intent === "mine" ? "" : "hidden"}`}>
          {tab === "matches" && (
            <QuerySection
              query={matches}
              empty={{
                icon: <Users size={22} aria-hidden />,
                title: "No matches yet",
                body: "Nobody currently teaches what you want to learn while wanting what you teach. Add more skills to either list and check back.",
              }}
            >
              {(rows) => (
                <div className="card-grid grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map((m) => (
                    <MatchCard
                      key={`${m.candidateId}-${m.theyTeach.id}-${m.youTeach?.id ?? "none"}`}
                      match={m}
                      pending={send.isPending}
                      alreadyRequested={requestedPairs.has(`${m.candidateId}:${m.theyTeach.id}`)}
                      onRequest={async (match, msg, format) => {
                        await send.mutateAsync({ match, message: msg, format });
                      }}
                    />
                  ))}
                </div>
              )}
            </QuerySection>
          )}

          {tab === "requests" && (
            <QuerySection
              query={requests}
              empty={{
                icon: <Inbox size={22} aria-hidden />,
                title: "No requests yet",
                body: "When you propose a swap, or someone proposes one to you, it shows up here.",
              }}
            >
              {() => (
                <div className="space-y-8">
                  {incoming.length > 0 && (
                    <section>
                      <h2 className="font-display text-lg tracking-tight text-ink">
                        {tx("Waiting on you")}
                      </h2>
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {incoming.map((r) => (
                          <RequestCard
                            key={r.id}
                            request={r}
                            pending={accept.isPending || decline.isPending}
                            onAccept={async (x) => void (await accept.mutateAsync(x))}
                            onDecline={async (x) => void (await decline.mutateAsync(x))}
                            onWithdraw={async (x) => void (await withdraw.mutateAsync(x))}
                            onMessage={async (x) =>
                              void (await message.mutateAsync(x.counterpart.id))
                            }
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {others.length > 0 && (
                    <section>
                      <h2 className="font-display text-lg tracking-tight text-ink">
                        {tx("Everything else")}
                      </h2>
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {others.map((r) => (
                          <RequestCard
                            key={r.id}
                            request={r}
                            pending={withdraw.isPending}
                            onAccept={async (x) => void (await accept.mutateAsync(x))}
                            onDecline={async (x) => void (await decline.mutateAsync(x))}
                            onWithdraw={async (x) => void (await withdraw.mutateAsync(x))}
                            onMessage={async (x) =>
                              void (await message.mutateAsync(x.counterpart.id))
                            }
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </QuerySection>
          )}

          {tab === "swaps" && (
            <QuerySection
              query={swaps}
              empty={{
                icon: <ArrowLeftRight size={22} aria-hidden />,
                title: "No swaps running",
                body: "Accept a request and the swap starts here, with a shared thread in Messages.",
              }}
            >
              {() => (
                <div className="space-y-8">
                  {activeSwaps.length > 0 && (
                    <div className="card-grid grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {activeSwaps.map((s) => (
                        <SwapCard
                          key={s.id}
                          swap={s}
                          onMessage={async (x) => void (await message.mutateAsync(x.partner.id))}
                        />
                      ))}
                    </div>
                  )}
                  {pastSwaps.length > 0 && (
                    <section>
                      <h2 className="font-display text-lg tracking-tight text-ink">
                        {tx("Finished")}
                      </h2>
                      <div className="card-grid mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {pastSwaps.map((s) => (
                          <SwapCard
                            key={s.id}
                            swap={s}
                            onMessage={async (x) => void (await message.mutateAsync(x.partner.id))}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </QuerySection>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading / error / empty around a react-query result.
 *
 * `children` only runs once there is a non-empty array, so every caller can
 * assume it has rows and none of them repeat the three states by hand.
 */
function QuerySection<T>({
  query,
  empty,
  children,
}: {
  query: { data?: T[]; isLoading: boolean; error: unknown };
  empty: { icon: React.ReactNode; title: string; body: string };
  children: (rows: T[]) => React.ReactNode;
}) {
  if (query.isLoading) {
    return (
      <p className="flex items-center gap-2 py-12 font-body text-sm text-ink-mute">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Loading…
      </p>
    );
  }
  if (query.error) {
    return (
      <p
        role="alert"
        className="border-l-[3px] border-saffron-500 py-4 pl-4 font-body text-sm text-ink"
      >
        {query.error instanceof Error ? query.error.message : "Something went wrong."}
      </p>
    );
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="panel flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-saffron-50 text-saffron-500">
          {empty.icon}
        </span>
        <h3 className="mt-4 font-display text-lg tracking-tight text-ink">{empty.title}</h3>
        <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-ink-mute">
          {empty.body}
        </p>
      </div>
    );
  }
  return <>{children(rows)}</>;
}
