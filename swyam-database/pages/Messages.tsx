import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  Send,
  Paperclip,
  FileText,
  ArrowLeft,
  Repeat2,
  Loader2,
  Video,
  Flag,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { initialsAvatar } from "../lib/avatar";
import {
  attachmentUrl,
  listConversations,
  listMessages,
  markConversationRead,
  postMessage,
  uploadAttachment,
  watchConversation,
  watchInbox,
  type ChatThread,
} from "../lib/messaging";
import { listMySessions } from "../lib/skillswap";
import VideoRoom, { type RoomInfo } from "../components/VideoRoom";
import ReportDialog from "../components/ReportDialog";
import { useTx } from "../lib/i18n";

/**
 * Messages — one inbox.
 *
 * Every thread here is real: direct messages and the conversation a swap
 * opens when it is accepted. There are no sample threads and no scripted
 * replies — an empty inbox says it is empty, which is the truth for a new
 * account.
 */

interface UiThread {
  key: string;
  id: string;
  /** The other person, so a session can be matched to this thread. */
  counterpartId: string | null;
  /** Their username, so the header can link to their profile. */
  handle: string | null;
  name: string;
  avatar: string;
  role: string;
  online: boolean;
  unreadCount: number;
  preview: string;
  /** Set for swap threads, so the trade is visible in the list. */
  isSwap: boolean;
}

interface UiMessage {
  key: string;
  fromMe: boolean;
  text: string;
  time: string;
  attachment?: string | undefined;
  attachmentPath?: string | undefined;
}

/** Short, local clock label for a timestamp. */
function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function toUiThread(t: ChatThread): UiThread {
  const name = t.counterpart?.displayName ?? t.title ?? "Conversation";
  return {
    key: t.id,
    id: t.id,
    counterpartId: t.counterpart?.id ?? null,
    handle: t.counterpart?.handle ?? null,
    name,
    avatar: t.counterpart?.avatarUrl || initialsAvatar(name),
    role:
      t.kind === "swap"
        ? "SkillSwap partner"
        : t.counterpart?.handle
          ? `@${t.counterpart.handle}`
          : t.kind,
    online: false,
    unreadCount: t.unread ? 1 : 0,
    preview: t.lastMessagePreview ?? "No messages yet",
    isSwap: t.kind === "swap",
  };
}

