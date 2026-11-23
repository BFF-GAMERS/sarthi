import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { useTx } from "../lib/i18n";
import { CITY_NAMES } from "../lib/location";
import { listSkills } from "../lib/skillswap";
import {
  EMPLOYER_STATES,
  setApplicationState,
  stateLabel,
  type ApplicationState,
} from "../lib/applications";
import {
  closeOpening,
  postOpening,
  reopenOpening,
  type NewOpening,
  type OpportunityKind,
  type WorkMode,
} from "../lib/employer";

/**
 * The employer's two jobs on this platform: move an applicant along, and put
 * an opening up. Both write real rows; both are limited by the database to
 * members of the company.
 */

/* ── Moving an application ───────────────────────────────────────── */

const decision = (s: ApplicationState) => s === "offered" || s === "hired" || s === "rejected";

export function ApplicantStateControl({
  applicationId,
  state,
}: {
  applicationId: string;
  state: ApplicationState;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<ApplicationState | null>(null);
  const [note, setNote] = useState("");

  const move = useMutation({
    mutationFn: (next: { state: ApplicationState; note?: string }) =>
      setApplicationState(applicationId, next.state, next.note),
    onError: (e: Error) =>
      toast({ tone: "bad", title: "The stage did not change", body: e.message }),
    onSuccess: (_d, v) => {
      setPending(null);
      setNote("");
      toast({
        title: `Moved to ${stateLabel(v.state)}`,
        body: "The candidate has been told, with the date.",
      });
      void qc.invalidateQueries({ queryKey: ["employer-applicants"] });
      void qc.invalidateQueries({ queryKey: ["employer-summary"] });
    },
  });

  const choose = (next: ApplicationState) => {
    if (next === state) return;
    // A decision carries a note to the candidate; ask for it before writing.
    if (decision(next)) {
      setPending(next);
      return;
    }
    move.mutate({ state: next });
  };

  if (state === "withdrawn") {
    return <span className="chip shrink-0 !text-[10px]">{tx(stateLabel(state))}</span>;
  }

  return (
    <div className="w-full sm:w-auto">
      <label className="sr-only" htmlFor={`state-${applicationId}`}>
        {tx("Stage")}
      </label>
      <select
        id={`state-${applicationId}`}
        value={pending ?? state}
        onChange={(e) => choose(e.target.value as ApplicationState)}
        disabled={move.isPending}
        className="input !w-full !py-1.5 !text-[12px] sm:!w-auto"
      >
        {EMPLOYER_STATES.map((s) => (
          <option key={s.id} value={s.id}>
            {tx(s.label)}
          </option>
        ))}
      </select>

      {pending && (
        <div className="mt-2 rounded-xl border border-ink-line p-3">
          <label htmlFor={`note-${applicationId}`} className="datum">
            {tx("A line to the candidate")}{" "}
            <span className="font-normal normal-case text-ink-mute">({tx("optional")})</span>
          </label>
          <textarea
            id={`note-${applicationId}`}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={2}
            placeholder={
              pending === "rejected"
                ? tx("What would have made the difference — they can act on that.")
                : tx("Next step, date, whom to contact.")
            }
            className="input mt-1.5 resize-none !text-[12.5px]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => move.mutate({ state: pending, note })}
              disabled={move.isPending}
              className="btn-primary !py-1.5 !text-[11px]"
            >
              {move.isPending && <Loader2 size={12} className="animate-spin" aria-hidden />}
              {tx("Mark")} {tx(stateLabel(pending))}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setNote("");
              }}
              className="btn-ghost !py-1.5 !text-[11px]"
            >
              {tx("Cancel")}
            </button>
          </div>
        </div>
      )}
      {move.isError && (
        <p className="mt-1 font-body text-[11px] text-danger">{(move.error as Error).message}</p>
      )}
      {move.isSuccess && !pending && (
        <p className="mt-1 inline-flex items-center gap-1 font-body text-[11px] text-emeraldx-400">
          <Check size={11} aria-hidden /> {tx("Candidate told")}
        </p>
      )}
    </div>
  );
}

/* ── Closing and reopening ───────────────────────────────────────── */

