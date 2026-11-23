import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, Award, BookOpen, CalendarCheck, Flame, Target, Trophy, Users } from "lucide-react";
import { currentAccount, listAccounts, type Account } from "../lib/auth";
import {
  BADGES,
  nextChapter,
  stats,
  subjectProgress,
  weakTopics,
  getProgress,
  type Stats,
} from "../lib/progress";
import { allChapters, chapterMeta, getChapter } from "../lib/content";
import {
  assignStudent,
  assignedStudentIds,
  linkChildByEmail,
  linkedStudentIds,
  recommendChapter,
  recommendationsFor,
  setRecommendationDone,
  canView,
} from "../lib/linking";
import type { ClassLevel } from "../data/curriculum";
import { useCountUp } from "../lib/useCountUp";

const DAILY_GOAL = 3;

export default function Dashboard() {
  const account = currentAccount();
  if (!account) {
    return (
      <section className="container-x py-12">
        <div className="card p-6">
          <p>Please log in to see your dashboard.</p>
          <Link to="/login" className="btn-primary mt-4 inline-block">
            Log in
          </Link>
        </div>
      </section>
    );
  }
  if (account.role === "student") return <StudentDashboard account={account} />;
  if (account.role === "parent") return <ParentDashboard account={account} />;
  if (account.role === "admin") return <Navigate to="/admin" replace />;
  return <StaffDashboard account={account} />;
}

/* ───────────────────────── shared pieces ───────────────────────── */

function Tile({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  const shown = useCountUp(value);
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm opacity-75">
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
        {label}
      </div>
      <p className="stat-figure mt-2 !text-3xl">{shown}</p>
    </div>
  );
}

function StatTiles({ s }: { s: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
      <Tile icon={<Trophy size={14} />} value={s.points} label="SkillPoints" />
      <Tile icon={<BookOpen size={14} />} value={s.lecturesWatched} label="Lectures watched" />
      <Tile icon={<Target size={14} />} value={s.quizzesTaken} label="Quizzes taken" />
      <Tile icon={<CalendarCheck size={14} />} value={s.accuracy === null ? "—" : `${s.accuracy}%`} label="Quiz accuracy" />
      <Tile icon={<Award size={14} />} value={s.chaptersCompleted} label="Chapters done" />
    </div>
  );
}

