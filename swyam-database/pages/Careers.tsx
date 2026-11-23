import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listCareerPaths, listMyGoals } from "../lib/career";
import { Reveal } from "../components/Reveal";
import { useTx } from "../lib/i18n";

/**
 * The eight career paths.
 *
 * They have been in the database the whole time — eight rows in
 * `career_paths`, forty-one skill requirements mapped to them, each with the
 * level it needs and the stage it belongs to. Nothing in this application had
 * ever read a single one of them.
 *
 * The page is deliberately plain: a path is a decision, and a decision page
 * that decorates itself is harder to decide from. Titles, what the job is
 * actually called on a listing, and how many skills stand between here and
 * there.
 */
export default function Careers() {
  const tx = useTx();
  const { profileId } = useAuth();

  const paths = useQuery({ queryKey: ["career-paths"], queryFn: listCareerPaths });

  const goals = useQuery({
    queryKey: ["my-goals", profileId],
    queryFn: () => listMyGoals(profileId!),
    enabled: Boolean(profileId),
  });

  const chosen = new Set((goals.data ?? []).map((g) => g.pathId));

  return (
    <div className="container-x max-w-4xl pb-24 pt-28">
      <Reveal>
        <p className="kicker">{tx("Careers")}</p>
        <h1 className="mt-3 section-title">{tx("Pick where you are going")}</h1>
        <p className="type-lede mt-4">
          {tx(
            "Choose a path and स्वYAM works out which skills you already have, which ones you have only claimed, and which ones are missing — then builds the plan that closes the gap.",
          )}
        </p>
      </Reveal>

      {(goals.data ?? []).length > 0 && (
        <Reveal className="mt-10">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
              <Target size={17} className="text-saffron-500" aria-hidden /> {tx("Your paths")}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {(goals.data ?? []).map((g) => (
                <li key={g.id}>
                  <Link
                    to="/careers/$slug"
                    params={{ slug: g.slug }}
                    className="btn-ghost !py-2 !text-xs"
                  >
                    {g.title} <ArrowRight size={12} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {paths.isLoading && <p className="mt-10 font-body text-sm text-ink-mute">{tx("Loading…")}</p>}

      {!paths.isLoading && (paths.data ?? []).length === 0 && (
        <p className="mt-10 font-body text-sm text-ink-mute">
          {tx("No career paths are published yet.")}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(paths.data ?? []).map((p, i) => (
          <Reveal key={p.id} delay={i * 0.04}>
            <Link
              to="/careers/$slug"
              params={{ slug: p.slug }}
              className="group flex h-full flex-col rounded-[var(--radius-card)] border border-ink-line bg-paper-light p-5 transition-colors hover:border-saffron-200"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg tracking-tight text-ink">{p.title}</h2>
                {chosen.has(p.id) && <span className="chip !text-[10px]">{tx("Your path")}</span>}
              </div>

              {p.summary && (
                <p className="mt-2 font-body text-[13px] leading-relaxed text-ink-soft">
                  {p.summary}
                </p>
              )}

              {p.typicalTitles.length > 0 && (
                <div className="mt-3">
                  <p className="datum">{tx("Advertised as")}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.typicalTitles.map((t) => (
                      <li key={t} className="chip !text-[10px]">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-auto pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                {p.skillCount} {p.skillCount === 1 ? tx("skill") : tx("skills")}
              </p>
            </Link>
          </Reveal>
        ))}
      </div>

      {!profileId && (paths.data ?? []).length > 0 && (
        <Reveal className="mt-10">
          <p className="flex items-start gap-2.5 rounded-2xl border border-ink-line bg-paper-dim p-5 font-body text-[13px] leading-relaxed text-ink-soft">
            <Compass size={16} className="mt-0.5 shrink-0 text-saffron-500" aria-hidden />
            <span>
              {tx(
                "Sign in to see how far along any of these you already are. The score is worked out from the skills on your profile — nothing is guessed.",
              )}
            </span>
          </p>
        </Reveal>
      )}
    </div>
  );
}
