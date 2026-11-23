import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, HardDrive, Trash2 } from "lucide-react";
import { useTx } from "../../lib/i18n";
import { estimateQuota, usePacks } from "../../lib/offline/store";
import { removeAllPacks, removePack } from "../../lib/offline/pack";
import {
  formatBytes,
  quotaFraction,
  totalBytes,
  type QuotaEstimate,
} from "../../lib/offline/format";

/**
 * What is stored on this device for offline study, with a way to delete it.
 *
 * Deleting the last pack also removes the service worker and its page cache
 * (see removePack), so "Delete all" really does leave nothing behind.
 */
export default function OfflineStorageList() {
  const tx = useTx();
  const { packs, ready, available } = usePacks();
  const [quota, setQuota] = useState<QuotaEstimate | null>(null);
  // Which row is waiting for a yes: a slug, "all", or nothing.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const total = totalBytes(packs);

  useEffect(() => {
    let off = false;
    void estimateQuota().then((q) => {
      if (!off) setQuota(q);
    });
    return () => {
      off = true;
    };
  }, [packs]);

  const del = async (slug: string, title: string) => {
    const ok = await removePack(slug);
    setConfirming(null);
    setStatus(ok ? `${tx("Deleted")}: ${title}` : tx("Could not delete the download."));
  };

  const delAll = async () => {
    const ok = await removeAllPacks();
    setConfirming(null);
    setStatus(ok ? tx("All downloads deleted.") : tx("Could not delete the downloads."));
  };

  return (
    <section aria-labelledby="offline-title" className="scroll-mt-28">
      <p className="datum">{tx("Offline")}</p>
      <h2
        id="offline-title"
        className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink"
      >
        {tx("Downloaded for offline")}
      </h2>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {!ready ? null : !available ? (
        <p className="mt-3 font-body text-[13.5px] text-ink-soft">
          {tx("Offline downloads are not available in this browser")}
        </p>
      ) : packs.length === 0 ? (
        <div className="card mt-4 p-6">
          <p className="font-body text-[13.5px] leading-relaxed text-ink-soft">
            {tx(
              "Nothing downloaded yet. Open a course and choose Download for offline to study without a connection.",
            )}
          </p>
          <Link to="/courses" className="btn-ghost mt-4 !py-2 !text-xs">
            {tx("Browse courses")}
          </Link>
        </div>
      ) : (
        <div className="card mt-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <HardDrive size={16} className="shrink-0 text-ink-mute" aria-hidden />
            <p className="min-w-0 flex-1 font-body text-[13px] text-ink-soft">
              {tx("Used by downloads")}:{" "}
              <span className="font-medium text-ink">{formatBytes(total)}</span>
              {quota ? (
                <>
                  {" "}
                  · {tx("Device allowance")}: {formatBytes(quota.quota)} ({tx("in use overall")}:{" "}
                  {formatBytes(quota.usage)})
                </>
              ) : null}
            </p>
          </div>
          {quota ? (
            <div
              className="offline-meter mt-2"
              role="meter"
              aria-label={tx("Storage in use on this device")}
              aria-valuemin={0}
              aria-valuemax={quota.quota}
              aria-valuenow={Math.min(quota.usage, quota.quota)}
              aria-valuetext={`${formatBytes(quota.usage)} / ${formatBytes(quota.quota)}`}
            >
              <span
                style={{
                  width: `${Math.max(1, Math.round(quotaFraction(quota.usage, quota.quota) * 100))}%`,
                }}
              />
            </div>
          ) : null}

          <ul className="mt-4">
            {packs.map((p) => (
              <li key={p.courseSlug} className="offline-list__row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[14px] font-medium text-ink">{p.title}</p>
                  <p className="font-body text-[12px] text-ink-mute">
                    <CheckCircle2 size={11} className="mr-1 inline text-emeraldx-400" aria-hidden />
                    {tx("Available offline")} · {formatBytes(p.bytes)} · {p.lessonCount}{" "}
                    {tx("lessons")} · {tx("Saved")}{" "}
                    {new Date(p.savedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {confirming === p.courseSlug ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-[12px] text-ink">
                      {tx("Delete this download? You can download it again while online.")}
                    </p>
                    <button
                      type="button"
                      onClick={() => void del(p.courseSlug, p.title)}
                      className="btn-primary offline-pack__btn !text-xs"
                    >
                      <Trash2 size={14} aria-hidden /> {tx("Delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="btn-ghost offline-pack__btn !text-xs"
                    >
                      {tx("Keep")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(p.courseSlug)}
                    aria-label={`${tx("Delete download")}: ${p.title}`}
                    className="btn-ghost offline-pack__btn !text-xs"
                  >
                    <Trash2 size={14} aria-hidden /> {tx("Delete")}
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-ink-line pt-3">
            {confirming === "all" ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-body text-[12px] text-ink">
                  {tx(
                    "Delete every download on this device? You can download them again while online.",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void delAll()}
                  className="btn-primary offline-pack__btn !text-xs"
                >
                  <Trash2 size={14} aria-hidden /> {tx("Delete all")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="btn-ghost offline-pack__btn !text-xs"
                >
                  {tx("Keep")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming("all")}
                className="btn-ghost offline-pack__btn !text-xs"
              >
                <Trash2 size={14} aria-hidden /> {tx("Delete all")}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
