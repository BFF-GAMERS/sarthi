import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookOpen,
  Check,
  GraduationCap,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import AdminContent from "../components/AdminContent";
import PillTabs from "../components/PillTabs";
import { useAuth } from "../context/AuthContext";
import {
  ASSIGNABLE_ROLES,
  countAdmins,
  grantRole,
  isAdmin,
  listCertificates,
  listCourses,
  listEnrolments,
  listMembers,
  platformMetrics,
  revokeRole,
  setAdmin,
  setCertificateRevoked,
  setEnrolmentState,
  unpublishCourse,
  updateCourse,
  updateMember,
  type AppRole,
  certifyTrainer,
  listCertifiedTrainers,
  revokeCertification,
  listCoachFeedback,
  listContactMessages,
  setContactHandled,
} from "../lib/admin";
import { listSkills } from "../lib/skillswap";
import { formatMinor } from "../lib/catalogue";
import {
  adminCreateCoupon,
  adminDeleteCoupon,
  adminSetCouponListed,
  listAllCoupons,
  setCouponActive,
} from "../lib/rewards";
import { listReports, resolveReport, type ReportState } from "../lib/safety";
import { useTx } from "../lib/i18n";
import { PROFILE_TYPES } from "../lib/profile-type";

/**
 * Administration.
 *
 * Gated on the real `admin` role, checked against the database rather than
 * anything held in the browser. Every control here is an ordinary query that
 * row-level security either allows or refuses — so this screen is a
 * convenience for someone who already has the power, never the thing that
 * grants it.
 */

type Tab =
  | "overview"
  | "reports"
  | "members"
  | "trainers"
  | "courses"
  | "enrolments"
  | "certificates"
  | "coupons"
  | "messages"
  | "coach"
  | "content";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  // Second, not last. A report is the only thing on this screen where the
  // cost of not looking today is borne by a person rather than by a number.
  { id: "reports", label: "Reports" },
  // Third, for the same reason reports are second: on the other side of an
  // unread message is a person waiting, not a number.
  { id: "messages", label: "Messages" },
  { id: "members", label: "Members" },
  { id: "trainers", label: "Trainers" },
  { id: "courses", label: "Courses" },
  { id: "enrolments", label: "Enrollments" },
  { id: "certificates", label: "Certificates" },
  { id: "coupons", label: "Coupons" },
  { id: "coach", label: "Coach feedback" },
  // Last, because it edits the catalogue rather than acting on somebody.
  { id: "content", label: "Content" },
];

