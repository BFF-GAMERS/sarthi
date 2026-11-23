import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { describePoints, useDetail } from "../lib/a11y";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Coins,
  Copy,
  Gift,
  GraduationCap,
  Loader2,
  Lock,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useAuth } from "../context/AuthContext";
import { announce } from "../components/VoiceGuide";
import { formatMinor } from "../lib/catalogue";
import {
  getWallet,
  listEarnings,
  listMyCoupons,
  listRewardOffers,
  redeemReward,
  type RewardOffer,
} from "../lib/rewards";
import { useTx } from "../lib/i18n";
import { SloganPlate } from "../components/Ornaments";

/**
 * Rewards — points earned by learning, spent on paid courses.
 *
 * For students only, and deliberately so: this is a scholarship mechanism for
 * learners, not a discount channel for recruiters or institutes. The database
 * enforces that; this page explains it.
 *
 * Points cannot be bought. Every one comes from finishing something real — a
 * lesson, a course, an assessment, a swap — which is what keeps a discount
 * code worth having.
 */

/**
 * One finished task is worth this much, everywhere.
 *
 * A single flat value is the whole point: a learner should be able to look at
 * a reward and count how many things they have to finish, without doing any
 * arithmetic. Kept in step with the database triggers that actually award it.
 */
const POINTS_PER_TASK = 100;
/** Tasks per level, matching `level_for_xp` in the database. */
const TASKS_PER_LEVEL = 5;

/** A cost in points, said as the number of tasks it really is. */
function inTasks(points: number): string {
  const tasks = Math.round(points / POINTS_PER_TASK);
  return `${tasks} task${tasks === 1 ? "" : "s"}`;
}

