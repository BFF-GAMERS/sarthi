import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  MapPin,
  Languages,
  CalendarCheck,
  Award,
  Upload,
  Pencil,
  Github,
  Linkedin,
  Globe,
  BadgeCheck,
  Bookmark,
  Activity,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { CourseCard } from "../components/Cards";
import { courses } from "../data/mock";
import OpportunityCard from "../components/OpportunityCard";
import { listOpportunities } from "../lib/opportunities";
import ProfileEditor from "../components/ProfileEditor";
import ConnectionRequests from "../components/ConnectionRequests";
import { TeachList, LearnList } from "../components/SkillLists";
import SwapActivity from "../components/SwapActivity";
import { getProfile, saveProfile, type UserProfile } from "../lib/local-store";
import { useAuth } from "../context/AuthContext";
import {
  listActivity,
  listBadges,
  listCertificates,
  listEnrollments,
  listUserLanguages,
  listSaves,
  getProfileDetail,
  getMemberMetrics,
} from "../lib/profile-data";
import { useTx } from "../lib/i18n";

/** "3 days ago" style label for a timestamp. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Profile() {
  const tx = useTx();
  const { user, profileId, updateUser, ready } = useAuth();
  const navigate = useNavigate();

  // Everything below is this member's own record. Where there is nothing yet
  // the section says so rather than showing someone else's story.
  const enabled = Boolean(profileId);
  const detail = useQuery({
    queryKey: ["profile-detail", profileId],
    queryFn: () => getProfileDetail(profileId!),
    enabled,
  });
  const newest = useQuery({
    queryKey: ["opportunities", "all"],
    queryFn: () => listOpportunities(),
    enabled,
  });
  const metrics = useQuery({
    queryKey: ["member-metrics", profileId],
    queryFn: () => getMemberMetrics(profileId!),
    enabled,
  });
  const badgeList = useQuery({
    queryKey: ["badges", profileId],
    queryFn: () => listBadges(profileId!),
    enabled,
  });
  const certList = useQuery({
    queryKey: ["certificates", profileId],
    queryFn: () => listCertificates(profileId!),
    enabled,
  });
  const activityList = useQuery({
    queryKey: ["activity", profileId],
    queryFn: () => listActivity(profileId!),
    enabled,
  });
  const enrollments = useQuery({
    queryKey: ["enrollments", profileId],
    queryFn: () => listEnrollments(profileId!),
    enabled,
  });
  const langs = useQuery({
    queryKey: ["user-languages", profileId],
    queryFn: () => listUserLanguages(profileId!),
    enabled,
  });
  const saves = useQuery({
    queryKey: ["saves", profileId],
    queryFn: () => listSaves(profileId!),
    enabled,
  });
  const completed = (enrollments.data ?? []).filter((e) => e.state === "completed");
  const [resume, setResume] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    // `ready` is the whole point: Supabase restores the session asynchronously,
    // so on a refresh or a direct link `user` is briefly null for a logged-in
    // person. Redirecting on that null threw them out of their own account
    // every time they reloaded the page.
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  // Load the stored profile, seeding it from the session on first visit.
  useEffect(() => {
    if (!user) return;
    setProfile(
      getProfile(user.email) ?? {
        name: user.name,
        email: user.email,
        phone: "",
        bio: "",
        location: "",
        education: "",
        skills: [],
        avatar: user.avatar,
      },
    );
  }, [user]);

  if (!user || !profile) return null;

  const handleSave = (next: UserProfile) => {
    saveProfile(user.email, next);
    setProfile(next);
    // Keep the session (navbar, dashboard) in step with the edit.
    updateUser({ name: next.name, avatar: next.avatar });
    setEditing(false);
    setSavedAt(Date.now());
  };

  return (
    <div className="pb-24">
      {/* Cover + identity */}
      <section className="relative h-56 overflow-hidden sm:h-72">
        <motion.img
          src="https://images.unsplash.com/photo-1514392181188-8f5d54262fa5?auto=format&fit=crop&w=1600&q=70"
          alt=""
          className="h-full w-full object-cover"
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.3 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/30 to-transparent" />
        <button className="btn-ghost absolute right-4 top-20 !px-3 !py-2 text-xs">
          <Pencil size={13} aria-hidden /> {tx("Edit cover")}
        </button>
      </section>

      <div className="container-x">
        <Reveal className="relative z-10 -mt-14">
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-5">
                <img
                  loading="lazy"
                  decoding="async"
                  src={profile.avatar}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-3xl object-cover ring-4 ring-saffron-500/60"
                />
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                    {profile.name}
                  </h1>
                  <p className="mt-1 text-saffron-500">
                    {detail.data?.headline ||
                      profile.education ||
                      "Add a headline from Edit profile"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-mute">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={14} aria-hidden />{" "}
                      {detail.data?.region || profile.location || "Add your city"}
                    </span>
                    {(langs.data ?? []).length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Languages size={14} aria-hidden />{" "}
                        {(langs.data ?? []).map((l) => l.native).join(" · ")}
                      </span>
                    )}
                    {detail.data?.handle && (
                      <span className="font-mono text-xs">@{detail.data.handle}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Only a link the member actually saved — dead "#" icons
                    told visitors nothing and went nowhere. */}
                {detail.data?.websiteUrl && (
                  <a
                    href={detail.data.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-ghost !p-2.5"
                    aria-label={tx("Website")}
                  >
                    <Globe size={17} />
                  </a>
                )}
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="btn-primary !py-2.5 text-sm"
                  aria-expanded={editing}
                >
                  <Pencil size={15} aria-hidden /> {editing ? "Close editor" : "Edit profile"}
                </button>
              </div>
            </div>
            <p className="mt-6 max-w-3xl leading-relaxed text-ink-soft">
              {detail.data?.bio ||
                profile.bio ||
                "No bio yet. Say what you work on and what you're trying to learn — it's the first thing a swap partner reads."}
            </p>
            {(badgeList.data ?? []).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {(badgeList.data ?? []).map((b) => (
                  <span
                    key={b.name}
                    title={b.description ?? undefined}
                    className="chip !border-saffron-500/30 !bg-saffron-50 !text-sm"
                  >
                    {b.icon ?? "🏅"} {b.name}
                  </span>
                ))}
              </div>
            )}

            {/* Live counts, so the header reflects the account rather than a
                fixed set of numbers. */}
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Teaching", value: metrics.data?.skillsOffered ?? 0 },
                { label: "Learning", value: metrics.data?.skillsWanted ?? 0 },
                { label: "Swaps done", value: metrics.data?.swapsCompleted ?? 0 },
                { label: "Level", value: metrics.data?.level ?? 1 },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl bg-paper-dim px-4 py-3">
                  <dd className="font-display text-2xl leading-none text-ink tabular-nums">
                    {m.value}
                  </dd>
                  <dt className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                    {m.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {savedAt && !editing && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-emeraldx-400/30 bg-emeraldx-400/10 px-4 py-3 font-body text-sm font-medium text-emeraldx-500"
          >
            {tx("Profile saved.")}
          </p>
        )}

        {editing && (
          <div className="mt-6">
            <ProfileEditor
              initial={profile}
              onCancel={() => setEditing(false)}
              onSave={handleSave}
            />
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-8 lg:col-span-2">
            {/* The two lists SkillSwap matches on. Same records the passport,
                dashboard and Sarthi read — this is the only place they're edited. */}
            {profileId ? (
              <>
                {/* Draws nothing unless somebody is waiting on you. It sits
                    first because it is the only thing on this page that
                    another person is blocked on. */}
                <Reveal>
                  <ConnectionRequests />
                </Reveal>
                <Reveal>
                  <TeachList profileId={profileId} />
                </Reveal>
                <Reveal>
                  <LearnList profileId={profileId} />
                </Reveal>
              </>
            ) : (
              <Reveal>
                <div className="glass rounded-3xl p-6">
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Skills &amp; levels
                  </h2>
                  <p className="mt-3 font-body text-sm text-ink-mute">
                    {tx(
                      "Connect a database to build your teach and learn lists \u2014 they're what SkillSwap matches on.",
                    )}
                  </p>
                </div>
              </Reveal>
            )}

            <Reveal>
              <div className="glass rounded-3xl p-6">
                <h2 className="font-display text-xl font-semibold text-ink">
                  {tx("Enrolled courses")}
                </h2>
                {(enrollments.data ?? []).length === 0 ? (
                  <p className="mt-4 font-body text-sm text-ink-mute">
                    You aren't enrolled in anything yet.{" "}
                    <Link to="/courses" className="link-sweep text-saffron-500">
                      {tx("Browse the catalog")}
                    </Link>{" "}
                    and your progress will track here.
                  </p>
                ) : (
                  <div className="mt-5 space-y-5">
                    {(enrollments.data ?? []).map((e) => (
                      <div key={e.id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                          <Link
                            to="/courses/$id"
                            params={{ id: e.slug }}
                            className="link-sweep font-medium text-ink hover:text-saffron-500"
                          >
                            {e.title}
                          </Link>
                          <span className="font-mono text-xs tabular-nums text-ink-mute">
                            {Math.round(e.progressPercent)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-paper-dim">
                          <motion.div
                            className="h-full rounded-full bg-saffron-500"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${e.progressPercent}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                        <p className="mt-1 font-body text-[11px] text-ink-mute">
                          {e.state === "completed"
                            ? "Completed"
                            : `${e.lessonsCompleted} lesson${e.lessonsCompleted === 1 ? "" : "s"} done`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Reveal>

            <Reveal>
              <div className="glass rounded-3xl p-6">
                <h2 className="font-display text-xl font-semibold text-ink">
                  {tx("Certificates")}
                </h2>
                {(certList.data ?? []).length === 0 ? (
                  <p className="mt-4 font-body text-sm text-ink-mute">
                    {tx(
                      "Nothing issued yet. Finishing a course or passing an assessment issues a certificate with a verifiable serial.",
                    )}
                  </p>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(certList.data ?? []).map((c) => (
                      <div key={c.id} className="rounded-2xl bg-paper-dim p-4">
                        <p className="text-2xl" aria-hidden>
                          {c.revoked ? "🚫" : "📜"}
                        </p>
                        <p className="mt-2 font-medium text-ink">{c.title}</p>
                        <p className="text-sm text-ink-mute">
                          {c.issuer ?? "स्वYAM"}
                          {c.issuedAt && ` · ${new Date(c.issuedAt).getFullYear()}`}
                          {c.score !== null && ` · ${Math.round(c.score)}%`}
                        </p>
                        {c.serial && (
                          <p className="mt-1 font-mono text-[10px] text-ink-mute">{c.serial}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Reveal>

            <Reveal>
              <div className="glass rounded-3xl p-6">
                <h2 className="font-display text-xl font-semibold text-ink">{tx("Activity")}</h2>
                {(activityList.data ?? []).length === 0 ? (
                  <p className="mt-4 font-body text-sm text-ink-mute">
                    {tx(
                      "Nothing recorded yet. Completing swaps, sessions, lessons and assessments all show up here.",
                    )}
                  </p>
                ) : (
                  <ul className="mt-5 space-y-4">
                    {(activityList.data ?? []).map((a) => (
                      <li key={a.id} className="flex items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-saffron-100 text-saffron-500">
                          <Activity size={15} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-baseline justify-between gap-2 text-sm text-ink">
                            <span>{a.text}</span>
                            {a.delta !== null && a.delta !== 0 && (
                              <span className="shrink-0 font-mono text-[11px] tabular-nums text-emeraldx-400">
                                {a.delta > 0 ? `+${a.delta}` : a.delta} XP
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-ink-mute">{relativeTime(a.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          </div>

          {/* Right column */}
          <div className="space-y-8">
            {profileId && (
              <Reveal delay={0.05}>
                <SwapActivity profileId={profileId} />
              </Reveal>
            )}

            <Reveal delay={0.1}>
              <div className="glass rounded-3xl p-6">
                <h2 className="font-display text-xl font-semibold text-ink">{tx("Resume")}</h2>
                {resume ? (
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-paper-dim p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden>
                        📄
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink">{resume}</p>
                        <p className="text-xs text-ink-mute">{tx("Stored on this device only")}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-mute">{tx("No resume uploaded yet.")}</p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setResume(e.target.files[0].name)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost mt-4 w-full text-sm"
                >
                  <Upload size={15} aria-hidden /> {resume ? "Replace resume" : "Upload resume"}
                </button>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="glass rounded-3xl p-6">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
                  <Bookmark size={18} className="text-saffron-500" aria-hidden />{" "}
                  {tx("Saved items")}
                </h2>
                {(saves.data ?? []).length === 0 ? (
                  <p className="mt-4 font-body text-sm text-ink-mute">
                    {tx(
                      "Nothing saved yet. Use the bookmark on any course, job or internship and it lands here.",
                    )}
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {(saves.data ?? []).map((item) => {
                      return (
                        <div
                          key={`${item.kind}-${item.targetId}`}
                          className="rounded-2xl bg-paper-dim p-3.5"
                        >
                          <p className="text-sm font-medium text-ink">{item.title}</p>
                          <p className="text-xs capitalize text-ink-mute">
                            {item.kind}
                            {item.meta ? ` · ${item.meta}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="glass rounded-3xl p-6">
                <h2 className="font-display text-xl font-semibold text-ink">{tx("Completed")}</h2>
                {completed.length === 0 ? (
                  <p className="mt-4 font-body text-sm text-ink-mute">
                    {tx("No courses finished yet.")}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {completed.map((c) => (
                      <li key={c.id} className="rounded-2xl bg-paper-dim p-3.5">
                        <p className="text-sm font-medium text-ink">{c.title}</p>
                        <p className="text-xs text-emeraldx-400">
                          Completed
                          {c.completedAt &&
                            ` · ${new Date(c.completedAt).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          </div>
        </div>

        {/*
          Headed for what it is. "Recommended for you" was `jobs.slice(0, 2)`
          from the sample catalogue — the same two, for everyone, recommended
          by nothing, and neither of them a real posting.
        */}
        {(newest.data ?? []).length > 0 && (
          <Reveal className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {tx("Newest openings")}
            </h2>
            <Stagger className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 card-grid">
              {(newest.data ?? []).slice(0, 2).map((o) => (
                <StaggerItem key={o.id}>
                  <OpportunityCard opportunity={o} />
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
        )}
      </div>
    </div>
  );
}
