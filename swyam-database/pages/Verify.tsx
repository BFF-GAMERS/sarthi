import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Ban,
  Clock,
  Download,
  Image as ImageIcon,
  Loader2,
  Printer,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { SerialLookup } from "../components/SerialLookup";
import {
  certificateSvg,
  checkCertificate,
  downloadCertificatePng,
  normaliseSerial,
  printCertificate,
} from "../lib/certificate";
import { useTx } from "../lib/i18n";

/**
 * Public certificate check.
 *
 * Open to anyone with the serial and no account required — a certificate an
 * employer cannot check on the spot is not proof of anything. The page states
 * plainly whether the serial is genuine, and shows the document itself so
 * there is nothing to take on trust.
 *
 * When it is not genuine the page says why, because the reasons mean different
 * things: a typo, a withdrawn certificate, an expired one and an altered record
 * are four different answers. A lost connection is a fifth, and is never shown
 * as "not found" — that would be a verdict the register never gave.
 */
export default function Verify() {
  const tx = useTx();
  const { serial: raw } = useParams({ from: "/verify/$serial" });
  const serial = normaliseSerial(raw);
  const [svg, setSvg] = useState("");

  const check = useQuery({
    queryKey: ["certificate-check", serial],
    queryFn: () => checkCertificate(serial),
    retry: 1,
  });

  const cert = check.data?.status === "valid" ? check.data.certificate : null;

  useEffect(() => {
    if (cert) setSvg(certificateSvg(cert));
  }, [cert]);

  // A verdict, once had, is kept: React Query holds the last data through a
  // failed background refetch, so data is read before error. With no data, an
  // error or a query paused for lack of a connection is the "couldn't reach"
  // state, never a silent "Checking…" that goes nowhere.
  const status = check.data
    ? check.data.status
    : check.isError || check.fetchStatus === "paused"
      ? "error"
      : "loading";

  const HEADINGS: Record<string, string> = {
    loading: tx("Checking…"),
    error: tx("Couldn't check"),
    valid: tx("Genuine"),
    sample: tx("A sample, not a certificate"),
    revoked: tx("Revoked"),
    expired: tx("Expired"),
    integrity_failed: tx("Not trustworthy"),
    not_found: tx("Not found"),
  };

  const FAILURES: Record<
    string,
    { icon: typeof ShieldAlert; title: string; body: string; tone: "warn" | "muted" }
  > = {
    not_found: {
      icon: ShieldAlert,
      title: tx("No certificate with this serial"),
      body: tx(
        "Check the characters against the certificate. Serials are made of capital letters, numbers and dashes.",
      ),
      tone: "warn",
    },
    revoked: {
      icon: Ban,
      title: tx("This certificate was revoked"),
      body: tx("It was issued, then withdrawn, so it should not be relied on."),
      tone: "warn",
    },
    expired: {
      icon: Clock,
      title: tx("This certificate has expired"),
      body: tx("It was genuine when issued, but its period of validity has ended."),
      tone: "warn",
    },
    integrity_failed: {
      icon: ShieldAlert,
      title: tx("This record has been altered"),
      body: tx(
        "Its details no longer match the seal taken when it was issued, so it can't be trusted.",
      ),
      tone: "warn",
    },
    sample: {
      icon: ImageIcon,
      title: tx("That serial is from our home page illustration"),
      body: tx(
        "The certificate drawn on स्वYAM's home page is a picture of what one looks like, and its serial isn't issued to anyone. Real certificates carry their own serial.",
      ),
      tone: "muted",
    },
    error: {
      icon: WifiOff,
      title: tx("We couldn't reach the certificate register"),
      body: tx(
        "This is a connection problem, not a verdict on the certificate. Try again in a moment.",
      ),
      tone: "muted",
    },
  };

  const failure = status && status !== "loading" && status !== "valid" ? FAILURES[status] : null;

  return (
    <div className="container-x max-w-4xl pb-24 pt-28">
      <Reveal>
        <p className="kicker">{tx("Certificate check")}</p>
        <h1 className="mt-3 section-title" aria-live="polite">
          {HEADINGS[status ?? "loading"]}
        </h1>
        <p className="mt-3 break-all font-mono text-sm text-ink-mute">{serial}</p>
      </Reveal>

      {status === "loading" && (
        <p className="mt-10 flex items-center gap-2 font-body text-sm text-ink-mute" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden /> {tx("Looking up this serial…")}
        </p>
      )}

      {failure && (
        <Reveal className="mt-10">
          <div className="panel flex flex-col items-center px-6 py-12 text-center">
            <span
              className={`grid h-12 w-12 place-items-center rounded-full ${
                failure.tone === "warn"
                  ? "bg-saffron-50 text-saffron-500"
                  : "bg-paper-dim text-ink-mute"
              }`}
            >
              <failure.icon size={22} aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-lg tracking-tight text-ink">{failure.title}</h2>
            <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-ink-mute">
              {failure.body}
            </p>
            {status === "error" && (
              <button
                onClick={() => void check.refetch()}
                className="btn-ghost mt-6 !py-2.5 !text-xs"
              >
                <RefreshCw size={14} aria-hidden /> {tx("Try again")}
              </button>
            )}
          </div>
        </Reveal>
      )}

      {cert && (
        <>
          <Reveal className="mt-8">
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-emeraldx-400/30 bg-emeraldx-400/10 px-5 py-4">
              <BadgeCheck size={20} className="shrink-0 text-emeraldx-400" aria-hidden />
              <p className="font-body text-sm text-ink">
                <strong>{cert.recipientName}</strong> {tx("completed")}{" "}
                <strong>{cert.title}</strong>, {tx("issued")}{" "}
                {new Date(cert.issuedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {cert.score != null && ` ${tx("with a score of")} ${Math.round(cert.score)}%`}.
              </p>
            </div>
          </Reveal>

          <Reveal className="mt-8">
            <div
              className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </Reveal>

          <Reveal className="mt-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void downloadCertificatePng(cert)}
                className="btn-primary !py-2.5 !text-xs"
              >
                <Download size={14} aria-hidden /> {tx("Download PNG")}
              </button>
              <button onClick={() => printCertificate(cert)} className="btn-ghost !py-2.5 !text-xs">
                <Printer size={14} aria-hidden /> {tx("Print")}
              </button>
            </div>
          </Reveal>
        </>
      )}

      {status && status !== "loading" && (
        <Reveal className="mt-12">
          <h2 className="font-display text-lg tracking-tight text-ink">
            {tx("Check another serial")}
          </h2>
          <div className="mt-4">
            <SerialLookup initial={status === "valid" ? "" : serial} />
          </div>
        </Reveal>
      )}
    </div>
  );
}