/** What an offer is worth, in words. */
function offerValue(o: RewardOffer): string {
  if (o.percentOff !== null) {
    const cap = o.maxDiscountMinor ? ` (up to ${formatMinor(o.maxDiscountMinor)})` : "";
    return `${o.percentOff}% off${cap}`;
  }
  return o.amountOffMinor ? `${formatMinor(o.amountOffMinor)} off` : "Discount";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Rewards() {
  const tx = useTx();
  const { user, profileId, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<{ code: string; title: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const enabled = Boolean(profileId);
  const isStudent = user?.role === "student";

  const detail = useDetail();
  const wallet = useQuery({
    queryKey: ["wallet", profileId],
    queryFn: () => getWallet(profileId!),
    enabled,
  });
  const offers = useQuery({ queryKey: ["reward-offers"], queryFn: listRewardOffers });
  const myCodes = useQuery({
    queryKey: ["my-coupons", profileId],
    queryFn: () => listMyCoupons(profileId!),
    enabled,
  });
  const earnings = useQuery({
    queryKey: ["earnings", profileId],
    queryFn: () => listEarnings(profileId!),
    enabled,
  });

  const redeem = useMutation({
    mutationFn: (slug: string) => redeemReward(slug),
    onSuccess: (r) => {
      if (!r.ok) {
        setError(r.reason ?? "That reward could not be claimed.");
        return;
      }
      setError("");
      setClaimed({ code: r.code ?? "", title: r.title ?? "" });
      announce(`Reward claimed. Your code is ${r.code}`);
      void qc.invalidateQueries({ queryKey: ["wallet", profileId] });
      void qc.invalidateQueries({ queryKey: ["my-coupons", profileId] });
      void qc.invalidateQueries({ queryKey: ["earnings", profileId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked — the code is on screen to copy by hand */
    }
  };

  if (!user) return null;

  const balance = wallet.data?.balance ?? 0;
  const live = (myCodes.data ?? []).filter((c) => !c.used);

  // The cheapest thing still out of reach. Nothing to aim at once everything
  // is affordable, which is the right time for this to disappear.
  const nextUp = (offers.data ?? [])
    .filter((o) => o.pointsCost > balance)
    .sort((a, b) => a.pointsCost - b.pointsCost)[0];

  return (
    <div className="container-x max-w-5xl pb-24 pt-28">
      <Reveal>
        <SloganPlate tone="marigold">{tx("Student rewards")}</SloganPlate>
        <h1 className="mt-3 section-title">
          {tx("Learn, earn,")}
          <span className="block text-saffron-500">{tx("spend it on learning.")}</span>
        </h1>
        <p className="type-lede mt-4 max-w-2xl">
          Finish anything &mdash; a lesson, a course, an assessment, a skill swap &mdash; and you
          earn <strong className="text-ink">{POINTS_PER_TASK} points</strong>
          {tx(". Every task is worth the same, so you can always count how close you are.")}
        </p>
      </Reveal>

      {/* Balance */}
      <Reveal className="mt-10">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="datum flex items-center gap-1.5">
                <Coins size={12} aria-hidden /> {tx("Points to spend")}
              </p>
              <p className="mt-1 font-display text-5xl leading-none text-saffron-500 tabular-nums">
                {balance}
              </p>
              {detail && (
                <p className="sr-only">{describePoints(balance, wallet.data?.level ?? 1)}</p>
              )}
              <p className="mt-2 font-body text-[13px] text-ink-soft">
                That&apos;s{" "}
                <strong className="text-ink">{Math.floor(balance / POINTS_PER_TASK)}</strong>{" "}
                {Math.floor(balance / POINTS_PER_TASK) === 1 ? "reward task" : "reward tasks"}{" "}
                banked
              </p>
              {(wallet.data?.spent ?? 0) > 0 && (
                <p className="mt-1 font-body text-[12px] text-ink-mute">
                  {wallet.data?.spent} already spent on rewards
                </p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              {[
                { label: "Level", value: wallet.data?.level ?? 1 },
                { label: "Lifetime XP", value: wallet.data?.xp ?? 0 },
                { label: "Badges", value: wallet.data?.badgeCount ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-paper-dim px-4 py-3">
                  <dd className="font-display text-2xl leading-none text-ink tabular-nums">
                    {s.value}
                  </dd>
                  <dt className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
          {/*
           * A balance on its own is a number. Next to the nearest thing it
           * cannot yet buy, it is a target — and the distance is stated in
           * tasks, because that is what the learner controls.
           */}
          {nextUp && (
            <div className="mt-6 border-t border-ink-line pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-body text-[13px] text-ink-soft">
                  {tx("Next reward you can unlock")}:{" "}
                  <strong className="text-ink">{nextUp.title}</strong>
                </p>
                <p className="font-mono text-[12px] tabular-nums text-ink-mute">
                  {balance} / {nextUp.pointsCost}
                </p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-paper-deep/70"
                role="progressbar"
                aria-valuenow={Math.round((balance / nextUp.pointsCost) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={tx("Progress to your next reward")}
              >
                <motion.span
                  className="block h-full rounded-full bg-saffron-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (balance / nextUp.pointsCost) * 100)}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-2 font-body text-[12px] text-ink-mute">
                {inTasks(nextUp.pointsCost - balance)} {tx("to go — any task counts.")}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink-line pt-4 font-body text-[12px] leading-relaxed text-ink-mute">
            <span>
              <strong className="text-ink">1 task = {POINTS_PER_TASK} points.</strong>{" "}
              {tx("Every task, the same.")}
            </span>
            <span>
              <strong className="text-ink">{TASKS_PER_LEVEL} tasks = 1 level.</strong>
            </span>
            <span>{tx("Spending points never costs you XP, level or badges.")}</span>
          </div>
        </div>
      </Reveal>

      {!isStudent && (
        <Reveal className="mt-6">
          <p className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-ink-line bg-paper-dim px-5 py-4 font-body text-sm text-ink-soft">
            <Lock size={16} className="mt-0.5 shrink-0 text-saffron-500" aria-hidden />
            <span>
              Rewards are for students. Your account is set to{" "}
              <strong className="text-ink">{user.role}</strong> — you can still collect points, but
              claiming a code needs the student role. Change it in{" "}
              <Link to="/settings" className="link-sweep text-saffron-500">
                settings
              </Link>
              .
            </span>
          </p>
        </Reveal>
      )}

      <AnimatePresence>
        {claimed && (
          <motion.div
            initial={{ y: -6 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className="mt-6 rounded-[var(--radius-card)] border-2 border-saffron-500 bg-saffron-50 p-5"
          >
            <p className="font-body text-sm font-medium text-saffron-700">
              {claimed.title} — claimed
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-xl border-2 border-dashed border-saffron-500 bg-paper-light px-4 py-2 font-mono text-lg font-bold tracking-[0.15em] text-ink">
                {claimed.code}
              </span>
              <button onClick={() => void copy(claimed.code)} className="btn-ghost !py-2 !text-xs">
                {copied === claimed.code ? (
                  <>
                    <Check size={13} aria-hidden /> {tx("Copied")}
                  </>
                ) : (
                  <>
                    <Copy size={13} aria-hidden /> {tx("Copy")}
                  </>
                )}
              </button>
              <Link to="/cart" className="btn-primary !py-2 !text-xs">
                {tx("Use it in your cart")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-[var(--radius-control)] border border-saffron-200 bg-saffron-50 px-4 py-3 font-body text-sm text-saffron-700"
        >
          {error}
        </p>
      )}

      {/* Your codes */}
      {live.length > 0 && (
        <Reveal className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
            <Ticket size={18} className="text-saffron-500" aria-hidden /> {tx("Your codes")}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {live.map((c) => (
              <li
                key={c.code}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-saffron-200 bg-saffron-50 p-4"
              >
                <div className="min-w-0">
                  <p className="font-mono text-base font-bold tracking-[0.12em] text-ink">
                    {c.code}
                  </p>
                  <p className="mt-0.5 truncate font-body text-[12px] text-ink-mute">
                    {c.description}
                    {c.expiresAt &&
                      ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}`}
                  </p>
                </div>
                <button
                  onClick={() => void copy(c.code)}
                  aria-label={`Copy ${c.code}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-light hover:text-saffron-600"
                >
                  {copied === c.code ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {/* Catalogue */}
      <Reveal className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
          <Coins size={18} className="text-saffron-500" aria-hidden /> {tx("Spend your points")}
        </h2>
        <div className="card-grid mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(offers.data ?? []).map((o) => {
            const affordable = balance >= o.pointsCost;
            const short = o.pointsCost - balance;
            return (
              <article key={o.slug} className="card flex flex-col p-5">
                <p className="font-display text-2xl leading-none text-saffron-500">
                  {offerValue(o)}
                </p>
                <p className="mt-2 font-body text-sm font-medium text-ink">{o.title}</p>
                {o.description && (
                  <p className="mt-1 font-body text-[12px] leading-snug text-ink-mute">
                    {o.description}
                  </p>
                )}
                <p className="mt-3 font-body text-[11px] text-ink-mute">
                  {o.minSpendMinor > 0 && `Min spend ${formatMinor(o.minSpendMinor)} · `}
                  Valid {o.validDays} days
                </p>

                <div className="mt-auto pt-4">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="font-body text-sm font-semibold text-ink">
                      {inTasks(o.pointsCost)}
                      <span className="ml-1.5 font-mono text-[11px] font-normal text-ink-mute tabular-nums">
                        {o.pointsCost} pts
                      </span>
                    </span>
                    {!affordable && (
                      <span className="shrink-0 font-body text-[11px] text-ink-mute">
                        {inTasks(short)} to go
                      </span>
                    )}
                  </div>
                  {/* Progress toward affording it — more motivating than a
                      disabled button with no sense of how far away it is. */}
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-paper-dim">
                    <span
                      className="block h-full rounded-full bg-saffron-500 transition-[width] duration-500"
                      style={{ width: `${Math.min(100, (balance / o.pointsCost) * 100)}%` }}
                    />
                  </div>
                  <button
                    onClick={() => redeem.mutate(o.slug)}
                    disabled={!affordable || !isStudent || redeem.isPending}
                    className="btn-primary w-full !py-2.5 !text-xs disabled:opacity-50"
                  >
                    {redeem.isPending && redeem.variables === o.slug ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : (
                      <Gift size={13} aria-hidden />
                    )}
                    Claim
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Reveal>

      {/* How to earn */}
      <Reveal className="mt-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
              <TrendingUp size={18} className="text-saffron-500" aria-hidden /> {tx("How to earn")}
            </h2>
            <p className="mt-3 font-body text-sm text-ink-soft">
              {tx("All of these count as one task, and every task is worth the same.")}
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                "Finish a lesson",
                "Pass an assessment",
                "Complete a course",
                "Complete a skill swap",
              ].map((what) => (
                <li
                  key={what}
                  className="flex items-center justify-between border-b border-ink-line pb-2.5 last:border-0"
                >
                  <span className="font-body text-sm text-ink">{what}</span>
                  <span className="font-mono text-sm font-semibold text-saffron-500 tabular-nums">
                    +{POINTS_PER_TASK}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/courses" className="btn-ghost !py-2 !text-xs">
                <GraduationCap size={13} aria-hidden /> {tx("Find a course")}
              </Link>
              <Link to="/skillswap" className="btn-ghost !py-2 !text-xs">
                {tx("Find a swap")}
              </Link>
            </div>
          </div>

          <div className="panel p-6">
            <h2 className="font-display text-lg tracking-tight text-ink">
              {tx("Your points history")}
            </h2>
            {(earnings.data ?? []).length === 0 ? (
              <p className="mt-4 font-body text-sm text-ink-mute">
                {tx("Nothing yet. Finish a lesson and it appears here.")}
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {(earnings.data ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-b border-ink-line pb-2.5 last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-body text-sm text-ink">{e.label}</span>
                      <span className="block font-body text-[11px] text-ink-mute">
                        {relativeTime(e.createdAt)}
                      </span>
                    </span>
                    {e.delta !== 0 && (
                      <span
                        className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                          e.delta > 0 ? "text-emeraldx-400" : "text-ink-mute"
                        }`}
                      >
                        {e.delta > 0 ? `+${e.delta}` : e.delta}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
