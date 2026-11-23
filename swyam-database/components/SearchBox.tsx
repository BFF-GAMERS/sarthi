import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock, Search as SearchIcon, X } from "lucide-react";
import { courses, categories } from "../data/mock";
import { schemes } from "../data/topics";
import { listOpportunities } from "../lib/opportunities";
import {
  clearSearches,
  forgetSearch,
  rememberSearch,
  useRecentSearches,
} from "../lib/search-history";
import { searchPeople } from "../lib/people";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";
import type { ServiceId } from "@/evolution";

/** What a picked suggestion tells the engine: its kind and domain, never its label or the typed text. A scheme says nothing. */
function trackSuggestion(kind: string): void {
  if (kind === "Scheme") return;
  const person = kind === "AI" || kind === "Sample account" || kind === "Person";
  const domain: ServiceId =
    kind === "Job" || kind === "Internship" ? "CAREER" : person ? "COMMUNITY" : "LEARNING";
  track(EV.SEARCH_PERFORMED, {
    surface: "search",
    suggestionKind: person ? "person" : kind.toLowerCase(),
    domain,
  });
  if (kind === "Category") track(EV.SKILL_SEARCHED, { surface: "search" });
}

/**
 * The search box, with the three things a search box owes you.
 *
 * It was a plain input: you typed the whole thing blind, pressed nothing,
 * and hoped the word you chose was the word the catalogue used. Now it
 * suggests as you type — from the real catalogue, never from a list of
 * invented "popular searches" — remembers the last five things you looked
 * for, and shows what there is to search when the box is empty.
 *
 * Every suggestion is a thing that exists: a course, an opening, a category,
 * a scheme. Choosing one goes straight to it; pressing Enter searches the
 * words instead, which is what a person who typed three words meant.
 */

interface Suggestion {
  label: string;
  kind: string;
  /** Where it goes. Absent means "search for this text". */
  to?: string;
}

