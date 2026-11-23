/**
 * /explore: every destination grouped by domain, with a purpose line (plan §4.4).
 * It is the guarantee that nothing is ever hidden: however the navigation has
 * adapted, every part of Swayam is listed here, from the same registry the top
 * bar, bottom bar, drawer, rail and footer render from.
 */
import { NAV_ITEM_IDS } from "@/evolution/config/ids";
import { useAuth } from "@/context/AuthContext";
import { useTx } from "@/lib/i18n";
import NavItems from "@/components/evolution/NavItems";
import { groupByDomain } from "@/components/evolution/nav-model";

const GROUPS = groupByDomain(NAV_ITEM_IDS);

export default function Explore() {
  const tx = useTx();
  const { user } = useAuth();
  const signedIn = Boolean(user);

  return (
    <div className="container-x max-w-5xl pb-24 pt-28">
      <header className="max-w-2xl">
        <p className="kicker">{tx("Explore")}</p>
        <h1 className="mt-3 font-display text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] font-semibold leading-[1.05] tracking-tight text-ink">
          {tx("Everything on स्वYAM, in one place")}
        </h1>
        <p className="mt-4 font-body text-[16px] leading-relaxed text-ink-soft">
          {tx(
            "Your navigation adapts to how you use स्वYAM. This page never does: every part of it is listed here, grouped by what it is for.",
          )}
        </p>
      </header>

      <div className="mt-12 space-y-12">
        {GROUPS.map((g) => (
          <section key={g.domain} aria-labelledby={`explore-${g.domain}`}>
            <h2
              id={`explore-${g.domain}`}
              className="font-display text-[1.35rem] font-semibold tracking-tight text-ink"
            >
              {tx(g.heading)}
            </h2>
            <NavItems
              items={g.items}
              surface="explore"
              signedIn={signedIn}
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            />
          </section>
        ))}
      </div>
    </div>
  );
}