export default function Messages({ conversationId }: { conversationId?: string } = {}) {
  const tx = useTx();
  const { user, profileId, ready, isRemote } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeKey, setActiveKey] = useState<string | null>(conversationId ?? null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // True when the next scroll should jump rather than glide: a thread switch
  // is a new place, not movement within the one being read.
  const jumpRef = useRef(true);

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const remote = Boolean(profileId) && isRemote;

  const threadsQuery = useQuery({
    queryKey: ["conversations", profileId],
    queryFn: () => listConversations(profileId!),
    enabled: remote,
  });

  const threads: UiThread[] = useMemo(
    () => (threadsQuery.data ?? []).map(toUiThread),
    [threadsQuery.data],
  );

  // A link straight to one conversation — from the bell, or a bookmark —
  // wins over the default. Following a second notification while this page
  // is already open changes the id without remounting, so watch it.
  useEffect(() => {
    if (conversationId) {
      jumpRef.current = true;
      setActiveKey(conversationId);
    }
  }, [conversationId]);

  // Open the newest thread by default — that is where an accepted swap lands.
  useEffect(() => {
    if (activeKey || threads.length === 0) return;
    setActiveKey(threads[0]!.key);
  }, [threads, activeKey]);

  const active = threads.find((t) => t.key === activeKey) ?? null;

  const messagesQuery = useQuery({
    queryKey: ["messages", active?.id],
    queryFn: () => listMessages(active!.id, profileId!),
    enabled: remote && Boolean(active),
  });

  // Clear the unread marker once a thread is on screen.
  useEffect(() => {
    if (!remote || !active) return;
    void markConversationRead(active.id).then(() =>
      qc.invalidateQueries({ queryKey: ["conversations", profileId] }),
    );
  }, [remote, active, profileId, qc]);

  const messages: UiMessage[] = useMemo(
    () =>
      (messagesQuery.data ?? []).map((m) => ({
        key: m.id,
        fromMe: m.fromMe,
        text: m.body ?? "",
        time: clock(m.createdAt),
        attachment: m.attachmentName ?? undefined,
        attachmentPath: m.attachmentPath ?? undefined,
      })),
    [messagesQuery.data],
  );

  /*
   * Keep the newest message in view — and only the message list.
   *
   * This used to call `scrollIntoView` on a sentinel at the bottom of the
   * thread. That method walks up and scrolls *every* scrollable ancestor,
   * the document included, so sending a message dragged the whole page down
   * behind the navbar. Scrolling the list element itself moves the one box
   * that should move and leaves the page where the reader put it.
   */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Jumping is right when a different thread opens; gliding is right when
    // one more message arrives in the thread already being read.
    el.scrollTo({ top: el.scrollHeight, behavior: jumpRef.current ? "auto" : "smooth" });
    jumpRef.current = false;
  }, [activeKey, messages]);

  // The whole inbox, not just the open thread: a message in another
  // conversation has to move the list on the left too.
  useEffect(() => {
    if (!remote) return;
    return watchInbox(() => {
      void qc.invalidateQueries({ queryKey: ["conversations", profileId] });
      // Prefix match: every thread's messages, whichever one is open.
      void qc.invalidateQueries({ queryKey: ["messages"] });
    });
  }, [remote, profileId, qc]);

  // A reply used to arrive silently and stay invisible until you reloaded.
  useEffect(() => {
    if (!remote || !active) return;
    return watchConversation(active.id, () => {
      void qc.invalidateQueries({ queryKey: ["messages", active.id] });
      void qc.invalidateQueries({ queryKey: ["conversations", profileId] });
    });
  }, [remote, active, profileId, qc]);

  const [sendError, setSendError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);

  // A person in a thread looks for the call button *here*, not on a dashboard
  // two pages away. The room comes from the swap's session, so both sides
  // land in the same place.
  const sessions = useQuery({
    queryKey: ["my-sessions", profileId],
    queryFn: () => listMySessions(profileId!),
    enabled: remote,
  });
  const activeSession = (sessions.data ?? []).find(
    (sn) => active && sn.counterpartId === active.counterpartId && sn.state !== "completed",
  );

  const postToDb = useMutation({
    mutationFn: async (v: { body: string; file?: File }) => {
      const attachment = v.file
        ? { path: await uploadAttachment(active!.id, v.file), name: v.file.name }
        : undefined;
      await postMessage(active!.id, profileId!, v.body, attachment);
    },
    onSuccess: () => {
      setSendError("");
      void qc.invalidateQueries({ queryKey: ["messages", active?.id] });
      void qc.invalidateQueries({ queryKey: ["conversations", profileId] });
    },
    onError: (e: Error) => setSendError(e.message),
  });

  if (!user) return null;

  const filtered = threads.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  const send = (text: string, file?: File) => {
    if ((!text.trim() && !file) || !active) return;
    postToDb.mutate({ body: text.trim(), ...(file ? { file } : {}) });
    setDraft("");
  };

  return (
    <div className="container-x pb-10 pt-24">
      {room && <VideoRoom room={room} onClose={() => setRoom(null)} />}
      {reporting && active && (
        <ReportDialog
          subjectKind="message"
          subjectId={active.id}
          subjectOwnerId={active.counterpartId}
          subjectLabel={active.name}
          onClose={() => setReporting(false)}
        />
      )}
      <div className="glass grid grid-cols-1 h-[calc(100dvh-9rem)] overflow-hidden rounded-3xl sm:min-h-[480px] md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <aside
          className={`flex-col border-r border-ink-line ${active ? "hidden md:flex" : "flex"}`}
        >
          <div className="border-b border-ink-line p-4">
            <h1 className="font-display text-lg font-semibold text-ink">{tx("Messages")}</h1>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-paper-dim px-3">
              <Search size={16} className="shrink-0 text-ink-mute" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tx("Search conversations\u2026")}
                className="w-full bg-transparent py-2.5 text-sm text-ink placeholder-ink-mute outline-none"
                aria-label={tx("Search conversations")}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" data-lenis-prevent>
            {threadsQuery.isLoading && (
              <p className="px-4 py-6 font-body text-sm text-ink-mute">Loading…</p>
            )}
            {!threadsQuery.isLoading && threads.length === 0 && (
              <div className="px-4 py-8">
                <p className="font-body text-sm text-ink-soft">{tx("No conversations yet.")}</p>
                <p className="mt-1.5 font-body text-xs leading-relaxed text-ink-mute">
                  {tx("Accepting a SkillSwap request opens a shared thread here.")}
                </p>
                <Link to="/skillswap" className="btn-ghost mt-4 w-full !py-2.5 !text-xs">
                  {tx("Find a swap partner")}
                </Link>
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  jumpRef.current = true;
                  setActiveKey(c.key);
                }}
                className={`flex w-full items-center gap-3 border-b border-ink-line px-4 py-3.5 text-left transition hover:bg-paper-deep/70 ${
                  activeKey === c.key ? "bg-paper-dim" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={c.avatar}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  {c.online && (
                    <span
                      className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emeraldx-400 ring-2 ring-paper-light"
                      aria-label={tx("Online")}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                    {c.isSwap && (
                      <Repeat2 size={13} className="shrink-0 text-saffron-500" aria-hidden />
                    )}
                    {c.name}
                  </p>
                  <p className="truncate text-xs text-ink-mute">{c.preview}</p>
                  <p className="text-[11px] text-ink-mute">{c.role}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-saffron-500 text-[10px] font-semibold text-on-accent">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Chat pane */}
        {active ? (
          <section
            className="flex min-h-0 min-w-0 flex-col"
            aria-label={`Chat with ${active.name}`}
          >
            <div className="flex items-center gap-3 border-b border-ink-line px-4 py-3">
              <button
                onClick={() => setActiveKey(null)}
                className="rounded-xl p-1.5 text-ink-mute hover:bg-paper-deep/70 md:hidden"
                aria-label={tx("Back to conversations")}
              >
                <ArrowLeft size={19} />
              </button>
              <div className="relative">
                <img
                  loading="lazy"
                  decoding="async"
                  src={active.avatar}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
                {active.online && (
                  <span
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emeraldx-400 ring-2 ring-paper-light"
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {active.handle ? (
                  <Link
                    to="/u/$handle"
                    params={{ handle: active.handle }}
                    className="block truncate text-sm font-medium text-ink transition-colors hover:text-saffron-600"
                  >
                    {active.name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-ink">{active.name}</p>
                )}
                <p className="text-xs text-ink-mute">{active.role}</p>
              </div>

              <button
                onClick={() => setReporting(true)}
                aria-label={tx("Report this conversation")}
                title={tx("Report this conversation")}
                className="shrink-0 rounded-xl p-2 text-ink-mute transition-colors hover:bg-paper-deep/70 hover:text-ink"
              >
                <Flag size={16} aria-hidden />
              </button>

              {activeSession && (
                <button
                  onClick={() =>
                    setRoom({
                      roomId: activeSession.roomId ?? activeSession.id,
                      title: activeSession.title,
                      displayName: user?.name ?? "Member",
                    })
                  }
                  className="btn-primary shrink-0 !py-2 !text-xs"
                  aria-label={tx("Start the video call")}
                >
                  <Video size={14} aria-hidden /> {tx("Video call")}
                </button>
              )}
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" data-lenis-prevent>
              {messagesQuery.isLoading && (
                <p className="text-sm text-ink-mute">{tx("Loading messages\u2026")}</p>
              )}
              {messages.map((m) => (
                <motion.div
                  key={m.key}
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
                  className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.fromMe
                        ? "rounded-br-md bg-saffron-500 text-on-accent"
                        : "rounded-bl-md bg-paper-dim text-ink"
                    }`}
                  >
                    {m.attachment && (
                      <Attachment name={m.attachment} path={m.attachmentPath} fromMe={m.fromMe} />
                    )}
                    {m.text}
                    <span
                      className={`mt-1 block text-right text-[10px] ${m.fromMe ? "text-paper-light/70" : "text-ink-mute"}`}
                    >
                      {m.time}
                    </span>
                  </div>
                </motion.div>
              ))}

              {!messagesQuery.isLoading && messages.length === 0 && (
                <p className="py-10 text-center font-body text-sm text-ink-mute">
                  {tx("No messages yet — say hello and set up your first session.")}
                </p>
              )}
            </div>

            <div className="border-t border-ink-line p-3">
              {sendError && (
                <p role="alert" className="mb-2 px-1 font-body text-[12px] text-danger">
                  {sendError}
                </p>
              )}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(draft);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) send(draft, f);
                    // Let the same file be picked again after a failure.
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={postToDb.isPending}
                  className="rounded-xl p-2.5 text-ink-mute transition hover:bg-paper-deep/70 hover:text-ink disabled:opacity-50"
                  aria-label={tx("Attach file")}
                >
                  {postToDb.isPending ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden />
                  ) : (
                    <Paperclip size={18} />
                  )}
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={tx("Type a message\u2026")}
                  className="input flex-1"
                  aria-label={tx("Message text")}
                />
                <button
                  type="submit"
                  disabled={postToDb.isPending}
                  className="btn-primary !px-4 disabled:opacity-60"
                  aria-label={tx("Send")}
                >
                  <Send size={17} />
                </button>
              </form>
            </div>
          </section>
        ) : (
          <section className="hidden flex-col items-center justify-center px-8 text-center md:flex">
            <p className="font-body text-sm text-ink-soft">
              {threads.length === 0
                ? "Your inbox is empty."
                : "Select a conversation to start chatting."}
            </p>
            {threads.length === 0 && (
              <p className="mt-2 max-w-xs font-body text-xs leading-relaxed text-ink-mute">
                {tx("Messages appear once you start a swap or someone reaches out.")}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * An attached file.
 *
 * The bucket is private, so there is no URL to render up front — the signed
 * link is minted on the click that opens it, and expires five minutes later.
 */
function Attachment({
  name,
  path,
  fromMe,
}: {
  name: string;
  path?: string | undefined;
  fromMe: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const skin = fromMe ? "bg-paper-light/25" : "bg-paper-dim";

  if (!path) {
    return (
      <span
        className={`mb-1.5 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${skin}`}
      >
        <FileText size={14} aria-hidden /> {name}
      </span>
    );
  }

  const open = async () => {
    setBusy(true);
    try {
      const url = await attachmentUrl(path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      className={`mb-1.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-60 ${skin}`}
    >
      {busy ? (
        <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
      ) : (
        <FileText size={14} className="shrink-0" aria-hidden />
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}