export default function SearchBox({
  value,
  onChange,
  onSubmit,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Called when the person searches the words rather than picking an item. */
  onSubmit: (v: string) => void;
  autoFocus?: boolean;
}) {
  const tx = useTx();
  const navigate = useNavigate();
  const recent = useRecentSearches();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  // The openings are the only part of the catalogue that is not a constant.
  const openings = useQuery({
    queryKey: ["opportunities", "all"],
    queryFn: () => listOpportunities(),
    staleTime: 5 * 60_000,
  });

  const pool: Suggestion[] = useMemo(() => {
    const out: Suggestion[] = [
      ...courses.map((c) => ({ label: c.title, kind: "Course", to: `/courses/${c.id}` })),
      ...(openings.data ?? []).map((o) => ({
        label: o.title,
        kind: o.kind === "internship" ? "Internship" : "Job",
        to: o.kind === "internship" ? `/internships/${o.slug}` : `/jobs/${o.slug}`,
      })),
      ...categories.map((c) => ({ label: c, kind: "Category" })),
      ...schemes.map((s) => ({ label: s.name, kind: "Scheme", to: "/schemes" })),
    ];
    return out;
  }, [openings.data]);

  /*
   * People, from the database.
   *
   * Every other suggestion here is a constant this bundle already holds, so
   * it matches as you type. An account cannot be: there are as many of them
   * as there are members. The value is deferred so a round trip is not spent
   * on each keystroke of a name.
   */
  const deferred = useDeferredValue(value);
  const peopleTerm = deferred.trim().replace(/^@+/, "");
  const people = useQuery({
    queryKey: ["search-people", peopleTerm],
    queryFn: () => searchPeople(peopleTerm, 4),
    enabled: peopleTerm.length >= 2,
    staleTime: 60_000,
  });

  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (q.length < 2) return [];
    const starts: Suggestion[] = [];
    const holds: Suggestion[] = [];
    for (const s of pool) {
      const l = s.label.toLowerCase();
      if (l.startsWith(q)) starts.push(s);
      else if (l.includes(q)) holds.push(s);
      if (starts.length >= 8) break;
    }
    return [...starts, ...holds].slice(0, 8);
  }, [pool, q]);

  // Close when the click lands anywhere else.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const commit = (s: Suggestion) => {
    setOpen(false);
    trackSuggestion(s.kind);
    if (s.to) {
      rememberSearch(s.label);
      void navigate({ to: s.to });
    } else {
      onChange(s.label);
      rememberSearch(s.label);
      onSubmit(s.label);
    }
  };

  const submitText = () => {
    setOpen(false);
    if (value.trim()) track(EV.SEARCH_PERFORMED, { surface: "search" });
    rememberSearch(value);
    onSubmit(value);
  };

  /*
   * A person goes to the top.
   *
   * Someone typing a name wants that person, not a course whose syllabus
   * happens to contain the same word — and if the account is not what they
   * meant, it costs one row to find out. Four at most, so the catalogue
   * still gets most of the list.
   */
  const peopleRows: Suggestion[] = (people.data ?? []).map((p) => ({
    label: p.name,
    kind: p.isAi ? "AI" : p.isDemo ? "Sample account" : "Person",
    to: `/u/${p.handle}`,
  }));

  const rows: Suggestion[] =
    q.length >= 2
      ? [...peopleRows, ...matches].slice(0, 8)
      : recent.map((r) => ({ label: r, kind: "Recent" }));

  return (
    <div ref={box} className="relative">
      <div className="flex items-center gap-3 rounded-2xl border bg-paper-light p-2 pl-5 [border-color:var(--color-field-line)] focus-within:border-saffron-500 focus-within:shadow-[0_0_0_4px_rgb(207_58_11_/_0.14)]">
        <SearchIcon size={20} className="shrink-0 text-saffron-500" aria-hidden />
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setCursor(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setCursor((c) => Math.min(c + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const picked = rows[cursor];
              if (picked) commit(picked);
              else submitText();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open && rows.length > 0}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={cursor >= 0 ? `search-opt-${cursor}` : undefined}
          placeholder={tx("Search people, courses, jobs, schemes…")}
          className="w-full bg-transparent py-3 text-[16px] text-ink placeholder-ink-mute outline-none sm:text-lg"
          aria-label={tx("Search everything")}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onSubmit("");
            }}
            aria-label={tx("Clear the search")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-paper-dim hover:text-ink"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && rows.length > 0 && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-ink-line bg-paper-light shadow-[var(--shadow-float)]"
        >
          {q.length < 2 && (
            <li className="flex items-center justify-between gap-2 border-b border-ink-line px-4 py-2">
              <span className="datum">{tx("Recent")}</span>
              <button
                type="button"
                onClick={clearSearches}
                className="font-body text-[11.5px] text-ink-mute underline"
              >
                {tx("Clear")}
              </button>
            </li>
          )}
          {rows.map((s, i) => (
            <li
              key={`${s.kind}-${s.label}`}
              id={`search-opt-${i}`}
              role="option"
              aria-selected={cursor === i}
            >
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => commit(s)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  cursor === i ? "bg-paper-dim" : ""
                }`}
              >
                {s.kind === "Recent" ? (
                  <Clock size={14} className="shrink-0 text-ink-mute" aria-hidden />
                ) : (
                  <SearchIcon size={14} className="shrink-0 text-ink-mute" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate font-body text-[14px] text-ink">
                  {s.label}
                </span>
                <span className="shrink-0 font-body text-[11px] uppercase tracking-wide text-ink-mute">
                  {s.kind === "Recent" ? "" : tx(s.kind)}
                </span>
                {s.kind === "Recent" && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`${tx("Forget")} ${s.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      forgetSearch(s.label);
                    }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-paper-deep"
                  >
                    <X size={12} />
                  </span>
                )}
              </button>
            </li>
          ))}
          {q.length >= 2 && (
            <li className="border-t border-ink-line">
              <button
                type="button"
                onClick={submitText}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-body text-[13px] text-saffron-600"
              >
                <ArrowRight size={14} aria-hidden />
                {tx("Search everything for")} “{value}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