export default function Admin() {
  const tx = useTx();
  const { user, profileId, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const admin = useQuery({
    queryKey: ["is-admin", profileId],
    queryFn: isAdmin,
    enabled: Boolean(profileId),
  });

  const say = (tone: "ok" | "bad", text: string) => {
    setNote({ tone, text });
    window.setTimeout(() => setNote(null), 4000);
  };

  if (!user) return null;

  /*
   * Restoring the session takes a moment, and until it lands `profileId` is
   * null and the query above is disabled — which react-query reports as "not
   * loading, no data", not as pending. Treating that as a refusal flashed
   * "Not an administrator" at every administrator on every load, so the wait
   * is spelled out explicitly here.
   */
  const stillChecking = !ready || !profileId || admin.isLoading || admin.isFetching;

  if (stillChecking) {
    return (
      <div className="container-x max-w-5xl pb-24 pt-28">
        <p className="flex items-center gap-2 font-body text-sm text-ink-mute">
          <Loader2 size={16} className="animate-spin" aria-hidden />{" "}
          {tx("Checking your access\u2026")}
        </p>
      </div>
    );
  }

  if (!admin.data) {
    return (
      <div className="container-x max-w-2xl pb-24 pt-28">
        <div className="panel flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-saffron-50 text-saffron-500">
            <ShieldAlert size={22} aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-xl tracking-tight text-ink">
            {tx("Not an administrator")}
          </h1>
          <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-ink-mute">
            {tx(
              "This account does not hold the admin role. The role is granted in the database, not from this page \u2014 which is why there is nothing to try here.",
            )}
          </p>
          <Link to="/dashboard" className="btn-ghost mt-6 !py-2.5 !text-xs">
            {tx("Back to your dashboard")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x max-w-6xl pb-24 pt-28">
      <Reveal>
        <p className="kicker flex items-center gap-1.5">
          <ShieldCheck size={12} aria-hidden /> {tx("Admin")}
        </p>
        <h1 className="mt-3 section-title">{tx("Control room")}</h1>
        <p className="type-lede mt-4 max-w-2xl">
          {tx("Everything on the platform, editable. Changes here are real and immediate.")}
        </p>
      </Reveal>

      {note && (
        <p
          role="status"
          className={`mt-6 rounded-[var(--radius-control)] border px-4 py-3 font-body text-sm ${
            note.tone === "ok"
              ? "border-emeraldx-400/30 bg-emeraldx-400/10 text-emeraldx-400"
              : "border-saffron-200 bg-saffron-50 text-saffron-700"
          }`}
        >
          {note.text}
        </p>
      )}

      <div className="mt-8 border-b border-ink-line pb-4">
        <PillTabs
          tabs={TABS}
          selected={tab}
          onSelect={setTab}
          layoutGroup="admin"
          ariaLabel={tx("Admin sections")}
        />
      </div>

      <div className="mt-8">
        {tab === "overview" && <Overview />}
        {tab === "reports" && <Reports onNote={say} />}
        {tab === "members" && <Members onNote={say} />}
        {tab === "trainers" && <Trainers onNote={say} />}
        {tab === "courses" && <Courses onNote={say} />}
        {tab === "enrolments" && <Enrolments onNote={say} qc={qc} />}
        {tab === "certificates" && <Certificates onNote={say} />}
        {tab === "coupons" && <Coupons onNote={say} />}
        {tab === "messages" && <Messages onNote={say} />}
        {tab === "coach" && <CoachFeedbackTab />}
        {tab === "content" && <AdminContent onNote={say} />}
      </div>
    </div>
  );
}

/* ── Coach feedback ──────────────────────────────────────────────── */

/**
 * What students said under their plans. Counts first, then the notes,
 * because the notes are the part that changes the prompt.
 */
function CoachFeedbackTab() {
  const tx = useTx();
  const q = useQuery({ queryKey: ["admin-coach-feedback"], queryFn: () => listCoachFeedback() });
  const rows = q.data?.rows ?? [];
  const byKind = ["school", "college", "career"].map((k) => {
    const of = rows.filter((r) => r.kind === k);
    return {
      kind: k,
      yes: of.filter((r) => r.helpful).length,
      no: of.filter((r) => !r.helpful).length,
    };
  });

  if (q.isLoading) return <p className="font-body text-sm text-ink-mute">Loading…</p>;
  if (q.isError)
    return <p className="font-body text-sm text-danger">{(q.error as Error).message}</p>;
  if (q.data && !q.data.available) {
    return (
      <p className="font-body text-sm text-ink-mute">
        {tx("Run db/023_coach_feedback.sql and the answers appear here.")}
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="font-body text-sm text-ink-mute">{tx("Nobody has answered yet.")}</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {byKind.map((b) => (
          <div key={b.kind} className="card-flat p-4">
            <p className="font-body text-[11px] uppercase tracking-wide text-ink-mute">{b.kind}</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-ink">
              {b.yes} <span className="text-[13px] text-emeraldx-400">{tx("helpful")}</span>{" "}
              <span className="text-ink-mute">·</span> {b.no}{" "}
              <span className="text-[13px] text-ink-mute">{tx("not")}</span>
            </p>
          </div>
        ))}
      </div>
      <ul className="mt-5 space-y-2">
        {rows
          .filter((r) => r.note)
          .map((r) => (
            <li key={r.id} className="card-flat p-4">
              <p className="font-body text-[12px] text-ink-mute">
                <span className={r.helpful ? "text-emeraldx-400" : "text-saffron-600"}>
                  {r.helpful ? tx("Helpful") : tx("Not helpful")}
                </span>{" "}
                · {r.kind} · {r.memberName} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-1 font-body text-sm text-ink">{r.note}</p>
            </li>
          ))}
      </ul>
    </>
  );
}

/* ── Overview ────────────────────────────────────────────────────── */

function Overview() {
  const metrics = useQuery({ queryKey: ["platform-metrics"], queryFn: platformMetrics });
  const m = metrics.data;

  const cards = [
    { label: "Members", value: m?.members, icon: <Users size={18} aria-hidden /> },
    { label: "Courses", value: m?.courses, icon: <BookOpen size={18} aria-hidden /> },
    { label: "Openings", value: m?.opportunities, icon: <GraduationCap size={18} aria-hidden /> },
    { label: "Enrollments", value: m?.enrolments, icon: <BookOpen size={18} aria-hidden /> },
    { label: "Completions", value: m?.completions, icon: <Check size={18} aria-hidden /> },
    { label: "Certificates", value: m?.certificates, icon: <BadgeCheck size={18} aria-hidden /> },
    { label: "Active swaps", value: m?.swapsActive, icon: <Users size={18} aria-hidden /> },
    {
      label: "Applications",
      value: m?.applications,
      icon: <GraduationCap size={18} aria-hidden />,
    },
  ];

  if (metrics.isLoading) {
    return (
      <p className="flex items-center gap-2 font-body text-sm text-ink-mute">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Loading…
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="card p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-saffron-100 text-saffron-500">
            {c.icon}
          </span>
          <p className="mt-3 font-display text-2xl leading-none text-ink tabular-nums">
            {c.value ?? 0}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            {c.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Shared search field ─────────────────────────────────────────── */

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative mb-5 block">
      <span className="sr-only">{placeholder}</span>
      <Search
        size={15}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input !pl-9"
      />
    </label>
  );
}

/* ── Members ─────────────────────────────────────────────────────── */

function Members({ onNote }: { onNote: (t: "ok" | "bad", m: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    displayName: "",
    headline: "",
    region: "",
    profileType: "",
  });

  const members = useQuery({
    queryKey: ["admin-members", search],
    queryFn: () => listMembers(search),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-members"] });

  const save = useMutation({
    mutationFn: (id: string) =>
      updateMember(id, {
        displayName: draft.displayName.trim(),
        headline: draft.headline.trim() || null,
        region: draft.region.trim() || null,
        profileType: draft.profileType || null,
      }),
    onSuccess: () => {
      onNote("ok", "Member updated.");
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  /** The member whose admin status is one click from changing. */
  const [confirmAdmin, setConfirmAdmin] = useState<string | null>(null);

  // Shown next to the control so the consequence of removing one is visible
  // before the attempt, not after the database refuses it.
  const admins = useQuery({ queryKey: ["admin-count"], queryFn: countAdmins });

  const admin = useMutation({
    mutationFn: (v: { id: string; make: boolean }) => setAdmin(v.id, v.make),
    onSuccess: (_d, v) => {
      onNote("ok", v.make ? "Admin granted." : "Admin removed.");
      setConfirmAdmin(null);
      void admins.refetch();
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const role = useMutation({
    mutationFn: (v: { id: string; role: AppRole; held: boolean }) =>
      v.held ? revokeRole(v.id, v.role) : grantRole(v.id, v.role),
    onSuccess: (_d, v) => {
      onNote("ok", `${v.held ? "Revoked" : "Granted"} ${v.role}.`);
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  return (
    <>
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder={tx("Search by name or handle")}
      />
      {members.isLoading && <p className="font-body text-sm text-ink-mute">Loading…</p>}

      <ul className="space-y-3">
        {(members.data ?? []).map((m) => (
          <li key={m.id} className="card-flat p-4">
            {editing === m.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    value={draft.displayName}
                    onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                    placeholder={tx("Display name")}
                    className="input !py-2 !text-[13px]"
                  />
                  <input
                    value={draft.headline}
                    onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                    placeholder={tx("Headline")}
                    className="input !py-2 !text-[13px]"
                  />
                  <input
                    value={draft.region}
                    onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                    placeholder={tx("Region")}
                    className="input !py-2 !text-[13px]"
                  />
                  {/*
                    Who this member is — the answer that decides their
                    dashboard and coach. Editable here so a wrong pick is a
                    one-line correction. "Not set" clears it and they are
                    asked again on their next visit.
                  */}
                  <select
                    value={draft.profileType}
                    onChange={(e) => setDraft({ ...draft, profileType: e.target.value })}
                    className="input !py-2 !text-[13px]"
                    aria-label={tx("Profile type")}
                  >
                    <option value="">{tx("Profile type: not set (ask again)")}</option>
                    {PROFILE_TYPES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {tx(p.label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => save.mutate(m.id)}
                    className="btn-primary !py-2 !text-xs"
                    disabled={save.isPending}
                  >
                    {tx("Save")}
                  </button>
                  <button onClick={() => setEditing(null)} className="btn-ghost !py-2 !text-xs">
                    {tx("Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-body text-sm font-medium text-ink">
                      {m.displayName}
                      <span className="font-mono text-[11px] text-ink-mute">@{m.handle}</span>
                      {m.isDemo && <span className="chip !text-[10px]">demo</span>}
                      {m.profileType && (
                        <span className="chip !text-[10px]">
                          {tx(
                            PROFILE_TYPES.find((p) => p.id === m.profileType)?.label ??
                              m.profileType,
                          )}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                      {m.headline ?? "No headline"}
                      {m.region ? ` · ${m.region}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(m.id);
                      setDraft({
                        displayName: m.displayName,
                        headline: m.headline ?? "",
                        region: m.region ?? "",
                        profileType: m.profileType ?? "",
                      });
                    }}
                    className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]"
                  >
                    {tx("Edit")}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ASSIGNABLE_ROLES.map((r) => {
                    const held = m.roles.includes(r);
                    return (
                      <button
                        key={r}
                        onClick={() => role.mutate({ id: m.id, role: r, held })}
                        aria-pressed={held}
                        title={held ? `Revoke ${r}` : `Grant ${r}`}
                        className={`rounded-full border px-2.5 py-1 font-body text-[10px] font-medium transition-colors ${
                          held
                            ? "border-transparent bg-ink text-paper-light"
                            : "border-ink-line bg-paper-light text-ink-mute hover:border-saffron-200"
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>

                {/*
                  Admin is not a chip.

                  It hands over every member, course and certificate on the
                  platform, so it asks first and says what it means — the other
                  eight roles are reversible in a click and this one can lock
                  you out of your own project.
                */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-line pt-3">
                  <span className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
                    {tx("Platform admin")}
                  </span>

                  {confirmAdmin === m.id ? (
                    <>
                      <span className="font-body text-[12px] text-ink-soft">
                        {m.roles.includes("admin")
                          ? tx("Remove admin from this account?")
                          : tx("Give this account full control of the platform?")}
                      </span>
                      <button
                        onClick={() => admin.mutate({ id: m.id, make: !m.roles.includes("admin") })}
                        disabled={admin.isPending}
                        className="btn-primary !px-3 !py-1.5 !text-[11px]"
                      >
                        {m.roles.includes("admin") ? tx("Yes, remove") : tx("Yes, make admin")}
                      </button>
                      <button
                        onClick={() => setConfirmAdmin(null)}
                        className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                      >
                        {tx("Cancel")}
                      </button>
                    </>
                  ) : m.roles.includes("admin") ? (
                    <>
                      <span className="chip !text-[10px]">{tx("Admin")}</span>
                      <button
                        onClick={() => setConfirmAdmin(m.id)}
                        className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                      >
                        {tx("Remove admin")}
                      </button>
                      {(admins.data ?? 0) <= 1 && (
                        <span className="font-body text-[11px] text-ink-mute">
                          {tx("Last admin — promote somebody else first.")}
                        </span>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmAdmin(m.id)}
                      className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                    >
                      {tx("Make admin")}
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Courses ─────────────────────────────────────────────────────── */

function Courses({ onNote }: { onNote: (t: "ok" | "bad", m: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const courses = useQuery({
    queryKey: ["admin-courses", search],
    queryFn: () => listCourses(search),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-courses"] });

  const toggle = useMutation({
    mutationFn: (v: { id: string; published: boolean }) =>
      v.published ? unpublishCourse(v.id) : updateCourse(v.id, { isPublished: true }),
    onSuccess: (_d, v) => {
      onNote("ok", v.published ? "Course withdrawn." : "Course published.");
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  return (
    <>
      <SearchField value={search} onChange={setSearch} placeholder={tx("Search courses")} />
      {courses.isLoading && <p className="font-body text-sm text-ink-mute">Loading…</p>}

      <ul className="space-y-2">
        {(courses.data ?? []).map((c) => (
          <li key={c.id} className="card-flat flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-medium text-ink">{c.title}</p>
              <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                {c.level} · {c.isFree ? "Free" : formatMinor(c.priceMinor)} · {c.enrolmentCount}{" "}
                enrolled
                {c.ratingAvg ? ` · ${c.ratingAvg.toFixed(1)}★` : ""}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 font-body text-[10px] font-medium ${
                c.isPublished
                  ? "border-emeraldx-400/30 bg-emeraldx-400/10 text-emeraldx-400"
                  : "border-ink-line bg-paper text-ink-mute"
              }`}
            >
              {c.isPublished ? "Live" : "Withdrawn"}
            </span>
            <button
              onClick={() => toggle.mutate({ id: c.id, published: c.isPublished })}
              className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]"
            >
              {c.isPublished ? "Withdraw" : "Publish"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Enrolments ──────────────────────────────────────────────────── */

function Enrolments({
  onNote,
  qc,
}: {
  onNote: (t: "ok" | "bad", m: string) => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const rows = useQuery({ queryKey: ["admin-enrolments"], queryFn: () => listEnrolments() });

  const setState = useMutation({
    mutationFn: (v: { id: string; state: "active" | "completed" | "cancelled" }) =>
      setEnrolmentState(v.id, v.state),
    onSuccess: (r, v) => {
      onNote(
        "ok",
        v.state === "completed"
          ? r.certificateSerial
            ? `Marked complete. Certificate ${r.certificateSerial} issued.`
            : "Marked complete."
          : `Set to ${v.state}.`,
      );
      void qc.invalidateQueries({ queryKey: ["admin-enrolments"] });
      void qc.invalidateQueries({ queryKey: ["admin-certificates"] });
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  return (
    <>
      {rows.isLoading && <p className="font-body text-sm text-ink-mute">Loading…</p>}
      <ul className="space-y-2">
        {(rows.data ?? []).map((r) => (
          <li key={r.id} className="card-flat flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-medium text-ink">{r.courseTitle}</p>
              <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                {r.memberName} · {Math.round(r.progressPercent)}% · {r.state}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {(["active", "completed", "cancelled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setState.mutate({ id: r.id, state: s })}
                  disabled={r.state === s || setState.isPending}
                  className={`rounded-full border px-2.5 py-1 font-body text-[10px] font-medium transition-colors disabled:opacity-40 ${
                    r.state === s
                      ? "border-transparent bg-ink text-paper-light"
                      : "border-ink-line bg-paper-light text-ink-mute hover:border-saffron-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Certificates ────────────────────────────────────────────────── */

/**
 * What people sent through the contact form.
 *
 * Until this screen existed the form saved every enquiry to a table nobody
 * read — no interface listed them and no email went out — while the page told
 * the sender their message had been "filed for the team". Unhandled first,
 * because the queue is the whole point.
 */
function Messages({ onNote }: { onNote: (t: "ok" | "bad", m: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const { profileId } = useAuth();
  const rows = useQuery({ queryKey: ["admin-contact"], queryFn: () => listContactMessages() });

  const mark = useMutation({
    mutationFn: (v: { id: string; handled: boolean }) =>
      setContactHandled(v.id, !v.handled, profileId!),
    onSuccess: (_d, v) => {
      onNote("ok", v.handled ? "Marked unanswered again." : "Marked answered.");
      void qc.invalidateQueries({ queryKey: ["admin-contact"] });
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const open = (rows.data ?? []).filter((m) => !m.handled).length;

  return (
    <>
      {rows.isLoading && <p className="font-body text-sm text-ink-mute">Loading…</p>}
      {rows.isError && (
        <p className="font-body text-sm text-danger">{(rows.error as Error).message}</p>
      )}
      {rows.data && rows.data.length === 0 && (
        <p className="font-body text-sm text-ink-mute">
          {tx("Nothing has come through the contact form yet.")}
        </p>
      )}
      {rows.data && rows.data.length > 0 && (
        <p className="mb-4 font-body text-[13px] text-ink-mute">
          {open} {open === 1 ? tx("waiting for a reply") : tx("waiting for a reply")} ·{" "}
          {rows.data.length} {tx("in total")}
        </p>
      )}
      <ul className="space-y-2">
        {(rows.data ?? []).map((m) => (
          <li key={m.id} className="card-flat p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-medium text-ink">{m.subject}</p>
                <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                  {m.name} ·{" "}
                  {/* A mailto, because reading a message you cannot answer is
                      only half a screen. */}
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`}
                    className="underline underline-offset-2 hover:text-saffron-600"
                  >
                    {m.email}
                  </a>
                  {m.phone ? ` · ${m.phone}` : ""} · {m.reason} ·{" "}
                  {new Date(m.createdAt).toLocaleDateString()}
                </p>
              </div>
              {!m.handled && (
                <span className="shrink-0 rounded-full border border-saffron-200 bg-saffron-50 px-2.5 py-1 font-body text-[10px] font-medium text-saffron-700">
                  {tx("Open")}
                </span>
              )}
              <button
                onClick={() => mark.mutate({ id: m.id, handled: m.handled })}
                className="btn-ghost shrink-0 !px-3 !py-2 !text-[11px]"
              >
                {m.handled ? <X size={12} aria-hidden /> : <Check size={12} aria-hidden />}
                {m.handled ? tx("Reopen") : tx("Mark answered")}
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap border-t border-ink-line pt-3 font-body text-[13px] leading-relaxed text-ink-soft">
              {m.message}
            </p>
            {m.sourcePath && (
              <p className="mt-2 font-mono text-[10px] text-ink-mute">
                {tx("sent from")} {m.sourcePath}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Certificates({ onNote }: { onNote: (t: "ok" | "bad", m: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: ["admin-certificates"], queryFn: () => listCertificates() });

  const revoke = useMutation({
    mutationFn: (v: { id: string; revoked: boolean }) => setCertificateRevoked(v.id, !v.revoked),
    onSuccess: (_d, v) => {
      onNote("ok", v.revoked ? "Certificate reinstated." : "Certificate revoked.");
      void qc.invalidateQueries({ queryKey: ["admin-certificates"] });
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  return (
    <>
      {rows.isLoading && <p className="font-body text-sm text-ink-mute">Loading…</p>}
      <ul className="space-y-2">
        {(rows.data ?? []).map((c) => (
          <li key={c.id} className="card-flat flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-medium text-ink">{c.title}</p>
              <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                {c.recipientName} · <span className="font-mono">{c.serial}</span> ·{" "}
                {new Date(c.issuedAt).toLocaleDateString()}
              </p>
            </div>
            {c.revoked && (
              <span className="shrink-0 rounded-full border border-saffron-200 bg-saffron-50 px-2.5 py-1 font-body text-[10px] font-medium text-saffron-700">
                {tx("Revoked")}
              </span>
            )}
            <Link
              to="/verify/$serial"
              params={{ serial: c.serial }}
              className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]"
            >
              {tx("View")}
            </Link>
            <button
              onClick={() => revoke.mutate({ id: c.id, revoked: c.revoked })}
              className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]"
            >
              {c.revoked ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}
              {c.revoked ? "Reinstate" : "Revoke"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Coupons ─────────────────────────────────────────── */

/**
 * Creating, hiding and removing discount codes.
 *
 * Three separate ideas, kept separate because they answer different
 * questions: whether a code works at all (active), whether it is advertised
 * on the checkout page (listed), and whether it should exist (delete).
 * Conflating them is how a partner code ends up on a public page.
 */
function Coupons({ onNote }: { onNote: (t: "ok" | "bad", m: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("25");
  const [minSpend, setMinSpend] = useState("0");
  const [cap, setCap] = useState("2500");
  const [days, setDays] = useState("90");
  const [uses, setUses] = useState("");
  const [perPerson, setPerPerson] = useState("1");
  const [listed, setListed] = useState(true);
  const [description, setDescription] = useState("");
  const [minted, setMinted] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  /* Shown next to the button too: the page banner sits far above this form, out of sight. */
  const [result, setResult] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const tell = (tone: "ok" | "bad", text: string) => {
    setResult({ tone, text });
    onNote(tone, text);
  };

  const rows = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listAllCoupons() });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    void qc.invalidateQueries({ queryKey: ["offers"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      // Amounts are stored in paise in a 32-bit column: ₹2,00,00,000 is the most a field can hold.
      const LIMIT = 2_00_00_000;
      for (const [label, v] of [
        ["The cap", kind === "percent" ? cap : ""],
        ["The flat amount", kind === "amount" ? value : ""],
        ["The minimum spend", minSpend],
      ] as const)
        if (v && Number(v) > LIMIT)
          return {
            ok: false,
            reason: `${label} is too large: ₹2,00,00,000 at most. For no cap, leave the cap empty.`,
          };
      return adminCreateCoupon({
        code: code.trim() || undefined,
        percentOff: kind === "percent" ? Number(value) : null,
        amountOffMinor: kind === "amount" ? Math.round(Number(value) * 100) : null,
        minSpendMinor: Math.round(Number(minSpend || 0) * 100),
        maxDiscountMinor: kind === "percent" && cap ? Math.round(Number(cap) * 100) : null,
        validDays: days.trim() ? Number(days) : null,
        maxRedemptions: uses.trim() ? Number(uses) : null,
        maxPerProfile: Number(perPerson || 1),
        isListed: listed,
        description: description.trim() || undefined,
      });
    },
    onSuccess: (r) => {
      if (!r.ok) {
        tell("bad", r.reason ?? "Could not create that code.");
        return;
      }
      setMinted(r.code ?? null);
      setCode("");
      tell("ok", `Created ${r.code}.`);
      refresh();
    },
    onError: (e: Error) => tell("bad", e.message),
  });

  const remove = useMutation({
    mutationFn: (c: string) => adminDeleteCoupon(c),
    onSuccess: (r, c) => {
      setConfirming(null);
      if (!r.ok) {
        onNote("bad", r.reason ?? "Could not remove that code.");
        return;
      }
      onNote("ok", `${c} removed.`);
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { code: string; active: boolean }) => setCouponActive(v.code, !v.active),
    onSuccess: (_d, v) => {
      onNote("ok", v.active ? "Code disabled." : "Code enabled.");
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const toggleListed = useMutation({
    mutationFn: (v: { code: string; listed: boolean }) => adminSetCouponListed(v.code, !v.listed),
    onSuccess: (_d, v) => {
      onNote("ok", v.listed ? "Hidden from checkout." : "Now shown at checkout.");
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  return (
    <>
      <div className="panel mb-6 p-6">
        <h2 className="font-display text-lg tracking-tight text-ink">{tx("Create a code")}</h2>

        <label className="mt-4 block max-w-sm">
          <span className="datum">{tx("Code")}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={tx("Leave blank to generate one")}
            maxLength={24}
            className="input mt-1 font-mono !text-[13px] uppercase tracking-[0.12em]"
          />
          <span className="mt-1 block font-body text-[11px] text-ink-mute">
            Letters and numbers only — spaces and punctuation are dropped.
          </span>
        </label>

        <div className="mt-4 flex gap-2" role="radiogroup" aria-label={tx("Discount type")}>
          {(
            [
              { id: "percent", label: "Percentage off" },
              { id: "amount", label: "Flat amount off" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={kind === o.id}
              onClick={() => setKind(o.id)}
              className={`rounded-full border px-4 py-2 font-body text-xs font-medium transition-[color,background-color,border-color] ${
                kind === o.id
                  ? "border-transparent bg-ink text-paper-light"
                  : "border-ink-line bg-paper-light text-ink-soft hover:border-saffron-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="datum">{kind === "percent" ? "Percent off" : "Rupees off"}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="numeric"
              className="input mt-1 !py-2 !text-[13px]"
            />
          </label>
          {kind === "percent" && (
            <label className="block">
              <span className="datum">Cap the discount at (₹)</span>
              <input
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                inputMode="numeric"
                placeholder={tx("No cap")}
                className="input mt-1 !py-2 !text-[13px]"
              />
            </label>
          )}
          <label className="block">
            <span className="datum">Minimum spend (₹)</span>
            <input
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
              inputMode="numeric"
              className="input mt-1 !py-2 !text-[13px]"
            />
          </label>
          <label className="block">
            <span className="datum">Valid for (days)</span>
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              inputMode="numeric"
              placeholder={tx("Never expires")}
              className="input mt-1 !py-2 !text-[13px]"
            />
          </label>
          <label className="block">
            <span className="datum">{tx("Total uses")}</span>
            <input
              value={uses}
              onChange={(e) => setUses(e.target.value)}
              inputMode="numeric"
              placeholder={tx("Unlimited")}
              className="input mt-1 !py-2 !text-[13px]"
            />
          </label>
          <label className="block">
            <span className="datum">{tx("Uses per person")}</span>
            <input
              value={perPerson}
              onChange={(e) => setPerPerson(e.target.value)}
              inputMode="numeric"
              className="input mt-1 !py-2 !text-[13px]"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="datum">{tx("Description")}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tx("Republic Day offer")}
              className="input mt-1 !py-2 !text-[13px]"
            />
          </label>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={listed}
            onChange={(e) => setListed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-saffron-500"
          />
          <span>
            <span className="block font-body text-sm font-medium text-ink">
              {tx("Show this code at checkout")}
            </span>
            <span className="block font-body text-[12px] leading-snug text-ink-mute">
              Off keeps it working for anyone who has it, but off the public list — for partner,
              press or campus codes.
            </span>
          </span>
        </label>

        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || !value}
          className="btn-primary mt-5 !py-2.5 !text-xs disabled:opacity-50"
        >
          {create.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
          Create code
        </button>

        {result && (
          <p
            role="status"
            className={`mt-3 font-body text-sm ${result.tone === "ok" ? "text-emeraldx-400" : "text-saffron-700"}`}
          >
            {result.text}
          </p>
        )}

        {minted && (
          <p className="mt-4 inline-block rounded-xl border-2 border-dashed border-saffron-500 bg-saffron-50 px-4 py-2 font-mono text-lg font-bold tracking-[0.15em] text-ink">
            {minted}
          </p>
        )}
      </div>

      {rows.isLoading && <p className="font-body text-sm text-ink-mute">Loading…</p>}

      <ul className="space-y-2">
        {(rows.data ?? []).map((c) => (
          <li key={c.code} className="card-flat p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-bold tracking-wide text-ink">{c.code}</span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[13px] text-ink">
                  {c.percentOff !== null
                    ? `${c.percentOff}% off`
                    : c.amountOffMinor
                      ? `${formatMinor(c.amountOffMinor)} off`
                      : "Discount"}
                  {c.description ? ` \u00b7 ${c.description}` : ""}
                </p>
                <p className="mt-0.5 font-body text-[11px] text-ink-mute">
                  {c.source}
                  {c.issuedTo ? " \u00b7 personal" : ""} · used {c.redemptionCount}
                  {c.maxRedemptions ? ` of ${c.maxRedemptions}` : ""}
                  {c.minSpendMinor > 0 ? ` \u00b7 min ${formatMinor(c.minSpendMinor)}` : ""}
                  {c.expiresAt
                    ? ` \u00b7 expires ${new Date(c.expiresAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : " \u00b7 no expiry"}
                </p>
              </div>

              <button
                onClick={() => toggleActive.mutate({ code: c.code, active: c.isActive })}
                title={c.isActive ? "Disable this code" : "Enable this code"}
                className={`shrink-0 rounded-full border px-2.5 py-1 font-body text-[10px] font-medium transition-colors ${
                  c.isActive
                    ? "border-emeraldx-400/30 bg-emeraldx-400/10 text-emeraldx-400"
                    : "border-ink-line bg-paper text-ink-mute"
                }`}
              >
                {c.isActive ? "Active" : "Disabled"}
              </button>

              {/* Personal reward codes are never advertised, so the control
                  would be meaningless on them. */}
              {!c.issuedTo && (
                <button
                  onClick={() => toggleListed.mutate({ code: c.code, listed: c.isListed })}
                  title={c.isListed ? "Hide from checkout" : "Show at checkout"}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-body text-[10px] font-medium transition-colors ${
                    c.isListed
                      ? "border-ink-line bg-paper-light text-ink-soft"
                      : "border-ink-line bg-paper text-ink-mute"
                  }`}
                >
                  {c.isListed ? <Eye size={11} aria-hidden /> : <EyeOff size={11} aria-hidden />}
                  {c.isListed ? "Shown" : "Hidden"}
                </button>
              )}

              {confirming === c.code ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => remove.mutate(c.code)}
                    disabled={remove.isPending}
                    className="rounded-full border border-saffron-500 bg-saffron-500 px-2.5 py-1 font-body text-[10px] font-medium text-on-accent disabled:opacity-60"
                  >
                    {tx("Really remove")}
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="rounded-full border border-ink-line px-2.5 py-1 font-body text-[10px] font-medium text-ink-mute"
                  >
                    {tx("Keep")}
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(c.code)}
                  aria-label={`Remove ${c.code}`}
                  title={tx("Remove this code")}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-saffron-50 hover:text-saffron-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Trainers ────────────────────────────────────────────────────── */

/**
 * Certifying the founding cohort.
 *
 * The swap gate refuses any teacher who is not verified in the skill, which on
 * day one is everybody — so the first trainers have to be granted here. This
 * is the only place on the platform that can do it, and every grant leaves an
 * `admin_grant` evidence row behind it.
 */
function Trainers({ onNote }: { onNote: (tone: "ok" | "bad", text: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [member, setMember] = useState("");
  const [skill, setSkill] = useState("");
  const [master, setMaster] = useState(false);

  const members = useQuery({
    queryKey: ["admin-members", search],
    queryFn: () => listMembers(search),
  });
  const skills = useQuery({ queryKey: ["skills-catalogue"], queryFn: listSkills });
  const trainers = useQuery({ queryKey: ["admin-trainers"], queryFn: listCertifiedTrainers });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-trainers"] });
    void qc.invalidateQueries({ queryKey: ["swap-matches"] });
  };

  const certify = useMutation({
    mutationFn: () => certifyTrainer(member, skill, master),
    onSuccess: (r) => {
      if (r.ok) {
        onNote(
          "ok",
          `${r.name ?? "Member"} is now a ${r.role === "master_trainer" ? "Master Trainer" : "certified Trainer"}.`,
        );
        refresh();
      } else {
        onNote("bad", r.reason ?? "That could not be granted.");
      }
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const revoke = useMutation({
    mutationFn: (v: { profileId: string; skillId: string }) =>
      revokeCertification(v.profileId, v.skillId),
    onSuccess: () => {
      onNote("ok", "Certification revoked.");
      refresh();
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const rows = trainers.data ?? [];

  return (
    <div className="space-y-8">
      <div className="card p-6">
        <h2 className="font-display text-xl font-semibold text-ink">{tx("Certify a trainer")}</h2>
        <p className="mt-1.5 max-w-2xl font-body text-sm text-ink-mute">
          {tx(
            "Nobody can teach a skill on SkillSwap until they are certified in it. Granting it here records evidence of who granted it and why, so the passport can always show how the skill was earned.",
          )}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wider text-ink-mute">
              {tx("Find a member")}
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx("Name or handle\u2026")}
              className="input w-full"
            />
            <select
              value={member}
              onChange={(e) => setMember(e.target.value)}
              className="input mt-2 w-full"
              aria-label={tx("Member to certify")}
            >
              <option value="">{tx("Select a member\u2026")}</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} {m.handle ? `(@${m.handle})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wider text-ink-mute">
              {tx("Skill they may teach")}
            </span>
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className="input w-full"
              aria-label={tx("Skill to certify")}
            >
              <option value="">{tx("Select a skill\u2026")}</option>
              {(skills.data ?? []).map((sk) => (
                <option key={sk.id} value={sk.id}>
                  {sk.name}
                </option>
              ))}
            </select>
            <label className="mt-3 flex items-center gap-2.5 font-body text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={master}
                onChange={(e) => setMaster(e.target.checked)}
                className="h-4 w-4 accent-saffron-500"
              />
              {tx("Grant Master Trainer for this skill")}
            </label>
          </label>
        </div>

        <button
          onClick={() => certify.mutate()}
          disabled={!member || !skill || certify.isPending}
          className="btn-primary mt-5 disabled:opacity-50"
        >
          {certify.isPending
            ? "Granting…"
            : master
              ? "Certify as Master Trainer"
              : "Certify as Trainer"}
        </button>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Certified trainers{" "}
          <span className="font-mono text-sm font-normal text-ink-mute">{rows.length}</span>
        </h2>
        {rows.length === 0 ? (
          <p className="mt-4 font-body text-sm text-ink-mute">
            {tx("Nobody is certified yet, so no swap can be created. Grant the first one above.")}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((t) => (
              <div
                key={`${t.profileId}-${t.skillId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {t.name}{" "}
                    {t.handle && (
                      <span className="font-mono text-xs text-ink-mute">@{t.handle}</span>
                    )}
                  </p>
                  <p className="mt-0.5 font-body text-sm text-ink-soft">
                    {t.skill}
                    <span
                      className={`ml-2 chip ${t.master ? "!bg-emeraldx-400 !text-paper-light" : ""}`}
                    >
                      {t.master ? "Master Trainer" : "Trainer"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => revoke.mutate({ profileId: t.profileId, skillId: t.skillId })}
                  disabled={revoke.isPending}
                  className="btn-ghost !py-2 !text-xs"
                >
                  {tx("Revoke")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Reports ────────────────────────────────────────── */

const REPORT_STATES: Array<{ id: ReportState | "all"; label: string }> = [
  { id: "open", label: "Open" },
  { id: "reviewing", label: "Reviewing" },
  { id: "actioned", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "Everything" },
];

/**
 * The queue behind the report button.
 *
 * `reports` shipped with a full workflow in its columns — state, handled_by,
 * handled_at, resolution — and nothing had ever written or read a row.
 * Defaults to Open, because the only view that matters is what nobody has
 * dealt with yet.
 */
function Reports({ onNote }: { onNote: (tone: "ok" | "bad", text: string) => void }) {
  const { profileId } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ReportState | "all">("open");
  const [note, setNote] = useState<Record<string, string>>({});

  const rows = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: () => listReports(filter === "all" ? undefined : filter),
  });

  const close = useMutation({
    mutationFn: (v: { id: string; state: ReportState }) =>
      resolveReport(v.id, v.state, note[v.id] ?? "", profileId!),
    onSuccess: () => {
      onNote("ok", "Report updated.");
      void qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e: Error) => onNote("bad", e.message),
  });

  const list = rows.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap gap-2">
        {REPORT_STATES.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`chip !text-[11px] transition-colors ${
              filter === f.id ? "!bg-saffron-500 !text-on-accent" : ""
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.isLoading && <p className="mt-6 font-body text-sm text-ink-mute">Loading…</p>}

      {!rows.isLoading && list.length === 0 && (
        <p className="mt-6 font-body text-sm text-ink-mute">
          {filter === "open"
            ? "Nothing waiting. That is the good outcome."
            : "No reports in this state."}
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {list.map((r) => (
          <li key={r.id} className="rounded-2xl border border-ink-line bg-paper-light p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-sm font-medium text-ink">
                  {r.reason} <span className="text-ink-mute">· {r.subjectKind}</span>
                </p>
                <p className="mt-1 font-body text-[12px] text-ink-mute">
                  {r.reporter ? `Reported by ${r.reporter.name}` : "Reported anonymously"}
                  {r.subjectOwner ? ` \u00b7 about ${r.subjectOwner.name}` : ""}
                  {" \u00b7 "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`chip !text-[10px] ${
                  r.state === "open" ? "!bg-saffron-100 !text-saffron-700" : ""
                }`}
              >
                {r.state}
              </span>
            </div>

            {r.detail && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper-dim p-3 font-body text-[13px] leading-relaxed text-ink-soft">
                {r.detail}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {r.subjectOwner?.handle && (
                <Link
                  to="/u/$handle"
                  params={{ handle: r.subjectOwner.handle }}
                  className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                >
                  Open the profile
                </Link>
              )}
            </div>

            {r.state === "open" || r.state === "reviewing" ? (
              <div className="mt-4 border-t border-ink-line pt-4">
                <input
                  value={note[r.id] ?? ""}
                  onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
                  placeholder="What did you do about it?"
                  className="input !py-2 !text-[13px]"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => close.mutate({ id: r.id, state: "actioned" })}
                    disabled={close.isPending}
                    className="btn-primary !px-3 !py-1.5 !text-[11px] disabled:opacity-60"
                  >
                    Actioned
                  </button>
                  <button
                    onClick={() => close.mutate({ id: r.id, state: "dismissed" })}
                    disabled={close.isPending}
                    className="btn-ghost !px-3 !py-1.5 !text-[11px] disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                  {r.state === "open" && (
                    <button
                      onClick={() => close.mutate({ id: r.id, state: "reviewing" })}
                      disabled={close.isPending}
                      className="btn-ghost !px-3 !py-1.5 !text-[11px] disabled:opacity-60"
                    >
                      Looking into it
                    </button>
                  )}
                </div>
              </div>
            ) : (
              r.resolution && (
                <p className="mt-3 font-body text-[12px] text-ink-mute">
                  Resolution: {r.resolution}
                </p>
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
