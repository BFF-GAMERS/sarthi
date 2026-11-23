import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin, Video, Building2, ArrowUpRight } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/Reveal";
import { events, type SkillEvent } from "@/data/topics";
import LocationBar, { defaultLocationState, type LocationState } from "@/components/LocationBar";
import { distanceFor, DISTANCE_OPTIONS, byDistance } from "@/lib/location";
import { SloganPlate } from "../components/Ornaments";

const TITLE = "Skill events, job fairs, summits & workshops | स्वYAM";
const DESC =
  "Job fairs, hackathons, bootcamps, summits and interview workshops across India — online and in person.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Sep 2026" → local midnight of that day, or null if the string is not in that shape. */
function eventDay(date: string): Date | null {
  const [d, m, y] = date.split(" ");
  const month = MONTHS.indexOf(m ?? "");
  const day = Number(d);
  const year = Number(y);
  if (month < 0 || !day || !year) return null;
  return new Date(year, month, day);
}

/**
 * Split by the visitor's own date at render time, so an event never sits under
 * "upcoming" with a Register button after it has happened. An event whose date
 * cannot be read is treated as upcoming rather than silently hidden.
 */
function splitByDate<T>(rows: T[], dateOf: (row: T) => string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const row of rows) {
    const day = eventDay(dateOf(row));
    (day && day.getTime() < today ? past : upcoming).push(row);
  }
  const t = (row: T) => eventDay(dateOf(row))?.getTime() ?? Infinity;
  upcoming.sort((a, b) => t(a) - t(b));
  past.sort((a, b) => t(b) - t(a));
  return { upcoming, past };
}

const FILTERS = [
  "All",
  "Job fair",
  "Workshop",
  "Bootcamp",
  "Webinar",
  "Masterclass",
  "Summit",
  "Meetup",
  "Competition",
] as const;

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loc, setLoc] = useState<LocationState>(defaultLocationState);
  const maxKm = DISTANCE_OPTIONS.find((d) => d.id === loc.distance)?.km ?? Infinity;

  // Nearest events first once a city is chosen; online events always qualify.
  const list = events
    .map((e) => ({ event: e, km: distanceFor(loc.city, e.city, e.online) }))
    .filter(({ event: e, km }) => {
      if (filter !== "All" && e.type !== filter) return false;
      if (loc.remoteOnly && !e.online) return false;
      if (loc.city && maxKm !== Infinity && (km === null || km > maxKm)) return false;
      return true;
    })
    .sort(loc.city ? byDistance((r) => r.km) : () => 0);

  // Soonest first; once a city is chosen, nearest first within upcoming instead.
  const split = splitByDate(list, (r) => r.event.date);
  const upcoming = loc.city ? [...split.upcoming].sort(byDistance((r) => r.km)) : split.upcoming;
  const past = split.past;

  return (
    <div className="relative z-10">
      <section className="border-b border-ink-line">
        <div className="container-x pb-10 pt-28 lg:pt-36">
          <SloganPlate tone="rani">Events · show up in person</SloganPlate>
          <h1 className="section-title mt-4 max-w-3xl">
            Handshakes still
            <span className="block text-saffron-500">beat applications.</span>
          </h1>
          <p className="type-lede mt-5 max-w-2xl text-ink-soft">
            Job fairs, hackathons, bootcamps and workshops across India and online — most of them
            free.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className="filter-pill"
              >
                {f}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <LocationBar value={loc} onChange={setLoc} showRemote />
          </div>
        </div>
      </section>

      <section className="container-x py-14">
        <h2 className="sr-only">Upcoming events</h2>
        <p className="mb-6 font-body text-sm text-ink-mute" role="status" aria-live="polite">
          {upcoming.length} upcoming {upcoming.length === 1 ? "event" : "events"}
        </p>

        <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 card-grid">
          {upcoming.map(({ event: e, km }) => (
            <StaggerItem key={e.id}>
              <EventCard e={e} km={km} showKm={!!loc.city} />
            </StaggerItem>
          ))}
        </Stagger>

        {upcoming.length === 0 && (
          <div className="panel p-12 text-center">
            <p className="font-display text-xl tracking-tight">
              {list.length === 0
                ? "Nothing scheduled in this category yet"
                : "No upcoming events here yet"}
            </p>
            <button
              onClick={() => {
                setFilter("All");
                setLoc(defaultLocationState);
              }}
              className="btn-ghost mt-6"
            >
              Show all events
            </button>
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-16 border-t border-ink-line pt-10">
            <h2 className="font-display text-xl tracking-tight text-ink">Past events</h2>
            <p className="mt-1 font-body text-sm text-ink-mute">
              {past.length} {past.length === 1 ? "event has" : "events have"} already taken place.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-6 opacity-80 md:grid-cols-2 xl:grid-cols-3">
              {past.map(({ event: e, km }) => (
                <EventCard key={e.id} e={e} km={km} showKm={!!loc.city} past />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EventCard({
  e,
  km,
  showKm,
  past = false,
}: {
  e: SkillEvent;
  km: number | null;
  showKm: boolean;
  past?: boolean;
}) {
  const [day, month, year] = e.date.split(" ");
  return (
    <article className="card group flex h-full flex-col overflow-hidden">
      {/* Banner */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={e.banner}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <span className="badge-soft absolute left-3 top-3">{past ? "Past" : e.type}</span>
        {showKm && km !== null && km > 0 && (
          <span className="badge-soft absolute bottom-3 right-3">{km} km away</span>
        )}
        <span className="badge-soft absolute right-3 top-3">
          {e.online ? (
            <>
              <Video size={12} aria-hidden /> Online
            </>
          ) : (
            <>
              <Building2 size={12} aria-hidden /> In person
            </>
          )}
        </span>
        <div
          className="absolute bottom-3 left-3 flex h-16 w-14 flex-col items-center justify-center rounded-xl bg-paper-light/95 shadow-[var(--shadow-soft)] backdrop-blur-sm"
          aria-label={e.date}
        >
          <span className="font-display text-xl leading-none text-ink">{day}</span>
          <span className="font-body text-[10px] font-medium uppercase tracking-wide text-saffron-600">
            {month}
          </span>
          {year && (
            <span className="font-mono text-[9.5px] tabular-nums text-ink-mute">{year}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg leading-tight tracking-tight text-ink transition-colors duration-200 group-hover:text-saffron-600">
          {e.title}
        </h3>

        <p className="mt-2.5 flex-1 font-body text-sm leading-relaxed text-ink-soft">{e.detail}</p>

        <dl className="mt-4 space-y-2 border-t border-ink-line pt-3.5 font-body text-sm">
          <Row icon={<CalendarDays size={13} />} label="Date" value={e.date} />
          <Row icon={<Clock size={13} />} label="Time" value={e.time} />
          <Row
            icon={<MapPin size={13} />}
            label={e.online ? "Platform" : "Venue"}
            value={e.venue}
          />
          <Row icon={<Building2 size={13} />} label="Organizer" value={e.host} />
        </dl>

        {past ? (
          <p className="mt-5 font-body text-xs text-ink-mute">This event has taken place.</p>
        ) : (
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="btn-primary mt-5 !py-2.5 !text-xs"
          >
            Register <ArrowUpRight size={15} aria-hidden />
          </Link>
        )}
      </div>
    </article>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-saffron-500" aria-hidden>
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="leading-snug text-ink-soft">{value}</dd>
    </div>
  );
}
