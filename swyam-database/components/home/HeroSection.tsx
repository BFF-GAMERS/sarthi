import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import SkillPlate from "@/components/SkillPlate";
import RegisterMark from "@/components/RegisterMark";
import { SloganPlate, NumberPlate } from "@/components/Ornaments";
import HomeResume from "@/components/HomeResume";
import { courses } from "@/data/mock";
import { schemes, totalSkillCount, skillCategories } from "@/data/topics";
import { EVOLUTION_CONFIG } from "@/evolution/config/evolution-config";
import { EV } from "@/evolution/config/ids";
import { useEvolutionSnapshot, type HomePlan } from "@/evolution/react/hooks";
import { track } from "@/evolution/runtime/tracker/track";
import type { EvolutionState, Tier } from "@/evolution/types";
import { useAuth } from "@/context/AuthContext";
import { useT, useTx } from "@/lib/i18n";
import HrefLink from "./HrefLink";
import { openingsOf, useOpenings } from "./data";
import { heroLayout, resolveCta } from "./plan";
import { resolveEntity } from "./resolve";
import LeadStrip from "./hero/LeadStrip";
import { HEADLINES, HERO_VISUAL } from "./hero/model";
import HeroVisual, { type Featured } from "./hero/Visuals";

/* One-tap starting points under the search box. */
const quickSkills = skillCategories
  .flatMap((c) => c.skills)
  .filter((s) => s.demand === "Very high")
  .slice(0, 5)
  .map((s) => s.title);

/** A stagger delay for the CSS entrance (no inline transform, so the server and client markup agree). */
const delay = (s: number): CSSProperties => ({ ["--d" as string]: `${s}s` });

/**
 * The Hero Cockpit. In UNIVERSAL it is the hero Swayam always had. In a learned state the headline pair,
 * the lede, the CTA, the right-hand visual and a three-item lead strip are the state's own; on a phone
 * the stats and try-chips fold into one 44 px strip so the first promoted card lands above 844 px.
 *
 * Reload without a flash: the pre-paint script stamps html[data-evo-state] before the first frame, and
 * evo-ui.css hides this section's state-dependent parts (title, lede, CTA, visual, lead strip)
 * until the store hydrates and `data-hydrated` appears, with their boxes reserved so nothing moves. The
 * keyed parts then mount with one 150 ms fade. Entrances are CSS keyed off the pre-paint
 * html[data-motion], so the server never emits a transform and reduced motion cannot mismatch.
 */
