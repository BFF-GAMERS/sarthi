import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Briefcase, Check, ExternalLink, MapPin, X } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { SloganPlate, BlockPrintRule } from "../components/Ornaments";
import { VerifiedBadge } from "../components/Trust";
import JobAlerts from "../components/JobAlerts";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { useTx } from "../lib/i18n";
import {
  TRACKER_STEPS,
  applicationEvents,
  isDecided,
  myApplications,
  stateLabel,
  stepIndex,
  withdrawById,
  type ApplicationEvent,
  type ApplicationState,
  type MyApplication,
} from "../lib/applications";

/**
 * Every application this member has made on स्वYAM, and where each one is.
 *
 * The line of five steps is drawn from `application_events` — a step is lit
 * only when the employer actually moved the application there, and the date
 * under it is the date that happened. Nothing is inferred: an application
 * that went straight from Applied to Shortlisted shows Viewed as passed but
 * undated, because nobody recorded a viewing.
 *
 * Openings that send the applicant to the employer's own site are not here.
 * स्वYAM cannot see what happens on somebody else's careers page, and a
 * tracker that guessed would be worse than none.
 */
export default function Applications() {
  const tx = useTx();
  const navigate = useNavigate();
  const { user, profileId, ready } = useAuth();

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const list = useQuery({
    queryKey: ["my-applications", profileId],
    queryFn: () => myApplications(profileId!),
    enabled: Boolean(profileId),
  });
  const ids = (list.data ?? []).map((a) => a.id);
  const history = useQuery({
    queryKey: ["application-events", ids.join(",")],
    queryFn: () => applicationEvents(ids),
    enabled: ids.length > 0,
  });

  const rows = list.data ?? [];
  const open = rows.filter((a) => !isDecided(a.state));
  const closed = rows.filter((a) => isDecided(a.state));
  const eventsFor = (id: string) =>
    (history.data?.events ?? []).filter((e) => e.applicationId === id);

  return (
    <div className="container-x max-w-4xl pb-24 pt-28">
      <Reveal>
        <SloganPlate tone="indigo">{tx("Applications")}</SloganPlate>
        <h1 className="section-title mt-3">{tx("Where each one stands")}</h1>
        <BlockPrintRule className="mt-5" />
        <p className="mt-4 max-w-2xl font-body text-[14.5px] leading-relaxed text-ink-soft">
          {tx(
            "Every step here was recorded when the employer took it, with the date. You are told the moment anything changes.",
          )}
        </p>
      </Reveal>

      {list.isLoading ? (
        <p className="mt-10 font-body text-sm text-ink-mute">{tx("Loading…")}</p>
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <>
          {open.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("In progress")} · {open.length}
              </h2>
              <ul className="mt-4 space-y-4">
                {open.map((a) => (
                  <ApplicationRow
                    key={a.id}
                    application={a}
                    events={eventsFor(a.id)}
                    historyAvailable={history.data?.available ?? true}
                  />
                ))}
              </ul>
            </section>
          )}
          {closed.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Decided")} · {closed.length}
              </h2>
              <ul className="mt-4 space-y-4">
                {closed.map((a) => (
                  <ApplicationRow
                    key={a.id}
                    application={a}
                    events={eventsFor(a.id)}
                    historyAvailable={history.data?.available ?? true}
                  />
                ))}
              </ul>
            </section>
          )}
          <p className="mt-8 font-body text-[12.5px] leading-relaxed text-ink-mute">
            {tx(
              "Openings that send you to the employer's own site are not listed: स्वYAM cannot see what happens there.",
            )}
          </p>
        </>
      )}

      <section className="mt-14">
        <JobAlerts />
      </section>
    </div>
  );
}