export function OpeningToggle({ id, closed }: { id: string; closed: boolean }) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const m = useMutation({
    mutationFn: () => (closed ? reopenOpening(id) : closeOpening(id)),
    onError: (e: Error) => toast({ tone: "bad", title: "That did not work", body: e.message }),
    onSuccess: () => {
      setConfirming(false);
      toast({
        title: closed ? "Opening reopened" : "Opening closed",
        body: closed
          ? "It is listed again, and alerts that match it will fire."
          : "It is off the list. Applications already made are kept.",
      });
      void qc.invalidateQueries({ queryKey: ["employer-posts"] });
      void qc.invalidateQueries({ queryKey: ["employer-summary"] });
      void qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
  if (closed) {
    return (
      <button
        type="button"
        onClick={() => m.mutate()}
        disabled={m.isPending}
        className="btn-ghost !px-3 !py-1.5 !text-[11px]"
      >
        {tx("Reopen")}
      </button>
    );
  }
  return confirming ? (
    <span className="inline-flex flex-wrap items-center gap-1.5 font-body text-[11px] text-ink">
      {tx("Close this opening?")}
      <button
        type="button"
        onClick={() => m.mutate()}
        disabled={m.isPending}
        className="btn-primary !px-3 !py-1.5 !text-[11px]"
      >
        {tx("Close it")}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="btn-ghost !px-3 !py-1.5 !text-[11px]"
      >
        {tx("Keep")}
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="btn-ghost !px-3 !py-1.5 !text-[11px]"
    >
      {tx("Close")}
    </button>
  );
}

/* ── Posting ─────────────────────────────────────────────────────── */

const MODES: { id: WorkMode; label: string }[] = [
  { id: "onsite", label: "In person" },
  { id: "hybrid", label: "Hybrid" },
  { id: "remote", label: "Remote" },
];

const blank: NewOpening = {
  kind: "job",
  title: "",
  summary: "",
  description: "",
  responsibilities: "",
  eligibility: "",
  workMode: "onsite",
  location: "",
  region: "",
  openings: 1,
  deadline: "",
  payMin: null,
  payMax: null,
  payPeriod: "month",
  durationWeeks: null,
  hoursPerWeek: null,
  experience: "",
  benefits: [],
  responseTime: "",
  skillIds: [],
};

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="datum">{label}</span>
      {children}
      {hint && <span className="mt-1 block font-body text-[11px] text-ink-mute">{hint}</span>}
    </label>
  );
}

