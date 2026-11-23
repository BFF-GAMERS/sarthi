import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import SarthiArt from "../components/SarthiArt";
import { currentAccount } from "../lib/auth";
import { getItem, setItem } from "../lib/store";
import { listSubjects } from "../lib/content";
import { chapterStatus, getProgress, recordActivity, weakTopics } from "../lib/progress";

/*
 * Study planner. The plan is built on this device from the student's own
 * progress: weak chapters are revised first, unfinished ones next, then new
 * ones, and the last week before the exam is kept for revision.
 */

interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  chapterId?: string;
  title: string;
  kind: "learn" | "revise" | "custom";
  minutes: number;
  done: boolean;
}

interface Plan {
  examDate: string;
  minutesPerDay: number;
  subjects: string[];
  tasks: Task[];
  createdAt: string;
}

const LEARN_MIN = 45;
const REVISE_MIN = 20;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const uid = () => Math.random().toString(36).slice(2, 9);

function buildPlan(classLevel: 8 | 9 | 10 | 11 | 12, examDate: string, minutesPerDay: number, subjects: string[]): { plan: Plan; overflow: number } {
  const progress = getProgress();
  const weakIds = new Set(weakTopics(undefined, 20).map((w) => w.chapterId));
  const queue: Omit<Task, "id" | "date" | "done">[] = [];
  const revisePool: Omit<Task, "id" | "date" | "done">[] = [];

  for (const s of listSubjects(classLevel).filter((x) => subjects.includes(x.id))) {
    for (const c of s.chapters) {
      const st = chapterStatus(c.id, undefined, progress);
      const label = `${s.name}: ${c.title}`;
      if (weakIds.has(c.id)) queue.unshift({ chapterId: c.id, title: `Revise weak topics · ${label}`, kind: "revise", minutes: REVISE_MIN });
      if (!st.completed) queue.push({ chapterId: c.id, title: `${st.pct > 0 ? "Finish" : "Learn"} · ${label} (lectures, notes, quiz)`, kind: "learn", minutes: LEARN_MIN });
      revisePool.push({ chapterId: c.id, title: `Quick revision · ${label}`, kind: "revise", minutes: REVISE_MIN });
    }
  }

  const today = new Date();
  const exam = new Date(examDate + "T00:00:00");
  const totalDays = Math.max(1, Math.round((exam.getTime() - today.getTime()) / 86_400_000));
  const revisionDays = totalDays > 14 ? 7 : Math.floor(totalDays / 3);
  const studyDays = totalDays - revisionDays;

  const tasks: Task[] = [];
  let day = 0;
  let used = 0;
  for (const t of queue) {
    if (used + t.minutes > minutesPerDay && used > 0) {
      day += 1;
      used = 0;
    }
    if (day >= studyDays) break;
    tasks.push({ ...t, id: uid(), date: iso(addDays(today, day)), done: false });
    used += t.minutes;
  }
  const overflow = queue.length - tasks.length;

  // revision days: spread quick-revision tasks
  let r = 0;
  for (let d = studyDays; d < totalDays && revisePool.length; d++) {
    let mins = 0;
    while (mins + REVISE_MIN <= minutesPerDay && r < revisePool.length) {
      tasks.push({ ...revisePool[r], id: uid(), date: iso(addDays(today, d)), done: false });
      mins += REVISE_MIN;
      r += 1;
    }
  }
  return { plan: { examDate, minutesPerDay, subjects, tasks, createdAt: new Date().toISOString() }, overflow };
}

