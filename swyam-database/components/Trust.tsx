import { useEffect, useState } from "react";
import { BadgeCheck, Clock, Info, X } from "lucide-react";
import Portal from "./Portal";
import { useTx } from "../lib/i18n";

/**
 * The small marks that say why something on the page can be believed.
 *
 * Three of them, and each is backed by a fact we actually hold:
 *
 *  - `VerifiedBadge` — an employer or institute whose `is_verified` flag is
 *    set in the database, which happens when a person on the team has
 *    confirmed the organisation exists and is who it says. The badge opens a
 *    short note on what that check is and what it is not, because a tick
 *    that nobody can explain is a decoration.
 *  - `LastUpdated` — the row's `updated_at`, as "3 days ago". A listing that
 *    says when it was last touched lets a reader judge it; one that does not
 *    asks them to trust it.
 *  - `HonestCount` — a number, or nothing. Never a made-up one.
 */

/* ── Verified ────────────────────────────────────────────────────── */

export function VerifiedBadge({
  kind = "employer",
  size = "sm",
}: {
  kind?: "employer" | "institute";
  size?: "sm" | "md";
}) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const label = kind === "institute" ? tx("Verified institute") : tx("Verified employer");
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 rounded-full bg-paper-dim font-body font-semibold text-peacock transition hover:bg-paper-deep focus-visible:ring-2 focus-visible:ring-peacock ${
          size === "md" ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[11px]"
        }`}
        aria-label={`${label}. ${tx("What does verified mean?")}`}
      >
        <BadgeCheck size={size === "md" ? 14 : 12} aria-hidden />
        {label}
      </button>
      {open && <WhatVerifiedMeans kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

function WhatVerifiedMeans({
  kind,
  onClose,
}: {
  kind: "employer" | "institute";
  onClose: () => void;
}) {
  const tx = useTx();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const who = kind === "institute" ? tx("institute") : tx("employer");
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verified-title"
          onClick={(e) => e.stopPropagation()}
          className="card w-full max-w-md rounded-b-none p-6 sm:rounded-b-[var(--radius)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-paper-dim text-peacock"
                aria-hidden
              >
                <BadgeCheck size={18} />
              </span>
              <h2 id="verified-title" className="font-display text-lg text-ink">
                {tx("What “Verified” means")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-paper-dim hover:text-ink"
              aria-label={tx("Close")}
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-4 font-body text-[14px] leading-relaxed text-ink">
            {tx("A person on the स्वYAM team has confirmed that this")} {who}{" "}
            {tx("exists, is who it says it is, and can be contacted at the details it gave us.")}
          </p>
          <ul className="mt-3 space-y-2 font-body text-[13px] text-ink-mute">
            <li className="flex gap-2">
              <Info size={15} className="mt-0.5 shrink-0 text-peacock" aria-hidden />
              {kind === "institute"
                ? tx(
                    "It does not mean the course is accredited by a government body, or that we have sat in on a class.",
                  )
                : tx(
                    "It does not mean we have checked the pay, the working conditions or the contract. Read the listing, and ask.",
                  )}
            </li>
            <li className="flex gap-2">
              <Info size={15} className="mt-0.5 shrink-0 text-peacock" aria-hidden />
              {tx(
                "Unverified is not a warning. It means nobody has checked yet. Listings from unverified organizations say so plainly.",
              )}
            </li>
            <li className="flex gap-2">
              <Info size={15} className="mt-0.5 shrink-0 text-peacock" aria-hidden />
              {tx(
                "Something wrong? Use Report on the listing, or write to us from the Contact page. A verified mark can be taken away.",
              )}
            </li>
          </ul>
          <button type="button" onClick={onClose} className="btn-primary mt-5 w-full sm:w-auto">
            {tx("Got it")}
          </button>
        </div>
      </div>
    </Portal>
  );
}

/* ── Last updated ────────────────────────────────────────────────── */

/** "today", "3 days ago", "2 months ago" — or the date, past a year. */
export function ago(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "a month ago" : `${months} months ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LastUpdated({
  iso,
  className = "",
}: {
  iso: string | null | undefined;
  className?: string;
}) {
  const tx = useTx();
  if (!iso) return null;
  const when = ago(iso);
  return (
    <span
      className={`inline-flex items-center gap-1 font-body text-[11.5px] text-ink-mute ${className}`}
      title={new Date(iso).toLocaleString("en-IN")}
    >
      <Clock size={11} aria-hidden />
      {tx("Updated")} {tx(when)}
    </span>
  );
}

/* ── Honest counts ───────────────────────────────────────────────── */

/**
 * A count, or nothing.
 *
 * Zero is shown as nothing rather than as "0 learners", because a zero on
 * every card reads as a catalogue nobody has taken, and a fake number is
 * worse. When there is a number, it is the real one.
 */
export function HonestCount({
  n,
  one,
  many,
}: {
  n: number | null | undefined;
  one: string;
  many: string;
}) {
  if (!n || n <= 0) return null;
  return (
    <span className="font-body text-[11.5px] text-ink-mute">
      {n.toLocaleString("en-IN")} {n === 1 ? one : many}
    </span>
  );
}
