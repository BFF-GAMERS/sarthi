import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { TabsHint, useTabPlan } from "@/evolution/react/use-tab-plan";
import { ArrowUpRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { courses, orgById, categories } from "@/data/mock";
import { listOpportunities, payLine, type Opportunity } from "@/lib/opportunities";
import SkillMatcher from "@/components/SkillMatcher";
import { track, EV } from "@/evolution";

const TITLE = "Everything open right now — courses, internships and jobs | स्वYAM";
const DESC =
  "Every course, internship and job on स्वYAM in one list. Filter by kind and track, then open the one you want.";

/**
 * `?kind=` preselects a filter, so a single "Jobs & Internships" entry in the
 * navigation can land here already narrowed to paid work rather than making
 * someone filter courses out by hand.
 */
type KindParam = "all" | "course" | "internship" | "job" | "work";

const isKindParam = (v: unknown): v is KindParam =>
  v === "all" || v === "course" || v === "internship" || v === "job" || v === "work";

const KIND_TABS: readonly KindParam[] = ["all", "work", "course", "internship", "job"];

export const Route = createFileRoute("/opportunities")({
  // Optional on purpose: every existing link to this page carries no search
  // params, and making `kind` required would break all of them.
  // `remote` and `free` arrive from "Say it" ("remote internships", "free courses"); kept as 1 so the URL reads ?remote=1.
  validateSearch: (
    search: Record<string, unknown>,
  ): { kind?: KindParam; remote?: 1; free?: 1 } => ({
    ...(isKindParam(search["kind"]) ? { kind: search["kind"] } : {}),
    ...(String(search["remote"]) === "1" ? { remote: 1 as const } : {}),
    ...(String(search["free"]) === "1" ? { free: 1 as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: MatrixPage,
});

type Kind = "course" | "internship" | "job";

interface Entry {
  id: string;
  kind: Kind;
  title: string;
  org: string;
  image: string;
  category: string;
  place: string;
  /** Three ruled columns of data, mono-set. */
  cols: [string, string][];
  href: string;
  note: string;
  free?: boolean;
  remote?: boolean;
}

const KIND_LABEL: Record<Kind, string> = {
  course: "Course",
  internship: "Internship",
  job: "Job",
};

function buildIndex(openings: Opportunity[]): Entry[] {
  const out: Entry[] = [];

  for (const c of courses) {
    const org = orgById(c.orgId);
    out.push({
      id: c.id,
      kind: "course",
      title: c.title,
      org: org?.name ?? "",
      image: c.hero,
      category: c.category,
      place: `${c.city}, ${c.state}`,
      cols: [
        ["Duration", c.duration],
        ["Fee", c.free ? "Free" : c.fees],
        ["Format", c.mode],
      ],
      href: `/courses/${c.id}`,
      note: c.overview,
      free: c.free,
      remote: /online|remote/i.test(String(c.mode)),
    });
  }

  // Jobs and internships come from the database — the same rows /jobs and
  // /internships show, and the only ones that exist. The mock catalogue this
  // index used to read had ninety openings; clicking any of them opened
  // "That opening is no longer listed", because it had never been listed.
  for (const o of openings) {
    const internship = o.kind === "internship";
    out.push({
      id: o.slug,
      kind: internship ? "internship" : "job",
      title: o.title,
      org: o.employer?.name ?? "",
      image: o.employer?.logoUrl ?? "",
      category: o.employer?.industry ?? "",
      place: o.location ?? (o.workMode === "remote" ? "Remote" : ""),
      cols: internship
        ? [
            ["Duration", o.durationWeeks ? `${o.durationWeeks} weeks` : "Not stated"],
            ["Stipend", payLine(o) ?? "Not stated"],
            ["Format", o.workMode.replace("_", " ")],
          ]
        : [
            ["Pay", payLine(o) ?? "Not stated"],
            ["Openings", String(o.openings)],
            ["Format", o.workMode.replace("_", " ")],
          ],
      href: internship ? `/internships/${o.slug}` : `/jobs/${o.slug}`,
      note: o.summary ?? o.description?.slice(0, 220) ?? "",
      remote: o.workMode === "remote",
    });
  }

  return out;
}

function MatrixPage() {
  const openings = useQuery({
    queryKey: ["opportunities", "all"],
    queryFn: () => listOpportunities(),
  });
  const index = useMemo(() => buildIndex(openings.data ?? []), [openings.data]);
  const nJobs = (openings.data ?? []).filter((o) => o.kind === "job").length;
  const nInternships = (openings.data ?? []).length - nJobs;
  const { kind: kindParam, remote: remoteParam, free: freeParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const onlyRemote = remoteParam === 1;
  const onlyFree = freeParam === 1;
  const dropNarrow = (which: "remote" | "free" | "both") =>
    void navigate({
      search: (s) => ({
        ...s,
        ...(which !== "free" ? { remote: undefined } : {}),
        ...(which !== "remote" ? { free: undefined } : {}),
      }),
      replace: true,
    });
  const [query, setQuery] = useState("");
  // "work" is not a row kind — it is the pair of them, so it lives beside the
  // single-kind filter rather than inside `Kind`.
  const kindPlan = useTabPlan("opportunities", KIND_TABS, { explicit: kindParam });
  const [pickedKind, setPickedKind] = useState<KindParam | null>(null);
  const kind: KindParam = pickedKind ?? kindPlan.defaultId;
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return index.filter((e) => {
      // "work" is the pair — an internship and a job are the same search to
      // most people, just a different contract length.
      if (kind === "work" && e.kind === "course") return false;
      if (kind !== "all" && kind !== "work" && e.kind !== kind) return false;
      if (category && e.category !== category) return false;
      if (onlyRemote && !e.remote) return false;
      // Openings never charge the learner; "free" only drops paid courses.
      if (onlyFree && e.kind === "course" && !e.free) return false;
      if (!q) return true;
      return `${e.title} ${e.org} ${e.category} ${e.place}`.toLowerCase().includes(q);
    });
  }, [index, query, kind, category, onlyRemote, onlyFree]);

  const activeFilters =
    (kind !== "all" ? 1 : 0) +
    (category ? 1 : 0) +
    (query ? 1 : 0) +
    (onlyRemote ? 1 : 0) +
    (onlyFree ? 1 : 0);

  return (
    <div className="relative z-10">
      {/* ══ MASTHEAD ═══════════════════════════════════════════ */}
      <section className="relative border-b border-ink-line">
        <div className="container-x relative pb-12 pt-32 lg:pt-40">
          <div className="flex items-center gap-3">
            <p className="kicker">Courses, internships and jobs</p>
          </div>
          <h1 className="type-hero mt-6 font-display text-ink">
            Everything open
            <span className="block text-saffron-500">right now.</span>
          </h1>
          <p className="type-lede mt-6 max-w-2xl text-ink-soft">
            {openings.isLoading
              ? `${courses.length} courses, and the openings are loading.`
              : `${courses.length} courses, ${nInternships} ${nInternships === 1 ? "internship" : "internships"} and ${nJobs} ${nJobs === 1 ? "job" : "jobs"}, all live. Open any row to see what you would be walking into.`}
          </p>
        </div>
      </section>

      {/* ══ SKILL MATCHER ═════════════════════════════════════ */}
      <SkillMatcher />

      {/* ══ FILTER BAR ════════════════════════════════════════ */}
      <section className="border-b border-ink-line bg-paper/95">
        <div className="container-x py-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex min-w-[15rem] flex-1 items-center">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 z-10 text-ink-mute"
                aria-hidden
              />
              <span className="sr-only">Search listings</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search trade, employer or district"
                className="input !pl-10"
              />
            </label>

            <div className="flex flex-wrap items-center gap-1.5">
              {kindPlan.order.map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    if (k !== kind)
                      track(EV.FILTER_USED, { surface: "opportunities", filter: "kind" });
                    setPickedKind(k);
                    kindPlan.onSelect(k);
                  }}
                  aria-pressed={kind === k}
                  className="filter-pill"
                >
                  {k === "all" ? "All" : k === "work" ? "Jobs & internships" : KIND_LABEL[k]}
                </button>
              ))}
            </div>

            <span className="datum ml-auto flex items-center gap-1.5">
              <SlidersHorizontal size={12} aria-hidden />
              {rows.length} / {index.length}
            </span>
          </div>

          {kindPlan.arranged && <TabsHint className="mt-2" />}

          {/* Track filter — horizontally scrollable, never wraps into a wall */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  track(EV.FILTER_USED, { surface: "opportunities", filter: "category" });
                  setCategory((v) => (v === c ? null : c));
                }}
                aria-pressed={category === c}
                className="filter-pill shrink-0"
              >
                {c}
              </button>
            ))}
            {onlyRemote && (
              <button
                type="button"
                onClick={() => dropNarrow("remote")}
                className="filter-pill evo-choice-on shrink-0"
                aria-label="Remote only. Remove this filter"
              >
                Remote only <X size={11} aria-hidden />
              </button>
            )}
            {onlyFree && (
              <button
                type="button"
                onClick={() => dropNarrow("free")}
                className="filter-pill evo-choice-on shrink-0"
                aria-label="Free only. Remove this filter"
              >
                Free only <X size={11} aria-hidden />
              </button>
            )}
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setQuery("");
                  setPickedKind("all");
                  setCategory(null);
                  if (onlyRemote || onlyFree) dropNarrow("both");
                }}
                className="btn-text ml-1 shrink-0"
              >
                <X size={11} aria-hidden /> Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ══ THE MATRIX ════════════════════════════════════════ */}
      <section className="container-x pb-20 pt-10">
        {/* Column header — the ruled index line */}
        <div className="hidden grid-cols-[3.5rem_1fr_repeat(3,8.5rem)_3rem] items-center gap-4 border-b border-ink-line pb-2 lg:grid">
          <span className="datum">Ref</span>
          <span className="datum">Listing</span>
          {["Term", "Value", "Format"].map((h) => (
            <span key={h} className="datum">
              {h}
            </span>
          ))}
          <span className="sr-only">Open</span>
        </div>

        {rows.length === 0 ? (
          <div className="border-b border-ink-line py-20 text-center">
            <p className="type-md font-display text-ink">Nothing matches that yet</p>
            <p className="mt-3 font-body text-sm text-ink-soft">
              Widen the track filter, or search a neighbouring district.
            </p>
            <button
              onClick={() => {
                setQuery("");
                setPickedKind("all");
                setCategory(null);
                if (onlyRemote || onlyFree) dropNarrow("both");
              }}
              className="btn-ghost mt-7"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul>
            {rows.map((e, i) => (
              <MatrixRow
                key={e.id}
                entry={e}
                num={i + 1}
                expanded={open === e.id}
                onEnter={() => setOpen(e.id)}
                onLeave={() => setOpen((v) => (v === e.id ? null : v))}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MatrixRow({
  entry,
  num,
  expanded,
  onEnter,
  onLeave,
}: {
  entry: Entry;
  num: number;
  expanded: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <li
      className="matrix-row group"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onLeave();
      }}
    >
      {/*
        The row itself is the link.

        The only way in used to be a "Quick apply" button inside the drawer,
        and the drawer only opened on hover — so on any touch device the whole
        index, 71 listings, was unreachable. Nothing here changes on the
        desktop hover; it just also works when you tap or click the row, which
        is what a row of results is expected to do.
      */}
      <Link
        to={entry.href}
        className="block text-inherit no-underline"
        aria-label={`${KIND_LABEL[entry.kind]}: ${entry.title} at ${entry.org}`}
      >
        <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-4 py-5 lg:grid-cols-[3.5rem_1fr_repeat(3,8.5rem)_3rem]">
          <span className="font-mono text-[11px] font-semibold tabular-nums text-ink-mute transition-colors group-hover:text-saffron-glow">
            {String(num).padStart(3, "0")}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="border border-current px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide">
                {KIND_LABEL[entry.kind]}
              </span>
              {entry.free && (
                <span className="bg-saffron-500 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-on-accent">
                  Free
                </span>
              )}
              <span className="font-mono text-[11px] uppercase tracking-wide opacity-70">
                {entry.place}
              </span>
            </div>
            <h2 className="mt-2 font-display text-xl leading-tight tracking-tight lg:text-2xl">
              {entry.title}
            </h2>
            <p className="mt-1 font-body text-sm opacity-75">{entry.org}</p>
          </div>

          {entry.cols.map(([label, value]) => (
            <div key={label} className="hidden lg:block">
              <p className="font-mono text-[10px] uppercase tracking-wide opacity-60">{label}</p>
              <p className="mt-0.5 font-body text-sm font-medium leading-snug">{value}</p>
            </div>
          ))}

          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center border-2 border-current transition-transform duration-300 group-hover:rotate-45"
          >
            <ArrowUpRight size={16} />
          </span>
        </div>
      </Link>

      {/* Hover-reveal drawer — thumbnail + the one action that matters */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-6 pb-7 sm:grid-cols-[13rem_1fr] lg:pl-[3.5rem]">
              <div className="relative aspect-[4/3] overflow-hidden border-paper-light/40">
                <motion.img
                  src={entry.image}
                  alt=""
                  loading="lazy"
                  initial={{ scale: 1.14 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full w-full object-cover contrast-[1.15] grayscale"
                />
                <div
                  className="halftone pointer-events-none absolute inset-0 opacity-25"
                  aria-hidden
                />
              </div>

              <div className="flex flex-col justify-between gap-5">
                <p className="max-w-2xl font-body text-sm leading-relaxed text-paper-deep">
                  {entry.note.length > 260 ? `${entry.note.slice(0, 257)}…` : entry.note}
                </p>

                {/* Mobile fallback for the ruled data columns */}
                <dl className="flex flex-wrap gap-x-8 gap-y-2 lg:hidden">
                  {entry.cols.map(([label, value]) => (
                    <div key={label}>
                      <dt className="font-mono text-[10px] uppercase tracking-wide opacity-60">
                        {label}
                      </dt>
                      <dd className="font-body text-sm font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={entry.href}
                    className="inline-flex items-center gap-2 border-paper-light bg-saffron-500 px-5 py-2.5 font-body text-xs font-semibold uppercase tracking-wider text-on-accent transition-colors hover:bg-paper-light"
                  >
                    Quick apply <ArrowUpRight size={15} aria-hidden />
                  </Link>
                  <Link
                    to={entry.href}
                    className="link-sweep font-mono text-xs font-semibold uppercase tracking-wider text-paper-light"
                  >
                    Full listing
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