export default function Planner() {
  const account = currentAccount();
  const key = "plan." + (account?.id ?? "none");
  const level = account?.classLevel ?? 10;
  const subjects = listSubjects(level);
  const [plan, setPlan] = useState<Plan | null>(() => getItem<Plan | null>(key, null));
  const [examDate, setExamDate] = useState(plan?.examDate ?? iso(addDays(new Date(), 60)));
  const [minutes, setMinutes] = useState(plan?.minutesPerDay ?? 90);
  const [picked, setPicked] = useState<string[]>(plan?.subjects ?? subjects.map((s) => s.id));
  const [warn, setWarn] = useState("");
  const [custom, setCustom] = useState("");

  if (!account || account.role !== "student") {
    return (
      <section className="container-x py-12">
        <div className="card p-6">The study planner is for student accounts.</div>
      </section>
    );
  }

  function save(p: Plan) {
    setItem(key, p);
    setPlan(p);
  }

  function generate(e: FormEvent) {
    e.preventDefault();
    if (picked.length === 0) return setWarn("Pick at least one subject.");
    if (new Date(examDate) <= new Date()) return setWarn("Exam date must be in the future.");
    const { plan: p, overflow } = buildPlan(level, examDate, minutes, picked);
    save(p);
    setWarn(overflow > 0 ? `Your time is tight: ${overflow} chapter task(s) did not fit before revision week. Add more minutes per day or start earlier.` : "Plan ready. Tick tasks as you finish them.");
  }

  function toggle(id: string) {
    if (!plan) return;
    const tasks = plan.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    const t = tasks.find((x) => x.id === id);
    if (t?.done) recordActivity("plan", t.chapterId, t.title);
    save({ ...plan, tasks });
  }

  function remove(id: string) {
    if (plan) save({ ...plan, tasks: plan.tasks.filter((t) => t.id !== id) });
  }

  function addCustom(e: FormEvent) {
    e.preventDefault();
    if (!plan || !custom.trim()) return;
    save({ ...plan, tasks: [...plan.tasks, { id: uid(), date: iso(new Date()), title: custom.trim(), kind: "custom", minutes: 30, done: false }] });
    setCustom("");
  }

  const today = iso(new Date());
  const byDate = new Map<string, Task[]>();
  for (const t of [...(plan?.tasks ?? [])].sort((a, b) => a.date.localeCompare(b.date))) {
    byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
  }
  const doneCount = plan?.tasks.filter((t) => t.done).length ?? 0;
  const total = plan?.tasks.length ?? 0;
  const daysLeft = plan ? Math.max(0, Math.round((new Date(plan.examDate).getTime() - Date.now()) / 86_400_000)) : null;
  const overdue = (plan?.tasks ?? []).filter((t) => !t.done && t.date < today);

  return (
    <section className="container-x py-10">
      <p className="kicker">Study planner</p>
      <h1 className="type-xl mt-2 flex items-center gap-3">
        <CalendarDays aria-hidden="true" /> Your exam plan
      </h1>

      <form onSubmit={generate} className="card mt-6 grid gap-4 p-4 sm:p-5 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Exam date
          <input type="date" className="input" value={examDate} min={iso(addDays(new Date(), 1))} onChange={(e) => setExamDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Study time per day
          <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[45, 60, 90, 120, 180, 240].map((m) => (
              <option key={m} value={m}>
                {m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} min`}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend>Subjects</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {subjects.map((s) => (
              <label key={s.id} className="filter-pill flex cursor-pointer items-center gap-1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-saffron-500" aria-pressed={picked.includes(s.id)}>
                <input type="checkbox" className="sr-only" checked={picked.includes(s.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-3">
          <button type="submit" className="btn-primary">
            {plan ? "Rebuild my plan" : "Make my plan"}
          </button>
          {warn && <p className="mt-2 text-sm" role="status">{warn}</p>}
        </div>
      </form>

      {!plan && (
        <div className="card mt-6 flex flex-col items-start gap-2 p-6">
          <SarthiArt size={96} className="mb-2" />
          <p className="font-semibold">No plan yet.</p>
          <p className="text-sm opacity-75">Pick your exam date, daily study time and subjects above, then tap “Make my plan”.</p>
        </div>
      )}

      {plan && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <div className="card p-4 sm:p-5">
              <p className="text-sm opacity-75">Days to exam</p>
              <p className="stat-figure mt-2 !text-3xl">{daysLeft}</p>
            </div>
            <div className="card p-4 sm:p-5">
              <p className="text-sm opacity-75">Tasks done</p>
              <p className="stat-figure mt-2 !text-3xl">
                {doneCount}/{total}
              </p>
            </div>
            <div className="card p-4 sm:p-5">
              <p className="text-sm opacity-75">Overdue</p>
              <p className="stat-figure mt-2 !text-3xl">{overdue.length}</p>
            </div>
            <div className="card p-4 sm:p-5">
              <p className="text-sm opacity-75">Daily time</p>
              <p className="stat-figure mt-2 !text-3xl">{plan.minutesPerDay}m</p>
            </div>
          </div>
          {overdue.length > 0 && <p className="mt-3 text-sm">You have {overdue.length} unfinished task(s) from earlier days. Rebuild the plan to spread them again.</p>}

          <form onSubmit={addCustom} className="mt-6 flex gap-2">
            <input className="input flex-1" aria-label="Add your own task" placeholder="Add your own task for today (e.g. solve 10 NCERT exercise questions)" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn-ghost flex items-center gap-1" type="submit">
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          </form>

          <div className="mt-6 grid gap-4 sm:gap-5">
            {[...byDate.entries()].slice(0, 30).map(([date, tasks]) => (
              <div key={date} className={date === today ? "card p-5" : "card-flat p-5"}>
                <p className="kicker">
                  {date === today ? "Today · " : ""}
                  {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                  {" · "}
                  {tasks.reduce((n, t) => n + t.minutes, 0)} min
                </p>
                <ul className="mt-3 grid gap-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3">
                      <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={`Mark ${t.title} done`} />
                      <span className={`flex-1 ${t.done ? "line-through opacity-60" : ""}`}>
                        {t.chapterId ? <Link to={`/learn?chapter=${t.chapterId}`}>{t.title}</Link> : t.title}
                        <span className="text-xs opacity-60"> · {t.minutes} min{t.kind === "revise" ? " · revision" : ""}</span>
                      </span>
                      <button type="button" className="btn-text !p-2" onClick={() => remove(t.id)} aria-label={`Remove ${t.title}`}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {byDate.size > 30 && <p className="text-sm opacity-70">Showing the next 30 study days.</p>}
          </div>
        </>
      )}
    </section>
  );
}
