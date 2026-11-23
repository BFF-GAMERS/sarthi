import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Briefcase,
  GraduationCap,
  CalendarClock,
  Award,
  Sparkles,
  ClipboardList,
  CheckCheck,
  Repeat2,
  Bell,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { useAuth } from "../context/AuthContext";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "../lib/profile-data";
import { followHref } from "../lib/notification-href";
import { useTx } from "../lib/i18n";

/**
 * Notification centre.
 *
 * Reads the member's own `notifications` rows — the ones the database writes
 * when a swap request arrives, a request is accepted, a certificate is issued
 * and so on. An account with nothing yet shows an empty state rather than a
 * sample feed.
 */

/**
 * Icon per notification kind.
 *
 * `kind` is free text written by the `notify()` function, so the lookup is
 * prefix-based and falls back to a bell — a kind added server-side later gets
 * a sensible icon instead of a blank space.
 */
function iconFor(kind: string) {
  const k = kind.toLowerCase();
  if (k.startsWith("swap")) return <Repeat2 size={18} aria-hidden />;
  if (k.startsWith("message") || k.startsWith("conversation"))
    return <MessageSquare size={18} aria-hidden />;
  if (k.startsWith("job") || k.startsWith("opportunity") || k.startsWith("application"))
    return <Briefcase size={18} aria-hidden />;
  if (k.startsWith("internship")) return <ClipboardList size={18} aria-hidden />;
  if (k.startsWith("course") || k.startsWith("lesson"))
    return <GraduationCap size={18} aria-hidden />;
  if (k.startsWith("session") || k.startsWith("interview"))
    return <CalendarClock size={18} aria-hidden />;
  if (k.startsWith("certificate") || k.startsWith("badge")) return <Award size={18} aria-hidden />;
  if (k.startsWith("ai") || k.startsWith("sarthi")) return <Sparkles size={18} aria-hidden />;
  return <Bell size={18} aria-hidden />;
}

const FILTERS = ["All", "Unread", "SkillSwap", "Messages", "Learning"] as const;

function matchesFilter(n: Notification, filter: (typeof FILTERS)[number]): boolean {
  const k = n.kind.toLowerCase();
  if (filter === "Unread") return !n.read;
  if (filter === "SkillSwap") return k.startsWith("swap") || k.startsWith("session");
  if (filter === "Messages") return k.startsWith("message") || k.startsWith("conversation");
  if (filter === "Learning")
    return (
      k.startsWith("course") ||
      k.startsWith("lesson") ||
      k.startsWith("certificate") ||
      k.startsWith("badge") ||
      k.startsWith("assessment")
    );
  return true;
}

/** "3 days ago" style label. */
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

export default function Notifications() {
  const tx = useTx();
  const { user, profileId, ready, isRemote } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const enabled = Boolean(profileId) && isRemote;
  const items = useQuery({
    queryKey: ["notifications", profileId],
    queryFn: () => listNotifications(profileId!),
    enabled,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["notifications", profileId] });
    void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
  };

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(profileId!),
    onSuccess: invalidate,
  });

  if (!user) return null;

  const all = items.data ?? [];
  const filtered = all.filter((n) => matchesFilter(n, filter));
  const unread = all.filter((n) => !n.read).length;

  /** Follow the notification's own link, and mark it read on the way. */
  const open = (n: Notification) => {
    if (!n.read) readOne.mutate(n.id);
    if (n.href) followHref(navigate, n.href);
  };

  return (
    <div className="container-x max-w-3xl pb-24 pt-28">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-saffron-500">
              {tx("Notification center")}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
              {unread > 0 ? `${unread} unread` : "Stay in the loop"}
            </h1>
          </div>
          <button
            onClick={() => readAll.mutate()}
            disabled={unread === 0 || readAll.isPending}
            className="btn-ghost !py-2 text-sm disabled:opacity-50"
          >
            <CheckCheck size={15} aria-hidden /> {tx("Mark all read")}
          </button>
        </div>
        <div
          className="mt-6 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={tx("Filter notifications")}
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f
                  ? "bg-saffron-500 text-on-accent"
                  : "bg-paper-dim text-ink-soft hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </Reveal>

      {items.isLoading && <p className="mt-8 font-body text-sm text-ink-mute">Loading…</p>}

      {items.error && (
        <p
          role="alert"
          className="mt-8 border-l-[3px] border-saffron-500 py-3 pl-4 font-body text-sm text-ink"
        >
          {items.error instanceof Error ? items.error.message : "Couldn't load notifications."}
        </p>
      )}

      <Stagger className="mt-8 space-y-3">
        {filtered.map((n) => (
          <StaggerItem key={n.id}>
            <button
              onClick={() => open(n)}
              className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition hover:border-saffron-500/40 ${
                n.read ? "border-ink-line bg-paper-dim" : "border-saffron-500/25 bg-saffron-50"
              }`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  n.read ? "bg-paper-dim text-ink-mute" : "bg-saffron-500/20 text-saffron-500"
                }`}
              >
                {iconFor(n.kind)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-ink">{n.title}</span>
                  {!n.read && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-saffron-500"
                      aria-label={tx("Unread")}
                    />
                  )}
                </span>
                {n.body && (
                  <span className="mt-0.5 block text-sm leading-relaxed text-ink-mute">
                    {n.body}
                  </span>
                )}
                <span className="mt-1 block text-xs text-ink-mute">
                  {relativeTime(n.createdAt)}
                </span>
              </span>
            </button>
          </StaggerItem>
        ))}
      </Stagger>

      {!items.isLoading && filtered.length === 0 && (
        <div className="panel mt-8 rounded-2xl px-6 py-12 text-center">
          <p className="font-body text-sm text-ink-soft">
            {all.length === 0 ? "No notifications yet." : "Nothing under this filter."}
          </p>
          {all.length === 0 && (
            <p className="mx-auto mt-2 max-w-sm font-body text-xs leading-relaxed text-ink-mute">
              {tx(
                "Swap requests, accepted swaps, session reminders and issued certificates all land here.",
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
