import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, BellRing, Loader2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { useTx } from "../lib/i18n";
import { CITY_NAMES } from "../lib/location";
import { getPreferredCity } from "../lib/local-store";
import { listSkills } from "../lib/skillswap";
import {
  ALERT_MAX,
  createAlert,
  deleteAlert,
  describeAlert,
  myAlerts,
  type JobAlertInput,
  type OpportunityKind,
  type WorkMode,
} from "../lib/job-alerts";

/**
 * "Tell me when something like this is posted."
 *
 * Shown at the foot of the jobs and internships lists and on the applications
 * page. It says what it does — a notification here, on the bell — and does
 * not promise mail or WhatsApp, because neither is wired to it.
 */
export default function JobAlerts({ compact = false }: { compact?: boolean }) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const { user, profileId } = useAuth();
  const [open, setOpen] = useState(false);

  const alerts = useQuery({
    queryKey: ["job-alerts", profileId],
    queryFn: () => myAlerts(profileId!),
    enabled: Boolean(profileId),
  });
  const remove = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      toast({ tone: "info", title: "Alert removed" });
      void qc.invalidateQueries({ queryKey: ["job-alerts"] });
    },
    onError: (e: Error) =>
      toast({ tone: "bad", title: "Could not remove that alert", body: e.message }),
  });

  const list = alerts.data?.alerts ?? [];
  const available = alerts.data?.available ?? true;

  return (
    <section className={`card ${compact ? "p-5" : "p-6"}`} aria-labelledby="job-alerts-h">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron-50 text-saffron-600"
        >
          {list.length > 0 ? <BellRing size={17} /> : <Bell size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="job-alerts-h" className="font-display text-lg tracking-tight text-ink">
            {tx("Not the right opening yet?")}
          </h2>
          <p className="mt-1 font-body text-[13.5px] leading-relaxed text-ink-soft">
            {tx(
              "There are not many openings on स्वYAM yet, and we would rather say so than pad the list. Save what you are looking for and you will get a notification here the day a matching opening is published.",
            )}
          </p>

          {!user ? (
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="btn-primary mt-4 !py-2.5 !text-xs"
            >
              {tx("Sign in to set an alert")}
            </Link>
          ) : !available && !alerts.isLoading ? (
            <p className="mt-3 font-body text-[12.5px] text-ink-mute">
              {tx("Alerts are not switched on for this site yet.")}
            </p>
          ) : (
            <>
              {list.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {list.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 rounded-2xl border border-ink-line px-3.5 py-2.5"
                    >
                      <p className="min-w-0 flex-1 font-body text-[13px] text-ink">
                        {describeAlert(a)}
                        {a.lastMatchedAt && (
                          <span className="block font-body text-[11px] text-ink-mute">
                            {tx("Last match")}{" "}
                            {new Date(a.lastMatchedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => remove.mutate(a.id)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-paper-dim hover:text-ink"
                        aria-label={`${tx("Remove alert")}: ${describeAlert(a)}`}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {open ? (
                <AlertForm
                  onDone={() => {
                    setOpen(false);
                    void qc.invalidateQueries({ queryKey: ["job-alerts"] });
                  }}
                  onCancel={() => setOpen(false)}
                />
              ) : list.length < ALERT_MAX ? (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="btn-primary mt-4 !py-2.5 !text-xs"
                >
                  <Bell size={13} aria-hidden />
                  {list.length === 0 ? tx("Set an alert") : tx("Add another alert")}
                </button>
              ) : (
                <p className="mt-3 font-body text-[12px] text-ink-mute">
                  {tx("Four alerts is the most you can keep. Remove one to add another.")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const MODES: { id: WorkMode | null; label: string }[] = [
  { id: null, label: "Any mode" },
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "In person" },
];

const KINDS: { id: OpportunityKind | null; label: string }[] = [
  { id: null, label: "Jobs and internships" },
  { id: "job", label: "Jobs only" },
  { id: "internship", label: "Internships only" },
];

function AlertForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const tx = useTx();
  const toast = useToast();
  const { profileId } = useAuth();
  const [city, setCity] = useState<string>(getPreferredCity() ?? "");
  const [skillDraft, setSkillDraft] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [minPay, setMinPay] = useState<string>("");
  const [mode, setMode] = useState<WorkMode | null>(null);
  const [kind, setKind] = useState<OpportunityKind | null>(null);

  const catalogue = useQuery({ queryKey: ["skills"], queryFn: listSkills, staleTime: 5 * 60_000 });
  const suggestions = skillDraft.trim()
    ? (catalogue.data ?? [])
        .filter(
          (s) =>
            s.name.toLowerCase().includes(skillDraft.trim().toLowerCase()) &&
            !skills.includes(s.name.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  const addSkill = (name: string) => {
    const v = name.trim().toLowerCase();
    if (!v || skills.includes(v) || skills.length >= 8) return;
    setSkills([...skills, v]);
    setSkillDraft("");
  };

  const save = useMutation({
    mutationFn: () => {
      const input: JobAlertInput = {
        city: city.trim() || null,
        skills,
        minPay: minPay ? Number(minPay.replace(/[^\d]/g, "")) || null : null,
        workMode: mode,
        kind,
      };
      return createAlert(profileId!, input);
    },
    onSuccess: () => {
      toast({
        title: "Alert saved",
        body: "You will get a notification here the day a matching opening is published.",
      });
      onDone();
    },
  });

  return (
    <form
      className="mt-4 space-y-4 rounded-2xl border border-ink-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="datum">{tx("City")}</span>
          <input
            list="alert-cities"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={tx("Anywhere")}
            className="input mt-1.5 !text-[13px]"
            autoComplete="off"
          />
          <datalist id="alert-cities">
            {CITY_NAMES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <span className="mt-1 block font-body text-[11px] text-ink-mute">
            {tx("Remote openings match every city.")}
          </span>
        </label>

        <label className="block">
          <span className="datum">{tx("Minimum pay per month (₹)")}</span>
          <input
            inputMode="numeric"
            value={minPay}
            onChange={(e) => setMinPay(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={tx("Any")}
            className="input mt-1.5 !text-[13px]"
          />
          <span className="mt-1 block font-body text-[11px] text-ink-mute">
            {tx("Openings that do not state pay are still sent.")}
          </span>
        </label>
      </div>

      <div>
        <span className="datum">{tx("Skills")}</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {skills.map((s) => (
            <span key={s} className="chip inline-flex items-center gap-1 !text-[11px]">
              {s}
              <button
                type="button"
                onClick={() => setSkills(skills.filter((x) => x !== s))}
                aria-label={`${tx("Remove")} ${s}`}
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
                addSkill(suggestions[0]?.name ?? skillDraft);
              }
            }}
            placeholder={skills.length ? tx("Add another") : tx("e.g. Excel, Welding, React")}
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
                onClick={() => addSkill(s.name)}
                className="filter-pill !h-8 !px-3 !text-[12px]"
              >
                + {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="datum">{tx("Mode")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={tx("Mode")}>
            {MODES.map((m) => (
              <button
                key={String(m.id)}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`filter-pill !h-9 !px-3 !text-[12px] ${mode === m.id ? "!bg-ink !text-paper" : ""}`}
              >
                {tx(m.label)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="datum">{tx("Type")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={tx("Type")}>
            {KINDS.map((k) => (
              <button
                key={String(k.id)}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => setKind(k.id)}
                className={`filter-pill !h-9 !px-3 !text-[12px] ${kind === k.id ? "!bg-ink !text-paper" : ""}`}
              >
                {tx(k.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={save.isPending} className="btn-primary !py-2.5 !text-xs">
          {save.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {tx("Save alert")}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost !py-2.5 !text-xs">
          {tx("Cancel")}
        </button>
        {save.isError && (
          <p className="font-body text-[12px] text-danger">{(save.error as Error).message}</p>
        )}
      </div>
      <p className="font-body text-[11.5px] leading-relaxed text-ink-mute">
        {tx(
          "You get a notification on स्वYAM — the bell at the top. No email or WhatsApp is sent.",
        )}
      </p>
    </form>
  );
}
