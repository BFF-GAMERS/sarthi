import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/PreferencesContext";
import { useTx } from "../lib/i18n";
import { getSupabase } from "../lib/supabase";
import { useRecentViews } from "./home/data";

/**
 * "Jobs for me" — openings picked for this member, only when they ask.
 *
 * Nothing is fetched from the model until the button is pressed, and the server allows a few
 * presses a day (see src/lib/jobs/job-match.ts). The last answer is shown again for
 * free. Visitors see a sign-in link instead of a button.
 */

interface Pick {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  kind: "job" | "internship" | "remote";
  href: string;
  external: boolean;
  source: string | null;
  why: string;
}
interface MatchResult {
  picks: Pick[];
  generatedAt: string;
  by: "gemini" | "rules";
}

async function call(method: "GET" | "POST", body?: unknown) {
  const sb = getSupabase();
  const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  // Never wait forever: the server gives up well before this.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch("/api/job-match", {
      signal: ctl.signal,
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return {
      status: 0,
      json: { error: "This is taking too long. Please try again in a minute." } as Record<
        string,
        unknown
      >,
    };
  } finally {
    clearTimeout(timer);
  }
  return {
    status: res.status,
    json: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

/** What the server is doing, in order. The request is one call, so the steps are paced, not reported. */
const STEPS = [
  { label: "Reading your skills and courses", at: 0 },
  { label: "Matching every open job and internship", at: 1200 },
  { label: "Gemini is picking the best ones for you", at: 3200 },
  { label: "Writing why each one fits", at: 7000 },
];

/** A step tracker and a bar that creeps towards 90% until the answer lands, then fills. */
function Tracker({ done }: { done: boolean }) {
  const tx = useTx();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - started), 200);
    return () => clearInterval(t);
  }, []);
  const step = done ? STEPS.length : STEPS.filter((s) => elapsed >= s.at).length - 1;
  // Eases towards 90% over ~20 s; the last tenth waits for the real answer.
  const pct = done ? 100 : Math.round(90 * (1 - Math.exp(-elapsed / 7000)));
  return (
    <div className="mt-4" role="status" aria-live="polite">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={tx("Picking jobs for you")}
      >
        <div
          className="h-full rounded-full bg-saffron-500 transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "now" : "next";
          return (
            <li key={s.label} className="flex items-center gap-2 font-body text-[13px]">
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  state === "done"
                    ? "border-saffron-500 bg-saffron-500 text-white"
                    : state === "now"
                      ? "animate-pulse border-saffron-500 motion-reduce:animate-none"
                      : "border-ink/25"
                }`}
              >
                {state === "done" ? <Check size={12} /> : null}
              </span>
              <span className={state === "next" ? "text-ink-mute" : "text-ink"}>{tx(s.label)}</span>
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden>
        {[0, 1, 2, 3].map((k) => (
          <li key={k} className="card-flat flex flex-col gap-2 p-4">
            <span className="h-3.5 w-2/3 animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
            <span className="h-3 w-1/2 animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
            <span className="h-3 w-full animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JobsForYou({ next }: { next: string }) {
  const tx = useTx();
  const { profileId } = useAuth();
  const { code } = useLanguage();
  const views = useRecentViews();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(2);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [landed, setLanded] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let live = true;
    void call("GET").then(({ status, json }) => {
      if (!live || status !== 200) return;
      setRemaining(Number(json["remaining"] ?? 0));
      setLimit(Number(json["limit"] ?? 2));
      if (json["last"]) setResult(json["last"] as MatchResult);
    });
    return () => {
      live = false;
    };
  }, [profileId]);

  const press = async () => {
    setBusy(true);
    setLanded(false);
    setNote(null);
    const recent = views.map((v) => v.title).slice(0, 15);
    const { status, json } = await call("POST", { recent, locale: code });
    // Let the bar reach the end before the results replace it.
    setLanded(true);
    await new Promise((r) => setTimeout(r, 450));
    setBusy(false);
    if (status === 200) {
      setResult(json["result"] as MatchResult);
      setRemaining(Number(json["remaining"] ?? 0));
    } else {
      if (json["last"]) setResult(json["last"] as MatchResult);
      if (status === 429) setRemaining(0);
      setNote(String(json["error"] ?? tx("Could not pick jobs right now.")));
    }
  };

  return (
    <section aria-labelledby="for-you-title" className="card-flat p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2
          id="for-you-title"
          className="flex items-center gap-2 font-display text-xl tracking-tight text-ink"
        >
          <Sparkles size={18} className="text-saffron-600" aria-hidden />
          {tx("Jobs for you")}
        </h2>
        <span className="grow" />
        {profileId ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void press()}
            disabled={busy || remaining === 0}
            aria-describedby="for-you-left"
          >
            {busy ? tx("Picking…") : result ? tx("Pick again") : tx("Find jobs for me")}
          </button>
        ) : (
          <a className="btn-ghost" href={`/auth?mode=login&next=${encodeURIComponent(next)}`}>
            {tx("Sign in to get jobs picked for you")}
          </a>
        )}
      </div>
      <p id="for-you-left" className="mt-1.5 font-body text-[13px] text-ink-mute">
        {profileId
          ? `${tx("Picked from your courses, skills and what you have viewed.")} ${
              remaining === null ? "" : `${remaining}/${limit} ${tx("left today")}`
            }`
          : tx(
              "We look at your courses, skills and what you have viewed, and pick openings that fit.",
            )}
      </p>
      {note && <p className="mt-2 font-body text-[13px] text-saffron-700">{note}</p>}

      {busy && <Tracker done={landed} />}

      {!busy && result && result.picks.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {result.picks.map((p) => {
            const inner = (
              <>
                <p className="font-body text-[14.5px] font-semibold leading-snug text-ink">
                  {p.title}
                </p>
                <p className="font-body text-[12.5px] text-ink-soft">
                  {[p.company, p.location].filter(Boolean).join(" · ") ||
                    (p.kind === "internship" ? tx("Internship") : tx("Job"))}
                </p>
                <p className="font-body text-[13px] leading-relaxed text-ink">{p.why}</p>
                <span className="grow" />
                <p className="flex items-center gap-1.5 font-body text-[11.5px] text-ink-mute">
                  {p.external
                    ? `${tx("Remote")} · ${tx("via")} ${p.source ?? ""}`
                    : tx("On स्वYAM")}
                  <span className="grow" />
                  <span className="inline-flex items-center gap-1 font-semibold text-saffron-700">
                    {tx("Open")}
                    <ArrowUpRight size={12} aria-hidden />
                  </span>
                </p>
              </>
            );
            return (
              <li key={p.id}>
                {p.external ? (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="card-flat flex h-full flex-col gap-1.5 p-4"
                  >
                    {inner}
                  </a>
                ) : (
                  <Link to={p.href} className="card-flat flex h-full flex-col gap-1.5 p-4">
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!busy && result && result.picks.length > 0 && (
        <p className="mt-3 font-body text-[12px] text-ink-mute">
          {result.picks.length} {tx("openings, best match first")}
        </p>
      )}
      {!busy && result && result.picks.length === 0 && (
        <p className="mt-3 font-body text-[13px] text-ink-mute">
          {tx("No openings fit yet. Add a skill or start a course, and try again tomorrow.")}
        </p>
      )}
      {!busy && result && (
        <p className="mt-3 font-body text-[11.5px] text-ink-mute">
          {result.by === "gemini"
            ? tx(
                "Picked with Google Gemini from real openings only. Check the details before you apply.",
              )
            : tx(
                "Picked by matching your skills and courses (the AI was busy). Check the details before you apply.",
              )}
        </p>
      )}
    </section>
  );
}
