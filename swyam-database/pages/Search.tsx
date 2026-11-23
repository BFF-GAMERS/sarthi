import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { CourseCard, OrgCard } from "../components/Cards";
import { courses, organizations, mentors, posts, categories, states } from "../data/mock";
import { useTx } from "../lib/i18n";
import SearchBox from "../components/SearchBox";
import OpportunityCard from "../components/OpportunityCard";
import { listOpportunities } from "../lib/opportunities";
import { searchPeople } from "../lib/people";
import { initialsAvatar } from "../lib/avatar";
import { track, EV } from "@/evolution";

const TABS = [
  "All",
  "People",
  "Courses",
  "Jobs",
  "Internships",
  "Organizations",
  "Mentors",
  "Posts",
] as const;

export default function SearchPage() {
  const tx = useTx();
  const { q = "" } = useSearch({ from: "/search" });
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [state, setState] = useState("All");
  const [cat, setCat] = useState("All");

  /*
   * People come from the database, so this one query is deferred: the page
   * re-navigates on every keystroke, and a round trip per letter is a lot of
   * work to throw away. Everything else here is filtered in memory and is
   * cheap enough to run as you type.
   */
  /*
   * Openings come from the database, like the rest of the site.
   *
   * This page searched the mock jobs and internships in data/mock while
   * /jobs and /internships list the real ones an employer posted. So a
   * search could return a job that exists nowhere else on the platform, and
   * could not find the five that do. Whatever else search does, it has to
   * agree with the pages it sends people to.
   */
  const openings = useQuery({
    queryKey: ["opportunities", "all"],
    queryFn: () => listOpportunities(),
    staleTime: 5 * 60_000,
  });

  const deferredQ = useDeferredValue(q);
  const people = useQuery({
    queryKey: ["search-people", deferredQ],
    queryFn: () => searchPeople(deferredQ),
    enabled: deferredQ.trim().replace(/^@+/, "").length >= 2,
    staleTime: 60_000,
  });
  /* A failed lookup means no People section, not a broken search page. */
  const peopleHits = people.data ?? [];

  const ql = q.toLowerCase();
  const match = (s: string) => ql === "" || s.toLowerCase().includes(ql);

  /*
   * One haystack per record, rather than three hand-picked fields.
   *
   * "python" used to return a single internship: courses were matched on
   * title, category and overview only, so a Python course whose syllabus,
   * outcomes and trainer all say Python — but whose title says "Backend
   * fundamentals" — was invisible. Jobs ignored the employer and the
   * description; mentors ignored their own role and company.
   *
   * Built once per catalogue rather than per keystroke: the source is static,
   * so there is no reason to re-lowercase every syllabus on every character.
   */
  const haystacks = useMemo(() => {
    const org = (id: string) => organizations.find((o) => o.id === id)?.name ?? "";
    const join = (...parts: Array<string | string[] | undefined>) =>
      parts.flat().filter(Boolean).join(" ").toLowerCase();

    return {
      courses: new Map(
        courses.map((c) => [
          c.id,
          join(
            c.title,
            c.category,
            c.overview,
            c.outcomes,
            c.certification,
            c.group,
            c.mode,
            c.trainer?.name,
            org(c.orgId),
            c.curriculum?.flatMap((m) => [m.module, ...m.topics]),
            c.projects,
          ),
        ]),
      ),
      mentors: new Map(mentors.map((m) => [m.id, join(m.name, m.role, m.company, m.expertise)])),
    };
  }, []);

  const results = useMemo(() => {
    const hit = (map: Map<string, string>, id: string) =>
      ql === "" || (map.get(id) ?? "").includes(ql);

    const fc = courses.filter(
      (c) =>
        hit(haystacks.courses, c.id) &&
        (state === "All" || c.state === state) &&
        (cat === "All" || c.category === cat),
    );
    /*
     * State is matched against the opening's own location text rather than a
     * state field, because an opening does not carry one — an employer writes
     * "Gurugram, Haryana". Matching the words is honest about what we know.
     */
    const inState = (o: { location: string | null; region: string | null }) =>
      state === "All" ||
      `${o.location ?? ""} ${o.region ?? ""}`.toLowerCase().includes(state.toLowerCase());
    const live = (openings.data ?? []).filter(
      (o) =>
        inState(o) &&
        (ql === "" ||
          [o.title, o.summary, o.location, o.region, o.employer?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(ql)),
    );
    const fj = live.filter((o) => o.kind !== "internship");
    const fi = live.filter((o) => o.kind === "internship");
    const fo = organizations.filter((o) => match(o.name) || match(o.about));
    const fm = mentors.filter((m) => hit(haystacks.mentors, m.id));
    const fp = posts.filter((p) => match(p.text) || match(p.author));
    return { fc, fj, fi, fo, fm, fp };
  }, [ql, state, cat, haystacks, openings.data]);

  const total =
    peopleHits.length +
    results.fc.length +
    results.fj.length +
    results.fi.length +
    results.fo.length +
    results.fm.length +
    results.fp.length;

  return (
    <div className="container-x pb-24 pt-28">
      <Reveal>
        <h1 className="section-title">{tx("Explore everything")}</h1>
        <div className="mt-8">
          <SearchBox
            value={q}
            autoFocus
            onChange={(v) => navigate({ to: "/search", search: v ? { q: v } : {}, replace: true })}
            onSubmit={(v) => navigate({ to: "/search", search: v ? { q: v } : {}, replace: true })}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tx("Result type")}>
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  if (t !== tab) track(EV.FILTER_USED, { surface: "search", filter: "tab" });
                  setTab(t);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t
                    ? "bg-saffron-500 text-on-accent"
                    : "bg-paper-dim text-ink-soft hover:text-paper-light"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <select
              value={cat}
              onChange={(e) => {
                track(EV.FILTER_USED, { surface: "search", filter: "category" });
                setCat(e.target.value);
              }}
              className="input !w-auto !py-1.5 text-sm"
              aria-label={tx("Category filter")}
            >
              <option>{tx("All")}</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={state}
              onChange={(e) => {
                track(EV.FILTER_USED, { surface: "search", filter: "state" });
                setState(e.target.value);
              }}
              className="input !w-auto !py-1.5 text-sm"
              aria-label={tx("State filter")}
            >
              <option>{tx("All")}</option>
              {states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </Reveal>

      <p className="mt-8 text-sm text-ink-mute" role="status">
        {total} results{q && <> for “{q}”</>}
      </p>

      {/*
        People first when they match.

        Somebody typing a name is looking for that person, not for a course
        with the same word in its syllabus. Everything else on this page is
        a catalogue you browse; this is the one result that is a someone.
      */}
      {(tab === "All" || tab === "People") && peopleHits.length > 0 && (
        <Section title={tx("People")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {peopleHits.map((p) => (
              <Link
                key={p.id}
                to="/u/$handle"
                params={{ handle: p.handle }}
                className="card flex items-center gap-3 p-4"
              >
                <img
                  loading="lazy"
                  decoding="async"
                  src={p.avatarUrl || initialsAvatar(p.name)}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-body text-[14px] font-semibold text-ink">
                    {p.name}
                    {/* Said plainly. These are seeded accounts, and letting
                        somebody write to one believing it is a stranger who
                        might write back is the kind of small lie that costs
                        a product its credibility. */}
                    {p.isDemo && <span className="chip !py-0 !text-[10px]">{tx("Sample")}</span>}
                    {p.isAi && <span className="chip !py-0 !text-[10px]">{tx("AI")}</span>}
                  </p>
                  <p className="truncate font-mono text-[11px] text-ink-mute">@{p.handle}</p>
                  {p.headline && (
                    <p className="mt-0.5 truncate font-body text-[12px] text-ink-soft">
                      {p.headline}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {(tab === "All" || tab === "Courses") && results.fc.length > 0 && (
        <Section title={tx("Courses")}>
          <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 card-grid">
            {results.fc.map((c) => (
              <StaggerItem key={c.id}>
                <CourseCard course={c} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}
      {(tab === "All" || tab === "Jobs") && results.fj.length > 0 && (
        <Section title={tx("Jobs")}>
          <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2 card-grid">
            {results.fj.map((o) => (
              <StaggerItem key={o.id}>
                <OpportunityCard opportunity={o} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}
      {(tab === "All" || tab === "Internships") && results.fi.length > 0 && (
        <Section title={tx("Internships")}>
          <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2 card-grid">
            {results.fi.map((o) => (
              <StaggerItem key={o.id}>
                <OpportunityCard opportunity={o} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}
      {(tab === "All" || tab === "Organizations") && results.fo.length > 0 && (
        <Section title={tx("Institutes & companies")}>
          <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 card-grid">
            {results.fo.map((o) => (
              <StaggerItem key={o.id}>
                <OrgCard org={o} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}
      {(tab === "All" || tab === "Mentors") && results.fm.length > 0 && (
        <Section title={tx("Mentors")}>
          <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {results.fm.map((m) => (
              <StaggerItem key={m.id}>
                <div className="card p-5 text-center">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={m.avatar}
                    alt=""
                    className="mx-auto h-16 w-16 rounded-full ring-2 ring-saffron-500/50"
                  />
                  <p className="mt-3 font-display font-medium text-ink">{m.name}</p>
                  <p className="text-sm text-ink-mute">
                    {m.role} · {m.company}
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {m.expertise.slice(0, 2).map((e) => (
                      <span key={e} className="chip !text-[11px]">
                        {e}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-mute">
                    {m.rating > 0 && <>⭐ {m.rating} · </>}
                    {m.mentees} mentees
                  </p>
                  <Link to="/messages" className="btn-ghost mt-3 w-full !py-1.5 text-xs">
                    {tx("Request mentorship")}
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}
      {(tab === "All" || tab === "Posts") && results.fp.length > 0 && (
        <Section title={tx("Community posts")}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {results.fp.map((p) => (
              <Link key={p.id} to="/community" className="card block p-5">
                <div className="flex items-center gap-3">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={p.avatar}
                    alt=""
                    className="h-9 w-9 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">{p.author}</p>
                    <p className="text-xs text-ink-mute">{p.role}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{p.text}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {total === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-ink-line p-10 text-center">
          <p className="font-display text-xl text-ink">
            {q ? `${tx("Nothing matches")} “${q}”` : tx("Search the whole site")}
          </p>
          <p className="mx-auto mt-2 max-w-md font-body text-[13.5px] leading-relaxed text-ink-mute">
            {q
              ? tx(
                  "Try one word rather than a sentence, or a trade rather than a job title — the catalog is named the way an institute names a course.",
                )
              : tx(
                  "People, courses, jobs, internships, institutes, mentors, schemes and posts, all at once.",
                )}
          </p>
          {/* Real starting points, from the catalogue this site actually has. */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {categories.slice(0, 6).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => navigate({ to: "/search", search: { q: c }, replace: true })}
                className="filter-pill !h-9 !px-3 !text-[12px]"
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/courses" className="btn-ghost !py-2.5 !text-xs">
              {tx("Browse all courses")}
            </Link>
            <Link to="/jobs" className="btn-ghost !py-2.5 !text-xs">
              {tx("Browse openings")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <Reveal>
        <h2 className="mb-5 font-display text-xl font-semibold text-ink">{title}</h2>
      </Reveal>
      {children}
    </section>
  );
}
