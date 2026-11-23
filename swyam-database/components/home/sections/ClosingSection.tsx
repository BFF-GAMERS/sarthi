import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { useAuth } from "@/context/AuthContext";
import { useT, useTx } from "@/lib/i18n";
import type { SectionProps } from "../types";

/** Visitors only: a sign-up band means nothing to somebody already signed in. */
export default function ClosingSection(_props: SectionProps) {
  const tx = useTx();
  const t = useT();
  const { user } = useAuth();
  if (user) return null;
  return (
    <section className="container-x pb-8">
      <Reveal>
        {/* The accent band. Its two blurred orbs are gone: they were the
            generic decoration of every generated page, and by lightening
            the ground unevenly they were also what dropped the copy on it
            below AA. A wash from saffron-500 to saffron-600 gives the same
            depth and keeps the contrast knowable: the copy sits on 5.96:1
            or better at every point (the band used to start at saffron-400,
            4.43:1 under the 12px label). The inset rim and the long soft
            shadow lift the band off the page the way a card is lifted. */}
        <div
          className="relative overflow-hidden rounded-[var(--radius-card)] px-7 py-16 text-center text-[color:var(--color-on-accent)] shadow-[inset_0_1px_0_rgb(255_255_255/0.22),var(--shadow-float)] sm:px-12 lg:py-24"
          style={{
            backgroundImage:
              "linear-gradient(140deg, var(--color-saffron-500), var(--color-saffron-500) 40%, var(--color-saffron-600))",
          }}
        >
          <div className="relative">
            <p className="font-body text-[12px] font-semibold uppercase tracking-[0.2em]">
              {tx("Two minutes. No fee. No catch.")}
            </p>
            <h2 className="type-xl mx-auto mt-5 max-w-3xl font-display">
              {tx("Your future")} {tx("won't wait.")}
            </h2>
            <p className="mx-auto mt-5 max-w-lg font-body text-lg">{tx("Neither should you.")}</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="btn-dark !bg-ink !px-8 !py-4 !text-[15px] !text-paper"
              >
                {tx("Create my free account")} <ArrowRight size={18} aria-hidden />
              </Link>
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-current/40 px-7 py-4 font-body text-[15px] font-semibold transition-colors hover:bg-current/10"
              >
                {t("browseCourses")}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
