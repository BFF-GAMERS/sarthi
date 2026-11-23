import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Video, X } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { useTx } from "../lib/i18n";

/**
 * The video room a training actually happens in.
 *
 * Jitsi on its free public instance, rather than Daily, LiveKit or Agora.
 * Those bill per participant-minute, and on a platform whose promise is that
 * learning is free, a per-minute cost on the core teaching action is the wrong
 * shape — every successful training would arrive as a bill. Jitsi needs no key
 * and no account and works in a low-end Android browser.
 *
 * It opens in a new tab, and that is the entire point of this rewrite. This
 * used to embed Jitsi through its external API, which is explicitly demo-only:
 * an embedded call is cut off after **five minutes**, with a banner from Jitsi
 * saying so. Sessions here are scheduled for sixty. A call that dies twelve
 * minutes into an hour-long lesson is worse than no call at all — the learner
 * blames the platform, and they are right to. The same room opened as an
 * ordinary tab has no time limit whatsoever, costs nothing, and needs no
 * account.
 *
 * The room name is derived from the session id, so both people compute the
 * same room with nothing to exchange. It is prefixed because Jitsi's public
 * instance is one shared namespace and a bare uuid is guessable enough to be
 * worth not handing to the whole internet.
 */

const JITSI_HOST = "meet.jit.si";

export interface RoomInfo {
  roomId: string;
  title: string;
  /** Shown to the other person, so it should be the name they know you by. */
  displayName: string;
}

/**
 * The room both sides land in, derived from the session id alone.
 *
 * The hash carries configuration as well as the name. Without it a call ends
 * on Jitsi's promotional close page, which is an advert for Jitsi shown to
 * somebody who just finished a lesson on स्वYAM, and it opens on a pre-join
 * lobby that makes a two-person call feel like a conference.
 */
export function roomUrl(roomId: string, displayName?: string): string {
  const room = `swayam-${roomId.replace(/-/g, "")}`;

  const settings = [
    // Ends the call quietly instead of on Jitsi's advert.
    "interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE=false",
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
    "interfaceConfig.SHOW_BRAND_WATERMARK=false",
    "interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true",
    // Straight into the room. A lobby between two people who already agreed a
    // time is a door with nobody behind it.
    "config.prejoinPageEnabled=false",
    "config.prejoinConfig.enabled=false",
    // No analytics or advert calls from a page our members were sent to.
    "config.disableThirdPartyRequests=true",
    "config.analytics.disabled=true",
    // Small call, so start simple and let them turn things on.
    "config.startWithVideoMuted=false",
    "config.startWithAudioMuted=false",
  ];

  if (displayName) {
    settings.unshift(`userInfo.displayName=%22${encodeURIComponent(displayName)}%22`);
  }

  return `https://${JITSI_HOST}/${room}#${settings.join("&")}`;
}

export default function VideoRoom({ room, onClose }: { room: RoomInfo; onClose: () => void }) {
  const tx = useTx();
  const { prefs } = usePreferences();
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<"ready" | "in-call" | "ended">("ready");
  const tabRef = useRef<Window | null>(null);

  const url = roomUrl(room.roomId, room.displayName);

  /*
   * Watch the call tab.
   *
   * Nothing inside it is readable — different origin — but whether it is still
   * open is, and that is the only fact needed. When they hang up and close it
   * from the Jitsi side, this panel notices and moves on by itself instead of
   * sitting on "call in progress" forever.
   */
  useEffect(() => {
    if (phase !== "in-call") return;
    const timer = window.setInterval(() => {
      if (!tabRef.current || tabRef.current.closed) {
        tabRef.current = null;
        setPhase("ended");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const openCall = () => {
    // Opened by script rather than as a plain link, because a window we opened
    // is a window we are allowed to close again — which is what makes "come
    // back" a button rather than an instruction.
    const tab = window.open(url, "swayam-call", "noopener=false");
    if (!tab) return; // Pop-up blocked; the link below still works.
    tabRef.current = tab;
    setPhase("in-call");
    try {
      tab.focus();
    } catch {
      /* Focus is a courtesy; the tab is open either way. */
    }
  };

  const comeBack = () => {
    try {
      tabRef.current?.close();
    } catch {
      /* Already gone, or the browser refused. Either way we carry on. */
    }
    tabRef.current = null;
    setPhase("ended");
    window.focus();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard refused — the link is on screen to copy by hand. */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tx("Video call")}: ${room.title}`}
      className="fixed inset-0 z-[95] grid place-items-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-card)] border border-ink-line bg-paper p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="datum">{tx("Video call")}</p>
            <h2 className="mt-1 truncate font-display text-lg tracking-tight text-ink">
              {room.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-ink-mute transition-colors hover:bg-paper-dim hover:text-ink"
            aria-label={tx("Close")}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {phase === "ended" ? (
          <>
            <p className="mt-4 font-body text-sm leading-relaxed text-ink-soft">
              {tx("The call is closed and you are back on स्वYAM.")}
            </p>
            <button onClick={onClose} className="btn-primary mt-5 flex w-full justify-center !py-3">
              <ArrowLeft size={16} aria-hidden />
              {tx("Back to the session")}
            </button>
            <button
              onClick={openCall}
              className="btn-ghost mt-2 w-full justify-center !py-2.5 !text-xs"
            >
              <Video size={14} aria-hidden /> {tx("Start it again")}
            </button>
          </>
        ) : phase === "in-call" ? (
          <>
            <p className="mt-4 flex items-center gap-2 font-body text-sm leading-relaxed text-ink-soft">
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500"
              />
              {tx("Your call is open in the other tab.")}
            </p>
            <p className="mt-1 font-body text-[13px] leading-relaxed text-ink-mute">
              {tx(
                "When you are done, hang up there and press this — it closes the call and brings you straight back.",
              )}
            </p>
            <button
              onClick={comeBack}
              className="btn-primary mt-5 flex w-full justify-center !py-3"
            >
              <ArrowLeft size={16} aria-hidden />
              {tx("I am done — come back")}
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 font-body text-sm leading-relaxed text-ink-soft">
              {tx(
                "The call opens in a new tab. You both land in the same room — there is nothing to share or dial.",
              )}
            </p>

            <button
              onClick={openCall}
              className="btn-primary mt-5 flex w-full justify-center !py-3"
            >
              <Video size={17} aria-hidden />
              {tx("Open the call")}
              <ExternalLink size={15} aria-hidden />
            </button>

            <button
              onClick={copy}
              className="btn-ghost mt-2 w-full justify-center !py-2.5 !text-xs"
            >
              {copied ? (
                <>
                  <Check size={14} aria-hidden /> {tx("Link copied")}
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden /> {tx("Copy the link")}
                </>
              )}
            </button>

            <p className="mt-4 border-t border-ink-line pt-3 font-body text-[11px] leading-relaxed text-ink-mute">
              {tx("Nothing is recorded, and there is no time limit.")}{" "}
              {prefs.locale !== "en" && tx("Captions are available inside the call.")}{" "}
              {tx("If no tab opened, your browser blocked the pop-up — use the link below.")}{" "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                {tx("Open it here")}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