function Empty() {
  const tx = useTx();
  return (
    <div className="card mt-10 p-8 text-center">
      <Briefcase size={24} className="mx-auto text-ink-mute" aria-hidden />
      <h2 className="mt-4 font-display text-xl tracking-tight text-ink">
        {tx("Nothing applied for yet")}
      </h2>
      <p className="mx-auto mt-2 max-w-md font-body text-sm leading-relaxed text-ink-soft">
        {tx(
          "When you apply to an opening on स्वYAM it appears here, and every step the employer takes is dated.",
        )}
      </p>
      <p className="mx-auto mt-2 max-w-md font-body text-[12.5px] leading-relaxed text-ink-mute">
        {tx(
          "Openings that send you to the employer's own site are not tracked — we cannot see what happens there.",
        )}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/jobs" className="btn-primary !py-2.5 !text-xs">
          {tx("See jobs")} <ArrowRight size={14} aria-hidden />
        </Link>
        <Link to="/internships" className="btn-ghost !py-2.5 !text-xs">
          {tx("See internships")}
        </Link>
      </div>
    </div>
  );
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function tone(state: ApplicationState): string {
  switch (state) {
    case "hired":
    case "offered":
      return "bg-emeraldx-400/10 text-emeraldx-400";
    case "rejected":
      return "bg-paper-deep text-ink-soft";
    case "withdrawn":
      return "bg-paper-deep text-ink-mute";
    case "submitted":
      return "bg-paper-deep text-ink";
    default:
      return "bg-saffron-50 text-saffron-600";
  }
}

function ApplicationRow({
  application: a,
  events,
  historyAvailable,
}: {
  application: MyApplication;
  events: ApplicationEvent[];
  historyAvailable: boolean;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const withdraw = useMutation({
    mutationFn: () => withdrawById(a.id),
    onError: (e: Error) =>
      toast({ tone: "bad", title: "That did not go through", body: e.message }),
    onSuccess: () => {
      setConfirming(false);
      toast({
        tone: "info",
        title: "Application withdrawn",
        body: a.opportunity
          ? `${a.opportunity.title} — you can apply again while it is open.`
          : undefined,
      });
      void qc.invalidateQueries({ queryKey: ["my-applications"] });
      void qc.invalidateQueries({ queryKey: ["application-events"] });
      void qc.invalidateQueries({ queryKey: ["application"] });
    },
  });

  const o = a.opportunity;
  const current = stepIndex(a.state);
  const withdrawn = a.state === "withdrawn";

  /*
   * A date per step, from the events. Where the history table is not there
   * yet, the two dates the row itself carries are used and the rest stay
   * blank — a blank is honest; a guessed date is not.
   */
  const reachedAt = new Map<number, string>();
  if (events.length > 0) {
    for (const e of events) {
      const i = stepIndex(e.toState);
      if (i >= 0 && !reachedAt.has(i)) reachedAt.set(i, e.createdAt);
    }
  } else {
    reachedAt.set(0, a.submittedAt);
    if (current > 0) reachedAt.set(current, a.stateChangedAt);
  }

  const decisionLabel =
    a.state === "hired"
      ? tx("Selected")
      : a.state === "offered"
        ? tx("Offer")
        : a.state === "rejected"
          ? tx("Not selected")
          : tx("Decision");

  return (
    <li className={`card p-5 ${withdrawn ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] leading-tight tracking-tight text-ink">
            {o ? (
              <Link
                to={o.kind === "internship" ? "/internships/$id" : "/jobs/$id"}
                params={{ id: o.slug }}
                className="hover:text-saffron-600"
              >
                {o.title}
              </Link>
            ) : (
              tx("Opening no longer listed")
            )}
          </h3>
          {o && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-[12.5px] text-ink-mute">
              <span>{o.employer?.name ?? tx("Employer not named")}</span>
              {o.employer?.isVerified && <VerifiedBadge />}
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} aria-hidden />
                {o.location ?? o.workMode.replace("_", " ")}
              </span>
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 font-body text-[11.5px] font-semibold ${tone(a.state)}`}
        >
          {tx(stateLabel(a.state))}
        </span>
      </div>

      {/* The line of steps. */}
      {!withdrawn && (
        <ol className="mt-5 grid grid-cols-5 gap-1" aria-label={tx("Progress")}>
          {TRACKER_STEPS.map((step, i) => {
            const reached = i <= current;
            const isCurrent = i === current;
            const when = reachedAt.get(i);
            const label = i === 4 ? decisionLabel : tx(step.label);
            const failed = i === 4 && a.state === "rejected";
            return (
              <li key={step.id} className="min-w-0">
                <div className="flex items-center">
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                      reached
                        ? failed
                          ? "border-ink-soft bg-ink-soft text-white"
                          : "border-saffron-500 bg-saffron-500 text-on-accent"
                        : "border-ink-line bg-paper-light"
                    }`}
                  >
                    {reached ? failed ? <X size={12} /> : <Check size={12} /> : null}
                  </span>
                  {i < TRACKER_STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={`h-0.5 flex-1 ${i < current ? "bg-saffron-500" : "bg-ink-line"}`}
                    />
                  )}
                </div>
                <p
                  className={`mt-1.5 truncate font-body text-[11px] ${
                    isCurrent
                      ? "font-semibold text-ink"
                      : reached
                        ? "text-ink-soft"
                        : "text-ink-mute"
                  }`}
                >
                  {label}
                  <span className="sr-only">
                    {isCurrent ? ` (${tx("current")})` : reached ? ` (${tx("done")})` : ""}
                  </span>
                </p>
                <p className="font-mono text-[10px] text-ink-mute">
                  {when ? day(when) : reached ? "—" : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {!historyAvailable && !withdrawn && (
        <p className="mt-2 font-body text-[11px] text-ink-mute">
          {tx("Dates for the middle steps are not being recorded on this account yet.")}
        </p>
      )}

      {a.decisionNote && (
        <blockquote className="mt-4 border-l-2 border-saffron-300 pl-3 font-body text-[13px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">{tx("From the employer")}: </span>
          {a.decisionNote}
        </blockquote>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-body text-[12px] text-ink-mute">
        <span>
          {tx("Applied")} {day(a.submittedAt)}
        </span>
        {a.stateChangedAt !== a.submittedAt && (
          <span>
            {tx("Last change")} {day(a.stateChangedAt)}
          </span>
        )}
        {o && a.state === "withdrawn" && !o.closedAt && (
          <Link
            to={o.kind === "internship" ? "/internships/$id" : "/jobs/$id"}
            params={{ id: o.slug }}
            className="inline-flex items-center gap-1 text-saffron-600 underline"
          >
            {tx("Apply again")} <ExternalLink size={11} aria-hidden />
          </Link>
        )}
        {!isDecided(a.state) &&
          (confirming ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-ink">{tx("Withdraw this application?")}</span>
              <button
                type="button"
                onClick={() => withdraw.mutate()}
                disabled={withdraw.isPending}
                className="btn-primary !py-1.5 !text-[11px]"
              >
                {tx("Yes, withdraw")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="btn-ghost !py-1.5 !text-[11px]"
              >
                {tx("Keep it")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="ml-auto underline hover:text-ink"
            >
              {tx("Withdraw")}
            </button>
          ))}
        {withdraw.isError && (
          <span className="text-danger">{(withdraw.error as Error).message}</span>
        )}
      </div>
    </li>
  );
}
