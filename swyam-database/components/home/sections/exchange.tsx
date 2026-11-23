import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { findMatches } from "@/lib/skillswap";
import { getMemberPassport } from "@/lib/people";
import { useTx } from "@/lib/i18n";
import { track } from "@/evolution/runtime/tracker/track";
import { EV } from "@/evolution/config/ids";
import HrefLink from "../HrefLink";
import { useMySkillNames } from "../data";
import { limitOf, type SectionProps } from "../types";
import { Empty, SectionShell, Skeleton, signInHref } from "./shared";

export function FindASkill(p: SectionProps) {
  const tx = useTx();
  const to = p.signedIn ? "/skillswap" : "/board";
  return (
    <SectionShell
      p={p}
      kicker={tx("Learn from someone")}
      title={tx("Find a skill")}
      seeAll={{ href: to, label: p.signedIn ? tx("Open skill swap") : tx("Open the board") }}
    >
      <Empty
        title={tx("Learn a skill from somebody certified in it")}
        body={
          p.signedIn
            ? tx("Say what you want to learn and Swayam matches you with people who teach it.")
            : tx("The skill board shows who teaches what. You can browse it without an account.")
        }
        cta={{
          href: to,
          label: p.signedIn ? tx("Find a trainer") : tx("Browse the skill board"),
          onClick: () => track(EV.SKILL_SWAP_REQUESTED, { role: "learn" }),
        }}
      />
    </SectionShell>
  );
}

export function TeachASkill(p: SectionProps) {
  const tx = useTx();
  const to = p.signedIn ? "/skillswap" : signInHref("/skillswap");
  return (
    <SectionShell
      p={p}
      kicker={tx("Teach one back")}
      title={tx("Teach a skill")}
      seeAll={{
        href: p.signedIn ? "/skillswap" : "/board?filter=trainer",
        label: tx("See who teaches"),
      }}
    >
      <Empty
        title={tx("Share what you already know")}
        body={
          p.signedIn
            ? tx("List a skill you can teach and learners looking for it can find you.")
            : tx(
                "Sign in to list a skill you can teach. Trainers are matched to learners by their skills, so we need an account to match you.",
              )
        }
        cta={{
          href: to,
          label: p.signedIn ? tx("List a skill") : tx("Sign in to teach"),
          onClick: () => track(EV.SKILL_SWAP_REQUESTED, { role: "teach" }),
        }}
      />
    </SectionShell>
  );
}

/** Real matches only. With no skills listed there are none, and the section says so. */
export function Matches(p: SectionProps) {
  const tx = useTx();
  const { profileId } = useAuth();
  const limit = limitOf(p);
  const mine = useMySkillNames();
  const matches = useQuery({
    queryKey: ["swap-matches", profileId],
    queryFn: () => findMatches(profileId!, 5),
    enabled: Boolean(profileId),
  });
  const rows = (matches.data ?? []).slice(0, limit);
  return (
    <SectionShell
      p={p}
      kicker={tx("Skill exchange")}
      title={tx("Your matches")}
      seeAll={{ href: p.signedIn ? "/skillswap" : signInHref("/skillswap"), label: tx("See all") }}
    >
      {!p.signedIn ? (
        <Empty
          title={tx("Sign in to see your matches")}
          body={tx(
            "Matches come from the skills you teach and want to learn, so there is nothing to show before you have an account.",
          )}
          cta={{ href: signInHref("/skillswap"), label: tx("Sign in") }}
        />
      ) : matches.isLoading || mine.loading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty
          title={tx("Add skills to see matches")}
          body={tx("List a skill you teach and one you want to learn. People who fit appear here.")}
          cta={{ href: "/skillswap", label: tx("Add my skills") }}
        />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
          {rows.map((m) => (
            <li key={m.candidateId} className="border-b border-ink-line last:border-b-0">
              <HrefLink
                href="/skillswap"
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper"
              >
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron-50 font-display text-[14px] font-semibold text-saffron-600"
                >
                  {m.displayName.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[1.02rem] font-semibold text-ink">
                    {m.displayName}
                  </span>
                  <span className="block truncate font-body text-[12.5px] text-ink-mute">
                    {tx("Teaches")} {m.theyTeach.name}
                  </span>
                </span>
              </HrefLink>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export function SkillPassport(p: SectionProps) {
  const tx = useTx();
  const { profileId } = useAuth();
  const passport = useQuery({
    queryKey: ["member-passport", profileId],
    queryFn: () => getMemberPassport(profileId!),
    enabled: Boolean(profileId),
  });
  const certs = passport.data?.certificates ?? null;
  return (
    <SectionShell
      p={p}
      kicker={tx("Proof, not claims")}
      title={tx("Skill Passport")}
      seeAll={{
        href: p.signedIn ? "/passport" : signInHref("/passport"),
        label: tx("Open passport"),
      }}
    >
      {!p.signedIn ? (
        <Empty
          title={tx("One link that shows what you can do")}
          body={tx(
            "Your passport lists the certificates you earned and the skills behind them, each one checkable by anyone. Sign in to start yours.",
          )}
          cta={{ href: signInHref("/passport"), label: tx("Sign in") }}
        />
      ) : passport.isLoading ? (
        <Skeleton h="h-24" />
      ) : (
        <div className="card p-5">
          <p className="font-display text-xl font-semibold leading-tight text-ink">
            {certs === null
              ? tx("Your passport is ready to open")
              : certs.length === 0
                ? tx("No certificates on your passport yet")
                : `${certs.length} ${certs.length === 1 ? tx("certificate") : tx("certificates")}`}
          </p>
          <p className="mt-2 font-body text-[13.5px] text-ink-soft">
            {tx(
              "Finish a course or pass an assessment and it is added here with a serial anyone can verify.",
            )}
          </p>
          <HrefLink
            href="/passport"
            onClick={() => track(EV.SKILL_PASSPORT_OPENED, { self: true })}
            className="btn-primary mt-4 !px-5 !py-2.5 !text-[13px]"
          >
            {tx("Open my passport")}
          </HrefLink>
        </div>
      )}
    </SectionShell>
  );
}
