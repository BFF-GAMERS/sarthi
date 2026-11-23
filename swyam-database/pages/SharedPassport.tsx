import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, GraduationCap, Lock, MapPin, ShieldCheck } from "lucide-react";
import { getSharedPassport } from "../lib/passport-share";
import { initialsAvatar } from "../lib/avatar";
import { Reveal } from "../components/Reveal";
import { useTx } from "../lib/i18n";

/**
 * Somebody's Skill Passport, opened by a stranger.
 *
 * This is the page at the end of the Copy link button, and until now it was a
 * 404 — the Passport page built `${origin}/passport/${slug}`, showed it, and
 * offered to copy it, and no route ever served that path. For a platform
 * whose whole claim is "a record an employer can check", that was the worst
 * possible link to have broken.
 *
 * Written for the person on the other end, who has no account and no reason
 * to make one: no navigation into the product, no sign-up wall, no
 * "unlock the full profile". Every certificate serial links to /verify, which
 * needs no account either, because a claim you cannot check is just a claim.
 */

const PROVEN = new Set(["verified", "expert_verified"]);
const ASSESSED = new Set(["assessed"]);

function VerificationTag({ state, tx }: { state: string | null; tx: (s: string) => string }) {
  if (!state) return null;
  if (PROVEN.has(state)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emeraldx-400/12 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-emeraldx-400">
        <BadgeCheck size={11} aria-hidden /> {tx("Verified")}
      </span>
    );
  }
  if (ASSESSED.has(state)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-marigold-600/12 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-marigold-600">
        {tx("Assessed")}
      </span>
    );
  }
  // Self-declared is shown as what it is, not hidden. A passport that dresses
  // up an unproven claim is the thing this page exists to be an alternative to.
  return <span className="chip !text-[10px]">{tx("Self-declared")}</span>;
}

export default function SharedPassport() {
  const tx = useTx();
  const { slug } = useParams({ from: "/passport_/$slug" });

  const shared = useQuery({
    queryKey: ["shared-passport", slug],
    queryFn: () => getSharedPassport(slug),
    // One view per opening, not one per refocus — the owner's view count is a
    // number they read, and inflating it with refetches makes it a lie.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: false,
  });

  if (shared.isLoading) {
    return (
      <div className="container-x max-w-3xl pb-24 pt-28">
        <p className="font-body text-sm text-ink-mute">{tx("Loading…")}</p>
      </div>
    );
  }

  const p = shared.data;

  if (!p?.found) {
    return (
      <div className="container-x max-w-2xl pb-24 pt-28 text-center">
        <Lock size={22} className="mx-auto text-ink-mute" aria-hidden />
        <h1 className="mt-4 section-title">{tx("This passport is not public")}</h1>
        <p className="type-lede mt-4">
          {tx(
            "Either the link is wrong, or its owner has not published it yet. Only they can change that.",
          )}
        </p>
        <Link to="/" className="btn-ghost mt-7 !py-2.5 !text-xs">
          {tx("What is स्वYAM?")}
        </Link>
      </div>
    );
  }

  const skills = p.skills ?? [];
  const certificates = p.certificates ?? [];
  const finished = (p.courses ?? []).filter((c) => c.state === "completed");

  return (
    <div className="container-x max-w-3xl pb-24 pt-28">
      <Reveal>
        <section className="panel p-6 sm:p-8">
          <div className="flex flex-wrap items-start gap-5">
            <img
              src={p.avatarUrl || initialsAvatar(p.name)}
              alt=""
              className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-ink-line"
            />
            <div className="min-w-0 flex-1">
              <p className="kicker">{tx("Skill Passport")}</p>
              <h1 className="mt-2 font-display text-2xl tracking-tight text-ink">{p.name}</h1>
              {p.handle && (
                <Link
                  to="/u/$handle"
                  params={{ handle: p.handle }}
                  className="mt-1 block font-mono text-[13px] text-ink-mute transition-colors hover:text-saffron-600"
                >
                  @{p.handle}
                </Link>
              )}
              {p.headline && (
                <p className="mt-2 font-body text-[15px] leading-relaxed text-ink-soft">
                  {p.headline}
                </p>
              )}
              {p.region && (
                <p className="mt-2 inline-flex items-center gap-1.5 font-body text-[13px] text-ink-mute">
                  <MapPin size={13} aria-hidden /> {p.region}
                </p>
              )}
            </div>
          </div>

          {p.summary && (
            <p className="mt-5 border-l-[3px] border-saffron-500 pl-4 font-editorial text-lg text-ink-soft">
              {p.summary}
            </p>
          )}
        </section>
      </Reveal>

      {p.skills !== null && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="font-display text-lg tracking-tight text-ink">{tx("Skills")}</h2>
            {skills.length === 0 ? (
              <p className="mt-3 font-body text-sm text-ink-mute">{tx("No skills listed yet.")}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {skills.map((s) => (
                  <li
                    key={s.skillId || s.name}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-ink-line px-3.5 py-2.5"
                  >
                    <span className="font-body text-[14px] text-ink">{s.name}</span>
                    {s.level && <span className="chip !text-[10px] capitalize">{s.level}</span>}
                    <VerificationTag state={s.verification} tx={tx} />
                    {s.evidenceCount > 0 && (
                      <span className="ml-auto font-body text-[11px] text-ink-mute">
                        {s.evidenceCount}{" "}
                        {s.evidenceCount === 1 ? tx("piece of evidence") : tx("pieces of evidence")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      )}

      {p.certificates !== null && certificates.length > 0 && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
              <ShieldCheck size={17} className="text-saffron-500" aria-hidden />
              {tx("Certificates")}
            </h2>
            <p className="mt-1.5 font-body text-[13px] text-ink-mute">
              {tx("Every serial can be checked without an account.")}
            </p>
            <ul className="mt-4 space-y-2">
              {certificates.map((c) => (
                <li
                  key={c.serial}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-ink-line px-3.5 py-3"
                >
                  <span
                    className={`font-body text-[14px] ${c.revoked ? "text-ink-mute line-through" : "text-ink"}`}
                  >
                    {c.title}
                  </span>
                  {c.issuer && (
                    <span className="font-body text-[12px] text-ink-mute">{c.issuer}</span>
                  )}
                  {c.revoked ? (
                    <span className="chip !text-[10px]">{tx("Revoked")}</span>
                  ) : (
                    <Link
                      to="/verify/$serial"
                      params={{ serial: c.serial }}
                      className="ml-auto font-mono text-[11px] text-saffron-700 underline-offset-2 hover:underline"
                    >
                      {c.serial}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {p.courses !== null && finished.length > 0 && (
        <Reveal className="mt-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
              <GraduationCap size={17} className="text-saffron-500" aria-hidden />
              {tx("Courses finished")}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {finished.map((c) => (
                <li key={c.title} className="chip !text-[11px]">
                  {c.title}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <p className="mt-8 text-center font-body text-[12px] leading-relaxed text-ink-mute">
        {tx("Published by its owner on")}{" "}
        <Link to="/" className="link-sweep text-saffron-600">
          स्वYAM
        </Link>
        . {tx("स्वYAM is not a government body and does not certify employers.")}
      </p>
    </div>
  );
}
