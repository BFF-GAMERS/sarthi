import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Bell,
  Briefcase,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  Repeat2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  watchMyNotifications,
  type Notification,
} from "../lib/profile-data";
import { followHref } from "../lib/notification-href";
import { useTx } from "../lib/i18n";

/**
 * The bell, and what is behind it.
 *
 * Two things were wrong with what this replaces. The count was fetched once
 * on mount and never again, so a request that arrived while the member was
 * reading a course page did not exist until they reloaded — which reads as
 * "notifications are slow" or "they never come". And the bell was a link:
 * seeing what had happened meant leaving the page you were on, so most people
 * never looked.
 *
 * Now it opens in place, and the list is live three ways over: a realtime
 * subscription for the instant case, a refetch whenever the panel is opened,
 * and a slow interval as a backstop for the case where the table is not in
 * the realtime publication. Whichever arrives first wins; none of them can
 * leave the member looking at a stale bell.
 */

function iconFor(kind: string) {
  const k = kind.toLowerCase();
  if (k.startsWith("follow")) return <UserPlus size={15} aria-hidden />;
  if (k.startsWith("swap")) return <Repeat2 size={15} aria-hidden />;
  if (k.startsWith("message") || k.startsWith("conversation"))
    return <MessageSquare size={15} aria-hidden />;
  if (k.startsWith("job") || k.startsWith("opportunity") || k.startsWith("application"))
    return <Briefcase size={15} aria-hidden />;
  if (k.startsWith("internship")) return <ClipboardList size={15} aria-hidden />;
  if (k.startsWith("course") || k.startsWith("lesson"))
    return <GraduationCap size={15} aria-hidden />;
  if (k.startsWith("session") || k.startsWith("interview"))
    return <CalendarClock size={15} aria-hidden />;
  if (k.startsWith("certificate") || k.startsWith("badge")) return <Award size={15} aria-hidden />;
  if (k.startsWith("ai") || k.startsWith("sarthi")) return <Sparkles size={15} aria-hidden />;
  return <Bell size={15} aria-hidden />;
}

/** "just now", "12m", "3h", "2d" — short, because the row is narrow. */
function shortAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function NotificationBell() {
  const tx = useTx();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profileId } = useAuth();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const feed = useQuery({
    queryKey: ["notifications", profileId],
    queryFn: () => listNotifications(profileId!, 12),
    enabled: Boolean(profileId),
    // The backstop. Every database read counts against the free plan's daily
    // allowance, so: every five minutes, only while the tab is on screen, and
    // a fresh look whenever the member comes back to it.
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  // The instant path.
  useEffect(() => {
    if (!profileId) return;
    return watchMyNotifications(profileId, () => {
      void qc.invalidateQueries({ queryKey: ["notifications", profileId] });
      void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
    });
  }, [profileId, qc]);

  // Opening the panel is itself a request to be up to date.
  useEffect(() => {
    if (open) void feed.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const items = feed.data ?? [];
  // Counted from the rows on screen rather than from the metrics view, so the
  // badge and the list can never disagree with each other.
  const unread = items.filter((n) => !n.read).length;

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", profileId] });
      void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
    },
  });

  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(profileId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", profileId] });
      void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
    },
  });

  const openItem = (n: Notification) => {
    if (!n.read) readOne.mutate(n.id);
    setOpen(false);
    if (n.href) followHref(navigate, n.href);
  };

  return (
    <div className="sm:relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread > 0 ? `${tx("Notifications")}, ${unread} ${tx("unread")}` : tx("Notifications")
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`nav-icon ${open ? "!text-ink" : ""}`}
      >
        <Bell size={17} aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-saffron-500 px-1 font-body text-[9px] font-bold text-on-accent ring-2 ring-paper-light"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={tx("Notifications")}
            initial={still ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: still ? 0 : 0.16 }}
            className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-ink-line bg-paper-light shadow-[var(--shadow-float)] sm:inset-x-auto sm:right-0 sm:mt-3 sm:w-[22rem]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink-line px-4 py-3">
              <p className="font-display text-sm tracking-tight text-ink">{tx("Notifications")}</p>
              {unread > 0 && (
                <button
                  onClick={() => readAll.mutate()}
                  disabled={readAll.isPending}
                  className="-my-2 inline-flex items-center gap-1.5 py-2 pl-2 font-body text-[11px] font-medium text-ink-mute transition-colors hover:text-saffron-600 disabled:opacity-50"
                >
                  <CheckCheck size={13} aria-hidden /> {tx("Mark all read")}
                </button>
              )}
            </div>

            <div
              className="max-h-[min(26rem,calc(100dvh-14rem))] overflow-y-auto overscroll-contain"
              data-lenis-prevent
            >
              {feed.isLoading ? (
                <p className="px-4 py-8 text-center font-body text-[13px] text-ink-mute">
                  {tx("Loading…")}
                </p>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell size={22} className="mx-auto text-ink-mute" aria-hidden />
                  <p className="mt-3 font-body text-[13px] text-ink-soft">{tx("Nothing yet.")}</p>
                  <p className="mt-1 font-body text-[12px] text-ink-mute">
                    {tx("Swap requests, session times and certificates land here.")}
                  </p>
                </div>
              ) : (
                <ul>
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => openItem(n)}
                        className={`flex min-h-[3.25rem] w-full gap-3 border-b border-ink-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-saffron-50 focus-visible:bg-saffron-50 focus-visible:outline-offset-[-2px] ${
                          n.read ? "" : "bg-saffron-50/40"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                            n.read
                              ? "bg-paper-dim text-ink-mute"
                              : "bg-saffron-500/12 text-saffron-600"
                          }`}
                        >
                          {iconFor(n.kind)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={`truncate font-body text-[13px] ${
                                n.read ? "text-ink-soft" : "font-semibold text-ink"
                              }`}
                            >
                              {n.title}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-ink-mute">
                              {shortAgo(n.createdAt)}
                            </span>
                          </span>
                          {n.body && (
                            <span className="mt-0.5 line-clamp-2 block font-body text-[12px] leading-snug text-ink-mute">
                              {n.body}
                            </span>
                          )}
                        </span>
                        {!n.read && (
                          <span
                            aria-hidden
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500"
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-ink-line px-4 py-3.5 text-center font-body text-[12px] font-medium text-ink-soft transition-colors hover:bg-paper-dim hover:text-saffron-600"
            >
              {tx("Open the notification center")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
