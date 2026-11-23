import { useMemo } from "react";
import { BadgeCheck } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { OrgCard } from "@/components/Cards";
import { organizations } from "@/data/mock";
import { getPreferredCity } from "@/lib/local-store";
import { distanceFor, byDistance } from "@/lib/location";
import { useTx } from "@/lib/i18n";
import type { SectionProps } from "../types";

export default function PartnersSection(_props: SectionProps) {
  const tx = useTx();
  const nearbyOrgs = useMemo(() => {
    const city = getPreferredCity();
    if (!city) return organizations.slice(0, 4);
    return [...organizations]
      .map((o) => ({ o, km: distanceFor(city, o.location) }))
      .sort(byDistance((r) => r.km))
      .slice(0, 4)
      .map((r) => r.o);
  }, []);
  return (
    <section className="container-x pb-20 lg:pb-28">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker">{tx("Training partners & employers")}</p>
            <h2 className="section-title mt-3 max-w-2xl">{tx("Institutes you can trust")}</h2>
          </div>
          <span className="inline-flex items-center gap-2 font-body text-[13px] font-semibold text-emeraldx-400">
            <BadgeCheck size={16} aria-hidden /> {tx("Verified partners")}
          </span>
        </div>
      </Reveal>
      <Stagger className="card-grid mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {nearbyOrgs.map((o) => (
          <StaggerItem key={o.id}>
            <OrgCard org={o} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
