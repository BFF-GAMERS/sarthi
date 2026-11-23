import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flag, Loader2, ShieldCheck, X } from "lucide-react";
import Portal from "./Portal";
import { useAuth } from "../context/AuthContext";
import { REPORT_REASONS, submitReport, type ReportReason, type ReportSubject } from "../lib/safety";
import { useTx } from "../lib/i18n";

/**
 * Reporting something.
 *
 * There was no way to do this. The `reports` table has existed since the
 * schema was written, with a moderator workflow in its columns — state,
 * handled_by, resolution — and correct row-level security. Nothing had ever
 * inserted a row. On a site that puts strangers into private video calls, the
 * answer to "this person is threatening me" was to close the tab.
 *
 * Three decisions worth naming:
 *
 * The reasons are ordered with harm first and nuisance last. Somebody in
 * trouble should not have to read past "spam" to find the words for what is
 * happening to them.
 *
 * It never says "we will investigate within N hours". This platform has one
 * administrator and no support desk; a promise about a queue that does not
 * exist is the same lie the contact form used to tell.
 *
 * It stays open after sending, showing what happens next, rather than
 * vanishing. A dialog that disappears leaves the person wondering whether it
 * worked at the moment they least want to wonder.
 */
export default function ReportDialog({
  subjectKind,
  subjectId,
  subjectOwnerId,
  subjectLabel,
  onClose,
}: {
  subjectKind: ReportSubject;
  subjectId: string;
  subjectOwnerId?: string | null;
  /** What they are reporting, in their words — "Krishna" or "this message". */
  subjectLabel: string;
  onClose: () => void;
}) {
  const tx = useTx();
  const { profileId } = useAuth();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    // The page behind a modal should not scroll under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const send = async () => {
    if (!reason || !profileId) return;
    setBusy(true);
    setError("");
    try {
      await submitReport(
        {
          subjectKind,
          subjectId,
          subjectOwnerId: subjectOwnerId ?? null,
          reason,
          detail,
        },
        profileId,
      );
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The report could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div
        data-lenis-prevent
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-ink/70 p-4 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (!panelRef.current?.contains(e.target as Node)) onClose();
        }}
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="my-auto w-full max-w-lg rounded-3xl border border-ink-line bg-paper-light p-6 shadow-[var(--shadow-float)] sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                <Flag size={13} aria-hidden /> {tx("Report")}
              </p>
              <h2 id="report-title" className="mt-2 font-display text-xl tracking-tight text-ink">
                {sent ? tx("Report sent") : subjectLabel}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label={tx("Close")}
              className="rounded-xl p-1.5 text-ink-mute transition-colors hover:bg-paper-deep/70 hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          {sent ? (
            <div className="mt-5">
              <p className="flex items-start gap-2.5 rounded-2xl border border-ink-line bg-paper-dim p-4 font-body text-[14px] leading-relaxed text-ink-soft">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emeraldx-400" aria-hidden />
                <span>
                  {tx(
                    "An administrator will see this. स्वYAM is run by a small team, so there is no promised response time — but the report is recorded and it does not expire.",
                  )}
                </span>
              </p>
              <p className="mt-3 font-body text-[13px] leading-relaxed text-ink-mute">
                {tx(
                  "If you want to stop hearing from this person right now, block them. Blocking is instant, and they are not told.",
                )}
              </p>
              <button onClick={onClose} className="btn-primary mt-5 w-full !py-2.5 !text-xs">
                {tx("Done")}
              </button>
            </div>
          ) : (
            <>
              <fieldset className="mt-5">
                <legend className="datum">{tx("What is happening?")}</legend>
                <div className="mt-2.5 space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                        reason === r.value
                          ? "border-saffron-500 bg-saffron-50"
                          : "border-ink-line hover:bg-paper-dim"
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-saffron-500"
                      />
                      <span className="font-body text-[14px] text-ink">{tx(r.label)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="mt-4 block">
                <span className="datum">{tx("Anything else? (optional)")}</span>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={tx("What happened, and when.")}
                  className="input mt-1 resize-none"
                />
              </label>

              {error && (
                <p role="alert" className="mt-3 font-body text-[13px] text-saffron-700">
                  {error}
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <button onClick={onClose} className="btn-ghost flex-1 !py-2.5 !text-xs">
                  {tx("Cancel")}
                </button>
                <button
                  onClick={() => void send()}
                  disabled={!reason || busy || !profileId}
                  className="btn-primary flex-1 !py-2.5 !text-xs disabled:opacity-50"
                >
                  {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  {tx("Send report")}
                </button>
              </div>
              {!profileId && (
                <p className="mt-2 text-center font-body text-[12px] text-ink-mute">
                  {tx("You need to be signed in to report something.")}
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </Portal>
  );
}
