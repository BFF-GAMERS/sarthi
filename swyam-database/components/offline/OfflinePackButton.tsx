import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Trash2, X } from "lucide-react";
import { useTx } from "../../lib/i18n";
import { usePacks } from "../../lib/offline/store";
import { useOnline } from "../../lib/offline/use-offline";
import {
  downloadPack,
  estimatePackSize,
  OfflineError,
  removePack,
  type OfflineErrorCode,
  type SizeEstimate,
} from "../../lib/offline/pack";
import { formatApprox, formatBytes } from "../../lib/offline/format";

type Phase =
  | { kind: "idle" }
  | { kind: "sizing" }
  | { kind: "sized"; est: SizeEstimate }
  | { kind: "downloading"; done: number; total: number }
  | { kind: "error"; code: OfflineErrorCode }
  | { kind: "confirm-remove" };

/**
 * Download a course's lessons to this device.
 *
 * The size is asked for on click and shown before any data is committed, the
 * download reports "n of m lessons" with a real progress bar, and the finished
 * state says "Available offline" with a way to remove it. Lesson text only:
 * videos stay online, and the button says so rather than letting anyone assume.
 */
export default function OfflinePackButton({
  courseSlug,
  courseTitle,
  className = "",
}: {
  courseSlug: string;
  courseTitle: string;
  className?: string;
}) {
  const tx = useTx();
  const { packs, ready, available } = usePacks();
  const online = useOnline();
  const pack = packs.find((p) => p.courseSlug === courseSlug) ?? null;

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [announce, setAnnounce] = useState("");
  const abort = useRef<AbortController | null>(null);

  // Leaving the page cancels a download in progress rather than leaving it running.
  useEffect(() => () => abort.current?.abort(), []);

  const unavailable = ready && !available;

  const messageFor = (code: OfflineErrorCode): string => {
    switch (code) {
      case "unavailable":
        return tx("Offline downloads are not available in this browser");
      case "no-connection":
        return tx("You need a connection to download. Try again when you are back online.");
      case "not-enrolled":
      case "not-found":
        return tx("Sign in and enroll in this course to download its lessons.");
      case "empty":
        return tx("This course has no lessons you can download yet.");
      case "storage-full":
        return tx(
          "Not enough space on this device. Delete a download or free some space, then try again.",
        );
      default:
        return tx("The download did not finish. Nothing was saved. Try again.");
    }
  };

  const checkSize = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: "sizing" });
    setAnnounce(tx("Checking the download size"));
    try {
      const est = await estimatePackSize(courseSlug, controller.signal);
      setPhase({ kind: "sized", est });
      setAnnounce(`${formatApprox(est.bytes)}, ${est.lessons} ${tx("lessons")}`);
    } catch (e) {
      const code = e instanceof OfflineError ? e.code : "failed";
      if (code === "aborted") {
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "error", code });
      setAnnounce(messageFor(code));
    }
  };

  const start = async (lessons: number) => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: "downloading", done: 0, total: lessons });
    setAnnounce(tx("Download started"));
    try {
      await downloadPack(courseSlug, {
        signal: controller.signal,
        onProgress: (p) => setPhase({ kind: "downloading", done: p.done, total: p.total }),
      });
      setPhase({ kind: "idle" });
      setAnnounce(tx("Download finished. Available offline."));
    } catch (e) {
      const code = e instanceof OfflineError ? e.code : "failed";
      if (code === "aborted") {
        setPhase({ kind: "idle" });
        setAnnounce(tx("Download cancelled. Nothing was saved."));
        return;
      }
      setPhase({ kind: "error", code });
      setAnnounce(messageFor(code));
    } finally {
      abort.current = null;
    }
  };

  const cancel = () => abort.current?.abort();

  const remove = async () => {
    const ok = await removePack(courseSlug);
    setPhase(ok ? { kind: "idle" } : { kind: "error", code: "failed" });
    setAnnounce(
      ok ? tx("Download removed from this device.") : tx("Could not remove the download."),
    );
  };

  const wrap = `offline-pack ${className}`.trim();
  const live = (
    <p role="status" aria-live="polite" className="sr-only">
      {announce}
    </p>
  );

  /* ── Not supported here ─────────────────────────────────────── */
  if (unavailable && !pack) {
    return (
      <div className={wrap}>
        <button
          type="button"
          disabled
          className="btn-ghost offline-pack__btn w-full disabled:opacity-60"
        >
          <Download size={15} aria-hidden /> {tx("Download for offline")}
        </button>
        <p className="offline-pack__note">
          {tx("Offline downloads are not available in this browser")}
        </p>
      </div>
    );
  }

  /* ── Downloading ────────────────────────────────────────────── */
  if (phase.kind === "downloading") {
    const pct = phase.total > 0 ? Math.round((phase.done / phase.total) * 100) : 0;
    const text = `${phase.done} ${tx("of")} ${phase.total} ${tx("lessons")}`;
    return (
      <div className={wrap}>
        {live}
        <div
          className="offline-progress"
          role="progressbar"
          aria-label={tx("Download progress")}
          aria-valuemin={0}
          aria-valuemax={phase.total}
          aria-valuenow={phase.done}
          aria-valuetext={text}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="offline-pack__row">
          <p className="offline-pack__note !text-ink flex-1" aria-hidden>
            <Loader2 size={13} className="mr-1 inline animate-spin" aria-hidden /> {text}
          </p>
          <button type="button" onClick={cancel} className="btn-ghost offline-pack__btn !text-xs">
            <X size={14} aria-hidden /> {tx("Cancel")}
          </button>
        </div>
      </div>
    );
  }

  /* ── Downloaded ─────────────────────────────────────────────── */
  if (pack) {
    if (phase.kind === "confirm-remove") {
      return (
        <div className={wrap}>
          {live}
          <p className="offline-pack__note !text-ink">
            {tx("Remove this download from your device? You can download it again while online.")}
          </p>
          <div className="offline-pack__row">
            <button
              type="button"
              onClick={() => void remove()}
              className="btn-primary offline-pack__btn !text-xs"
            >
              <Trash2 size={14} aria-hidden /> {tx("Remove")}
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              className="btn-ghost offline-pack__btn !text-xs"
            >
              {tx("Keep")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className={wrap}>
        {live}
        <div className="offline-pack__row">
          <span className="offline-badge">
            <CheckCircle2 size={12} aria-hidden /> {tx("Available offline")}
          </span>
          <span className="offline-pack__note">
            {formatBytes(pack.bytes)} · {pack.lessonCount} {tx("lessons")}
          </span>
          <button
            type="button"
            onClick={() => setPhase({ kind: "confirm-remove" })}
            aria-label={`${tx("Remove download")}: ${courseTitle}`}
            className="btn-ghost offline-pack__btn ml-auto !text-xs"
          >
            <Trash2 size={14} aria-hidden /> {tx("Remove")}
          </button>
        </div>
        <p className="offline-pack__note">
          {tx("Lesson text only. Videos, notes and progress need a connection.")}
        </p>
      </div>
    );
  }

  /* ── Size revealed, waiting for a yes ───────────────────────── */
  if (phase.kind === "sized") {
    const est = phase.est;
    return (
      <div className={wrap}>
        {live}
        <p className="offline-pack__note !text-ink">
          {formatApprox(est.bytes)} · {est.lessons} {tx("lessons")}.{" "}
          {tx("Lesson text only; videos stay online.")}
        </p>
        <div className="offline-pack__row">
          <button
            type="button"
            onClick={() => void start(est.lessons)}
            className="btn-primary offline-pack__btn flex-1 !text-xs"
          >
            <Download size={14} aria-hidden /> {tx("Download")} ({formatApprox(est.bytes)})
          </button>
          <button
            type="button"
            onClick={() => setPhase({ kind: "idle" })}
            className="btn-ghost offline-pack__btn !text-xs"
          >
            {tx("Not now")}
          </button>
        </div>
      </div>
    );
  }

  /* ── Idle, checking, or failed ──────────────────────────────── */
  const sizing = phase.kind === "sizing";
  return (
    <div className={wrap}>
      {live}
      <button
        type="button"
        onClick={() => void checkSize()}
        disabled={sizing || !online}
        aria-busy={sizing}
        className="btn-ghost offline-pack__btn w-full disabled:opacity-60"
      >
        {sizing ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <Download size={15} aria-hidden />
        )}{" "}
        {sizing ? tx("Checking size…") : tx("Download for offline")}
      </button>
      {phase.kind === "error" ? (
        <p className="offline-pack__note !text-ink flex items-start gap-1.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-saffron-600" aria-hidden />
          <span>{messageFor(phase.code)}</span>
        </p>
      ) : !online ? (
        <p className="offline-pack__note">{tx("Needs a connection")}</p>
      ) : (
        <p className="offline-pack__note">
          {tx("Study without a connection. Shows the size first.")}
        </p>
      )}
    </div>
  );
}