export function PostOpeningForm({ companyId, onDone }: { companyId: string; onDone?: () => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const { profileId } = useAuth();
  const [o, setO] = useState<NewOpening>(blank);
  const [benefitDraft, setBenefitDraft] = useState("");
  const [skillDraft, setSkillDraft] = useState("");
  const [posted, setPosted] = useState<{ slug: string; kind: OpportunityKind } | null>(null);

  const set = <K extends keyof NewOpening>(k: K, v: NewOpening[K]) =>
    setO((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d]/g, "")) || null);

  const catalogue = useQuery({ queryKey: ["skills"], queryFn: listSkills, staleTime: 5 * 60_000 });
  const chosen = (catalogue.data ?? []).filter((s) => o.skillIds.includes(s.id));
  const suggestions = skillDraft.trim()
    ? (catalogue.data ?? [])
        .filter(
          (s) =>
            s.name.toLowerCase().includes(skillDraft.trim().toLowerCase()) &&
            !o.skillIds.includes(s.id),
        )
        .slice(0, 6)
    : [];

  const post = useMutation({
    mutationFn: () => postOpening(companyId, profileId!, o),
    onError: (e: Error) =>
      toast({ tone: "bad", title: "The opening was not posted", body: e.message }),
    onSuccess: (r) => {
      setPosted({ slug: r.slug, kind: o.kind });
      toast({
        title: "Opening published",
        body: "Members whose alerts match it are being told now.",
        action: {
          label: "See it as candidates do",
          to: o.kind === "internship" ? `/internships/${r.slug}` : `/jobs/${r.slug}`,
        },
      });
      setO(blank);
      void qc.invalidateQueries({ queryKey: ["employer-posts"] });
      void qc.invalidateQueries({ queryKey: ["employer-summary"] });
      void qc.invalidateQueries({ queryKey: ["opportunities"] });
      onDone?.();
    },
  });

  const internship = o.kind === "internship";
  const valid = o.title.trim().length >= 4 && (o.workMode === "remote" || o.location.trim());

  if (posted) {
    return (
      <div className="rounded-2xl border border-emeraldx-400/30 bg-emeraldx-400/5 p-5">
        <p className="inline-flex items-center gap-2 font-body text-sm font-medium text-emeraldx-400">
          <Check size={16} aria-hidden /> {tx("Posted. It is live now.")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={posted.kind === "internship" ? "/internships/$id" : "/jobs/$id"}
            params={{ id: posted.slug }}
            className="btn-primary !py-2 !text-xs"
          >
            {tx("See it as candidates do")}
          </Link>
          <button
            type="button"
            onClick={() => setPosted(null)}
            className="btn-ghost !py-2 !text-xs"
          >
            {tx("Post another")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) post.mutate();
      }}
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tx("Type")}>
        {(
          [
            { id: "job", label: "Job" },
            { id: "internship", label: "Internship" },
          ] as { id: OpportunityKind; label: string }[]
        ).map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={o.kind === k.id}
            onClick={() => set("kind", k.id)}
            className={`filter-pill !h-9 !px-3 !text-[12px] ${o.kind === k.id ? "!bg-ink !text-paper" : ""}`}
          >
            {tx(k.label)}
          </button>
        ))}
      </div>

      <Field label={tx("Title")}>
        <input
          value={o.title}
          onChange={(e) => set("title", e.target.value.slice(0, 120))}
          required
          minLength={4}
          className="input mt-1.5 !text-[13px]"
          placeholder={
            internship ? tx("e.g. Accounts Intern") : tx("e.g. Solar Installation Technician")
          }
        />
      </Field>

      <Field label={tx("One line about the role")} hint={tx("This is what shows on the card.")}>
        <input
          value={o.summary}
          onChange={(e) => set("summary", e.target.value.slice(0, 200))}
          className="input mt-1.5 !text-[13px]"
        />
      </Field>

      <Field label={tx("About the role")}>
        <textarea
          value={o.description}
          onChange={(e) => set("description", e.target.value.slice(0, 4000))}
          rows={4}
          className="input mt-1.5 !text-[13px]"
        />
      </Field>

      <Field label={tx("What they would do")} hint={tx("One duty per line.")}>
        <textarea
          value={o.responsibilities}
          onChange={(e) => set("responsibilities", e.target.value.slice(0, 3000))}
          rows={4}
          className="input mt-1.5 !text-[13px]"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx("Who can apply")}>
          <textarea
            value={o.eligibility}
            onChange={(e) => set("eligibility", e.target.value.slice(0, 1000))}
            rows={3}
            className="input mt-1.5 !text-[13px]"
            placeholder={tx("Class 12 pass; any age; ITI preferred but not required…")}
          />
        </Field>
        <Field
          label={tx("Experience")}
          hint={tx("Say “none needed” if that is true — it brings applicants.")}
        >
          <input
            value={o.experience}
            onChange={(e) => set("experience", e.target.value.slice(0, 80))}
            className="input mt-1.5 !text-[13px]"
            placeholder={tx("e.g. None needed / 1–2 years")}
          />
        </Field>
      </div>

      <div>
        <span className="datum">{tx("Work mode")}</span>
        <div
          className="mt-1.5 flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label={tx("Work mode")}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={o.workMode === m.id}
              onClick={() => set("workMode", m.id)}
              className={`filter-pill !h-9 !px-3 !text-[12px] ${o.workMode === m.id ? "!bg-ink !text-paper" : ""}`}
            >
              {tx(m.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx("City / location")}>
          <input
            list="post-cities"
            value={o.location}
            onChange={(e) => set("location", e.target.value.slice(0, 80))}
            required={o.workMode !== "remote"}
            className="input mt-1.5 !text-[13px]"
            placeholder={o.workMode === "remote" ? tx("Anywhere in India") : tx("e.g. Faridabad")}
            autoComplete="off"
          />
          <datalist id="post-cities">
            {CITY_NAMES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label={tx("State / region")}>
          <input
            value={o.region}
            onChange={(e) => set("region", e.target.value.slice(0, 60))}
            className="input mt-1.5 !text-[13px]"
            placeholder={tx("e.g. Haryana")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={internship ? tx("Stipend (₹)") : tx("Pay from (₹)")}>
          <input
            inputMode="numeric"
            value={o.payMin ?? ""}
            onChange={(e) => set("payMin", num(e.target.value))}
            className="input mt-1.5 !text-[13px]"
            placeholder={tx("Leave blank if unstated")}
          />
        </Field>
        {!internship && (
          <Field label={tx("Pay to (₹)")}>
            <input
              inputMode="numeric"
              value={o.payMax ?? ""}
              onChange={(e) => set("payMax", num(e.target.value))}
              className="input mt-1.5 !text-[13px]"
            />
          </Field>
        )}
        <Field label={tx("Per")}>
          <select
            value={o.payPeriod}
            onChange={(e) => set("payPeriod", e.target.value as NewOpening["payPeriod"])}
            className="input mt-1.5 !text-[13px]"
          >
            <option value="month">{tx("Month")}</option>
            <option value="year">{tx("Year")}</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {internship && (
          <Field label={tx("Duration (weeks)")}>
            <input
              inputMode="numeric"
              value={o.durationWeeks ?? ""}
              onChange={(e) => set("durationWeeks", num(e.target.value))}
              className="input mt-1.5 !text-[13px]"
            />
          </Field>
        )}
        <Field label={tx("Hours per week")}>
          <input
            inputMode="numeric"
            value={o.hoursPerWeek ?? ""}
            onChange={(e) => set("hoursPerWeek", num(e.target.value))}
            className="input mt-1.5 !text-[13px]"
          />
        </Field>
        <Field label={tx("Openings")}>
          <input
            inputMode="numeric"
            value={o.openings}
            onChange={(e) => set("openings", Number(e.target.value.replace(/[^\d]/g, "")) || 1)}
            className="input mt-1.5 !text-[13px]"
          />
        </Field>
        <Field label={tx("Last date to apply")} hint={tx("Blank = open until filled.")}>
          <input
            type="date"
            value={o.deadline}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set("deadline", e.target.value)}
            className="input mt-1.5 !text-[13px]"
          />
        </Field>
      </div>

      <div>
        <span className="datum">{tx("Skills asked for")}</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {chosen.map((s) => (
            <span key={s.id} className="chip inline-flex items-center gap-1 !text-[11px]">
              {s.name}
              <button
                type="button"
                onClick={() =>
                  set(
                    "skillIds",
                    o.skillIds.filter((x) => x !== s.id),
                  )
                }
                aria-label={`${tx("Remove")} ${s.name}`}
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-ink/10"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const first = suggestions[0];
                if (first) {
                  set("skillIds", [...o.skillIds, first.id]);
                  setSkillDraft("");
                }
              }
            }}
            placeholder={tx("Type to search the skill list")}
            className="input !w-auto min-w-[12rem] flex-1 !py-2 !text-[13px]"
            autoComplete="off"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  set("skillIds", [...o.skillIds, s.id]);
                  setSkillDraft("");
                }}
                className="filter-pill !h-8 !px-3 !text-[12px]"
              >
                <Plus size={11} aria-hidden /> {s.name}
              </button>
            ))}
          </div>
        )}
        <p className="mt-1 font-body text-[11px] text-ink-mute">
          {tx(
            "Only skills from the catalog, so candidates' passports can be matched against them.",
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="datum">{tx("Benefits")}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {o.benefits.map((b) => (
              <span key={b} className="chip inline-flex items-center gap-1 !text-[11px]">
                {b}
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "benefits",
                      o.benefits.filter((x) => x !== b),
                    )
                  }
                  aria-label={`${tx("Remove")} ${b}`}
                  className="grid h-4 w-4 place-items-center rounded-full hover:bg-ink/10"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              value={benefitDraft}
              onChange={(e) => setBenefitDraft(e.target.value.slice(0, 60))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = benefitDraft.trim();
                  if (v && !o.benefits.includes(v) && o.benefits.length < 8) {
                    set("benefits", [...o.benefits, v]);
                    setBenefitDraft("");
                  }
                }
              }}
              placeholder={tx("e.g. PF, travel allowance — Enter to add")}
              className="input !w-auto min-w-[12rem] flex-1 !py-2 !text-[13px]"
            />
          </div>
        </div>
        <Field
          label={tx("How soon you reply")}
          hint={tx("Only promise what you will keep; it is shown to every applicant.")}
        >
          <input
            value={o.responseTime}
            onChange={(e) => set("responseTime", e.target.value.slice(0, 80))}
            className="input mt-1.5 !text-[13px]"
            placeholder={tx("e.g. Within 7 working days")}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!valid || post.isPending}
          className="btn-primary !py-2.5 !text-xs disabled:opacity-50"
        >
          {post.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {tx("Publish opening")}
        </button>
        {post.isError && (
          <p className="font-body text-[12px] text-danger">{(post.error as Error).message}</p>
        )}
      </div>
      <p className="font-body text-[11.5px] leading-relaxed text-ink-mute">
        {tx(
          "Applications come to this dashboard with each candidate's Skill Passport. Members whose alerts match are told the moment it is live.",
        )}
      </p>
    </form>
  );
}
