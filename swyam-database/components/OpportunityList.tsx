import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";
import OpportunityCard from "./OpportunityCard";
import LocationBar, { defaultLocationState, type LocationState } from "./LocationBar";
import { byDistance, DISTANCE_OPTIONS, distanceFor } from "../lib/location";
import { listOpportunities, matchAgainst, payLine, type Opportunity } from "../lib/opportunities";
import { listTeachSkills } from "../lib/skillswap";
import { useAuth } from "../context/AuthContext";
import { useTx } from "../lib/i18n";
import { PaintedPanel, SloganPlate } from "./Ornaments";
import JobAlerts from "./JobAlerts";
import { track, EV } from "@/evolution";
import { useListReturn } from "./return/useListReturn";

/**
 * The listing page behind both /jobs and /internships.
 *
 * One component rather than two nearly-identical ones, because the pair had
 * already drifted: the filters, the empty state and the distance sort were
 * copied and then edited on one side only. A job and an internship differ in
 * two facts — how they pay and whether they end — and both are handled by the
 * card. Everything else was duplication waiting to disagree with itself.
 */

type Kind = "job" | "internship";

const MODES = [
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "On-site" },
] as const;

export default function OpportunityList({ kind, picks }: { kind: Kind; picks?: ReactNode }) {
  const tx = useTx();
  // Back from a listing: same scroll, and the card you opened says "You were here".
  useListReturn(kind === "job" ? "jobs" : "internships");
  const { profileId } = useAuth();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState<LocationState>(defaultLocationState);
  const [modes, setModes] = useState<string[]>([]);
  const [paidOnly, setPaidOnly] = useState(false);
  const [matchOnly, setMatchOnly] = useState(false);

  const list = useQuery({
    queryKey: ["opportunities", kind],
    queryFn: () => listOpportunities(kind),
  });

  // Their own skills, so a match can be shown. Absent when logged out, and the
  // page is expected to work perfectly well without it.
  const mine = useQuery({
    queryKey: ["my-skills", profileId],
    queryFn: () => listTeachSkills(profileId!),
    enabled: Boolean(profileId),
  });
  const mySkills = useMemo(() => (mine.data ?? []).map((s) => s.skill.name), [mine.data]);

  const maxKm = DISTANCE_OPTIONS.find((d) => d.id === loc.distance)?.km ?? Infinity;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = list.data ?? [];

    return all
      .map((o: Opportunity) => ({
        o,
        km: distanceFor(loc.city, o.location ?? "", o.workMode === "remote"),
        match: mySkills.length ? matchAgainst(o, mySkills) : null,
      }))
      .filter(({ o, km, match }) => {
        if (loc.remoteOnly && o.workMode !== "remote") return false;
        if (loc.city && maxKm !== Infinity && (km === null || km > maxKm)) return false;
        if (modes.length && !modes.includes(o.workMode)) return false;
        if (paidOnly && !payLine(o)) return false;
        if (matchOnly && (!match || match.score < 50)) return false;

        if (!needle) return true;
        return [o.title, o.summary, o.employer?.name, o.location, ...o.skills]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(needle));
      })
      .sort(loc.city ? byDistance((r) => r.km) : () => 0);
  }, [list.data, q, loc, maxKm, modes, paidOnly, matchOnly, mySkills]);

  // Behaviour events carry the surface and WHICH control moved, never a typed value.
  const surface = kind === "job" ? "jobs" : "internships";
  // Weak list signals (affinity only): a filter or search on this page never adapts the app on its own.
  const filterUsed = (filter: string) => track(EV.LIST_FILTERED, { surface, filter });
  const committed = useRef("");
  const commitSearch = () => {
    const t = q.trim().toLowerCase();
    if (t && t !== committed.current) {
      committed.current = t;
      track(EV.LIST_SEARCHED, { surface });
    }
  };
  const onLoc = (next: LocationState) => {
    for (const k of Object.keys(next) as (keyof LocationState)[]) {
      if (next[k] !== loc[k]) filterUsed(k === "city" || k === "state" ? "location" : k);
    }
    setLoc(next);
  };

  const toggleMode = (id: string) => {
    filterUsed("mode");
    setModes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clear = () => {
    setQ("");
    setLoc(defaultLocationState);
    setModes([]);
    setPaidOnly(false);
    setMatchOnly(false);
  };

  const filtered = q || modes.length || paidOnly || matchOnly || loc.city || loc.remoteOnly;
  const total = (list.data ?? []).length;

  return (
    <div className="container-x max-w-6xl pb-24 pt-28">
      <Reveal>
        <SloganPlate tone="indigo">{kind === "job" ? tx("Jobs") : tx("Internships")}</SloganPlate>
        <h1 className="section-title mt-3">
          {kind === "job" ? tx("Work that pays for the skill") : tx("Learn on the job")}
        </h1>
        <p className="type-lede mt-4 max-w-2xl">
          {kind === "job"
            ? tx(
                "Openings posted by employers on स्वYAM. Every one says what the work is, who qualifies, and what happens after you apply.",
              )
            : tx(
                "Paid and unpaid placements where the point is what you learn. Many ask for willingness to learn rather than a degree.",
              )}
        </p>
      </Reveal>

      {/*
        Getting the CV right is worth more than any filter on this page, and
        the first version did not look like it. A wide low-contrast card with a
        small grey link on the end reads as a banner, and people have learned
        to skip banners — it sat above the fold and still got missed.
        A painted panel and a real primary button say it is an action.
      */}
      <Reveal className="mt-6">
        <PaintedPanel tone="rani" className="bg-paper-light">
          {/*
            Stacked on a phone — icon, heading, line, full-width button —
            and a single row from `sm` up. The old `flex-wrap` row let the
            icon and the button claim their widths first and squeezed the
            text into whatever was left, which on a 360px screen was a
            column three words wide.
          */}
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-x-5">
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center"
              style={{ border: "2px solid var(--color-rani)", borderRadius: 2 }}
            >
              <FileText size={18} style={{ color: "var(--color-rani)" }} />
            </span>

            <span className="min-w-0 sm:flex-1">
              <span className="block font-display text-[17px] leading-tight tracking-tight text-ink">
                {tx("Check your CV before you apply")}
              </span>
              <span className="mt-0.5 block font-body text-[12.5px] leading-snug text-ink-soft">
                {tx(
                  "Most applications are rejected by automated screening that never tells you why. Find out what yours would trip on.",
                )}
              </span>
            </span>

            <Link
              to="/cv"
              className="btn-primary w-full justify-center !py-3 !text-xs sm:w-auto sm:shrink-0 sm:!py-2.5"
            >
              <FileText size={14} aria-hidden />
              {tx("Improve my CV")}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </PaintedPanel>
      </Reveal>

      {/* "Jobs for you" — personal picks, under the heading and above the full list. */}
      {picks && <div className="mt-7">{picks}</div>}

      <Reveal className="mt-7">
        <LocationBar value={loc} onChange={onLoc} />
      </Reveal>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[13rem] flex-1 sm:max-w-sm">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={commitSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSearch();
            }}
            placeholder={
              kind === "job" ? tx("Search a role or employer…") : tx("Search an internship…")
            }
            aria-label={tx("Search")}
            className="input !py-2 !pl-9 !text-[13px]"
          />
        </div>

        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => toggleMode(m.id)}
            aria-pressed={modes.includes(m.id)}
            className="filter-pill"
          >
            {tx(m.label)}
          </button>
        ))}

        <button
          onClick={() => {
            filterUsed("paid");
            setPaidOnly((v) => !v);
          }}
          aria-pressed={paidOnly}
          className="filter-pill"
        >
          {kind === "job" ? tx("Salary shown") : tx("Paid only")}
        </button>

        {mySkills.length > 0 && (
          <button
            onClick={() => {
              filterUsed("match");
              setMatchOnly((v) => !v);
            }}
            aria-pressed={matchOnly}
            className="filter-pill"
          >
            <SlidersHorizontal size={12} aria-hidden /> {tx("Good match for me")}
          </button>
        )}

        {filtered && (
          <button onClick={clear} className="btn-ghost !px-3 !py-1.5 !text-[11px]">
            <X size={12} aria-hidden /> {tx("Clear")}
          </button>
        )}
      </div>

      <p className="mt-5 font-body text-[12px] text-ink-mute">
        {list.isLoading
          ? tx("Loading openings…")
          : `${rows.length} ${rows.length === 1 ? tx("opening") : tx("openings")}${
              filtered && rows.length !== total ? ` ${tx("of")} ${total}` : ""
            }`}
      </p>

      {/*
        A short list is stated as a short list. The number above is the real
        one; this line says why it is small and what to do about it, instead
        of leaving the visitor to wonder whether the page is broken.
      */}
      {!list.isLoading && !list.isError && total > 0 && total < 12 && (
        <p className="mt-2 max-w-2xl font-body text-[12.5px] leading-relaxed text-ink-soft">
          {tx(
            "स्वYAM is new and employers are still joining, so the list is short. Everything on it is a real opening; set an alert below and you will hear the day something new fits.",
          )}
        </p>
      )}

      {list.isError ? (
        <p className="mt-10 font-body text-sm text-danger">
          {tx("The openings could not be loaded. Refresh and try again.")}
        </p>
      ) : rows.length === 0 && !list.isLoading ? (
        <div className="mt-10 panel p-8 text-center">
          <p className="font-display text-lg tracking-tight text-ink">
            {tx("Nothing matches that")}
          </p>
          <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink-soft">
            {tx(
              "Widen the distance, drop a filter, or look at the other side — plenty of people find their first role in a category they were not searching for.",
            )}
          </p>
          {filtered && (
            <button onClick={clear} className="btn-primary mt-5 !py-2.5 !text-xs">
              {tx("Clear the filters")}
            </button>
          )}
        </div>
      ) : (
        <Stagger className="card-grid mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ o, km, match }) => (
            <StaggerItem key={o.id}>
              <OpportunityCard opportunity={o} match={match} distanceKm={km} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <div className="mt-12">
        <JobAlerts />
      </div>
    </div>
  );
}
