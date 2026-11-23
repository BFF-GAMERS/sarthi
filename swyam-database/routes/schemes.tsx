import { createFileRoute } from "@tanstack/react-router";
import { Landmark, IndianRupee, UserCheck, ArrowUpRight } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/Reveal";
import SchemeChecker from "@/components/SchemeChecker";
import { schemes } from "@/data/topics";
import { SloganPlate } from "../components/Ornaments";

const TITLE = "Government schemes & scholarships for skilling | स्वYAM";
const DESC =
  "PMKVY 4.0, NAPS, PM Vishwakarma, MUDRA, DDU-GKY and scholarships — what you get, who qualifies and exactly how to apply.";

export const Route = createFileRoute("/schemes")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: SchemesPage,
});

function SchemesPage() {
  return (
    <div className="relative z-10">
      <section className="border-b border-ink-line">
        <div className="container-x pb-12 pt-32 lg:pt-40">
          <SloganPlate tone="marigold">Schemes · funding that already exists</SloganPlate>
          <h1 className="mt-4 section-title max-w-3xl">
            Training is often free.
            <span className="block text-saffron-500">Most people never claim it.</span>
          </h1>
          <p className="mt-6 max-w-2xl border-l-[3px] border-saffron-500 pl-5 font-editorial text-xl text-ink-soft">
            {schemes.length} central schemes cover free training, fees, stipends, toolkits and loans
            for skilled work. Here is the plain-language version, with a link to each
            ministry&apos;s own page.
          </p>
          <a href="#check" className="btn-primary mt-8 !py-3">
            Check my eligibility <ArrowUpRight size={16} aria-hidden />
          </a>
        </div>
      </section>

      <SchemeChecker />

      <section className="container-x py-14">
        <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {schemes.map((s) => (
            <StaggerItem key={s.id}>
              <article className="card flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-3xl leading-[1.02] tracking-tight">{s.name}</h2>
                  <Landmark size={20} className="mt-1 shrink-0 text-saffron-500" />
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 font-body text-[11px] uppercase tracking-widest text-ink-mute">
                  {s.ministry}
                  {s.free && <span className="chip !text-[10px] !normal-case">Free to apply</span>}
                </p>

                <dl className="mt-5 space-y-4 font-body text-sm leading-relaxed">
                  <div>
                    <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-saffron-500">
                      <IndianRupee size={12} /> What you get
                    </dt>
                    <dd className="mt-1 text-ink-soft">{s.benefit}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-saffron-500">
                      <UserCheck size={12} /> Who qualifies
                    </dt>
                    <dd className="mt-1 text-ink-soft">{s.eligibility}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-widest text-saffron-500">
                      How to apply
                    </dt>
                    <dd className="mt-1 text-ink-soft">{s.how}</dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-6">
                  <a
                    href="#check"
                    className="link-sweep inline-flex items-center gap-1 font-body text-xs font-semibold uppercase tracking-widest"
                  >
                    Check my eligibility <ArrowUpRight size={14} />
                  </a>
                  {/*
                   * The ministry changes the amounts and the age bands, not
                   * this file. Anyone deciding whether they qualify should
                   * land on the source, not on our summary of it.
                   */}
                  <a
                    href={s.official}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-body text-xs font-semibold uppercase tracking-widest text-ink-mute transition-colors hover:text-saffron-600"
                  >
                    Official site <ArrowUpRight size={14} />
                  </a>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
