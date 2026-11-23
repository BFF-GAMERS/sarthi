import { useId } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTx } from "@/lib/i18n";
import { profileTypeInfo } from "@/lib/profile-type";
import { recordPlusEvent, useMembership, usePlusState } from "@/membership";
import { openPlus } from "@/membership/trigger/plus-open-store";
import { useIsMinor } from "@/membership/trigger/use-is-minor";
import FoilCard from "./FoilCard";
import PriceRoll, { fill } from "./PriceRoll";
import { useStaticFx } from "./use-plus-fx";

/**
 * "Your membership" for Settings. Always available, whoever you are:
 *
 *  - a member with a plan sees their card, the price in full, why this plan, and one button;
 *  - a minor, or anyone whose age is not known, sees the same with "Ask a parent or guardian before
 *    subscribing" - the sheet never opens by itself for them, but they can look;
 *  - a guest, or someone who has not said how they use Swayam, sees a neutral "coming soon" with no
 *    rupee figure at all, because there is no plan to price yet.
 *
 * Seen again and again, so nothing here animates the price. No props: it reads who you are itself.
 */
export default function MembershipCard() {
  const tx = useTx();
  const headingId = useId();
  const { user, profileId } = useAuth();
  const m = useMembership();
  const plus = usePlusState();
  const isMinor = useIsMinor(profileId);
  const staticFx = useStaticFx();
  const plan = m.plan;

  if (!user || !plan) {
    return (
      <section className="plus-card" aria-labelledby={headingId} data-guest="">
        <h3 id={headingId}>{tx("Swayam Plus is coming soon")}</h3>
        <p>
          {tx(
            "A membership built around how you use Swayam. Tell us whether you are a student, job seeker, professional, trainer or recruiter in your profile, and it will show what fits you.",
          )}
        </p>
        <p>{tx("Nothing to pay. Nothing is charged during the pilot.")}</p>
      </section>
    );
  }

  const firstName = user.name.trim().split(/\s+/)[0] || tx("Member");
  const roleLabel = tx(profileTypeInfo(plan.profileType).label);
  const open = () => {
    recordPlusEvent("plus_settings_opened", { planId: plan.id });
    openPlus({ source: "settings" });
  };

  return (
    <section
      className="plus-card"
      aria-labelledby={headingId}
      data-static={staticFx ? "" : undefined}
    >
      <div className="plus-card-grid">
        <FoilCard
          firstName={firstName}
          planName={plan.name}
          roleLabel={roleLabel}
          accent={m.accent}
          staticFx={staticFx}
          sheen={false}
        />
        <div style={{ display: "grid", gap: 12 }}>
          <h3 id={headingId}>{`${tx("Swayam Plus")} · ${plan.name}`}</h3>
          <PriceRoll regular={plan.regularPrice} intro={plan.introPrice} animate={false} />
          {plus.state.interest && (
            <p className="plus-price-line">
              {plus.state.interest === "notify"
                ? tx("Demo · you will be told when payments open")
                : tx("Demo trial · no payment")}
            </p>
          )}
          {isMinor !== false && (
            <p className="plus-price-line">{tx("Ask a parent or guardian before subscribing")}</p>
          )}
          <details>
            <summary>{tx("Why this plan")}</summary>
            <p>
              {fill(
                tx(
                  "{plan} is the plan for the role you chose, and its price is the same for everyone with that role.",
                ),
                { plan: plan.name },
              )}
            </p>
            {m.reason && (
              <p>
                {tx(m.reason)} · {m.source === "ai" ? tx("Chosen by AI") : tx("Chosen by rules")}
              </p>
            )}
          </details>
          <button type="button" className="plus-btn" data-primary="" onClick={open}>
            {tx("See what is included")}
          </button>
        </div>
      </div>
    </section>
  );
}
