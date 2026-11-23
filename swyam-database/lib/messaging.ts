/**
 * Real conversations.
 *
 * The Messages page keeps its sample threads so the app stays explorable
 * offline, but once someone is signed in their actual threads — including the
 * one opened when a swap is accepted — come from here and are shown first.
 *
 * Membership is enforced by RLS (`is_conversation_member`), so these queries
 * never need to filter by participant themselves; asking for a conversation
 * you are not in simply returns nothing.
 */

import { getSupabase, requireSupabase } from "./supabase";
import type { Database } from "@/types/database";

export type ConversationKind = Database["public"]["Enums"]["conversation_kind"];
export type MessageKind = Database["public"]["Enums"]["message_kind"];

export interface ChatThread {
  id: string;
  kind: ConversationKind;
  title: string | null;
  /** The other person in a direct thread; null for group kinds. */
  counterpart: {
    id: string;
    displayName: string;
    handle: string;
    avatarUrl: string | null;
  } | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  /** True when something arrived after this member last read the thread. */
  unread: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  kind: MessageKind;
  body: string | null;
  attachmentName: string | null;
  /** Object path inside the private `attachments` bucket, not a public URL. */
  attachmentPath: string | null;
  createdAt: string;
  fromMe: boolean;
}

type RawParticipantProfile = {
  profile_id: string;
  profiles: { id: string; display_name: string; handle: string; avatar_url: string | null } | null;
};

/**
 * Every thread the signed-in person is in, most recent first.
 *
 * Two round trips rather than one nested select: PostgREST cannot express
 * "the participant who is not me" in a single embed, so participants are
 * fetched for the returned conversations and reduced here.
 */
export async function listConversations(profileId: string): Promise<ChatThread[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: memberships, error: mErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("profile_id", profileId)
    .is("left_at", null);
  if (mErr) throw new Error(mErr.message);

  const ids = (memberships ?? []).map((m) => m.conversation_id);
  if (ids.length === 0) return [];

  const lastReadBy = new Map(
    (memberships ?? []).map((m) => [m.conversation_id, m.last_read_at] as const),
  );

  const [{ data: convs, error: cErr }, { data: parts, error: pErr }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, kind, title, last_message_at, last_message_preview")
      .in("id", ids)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("conversation_participants")
      .select("conversation_id, profile_id, profiles ( id, display_name, handle, avatar_url )")
      .in("conversation_id", ids)
      .neq("profile_id", profileId),
  ]);
  if (cErr) throw new Error(cErr.message);
  if (pErr) throw new Error(pErr.message);

  const otherByConv = new Map<string, RawParticipantProfile["profiles"]>();
  for (const row of (parts ?? []) as unknown as Array<
    RawParticipantProfile & { conversation_id: string }
  >) {
    if (otherByConv.has(row.conversation_id)) continue;
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    otherByConv.set(row.conversation_id, p ?? null);
  }

  return (convs ?? []).map((c) => {
    const other = otherByConv.get(c.id) ?? null;
    const lastRead = lastReadBy.get(c.id);
    return {
      id: c.id,
      kind: c.kind,
      title: c.title,
      counterpart: other
        ? {
            id: other.id,
            displayName: other.display_name,
            handle: other.handle,
            avatarUrl: other.avatar_url,
          }
        : null,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: c.last_message_preview,
      unread: Boolean(
        c.last_message_at && lastRead && new Date(c.last_message_at) > new Date(lastRead),
      ),
    };
  });
}

/** Messages in a thread, oldest first. Deleted messages are left out. */
export async function listMessages(
  conversationId: string,
  profileId: string,
): Promise<ChatMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, kind, body, attachment_name, attachment_url, created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw new Error(error.message);

  return (data ?? []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    kind: m.kind,
    body: m.body,
    attachmentName: m.attachment_name,
    attachmentPath: m.attachment_url,
    createdAt: m.created_at,
    fromMe: m.sender_id === profileId,
  }));
}

const BUCKET = "attachments";

/**
 * Put a file in the private bucket for this conversation.
 *
 * The conversation id is the first path segment because that is what the
 * storage policies check membership against — anyone who is not in the thread
 * cannot read the object even holding its path.
 */
export async function uploadAttachment(conversationId: string, file: File): Promise<string> {
  const supabase = requireSupabase();

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Files need to be under 10 MB.");
  }
  // Keep the extension, drop everything else: the display name is stored
  // separately, so the object name never has to carry someone's punctuation.
  const dot = file.name.lastIndexOf(".");
  const ext =
    dot > 0
      ? file.name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "";
  const path = `${conversationId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);

  return path;
}

/**
 * A short-lived link to an attachment.
 *
 * The bucket is private, so there is no permanent URL to store — a signed link
 * is minted when someone actually asks to open the file.
 */
export async function attachmentUrl(path: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  return error ? null : (data?.signedUrl ?? null);
}

export async function postMessage(
  conversationId: string,
  profileId: string,
  body: string,
  attachment?: { path: string; name: string },
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: profileId,
    kind: attachment ? "attachment" : "text",
    body: body || null,
    ...(attachment ? { attachment_url: attachment.path, attachment_name: attachment.name } : {}),
  });
  if (error) throw new Error(error.message);
}

/**
 * Tell me when this thread changes.
 *
 * `messages` is already in the realtime publication, and without this the page
 * only ever showed what was there when it loaded: a reply arrived silently and
 * stayed invisible until you switched threads or reloaded, which is the one
 * thing a chat window must not do.
 */
/**
 * Tell me when *anything* in my inbox changes.
 *
 * Deliberately unfiltered. The per-thread watch below only fires for the
 * conversation you already have open, so a message arriving in any other
 * thread produced no event and the list beside it never moved — which is
 * exactly what "the inbox does not update" looks like.
 *
 * Subscribing to the whole table is safe because row-level security decides
 * what is delivered: the server only sends rows this member could have read
 * anyway, so this is every thread of theirs and nobody else's.
 */
export function watchInbox(onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel("inbox")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function watchConversation(conversationId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Clear the unread marker. Failure here is cosmetic, so it never throws. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}
