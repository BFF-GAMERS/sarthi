import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, Check, HelpCircle, Loader2, Minus, ShieldCheck } from "lucide-react";
import { schemes } from "../data/topics";
import { useTx } from "../lib/i18n";
import {
  EMPTY_ANSWERS,
  GOALS,
  INCOME_BANDS,
  QUALIFICATIONS,
  SITUATIONS,
  checkSchemes,
  type Goal,
  type SchemeAnswers,
  type SchemeCheck,
  type Verdict,
} from "../lib/schemes";

const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman & Nicobar",
  "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Lakshadweep",
];

/**
 * The eligibility checker on the schemes page.
 *
 * Eight questions, none of them required, and three of them — income,
 * category, disability — marked as optional twice because several schemes
 * are reserved by exactly those things and the visitor should know why they
 * are being asked. The answers go to the server for one request and are
 * kept nowhere.
 *
 * The result is a verdict per scheme, never a promise: "likely" is the
 * strongest word, and every card ends in the ministry's own link.
 */
export default function SchemeChecker() {
  const tx = useTx();
  const [a, setA] = useState<SchemeAnswers>(EMPTY_ANSWERS);
  const set = <K extends keyof SchemeAnswers>(k: K, v: SchemeAnswers[K]) =>
    setA((p) => ({ ...p, [k]: v }));
  const toggleGoal = (g: Goal) =>
    set("goals", a.goals.includes(g) ? a.goals.filter((x) => x !== g) : [...a.goals, g]);

  const run = useMutation({ mutationFn: () => checkSchemes(a) });

  return (
    <section id="check" className="scroll-mt-28 border-y border-ink-line bg-paper-light/60">
      <div className="container-x py-14">
        <div className="max-w-2xl">
          <p className="datum">{tx("Eligibility checker")}</p>
          <h2 className="section-title mt-2">{tx("Which of these might be yours?")}</h2>
          <p className="mt-4 font-body text-[14.5px] leading-relaxed text-ink-soft">
            {tx(
              "Answer what you can. Your answers are checked against each scheme's eligibility rules and you get a plain verdict — likely, worth checking, or probably not — with the reason and what to have ready. Nothing you enter is saved.",
            )}
          </p>
        </div>

        <form
          className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="datum">{tx("Age")}</span>
                <input
                  inputMode="numeric"
                  value={a.age ?? ""}
                  onChange={(e) => set("age", Number(e.target.value.replace(/[^\d]/g, "")) || null)}
                  className="input mt-1.5 !text-[13px]"
                  placeholder="18"
                />
              </label>
              <label className="block">
                <span className="datum">{tx("State")}</span>
                <select
                  value={a.state}
                  onChange={(e) => set("state", e.target.value)}
                  className="input mt-1.5 !text-[13px]"
                >
                  <option value="">{tx("Choose")}</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Choice
              label={tx("Right now you are")}
              value={a.situation}
              options={SITUATIONS.map((s) => ({ id: s.id, label: tx(s.label) }))}
              onChange={(v) => set("situation", v)}
            />

            <label className="block">
              <span className="datum">{tx("Highest qualification")}</span>
              <select
                value={a.qualification}
                onChange={(e) => set("qualification", e.target.value)}
                className="input mt-1.5 !text-[13px]"
              >
                {QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {tx(q)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="datum">{tx("You want")}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={a.goals.includes(g.id)}
                    onClick={() => toggleGoal(g.id)}
                    className={`filter-pill !h-9 !px-3 !text-[12px] ${a.goals.includes(g.id) ? "!bg-ink !text-paper" : ""}`}
                  >
                    {tx(g.label)}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="datum">{tx("A trade or field in mind")}</span>
              <input
                value={a.trade}
                onChange={(e) => set("trade", e.target.value.slice(0, 60))}
                className="input mt-1.5 !text-[13px]"
                placeholder={tx("e.g. electrician, tailoring, nursing — or leave blank")}
              />
            </label>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-ink-line p-4">
              <p className="font-body text-[12.5px] leading-relaxed text-ink-mute">
                <ShieldCheck size={13} className="mr-1 inline text-saffron-600" aria-hidden />
                {tx(
                  "The next five are optional. Several schemes are reserved by income, category, sex, disability or minority status, which is the only reason they are asked. Skip any of them and that scheme is marked “worth checking” instead of guessed.",
                )}
              </p>

              <Choice
                className="mt-4"
                label={tx("Family income, per year")}
                value={a.income}
                options={INCOME_BANDS.map((b) => ({ id: b.id, label: tx(b.label) }))}
                onChange={(v) => set("income", v)}
              />

              <Choice
                className="mt-4"
                label={tx("Category")}
                value={a.category}
                options={[
                  { id: "general", label: tx("General") },
                  { id: "obc", label: "OBC" },
                  { id: "sc", label: "SC" },
                  { id: "st", label: "ST" },
                  { id: "ews", label: "EWS" },
                  { id: "skip", label: tx("Prefer not to say") },
                ]}
                onChange={(v) => set("category", v)}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <TriState label={tx("Woman")} value={a.woman} onChange={(v) => set("woman", v)} />
                <TriState
                  label={tx("Person with disability")}
                  value={a.disability}
                  onChange={(v) => set("disability", v)}
                />
                <TriState
                  label={tx("Minority community")}
                  value={a.minority}
                  onChange={(v) => set("minority", v)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={run.isPending} className="btn-primary !py-3">
                {run.isPending ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : (
                  <Check size={15} aria-hidden />
                )}
                {tx("Check my eligibility")}
              </button>
              {run.isError && (
                <p className="font-body text-[12.5px] text-danger">
                  {(run.error as Error).message}
                </p>
              )}
            </div>
            <p className="font-body text-[11.5px] leading-relaxed text-ink-mute">
              {tx(
                "This is a reading of the published eligibility lines, not a decision. The ministry decides; the official link on each result is where to apply.",
              )}
            </p>
          </div>
        </form>

        {run.data && <Results data={run.data} />}
      </div>
    </section>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="datum">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`filter-pill !h-9 !px-3 !text-[12px] ${value === o.id ? "!bg-ink !text-paper" : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TriState({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const tx = useTx();
  const opts: { id: boolean | null; label: string }[] = [
    { id: true, label: tx("Yes") },
    { id: false, label: tx("No") },
    { id: null, label: tx("Skip") },
  ];
  return (
    <div>
      <span className="datum">{label}</span>
      <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label={label}>
        {opts.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`filter-pill !h-8 !px-2.5 !text-[11.5px] ${value === o.id ? "!bg-ink !text-paper" : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ORDER: Verdict[] = ["likely", "maybe", "unlikely"];

function Results({ data }: { data: SchemeCheck }) {
  const tx = useTx();
  const byId = new Map(schemes.map((s) => [s.id, s]));
  const groups = ORDER.map((v) => ({
    verdict: v,
    items: data.results.filter((r) => r.verdict === v),
  }));
  const heading: Record<Verdict, string> = {
    likely: tx("Likely — read the line and apply"),
    maybe: tx("Worth checking"),
    unlikely: tx("Probably not, from what you said"),
  };
  const icon: Record<Verdict, React.ReactNode> = {
    likely: <Check size={14} aria-hidden />,
    maybe: <HelpCircle size={14} aria-hidden />,
    unlikely: <Minus size={14} aria-hidden />,
  };
  const tone: Record<Verdict, string> = {
    likely: "border-emeraldx-400/40 text-emeraldx-400",
    maybe: "border-saffron-300 text-saffron-600",
    unlikely: "border-ink-line text-ink-mute",
  };

  return (
    <div className="mt-10" aria-live="polite">
      {data.summary && (
        <p className="max-w-2xl font-body text-[15px] leading-relaxed text-ink">{data.summary}</p>
      )}
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.verdict} className="mt-8">
              <h3 className="font-display text-lg tracking-tight text-ink">
                {heading[g.verdict]} · {g.items.length}
              </h3>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {g.items.map((r) => {
                  const s = byId.get(r.id);
                  if (!s) return null;
                  return (
                    <li
                      key={r.id}
                      className={`card p-4 ${g.verdict === "unlikely" ? "opacity-80" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${tone[g.verdict]}`}
                        >
                          {icon[g.verdict]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[15px] leading-tight text-ink">
                            {s.name}
                          </p>
                          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-soft">
                            {r.reason}
                          </p>
                          <p className="mt-1.5 font-body text-[12px] leading-relaxed text-ink-mute">
                            <span className="font-semibold text-ink-soft">
                              {tx("Have ready")}:{" "}
                            </span>
                            {r.confirm}
                          </p>
                          <p className="mt-2 font-body text-[11.5px] leading-relaxed text-ink-mute">
                            <span className="font-semibold">{tx("Their line")}: </span>
                            {s.eligibility}
                          </p>
                          <a
                            href={s.official}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 font-body text-[12px] font-semibold text-saffron-600 hover:underline"
                          >
                            {tx("Official site")} <ArrowUpRight size={12} aria-hidden />
                          </a>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}
    </div>
  );
}
