import { useState } from "react";
import { Award, Gift, Lock } from "lucide-react";
import { currentAccount } from "../lib/auth";
import { BADGES, getProgress, spendPoints, stats } from "../lib/progress";
import { getItem, setItem } from "../lib/store";
import { Link } from "react-router-dom";

interface Reward {
  id: string;
  title: string;
  description: string;
  cost: number;
  kind: "notes" | "practice" | "test" | "certificate" | "theme" | "challenge";
}

interface Redemption {
  rewardId: string;
  at: string;
}

const CATALOGUE: readonly Reward[] = [
  { id: "theme-poster", title: "Profile theme: Street Poster", description: "Unlocks the bold dark theme for your account.", cost: 30, kind: "theme" },
  { id: "challenge-weekly", title: "Weekly brain challenge", description: "A tougher 10-question mixed quiz from your class syllabus.", cost: 50, kind: "challenge" },
  { id: "revision-pack", title: "Extra revision notes pack", description: "One-page revision sheets for every chapter you have completed.", cost: 60, kind: "notes" },
  { id: "practice-advanced", title: "Advanced practice set", description: "Harder application-based questions for your weak topics.", cost: 80, kind: "practice" },
  { id: "question-bank", title: "Subject-wise question bank", description: "Chapter-wise question bank for one subject of your choice.", cost: 100, kind: "practice" },
  { id: "mock-test", title: "Full-length mock test", description: "A timed mock paper in CBSE board pattern.", cost: 120, kind: "test" },
  { id: "certificate", title: "Digital learning certificate", description: "A printable certificate listing your completed chapters.", cost: 150, kind: "certificate" },
];

export default function Rewards() {
  const account = currentAccount();
  const key = "redemptions." + (account?.id ?? "none");
  const [balance, setBalance] = useState(() => getProgress().points);
  const [redemptions, setRedemptions] = useState<Redemption[]>(() => getItem<Redemption[]>(key, []));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const s = stats();

  if (!account || account.role !== "student") {
    return (
      <section className="container-x py-12">
        <div className="card p-6">Swyam Rewards is for student accounts.</div>
      </section>
    );
  }

  const owned = new Set(redemptions.map((r) => r.rewardId));

  function redeem(r: Reward) {
    if (owned.has(r.id)) return setMessage({ ok: false, text: "You already have this reward." });
    if (!confirm(`Redeem "${r.title}" for ${r.cost} SkillPoints?`)) return;
    if (!spendPoints(r.cost, r.id)) {
      setBalance(getProgress().points);
      return setMessage({ ok: false, text: `You need ${r.cost} points for this. Keep learning to earn more!` });
    }
    const next = [...getItem<Redemption[]>(key, []), { rewardId: r.id, at: new Date().toISOString() }];
    setItem(key, next);
    setRedemptions(next);
    setBalance(getProgress().points);
    setMessage({ ok: true, text: `🎉 Redeemed: ${r.title}` });
  }

  return (
    <section className="container-x py-10">
      <p className="kicker">Swyam Rewards</p>
      <h1 className="type-xl mt-2">Spend your SkillPoints</h1>

      <div className="mt-6 grid gap-4 sm:gap-5 md:grid-cols-3">
        <div className="card p-5 sm:p-6">
          <p className="kicker">Balance</p>
          <p className="stat-figure mt-1">{balance}</p>
          <p className="text-sm opacity-75">SkillPoints · {s.earned} earned in total</p>
        </div>
        <div className="card p-5 sm:p-6 md:col-span-2">
          <p className="kicker">How to earn</p>
          <ul className="mt-2 grid gap-1 text-sm">
            <li>+10 for every lecture you watch</li>
            <li>+2 for every correct quiz answer (once per chapter per day)</li>
            <li>+20 bonus when you complete a chapter</li>
          </ul>
          <Link to="/learn" className="btn-text mt-2 inline-block">
            Go learn →
          </Link>
        </div>
      </div>

      {message && (
        <p role="status" className={`card mt-4 p-4 text-sm font-medium ${message.ok ? "" : "opacity-90"}`}>
          {message.text}
        </p>
      )}

      <h2 className="section-title mt-10">Reward catalogue</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {CATALOGUE.map((r) => {
          const have = owned.has(r.id);
          const locked = !have && balance < r.cost;
          return (
            <article key={r.id} className={`card flex flex-col p-5 ${locked ? "opacity-75" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <Gift size={20} aria-hidden="true" />
                <span className={have ? "chip" : locked ? "chip" : "chip-accent"}>{have ? "Owned" : locked ? `${r.cost} pts · locked` : `${r.cost} pts`}</span>
              </div>
              <h3 className="type-lg mt-3">{r.title}</h3>
              <p className="mt-1 flex-1 text-sm opacity-80">{r.description}</p>
              {have ? (
                <p className="mt-4 text-sm">✓ Unlocked</p>
              ) : (
                <button type="button" className={locked ? "btn-ghost mt-4" : "btn-primary mt-4"} disabled={locked} onClick={() => redeem(r)}>
                  {locked ? (
                    <span className="flex items-center gap-1">
                      <Lock size={14} /> Need {r.cost - balance} more
                    </span>
                  ) : (
                    "Redeem"
                  )}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 sm:gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <p className="kicker flex items-center gap-2">
            <Award size={14} /> Badges
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BADGES.map((b) => (
              <span key={b.id} className={b.test(s) ? "chip-accent" : "chip opacity-50"}>
                {b.test(s) ? "🏅" : "🔒"} {b.label}
              </span>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="kicker">Redemption history</p>
          {redemptions.length === 0 ? (
            <div className="panel mt-3 flex items-start gap-3 p-4">
              <span aria-hidden="true" className="chip-accent !p-2">
                <Gift size={14} />
              </span>
              <p className="text-sm opacity-80">No redemptions yet.</p>
            </div>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm">
              {[...redemptions].reverse().map((r, i) => (
                <li key={i}>
                  {CATALOGUE.find((c) => c.id === r.rewardId)?.title ?? r.rewardId} · {new Date(r.at).toLocaleDateString("en-IN")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-8 text-sm opacity-70">Essential learning, quizzes, notes and Sarthi are always free. Points are earned only by learning and can never be bought.</p>
    </section>
  );
}
