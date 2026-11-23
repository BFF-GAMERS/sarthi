import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Reveal } from "../components/Reveal";
import { useTx } from "../lib/i18n";

/**
 * The page that isn't there.
 *
 * The old one was a big 404, a line of apology and a Go home button, which
 * is the shape every 404 has and helps nobody: a person who mistyped a URL
 * or followed a dead link does not want the front page, they wanted a
 * particular thing. So this one does the two useful things instead — it
 * searches for whatever was in the address, and it offers the handful of
 * places anything on this site actually lives.
 *
 * The guess is honest about being a guess. "/coursse/welding" becomes a
 * search for "welding", not a claim that we know what they meant.
 */

/** The words out of a path, minus ids, slugs' hyphens and file extensions. */
function guessFrom(pathname: string): string {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return last
    .replace(/\.[a-z]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b[0-9a-f]{8,}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

const PLACES = [
  { to: "/courses" as const, label: "Courses", note: "39 of them, 19 free" },
  { to: "/jobs" as const, label: "Jobs", note: "Openings posted by employers" },
  { to: "/internships" as const, label: "Internships", note: "For a first job" },
  { to: "/schemes" as const, label: "Government schemes", note: "18, explained plainly" },
  { to: "/skills" as const, label: "Skills", note: "And what teaches them" },
  { to: "/community" as const, label: "Community", note: "Ask, and answer" },
];

export default function NotFound() {
  const tx = useTx();
  const { pathname } = useLocation();
  const [q, setQ] = useState(() => guessFrom(pathname));

  /*
   * Say so in the tab as well as on the page.
   *
   * This is the root route's notFoundComponent, not a route of its own, so
   * it inherits the root's <title> — which is the home page's. Somebody who
   * followed a dead link got a tab and a browser-history entry reading
   * "Learn a skill. Get hired.", which is the one place they were not. The
   * status code is already a correct 404; this is for the human.
   */
  useEffect(() => {
    document.title = "Page not found — स्वYAM";
  }, []);

  return (
    <div className="container-x pb-24 pt-32">
      <Reveal>
        <p className="datum">{tx("404")}</p>
        <h1 className="section-title mt-3">{tx("That page isn't here")}</h1>
        <p className="mt-4 max-w-xl font-body text-[15px] leading-relaxed text-ink-soft">
          {tx(
            "It may have moved, or the address may have a typo in it. Nothing is broken on your side.",
          )}
        </p>
        {/* Said plainly, because a person who typed it wants to know which
            part was wrong. */}
        <p className="mt-2 max-w-xl break-all font-mono text-[12px] text-ink-mute">{pathname}</p>
      </Reveal>

      <Reveal className="mt-8">
        <form
          role="search"
          action="/search"
          className="flex max-w-xl items-center gap-2 rounded-[var(--radius-pill)] border bg-paper-light p-1.5 pl-5 [border-color:var(--color-field-line)]"
        >
          <Search size={18} className="shrink-0 text-ink-mute" aria-hidden />
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={tx("Search the site")}
            placeholder={tx("Search a skill, a course, or a job…")}
            className="min-w-0 flex-1 bg-transparent py-2.5 font-body text-[15px] text-ink outline-none placeholder:text-ink-mute"
          />
          <button type="submit" className="btn-primary !px-5 !py-2.5">
            {tx("Search")}
          </button>
        </form>
        {q && (
          <p className="mt-2 font-body text-[12.5px] text-ink-mute">
            {tx("Taken from the address you came in on — change it if it guessed wrong.")}
          </p>
        )}
      </Reveal>

      <Reveal className="mt-12">
        <h2 className="font-display text-lg tracking-tight text-ink">
          {tx("Everything on this site is in one of these")}
        </h2>
        <ul className="mt-4 grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
          {PLACES.map((p) => (
            <li key={p.to}>
              <Link
                to={p.to}
                className="card-flat flex items-center gap-3 p-4 transition-colors hover:border-saffron-300"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[14px] font-semibold text-ink">
                    {tx(p.label)}
                  </span>
                  <span className="block font-body text-[12.5px] text-ink-mute">{tx(p.note)}</span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-ink-mute" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="mt-10">
        <p className="font-body text-[13px] text-ink-mute">
          {tx("Still stuck?")}{" "}
          <Link to="/contact" className="text-saffron-700 underline-offset-2 hover:underline">
            {tx("Tell us what you were looking for")}
          </Link>
          {tx(" — a dead link is our bug, not yours.")}
        </p>
      </Reveal>
    </div>
  );
}