export default function HeroSection({
  hero,
  state = "UNIVERSAL",
  tier = 0,
  hydrated = false,
}: {
  hero: HomePlan["hero"];
  state?: EvolutionState;
  tier?: Tier;
  hydrated?: boolean;
}) {
  const tx = useTx();
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  /* Local to the hero: typing here no longer re-renders the whole page. */
  const [q, setQ] = useState("");
  /* The mark is drawn per register and the register is only known on the client: drawing it after mount (in the
     same pass that reads the stored preferences) means it is never drawn in the wrong register and swapped. */
  const [decor, setDecor] = useState(false);
  useEffect(() => setDecor(true), []);

  /* Each state swaps the headline pair, lede and primary CTA; UNIVERSAL keeps today's copy exactly. */
  const universal = hero.ledeKey === "evo.lede.universal";
  const stateLede = EVOLUTION_CONFIG.ledes[hero.ledeKey];
  const layout = heroLayout(state, tier, Boolean(user));
  const pair = HEADLINES[state];
  /* Keyed parts remount on a state change and fade in once; UNIVERSAL keeps the rise-in on first paint. */
  const enter = layout.evolved ? "hero-fade" : "hero-rise";

  const recent = useEvolutionSnapshot().profile.recent;
  const openings = useOpenings();
  const cta = resolveCta(
    hero.cta,
    Boolean(user),
    (id) => resolveEntity(id, openingsOf(openings.data))?.href ?? null,
    recent,
  );
  const viaCta = () =>
    track(EV.RECOMMENDATION_CLICKED, { surface: "home-hero", rank: 0, via: "adaptive" });

  /* The newest real thing the visitor looked at, if it fits the state's visual. */
  const featured = useMemo<Featured | null>(() => {
    const kind = HERO_VISUAL[state];
    if (kind !== "pipeline" && kind !== "progress") return null;
    for (const r of recent) {
      const e = resolveEntity(r.entityId, openingsOf(openings.data));
      if (!e) continue;
      const fits =
        kind === "pipeline" ? e.kind === "job" || e.kind === "internship" : e.kind === "course";
      if (fits) return { title: e.title, sub: e.sub };
    }
    return null;
  }, [state, recent, openings.data]);

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const plateY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const typeY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate({ to: "/search", search: term ? { q: term } : {} });
  };

  const memberResume = Boolean(user) && (state === "UNIVERSAL" || state === "LEARNING_FIRST");

  return (
    <section
      ref={heroRef}
      className="relative"
      data-evo-hero
      data-hydrated={hydrated ? "true" : undefined}
      data-hero-state={hydrated ? state : undefined}
      data-evolved={layout.evolved ? "true" : undefined}
    >
      {/* Two blurred colour orbs used to sit here. They are the default
          decoration of every generated landing page, they said nothing
          about this product, and on the cream register they turned the
          top of the page pink. The mark that replaced them is drawn in
          whichever register is on. */}
      {/* Signed in, the right of the hero is a real card — where you
          stopped, and the button back into it. An ornament beside that is
          a second thing competing for the same corner, so it stands down.
          It is a device for the shop window, not for the desk. */}
      {!user && decor && <RegisterMark />}

      <div
        className={`hero-pad container-x relative pb-16 lg:pb-24 ${
          user ? "pt-24 lg:pt-28" : "pt-24 sm:pt-32 lg:pt-40"
        }`}
      >
        {/* xl, not lg.

            The type column asks for 36rem and the illustration's cards are
            positioned for the room that is left. At exactly 1024px there is
            not enough: the certificate lands on top of the module list and
            clips it. Below 1280px the two stack instead, which is the
            layout the plate was drawn for at that width anyway. */}
        <div className="grid grid-cols-1 items-start gap-14 xl:grid-cols-[minmax(0,36rem)_1fr] xl:gap-10">
          {/* ── Type column ──────────────────────────────────── */}
          {/* min-w-0: a grid item defaults to min-width:auto and will not go
              narrower than its content, which at 320px pushed this column to
              338px inside a 280px track and chopped the whole hero. */}
          <motion.div className="hero-type hero-parallax min-w-0" style={{ y: typeY }}>
            {!user && (
              <div className="hero-rise hero-slogan inline-block" style={delay(0)}>
                {/* The whole claim needs a line of its own on a phone, and
                    a two-line badge is a banner. The short half carries the
                    promise; the rest is one scroll down anyway. */}
                <SloganPlate tone="saffron">
                  <span className="sm:hidden">{tx("Free to start")}</span>
                  <span className="hidden sm:inline">
                    {tx("Free to start · Assessed, not just attended")}
                  </span>
                </SloganPlate>
              </div>
            )}

            <h1
              key={`title-${state}`}
              className={`${enter} hero-title ${user ? "type-lg" : "type-hero hero-title-pair"} mt-6 font-display text-ink`}
              style={delay(0.06)}
            >
              {user ? (
                <>
                  {tx("Welcome back,")}{" "}
                  <span className="text-saffron-500">{user.name.split(" ")[0]}.</span>
                </>
              ) : pair ? (
                <>
                  {tx(pair.first)}
                  <span className="block text-saffron-500">{tx(pair.second)}</span>
                </>
              ) : (
                <>
                  {t("heroTitle1")}
                  <span className="block text-saffron-500">{t("heroTitle2")}</span>
                </>
              )}
            </h1>

            <p
              key={`lede-${state}`}
              className={`${enter} hero-lede mt-5 max-w-xl font-body text-[15.5px] leading-relaxed text-ink-soft sm:mt-6 sm:text-[17px] sm:leading-[1.75]`}
              style={delay(0.14)}
            >
              {!universal && stateLede
                ? tx(stateLede)
                : user
                  ? tx("Pick up where you left off, or find someone to learn your next skill from.")
                  : t("heroLede")}
            </p>

            {/* Search: the fastest route in. */}
            <form
              data-tour="home-search"
              onSubmit={search}
              role="search"
              className="hero-rise hero-search mt-6 flex max-w-xl items-center gap-2 rounded-[var(--radius-pill)] border bg-paper-light p-1.5 pl-5 shadow-[var(--shadow-raised)] transition-shadow [border-color:var(--color-field-line)] focus-within:shadow-[var(--shadow-float)] sm:mt-8"
              style={delay(0.2)}
            >
              <Search size={18} className="shrink-0 text-ink-mute" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tx("Search a skill, a course, or a job…")}
                aria-label={tx("Search the platform")}
                className="min-w-0 flex-1 bg-transparent py-2.5 font-body text-[15px] text-ink outline-none placeholder:text-ink-mute"
              />
              <button type="submit" className="btn-primary !px-5 !py-2.5">
                {tx("Search")}
              </button>
            </form>

            <div
              key={`cta-${state}`}
              className={`${enter} hero-cta mt-6 flex flex-wrap items-center gap-3 sm:mt-8`}
              style={delay(0.3)}
            >
              {user ? (
                <>
                  {universal ? (
                    <Link to="/my-learning" className="btn-ghost">
                      {tx("Continue learning")} <ArrowRight size={17} aria-hidden />
                    </Link>
                  ) : (
                    <HrefLink href={cta.href} onClick={viaCta} className="btn-primary" press>
                      {tx(cta.label)} <ArrowRight size={17} aria-hidden />
                    </HrefLink>
                  )}
                  <Link to="/dashboard" className="btn-ghost hero-cta-2">
                    {tx("Your dashboard")}
                  </Link>
                </>
              ) : (
                <>
                  {/*
                    The button says what happens, not "get started". A
                    stranger who presses it gets a plan built from their
                    own marks and goals — that is the first thing the
                    account is for, so it is the first thing offered.
                  */}
                  {universal ? (
                    <Link
                      to="/auth"
                      search={{ mode: "signup", next: "/coach" }}
                      className="btn-primary"
                    >
                      {tx("Build my learning plan")} <ArrowRight size={17} aria-hidden />
                    </Link>
                  ) : (
                    <HrefLink href={cta.href} onClick={viaCta} className="btn-primary" press>
                      {tx(cta.label)} <ArrowRight size={17} aria-hidden />
                    </HrefLink>
                  )}
                  <a href="#how-it-works" className="btn-ghost hero-cta-2">
                    {tx("See how it works")}
                  </a>
                </>
              )}
            </div>
            {/* Under the CTA: a returning member's three doors. A first visit gets no extras. */}
            {!universal && (
              <LeadStrip
                key={`lead-${state}`}
                state={state}
                signedIn={Boolean(user)}
                className={enter}
                style={delay(0.34)}
              />
            )}

            {/* Phone, learned state: stats and try-chips fold into this one 44 px strip (CSS shows it). */}
            <div className="hero-strip" role="group" aria-label={tx("Starting points")}>
              {!user && (
                <span className="hero-strip-facts">
                  {courses.length} {tx("courses")} · {totalSkillCount} {tx("skills")} ·{" "}
                  {schemes.length} {tx("schemes")}
                </span>
              )}
              {quickSkills.slice(0, 3).map((s) => (
                <Link key={s} to="/search" search={{ q: s }} className="hero-strip-chip">
                  {s}
                </Link>
              ))}
            </div>

            {/* Proof, for a stranger. A member has their own numbers in
                the resume card beside this, and two stat rows read as none. */}
            {!user && (
              <div className="hero-stats mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-ink-line pt-7">
                {[
                  {
                    value: String(courses.length),
                    label: tx("courses to choose from"),
                    tone: "ink" as const,
                  },
                  {
                    value: String(totalSkillCount),
                    label: tx("skills you can learn or teach"),
                    tone: "ink" as const,
                  },
                  {
                    value: String(schemes.length),
                    label: tx("government schemes explained"),
                    tone: "ink" as const,
                  },
                ].map((s) => (
                  <NumberPlate key={s.label} value={s.value} label={s.label} tone={s.tone} />
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Visual column ────────────────────────────────── */}
          <motion.div
            style={{ y: plateY }}
            className="hero-visual-col hero-parallax relative mx-auto w-full min-w-0 max-w-xl lg:max-w-none"
          >
            <div
              key={`visual-${state}-${memberResume}`}
              className={`${enter} hero-visual`}
              style={delay(0.12)}
            >
              {memberResume ? (
                <HomeResume />
              ) : state === "UNIVERSAL" ? (
                <SkillPlate />
              ) : (
                <HeroVisual state={state} featured={featured} />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
