import type { ReactNode } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  MapPin,
  Globe,
  Phone,
  BadgeCheck,
  Check,
  TrendingUp,
  IndianRupee,
  MessageSquare,
} from "lucide-react";
import { Reveal, ScaleImage, Stagger, StaggerItem } from "../components/Reveal";
import { StarRating } from "../components/Cards";
import { CourseCard } from "../components/Cards";
import { organizations, courses } from "../data/mock";
import { useTx } from "../lib/i18n";

export default function OrgProfile() {
  const tx = useTx();
  const { id } = useParams({ from: "/orgs/$id" });
  const org = organizations.find((o) => o.id === id);

  if (!org) {
    return (
      <div className="container-x pt-40 text-center text-ink-mute">
        Organization not found.{" "}
        <Link to="/search" className="text-saffron-500">
          {tx("Explore instead")}
        </Link>
      </div>
    );
  }

  const orgCourses = courses.filter((c) => c.orgId === org.id);

  const stats: { icon: ReactNode; label: string; value: string }[] = [];
  if (org.placementRate > 0) {
    stats.push({
      icon: <TrendingUp size={20} aria-hidden />,
      label: tx("Placement rate"),
      value: `${org.placementRate}%`,
    });
  }
  if (org.avgPackage && org.avgPackage.trim()) {
    stats.push({
      icon: <IndianRupee size={20} aria-hidden />,
      label: tx("Average package"),
      value: org.avgPackage,
    });
  }
  if (orgCourses.length > 0) {
    stats.push({
      icon: <BadgeCheck size={20} aria-hidden />,
      label: tx("Courses offered"),
      value: `${orgCourses.length}`,
    });
  }
  if (org.rating > 0 && org.reviews.length > 0) {
    stats.push({ icon: <StarIcon />, label: tx("Learner rating"), value: `${org.rating}/5` });
  }

  return (
    <div className="pb-24">
      {/* Cover */}
      <section className="relative h-72 overflow-hidden sm:h-96">
        <motion.img
          src={org.cover}
          alt=""
          className="h-full w-full object-cover object-center"
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/40 to-paper/30" />
      </section>

      <div className="container-x">
        <Reveal className="-mt-16 relative z-10">
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-5">
                <img
                  loading="lazy"
                  decoding="async"
                  src={org.logo}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover ring-4 ring-paper-light sm:h-24 sm:w-24"
                />
                <div>
                  <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                    {org.name}
                  </h1>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-ink-mute">
                    <MapPin size={15} aria-hidden /> {org.location}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {/* StarRating falls back to "New course" when unrated, which means
                        nothing on an organization, so only show it with real reviews. */}
                    {org.rating > 0 && org.reviews.length > 0 && (
                      <StarRating value={org.rating} count={org.reviews.length} />
                    )}
                    <span className="chip">
                      {org.type === "institute" ? tx("Institute") : tx("Company")}
                    </span>
                    {org.certifications.map((c) => (
                      <span key={c} className="chip !text-emeraldx-400">
                        <BadgeCheck size={12} aria-hidden /> {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to="/messages" className="btn-primary !py-2.5 text-sm">
                  <MessageSquare size={16} aria-hidden /> {tx("Message")}
                </Link>
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    /* noopener as well as noreferrer: modern browsers imply it,
                       the older Android webviews a lot of this audience is on do
                       not, and every other outbound link here pairs them. */
                    rel="noopener noreferrer"
                    className="btn-ghost !py-2.5 text-sm"
                  >
                    <Globe size={16} aria-hidden /> {tx("Website")}
                  </a>
                )}
              </div>
            </div>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-soft">{org.about}</p>
            {org.contact && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink-mute">
                <Phone size={14} aria-hidden /> {org.contact}
              </p>
            )}
          </div>
        </Reveal>

        {/* Stats: only the ones with real data. A zero or blank here would read
            as a measured result, so it is left out rather than shown. */}
        {org.type === "institute" && stats.length > 0 && (
          <Stagger className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => (
              <StaggerItem key={s.label}>
                <div className="card p-5 text-center">
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-saffron-100 text-saffron-500">
                    {s.icon}
                  </span>
                  <p className="mt-3 font-display text-2xl font-semibold text-ink">{s.value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-mute">
                    {s.label}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}

        {/* Gallery */}
        <Reveal className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink">
            {org.type === "institute" ? "Campus & training environment" : "Inside the workplace"}
          </h2>
          <Stagger className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {org.gallery.map((g, i) => (
              <StaggerItem key={i} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                <ScaleImage
                  src={g}
                  alt={`${org.name} photo ${i + 1}`}
                  className="h-full min-h-40 rounded-2xl"
                />
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        {/* Facilities */}
        <Reveal className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink">{tx("Facilities")}</h2>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {org.facilities.map((f) => (
              <span key={f} className="chip !px-4 !py-2 !text-sm">
                <Check size={13} aria-hidden /> {sentenceCase(f)}
              </span>
            ))}
          </div>
          {org.eligibility && (
            <div className="mt-6 rounded-2xl border border-saffron-500/30 bg-saffron-500/5 p-5">
              <p className="font-medium text-saffron-600">{tx("Eligibility criteria")}</p>
              <p className="mt-1.5 text-ink-soft">{org.eligibility}</p>
            </div>
          )}
        </Reveal>

        {/* Trainers */}
        {org.trainers && org.trainers.length > 0 && (
          <Reveal className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {tx("Meet the trainers")}
            </h2>
            <Stagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {org.trainers.map((t) => (
                <StaggerItem key={t.name}>
                  <div className="card flex items-center gap-4 p-5">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={t.avatar}
                      alt=""
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                    <div>
                      <p className="font-display font-medium text-ink">{t.name}</p>
                      <p className="text-sm text-ink-mute">{t.expertise}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
        )}

        {/* Success stories */}
        {org.successStories.length > 0 && (
          <Reveal className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {tx("Success stories")}
            </h2>
            <Stagger className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {org.successStories.map((s) => (
                <StaggerItem key={s.name}>
                  <div className="card p-6">
                    <p className="text-lg leading-relaxed text-ink">"{s.story}"</p>
                    <div className="mt-5 flex items-center gap-3">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={s.avatar}
                        alt=""
                        className="h-11 w-11 rounded-full ring-2 ring-saffron-500/50"
                      />
                      <div>
                        <p className="font-medium text-ink">{s.name}</p>
                        <p className="text-sm text-saffron-500">{s.role}</p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
        )}

        {/* Listings */}
        {orgCourses.length > 0 && (
          <Reveal className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {tx("Available courses")}
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 card-grid">
              {orgCourses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </Reveal>
        )}
        {/*
          No openings here. The ones this page listed came from the sample
          catalogue, keyed to these organisations by hand, and every card led
          to "That opening is no longer listed". Real openings belong to
          employers in `companies` and live on /jobs and /internships.
        */}

        {/* Reviews */}
        <Reveal className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink">{tx("Reviews")}</h2>
          {org.reviews.length === 0 && (
            <p className="mt-3 text-ink-mute">{tx("No reviews yet.")}</p>
          )}
          <div className="mt-6 space-y-4">
            {org.reviews.map((r) => (
              <div key={r.author} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={r.avatar}
                    alt=""
                    className="h-10 w-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-ink">{r.author}</p>
                    <StarRating value={r.rating} />
                  </div>
                </div>
                <p className="mt-3 leading-relaxed text-ink-soft">"{r.text}"</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/**
 * Facility labels in the data mix Title Case ("Residential Campus") and sentence
 * case ("Staff canteen"). Show them all in sentence case: lowercase every plain
 * capitalized word after the first, but leave acronyms and mixed-case words
 * ("PF", "IoT", "Wi-Fi") as written.
 */
function sentenceCase(label: string): string {
  return label
    .split(" ")
    .map((w, i) => (i > 0 && /^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w))
    .join(" ");
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