function WeekBars({ s }: { s: Stats }) {
  const max = Math.max(1, ...s.week.map((d) => d.count));
  return (
    <div className="card p-5">
      <p className="kicker">This week’s learning</p>
      <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label={`Activities per day: ${s.week.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
        {s.week.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs opacity-70">{d.count || ""}</span>
            <div className="progress-fill w-full rounded-sm" style={{ height: `${Math.max(4, (d.count / max) * 80)}px`, opacity: d.count ? 1 : 0.25 }} />
            <span className="text-xs opacity-70">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectBars({ classLevel, studentId }: { classLevel: ClassLevel; studentId?: string }) {
  const rows = subjectProgress(classLevel, studentId);
  return (
    <div className="card p-5">
      <p className="kicker">Subject-wise progress · Class {classLevel}</p>
      <div className="mt-4 grid gap-4">
        {rows.map((r) => (
          <div key={r.subjectId}>
            <div className="flex justify-between text-sm">
              <span className="font-semibold">{r.name}</span>
              <span className="opacity-75">
                {r.completed}/{r.total} chapters · {r.pct}%
              </span>
            </div>
            <div className="progress-track mt-1">
              <div className="progress-fill" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeakList({ studentId, linkable }: { studentId?: string; linkable: boolean }) {
  const weak = weakTopics(studentId);
  return (
    <div className="card p-5">
      <p className="kicker flex items-center gap-2">
        <AlertTriangle size={14} /> Topics that need attention
      </p>
      {weak.length === 0 ? (
        <div className="panel mt-3 flex items-start gap-3 p-4">
          <span aria-hidden="true" className="chip-accent !p-2">
            <AlertTriangle size={14} />
          </span>
          <p className="text-sm opacity-80">No weak topics yet. They appear after quizzes.</p>
        </div>
      ) : (
        <ul className="mt-3 grid gap-2">
          {weak.map((w) => {
            const ch = getChapter(w.chapterId);
            const label = (
              <>
                <span className="font-semibold">{w.topic}</span>
                <span className="text-sm opacity-70">
                  {" "}
                  · {ch?.title} · missed {w.misses}×
                </span>
              </>
            );
            return (
              <li key={w.chapterId + w.topic} className="panel p-3">
                {linkable ? <Link to={`/learn?chapter=${w.chapterId}`}>{label}</Link> : label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Badges({ s }: { s: Stats }) {
  return (
    <div className="card p-5">
      <p className="kicker">Badges</p>
      <div className="mt-3 flex flex-wrap gap-2 sm:gap-2.5">
        {BADGES.map((b) => {
          const got = b.test(s);
          return (
            <span key={b.id} className={got ? "chip-accent" : "chip opacity-50"} title={got ? "Earned" : "Locked"}>
              {got ? "🏅 " : "🔒 "}
              {b.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function lastActiveText(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/* ───────────────────────── student ───────────────────────── */

function StudentDashboard({ account }: { account: Account }) {
  const level = account.classLevel ?? 10;
  const s = stats();
  const next = nextChapter(level);
  const nextMeta = next ? chapterMeta(next) : undefined;
  const [recs, setRecs] = useState(() => recommendationsFor(account.id));
  const goalPct = Math.min(100, Math.round((s.todayCount / DAILY_GOAL) * 100));

  return (
    <section className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Student dashboard</p>
          <h1 className="type-xl anim-fade-up mt-2">Namaste, {account.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 opacity-75">CBSE · Class {level}</p>
        </div>
        <span className="chip-accent flex items-center gap-1 !text-base">
          <Flame size={16} /> {s.streak}-day streak
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card anim-fade-up p-6 lg:col-span-2" style={{ "--delay": "80ms" } as CSSProperties}>
          <p className="kicker">Continue learning</p>
          {nextMeta ? (
            <>
              <h2 className="type-lg mt-2">{nextMeta.title}</h2>
              <p className="opacity-75">
                {nextMeta.subjectName} · Chapter {nextMeta.number}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={`/learn?chapter=${nextMeta.id}`} className="btn-primary">
                  Start chapter
                </Link>
                <Link to={`/sarthi?chapter=${nextMeta.id}`} className="btn-ghost">
                  Ask Sarthi
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-2">You have completed every chapter for your class. 🎉</p>
          )}
        </div>
        <div className="card anim-fade-up p-6" style={{ "--delay": "160ms" } as CSSProperties}>
          <p className="kicker">Today’s goal</p>
          <p className="stat-figure mt-2">
            {Math.min(s.todayCount, DAILY_GOAL)}/{DAILY_GOAL}
          </p>
          <p className="text-sm opacity-75">learning activities (lecture, quiz or doubt)</p>
          <div className="progress-track mt-3">
            <div className="progress-fill" style={{ width: `${goalPct}%` }} />
          </div>
          <Link to="/planner" className="btn-text mt-3 inline-block">
            Open study planner →
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <StatTiles s={s} />
      </div>

      {recs.length > 0 && (
        <div className="card mt-6 p-5">
          <p className="kicker">From your teacher</p>
          <ul className="mt-3 grid gap-2">
            {recs.map((r) => (
              <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <Link to={`/learn?chapter=${r.chapterId}`} className="font-semibold">
                    {getChapter(r.chapterId)?.title ?? r.chapterId}
                  </Link>
                  <p className="text-sm opacity-75">
                    {r.staffName}
                    {r.note && ` · “${r.note}”`}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.done}
                    onChange={(e) => {
                      setRecommendationDone(r.id, account.id, e.target.checked);
                      setRecs(recommendationsFor(account.id));
                    }}
                  />
                  Done
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-2">
        <SubjectBars classLevel={level} />
        <WeekBars s={s} />
        <WeakList linkable />
        <Badges s={s} />
      </div>
    </section>
  );
}

/* ───────────────────────── read-only report (parent + teacher) ───────────────────────── */

function StudentReport({ student }: { student: Account }) {
  const s = stats(student.id);
  const level = student.classLevel ?? 10;
  const done = getProgress(student.id).completedChapters;
  return (
    <div className="grid gap-4">
      <StatTiles s={s} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SubjectBars classLevel={level} studentId={student.id} />
        <WeekBars s={s} />
        <WeakList studentId={student.id} linkable={false} />
        <div className="card p-5">
          <p className="kicker">Completed chapters</p>
          {done.length === 0 ? (
            <p className="mt-3 opacity-75">None yet.</p>
          ) : (
            <ul className="mt-3 grid list-disc gap-1 pl-5">
              {done.map((id) => {
                const m = chapterMeta(id);
                return <li key={id}>{m ? `${m.subjectName}: ${m.title}` : id}</li>;
              })}
            </ul>
          )}
        </div>
      </div>
      <Badges s={s} />
    </div>
  );
}

function AddByEmail({ label, button, onAdd }: { label: string; button: string; onAdd: (email: string) => { ok: boolean; error?: string } }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = onAdd(email.trim());
    setMsg(r.ok ? "Added." : r.error ?? "Could not add.");
    if (r.ok) setEmail("");
  }
  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-5">
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
        {label}
        <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="student@email.com" />
      </label>
      <button type="submit" className="btn-primary">
        {button}
      </button>
      {msg && (
        <p role="status" className="w-full text-sm">
          {msg}
        </p>
      )}
    </form>
  );
}

/* ───────────────────────── parent ───────────────────────── */

function ParentDashboard({ account }: { account: Account }) {
  const [, refresh] = useState(0);
  const accounts = listAccounts();
  const children = linkedStudentIds(account.id)
    .map((id) => accounts.find((a) => a.id === id))
    .filter((a): a is Account => !!a);
  const [selected, setSelected] = useState<string | null>(children[0]?.id ?? null);
  const child = children.find((c) => c.id === selected) ?? children[0];

  return (
    <section className="container-x py-10">
      <p className="kicker">Parent dashboard</p>
      <h1 className="type-xl mt-2">Your child’s learning</h1>
      <p className="mt-1 max-w-2xl opacity-75">Read-only view. You can see progress, quiz results and topics to revise — you cannot change your child’s work.</p>

      <div className="mt-6">
        <AddByEmail
          label="Link your child (their Swyam student email)"
          button="Link child"
          onAdd={(email) => {
            const r = linkChildByEmail(account.id, email);
            refresh((n) => n + 1);
            return r.ok ? { ok: true } : { ok: false, error: r.error };
          }}
        />
      </div>

      {children.length === 0 ? (
        <div className="card mt-6 flex flex-col items-start gap-2 p-6">
          <p className="font-semibold">No child linked yet.</p>
          <p className="text-sm opacity-75">Ask your child for the email they used to join Swyam.</p>
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {children.map((c) => (
                <button key={c.id} type="button" className="filter-pill" aria-pressed={c.id === child?.id} onClick={() => setSelected(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {child && (
            <div className="mt-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="type-lg">
                  {child.name} · Class {child.classLevel}
                </h2>
                <span className="text-sm opacity-75">Last active: {lastActiveText(stats(child.id).lastActive)}</span>
              </div>
              <ParentSummary student={child} />
              <div className="mt-4">
                <StudentReport student={child} />
              </div>
            </div>
          )}
        </>
      )}
      <p className="mt-8 text-xs opacity-60">Progress is saved on the device where your child studies. Open this dashboard on that device to see the latest.</p>
    </section>
  );
}

/** A plain-language sentence for parents. */
function ParentSummary({ student }: { student: Account }) {
  const s = stats(student.id);
  const weekTotal = s.week.reduce((n, d) => n + d.count, 0);
  const weak = weakTopics(student.id, 2).map((w) => w.topic);
  const name = student.name.split(" ")[0];
  return (
    <div className="card p-5">
      <p className="kicker">This week in one line</p>
      <p className="mt-2 text-lg">
        {weekTotal === 0
          ? `${name} has not studied on Swyam this week yet.`
          : `${name} did ${weekTotal} learning activit${weekTotal === 1 ? "y" : "ies"} this week${s.accuracy !== null ? ` with ${s.accuracy}% quiz accuracy` : ""}.`}
        {weak.length > 0 && ` Needs a little more practice in ${weak.join(" and ")}.`}
      </p>
    </div>
  );
}

/* ───────────────────────── teacher / volunteer ───────────────────────── */

function needsSupport(s: Stats): string | null {
  const days = s.lastActive ? (Date.now() - Date.parse(s.lastActive)) / 86_400_000 : Infinity;
  if (days > 7) return "Inactive 7+ days";
  if (s.accuracy !== null && s.accuracy < 50 && s.quizzesTaken >= 2) return "Low quiz accuracy";
  return null;
}

function StaffDashboard({ account }: { account: Account }) {
  const [, refresh] = useState(0);
  const accounts = listAccounts();
  const group = assignedStudentIds(account.id)
    .map((id) => accounts.find((a) => a.id === id))
    .filter((a): a is Account => !!a && canView(account.id, a.id));
  const [selected, setSelected] = useState<string | null>(null);
  const student = group.find((g) => g.id === selected);
  const rows = group.map((g) => ({ g, s: stats(g.id) }));
  const flagged = rows.filter((r) => needsSupport(r.s));
  const accs = rows.map((r) => r.s.accuracy).filter((a): a is number => a !== null);
  const avgAcc = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;

  // weak topics shared across the group
  const groupWeak = new Map<string, number>();
  for (const g of group) for (const w of weakTopics(g.id, 10)) groupWeak.set(w.topic, (groupWeak.get(w.topic) ?? 0) + w.misses);
  const topGroupWeak = [...groupWeak.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <section className="container-x py-10">
      <p className="kicker">{account.role === "teacher" ? "Teacher" : "Volunteer"} dashboard</p>
      <h1 className="type-xl mt-2">Your student group</h1>
      <p className="mt-1 opacity-75">You can only see students you have added to your group.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile icon={<Users size={14} />} value={group.length} label="Students" />
        <Tile icon={<Target size={14} />} value={avgAcc === null ? "—" : `${avgAcc}%`} label="Avg quiz accuracy" />
        <Tile icon={<Award size={14} />} value={rows.reduce((n, r) => n + r.s.chaptersCompleted, 0)} label="Chapters completed" />
        <Tile icon={<AlertTriangle size={14} />} value={flagged.length} label="Need support" />
      </div>

      <div className="mt-6">
        <AddByEmail
          label="Add a student to your group (their Swyam email)"
          button="Add student"
          onAdd={(email) => {
            const r = assignStudent(account.id, email);
            refresh((n) => n + 1);
            return r.ok ? { ok: true } : { ok: false, error: r.error };
          }}
        />
      </div>

      {group.length === 0 ? (
        <div className="card mt-6 flex flex-col items-start gap-2 p-6">
          <p className="font-semibold">No students in your group yet.</p>
          <p className="text-sm opacity-75">Add a student with their Swyam email above.</p>
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ink-line)]">
                <th className="p-3">Student</th>
                <th className="p-3">Class</th>
                <th className="p-3">Points</th>
                <th className="p-3">Chapters</th>
                <th className="p-3">Accuracy</th>
                <th className="p-3">Last active</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ g, s }) => {
                const flag = needsSupport(s);
                return (
                  <tr key={g.id} className="border-b border-[var(--color-ink-line)]">
                    <td className="p-3 font-semibold">{g.name}</td>
                    <td className="p-3">{g.classLevel}</td>
                    <td className="p-3">{s.points}</td>
                    <td className="p-3">{s.chaptersCompleted}</td>
                    <td className="p-3">{s.accuracy === null ? "—" : `${s.accuracy}%`}</td>
                    <td className="p-3">{lastActiveText(s.lastActive)}</td>
                    <td className="p-3">{flag ? <span className="chip-accent">{flag}</span> : <span className="chip">On track</span>}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="btn-text"
                        aria-expanded={g.id === selected}
                        aria-label={`${g.id === selected ? "Close" : "View"} ${g.name}`}
                        onClick={() => setSelected(g.id === selected ? null : g.id)}
                      >
                        {g.id === selected ? "Close" : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {topGroupWeak.length > 0 && (
        <div className="card mt-6 p-5">
          <p className="kicker">Weak topics across your group</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topGroupWeak.map(([t, n]) => (
              <span key={t} className="chip">
                {t} · {n} misses
              </span>
            ))}
          </div>
        </div>
      )}

      {student && (
        <div className="mt-8">
          <h2 className="type-lg mb-4">
            {student.name} · Class {student.classLevel}
          </h2>
          <AssignWork staff={account} student={student} />
          <div className="mt-4">
            <StudentReport student={student} />
          </div>
        </div>
      )}
    </section>
  );
}

function AssignWork({ staff, student }: { staff: Account; student: Account }) {
  const chapters = allChapters(student.classLevel ?? 10);
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [, refresh] = useState(0);
  const recs = recommendationsFor(student.id).filter((r) => r.staffId === staff.id);

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = recommendChapter(staff.id, student.id, chapterId, note);
    setMsg(r.ok ? "Assigned. It now shows on the student’s dashboard." : r.error);
    if (r.ok) setNote("");
    refresh((n) => n + 1);
  }

  return (
    <div className="card p-5">
      <p className="kicker">Assign revision / practice</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
          Chapter
          <select className="input" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            {chapters.map((c) => {
              const m = chapterMeta(c.id);
              return (
                <option key={c.id} value={c.id}>
                  {m?.subjectName} · {c.number}. {c.title}
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
          Note (optional)
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Revise and take the quiz again" />
        </label>
        <button type="submit" className="btn-primary">
          Assign
        </button>
      </form>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      {recs.length > 0 && (
        <ul className="mt-4 grid gap-1 text-sm">
          {recs.map((r) => (
            <li key={r.id}>
              {r.done ? "✅" : "⏳"} {getChapter(r.chapterId)?.title} {r.note && `— ${r.note}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
