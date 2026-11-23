import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Download, ExternalLink, Loader2, Printer, X } from "lucide-react";
import { getCompletion } from "../lib/learn";
import { EV } from "@/evolution";
import { entityId, trackOnce } from "@/evolution/runtime/tracker/track";
import {
  certificateSvg,
  downloadCertificatePng,
  issueCertificate,
  printCertificate,
  verifyCertificate,
} from "../lib/certificate";
import { usePreferences } from "../context/PreferencesContext";
import { useTx } from "../lib/i18n";

/**
 * What is left, and the certificate once nothing is.
 *
 * The four requirements are listed individually rather than reduced to a
 * percentage, because "94%" tells a learner nothing about what to do next
 * while "the final assessment is still to sit" tells them exactly.
 *
 * The certificate is requested from the server, which re-checks every rule
 * before issuing one. If this component is wrong about being finished, the
 * database says no — the tick list is a summary of the decision, not the
 * decision itself.
 */
export default function CourseCompletion({
  courseSlug,
  profileId,
  onOpenLesson,
}: {
  courseSlug: string;
  profileId: string | null;
  /** Jump to the lesson that is blocking, when the learner presses a step. */
  onOpenLesson?: (kind: "assignment" | "quiz") => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;
  const [showCert, setShowCert] = useState(false);
  const [error, setError] = useState("");

  const completion = useQuery({
    queryKey: ["completion", courseSlug],
    queryFn: () => getCompletion(courseSlug),
  });

  const c = completion.data ?? null;

  const claim = useMutation({
    mutationFn: () => issueCertificate(profileId!, courseSlug),
    onSuccess: () => {
      trackOnce(
        `done:${courseSlug}`,
        EV.COURSE_COMPLETED,
        {},
        { entityId: entityId("crs", courseSlug) },
      );
      setError("");
      void qc.invalidateQueries({ queryKey: ["completion", courseSlug] });
      void qc.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!c) return null;

  const steps: Array<{ done: boolean; label: string; go?: "assignment" | "quiz" }> = [
    { done: c.lessonsDone, label: tx("Every lesson completed") },
    { done: c.modulesPassed, label: tx("Every module assessment passed") },
    { done: c.projectSubmitted, label: tx("Final project submitted"), go: "assignment" },
    {
      done: c.finalPassed,
      label:
        c.finalScore !== null
          ? `${tx("Final assessment passed")} (${c.finalScore}%)`
          : tx("Final assessment passed"),
      go: "quiz",
    },
  ];

  return (
    <section className="card mt-10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="datum">{tx("Course completion")}</p>
          <h2 className="mt-1 font-display text-xl tracking-tight text-ink">
            {c.complete ? tx("Everything is done") : tx("What is left")}
          </h2>
        </div>
        <span className="font-display text-3xl tabular-nums text-ink">{c.percent}%</span>
      </div>

      <ul className="mt-5 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                s.done ? "bg-emeraldx-400 text-on-emerald" : "border border-ink-line text-ink-mute"
              }`}
            >
              {s.done ? <Check size={12} /> : <X size={11} />}
            </span>
            <span className={`font-body text-[14px] ${s.done ? "text-ink-soft" : "text-ink"}`}>
              {s.label}
            </span>
            {!s.done && s.go && onOpenLesson && (
              <button
                onClick={() => onOpenLesson(s.go!)}
                className="btn-ghost !px-2.5 !py-1 !text-[11px]"
              >
                {tx("Go there")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-4 font-body text-[13px] text-saffron-700">
          {error}
        </p>
      )}

      {c.complete && (
        <motion.div
          initial={still ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: still ? 0 : 0.4 }}
          className="mt-6 rounded-2xl border border-emeraldx-400/30 bg-emeraldx-400/10 p-6 text-center"
        >
          <p className="font-display text-lg tracking-tight text-ink">
            🎉 {tx("Course completed")}
          </p>
          {c.certificateSerial ? (
            <>
              <p className="mt-2 font-body text-sm text-ink-soft">
                {tx("Certificate")}{" "}
                <span className="font-mono text-[12px] text-ink">{c.certificateSerial}</span>
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button onClick={() => setShowCert(true)} className="btn-primary !py-2.5 !text-xs">
                  {tx("View certificate")}
                </button>
                <Link
                  to="/verify/$serial"
                  params={{ serial: c.certificateSerial }}
                  className="btn-ghost !py-2.5 !text-xs"
                >
                  <ExternalLink size={14} aria-hidden /> {tx("Public check")}
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 font-body text-sm text-ink-soft">
                {tx("Your certificate is ready to be issued.")}
              </p>
              <button
                onClick={() => claim.mutate()}
                disabled={claim.isPending}
                className="btn-primary mt-4 !py-2.5 !text-xs disabled:opacity-60"
              >
                {claim.isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {tx("Issue my certificate")}
              </button>
            </>
          )}
        </motion.div>
      )}

      {showCert && c.certificateSerial && (
        <CertificateSheet serial={c.certificateSerial} onClose={() => setShowCert(false)} />
      )}
    </section>
  );
}

/** The document itself, drawn from the same SVG the public check renders. */
function CertificateSheet({ serial, onClose }: { serial: string; onClose: () => void }) {
  const tx = useTx();
  const cert = useQuery({
    queryKey: ["certificate", serial],
    queryFn: () => verifyCertificate(serial),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tx("Your certificate")}
      className="fixed inset-0 z-[95] flex flex-col bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="mx-auto my-auto w-full max-w-3xl rounded-2xl bg-paper p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-sm tracking-tight text-ink">{tx("Your certificate")}</p>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-ink-mute hover:bg-paper-dim"
            aria-label={tx("Close")}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {cert.isLoading ? (
          <p className="py-10 text-center font-body text-sm text-ink-mute">{tx("Loading…")}</p>
        ) : !cert.data ? (
          <p className="py-10 text-center font-body text-sm text-ink-mute">
            {tx("The certificate could not be loaded.")}
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-ink-line bg-white p-2">
              {/*
                The same SVG the public verification page draws, so what gets
                downloaded is exactly what an employer will see. The markup is
                generated by our own code from our own row — there is no
                third-party string anywhere in it.
              */}
              <div dangerouslySetInnerHTML={{ __html: certificateSvg(cert.data) }} />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => void downloadCertificatePng(cert.data!)}
                className="btn-primary !py-2.5 !text-xs"
              >
                <Download size={14} aria-hidden /> {tx("Download PNG")}
              </button>
              <button
                onClick={() => printCertificate(cert.data!)}
                className="btn-ghost !py-2.5 !text-xs"
              >
                <Printer size={14} aria-hidden /> {tx("Print or save as PDF")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
