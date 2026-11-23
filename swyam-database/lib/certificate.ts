/**
 * Certificates.
 *
 * The record lives in Postgres — `issue_course_certificate` mints the serial
 * and an integrity hash, so a certificate can be checked later by anyone
 * holding the serial. This module is the client side of that: it asks the
 * database to issue one, and draws the document a person actually keeps.
 *
 * The drawing is an SVG built here rather than an image fetched from a
 * server, which means it renders offline, prints sharply at any size, and can
 * be turned into a PNG in the browser with no library.
 */

import { getSupabase, requireSupabase } from "./supabase";
import { resolveCourseId } from "./catalogue";
import { issuerName } from "./issuer";

export interface IssuedCertificate {
  id: string;
  serial: string;
  title: string;
  issuer: string | null;
  recipientName: string;
  score: number | null;
  issuedAt: string;
}

/**
 * Issue the certificate for a completed course.
 *
 * The database refuses unless the enrolment is genuinely complete, which is
 * the point: the certificate has to mean something to be worth verifying.
 */
export async function issueCertificate(
  profileId: string,
  courseSlug: string,
): Promise<IssuedCertificate> {
  const supabase = requireSupabase();
  const courseId = await resolveCourseId(courseSlug);
  if (!courseId) throw new Error("That course isn't in the catalog.");

  const { data: enrolment, error: enrolErr } = await supabase
    .from("course_enrollments")
    .select("id, state")
    .eq("profile_id", profileId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (enrolErr) throw new Error(enrolErr.message);
  if (!enrolment) throw new Error("You aren't enrolled on this course.");
  if (enrolment.state !== "completed") {
    throw new Error("Finish the course first — the certificate is issued on completion.");
  }

  const { data, error } = await supabase.rpc("issue_course_certificate", {
    p_enrollment: enrolment.id,
  });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string;
    serial: string;
    title: string;
    issuer: string | null;
    recipient_name: string;
    score: number | null;
    issued_at: string;
  } | null;
  if (!row) throw new Error("The certificate could not be issued.");

  return {
    id: row.id,
    serial: row.serial,
    title: row.title,
    issuer: issuerName(row.issuer),
    recipientName: row.recipient_name,
    score: row.score === null ? null : Number(row.score),
    issuedAt: row.issued_at,
  };
}

/**
 * The serial printed on the home page's illustration.
 *
 * It is a drawing of what a certificate looks like, not one anybody holds. A
 * visitor who types it into the public check should be told exactly that,
 * rather than a bare "not found" that reads like the platform failing.
 */
export const SAMPLE_SERIAL = "SWY-24-0417";

/** Uppercase with no spaces — the form serials are issued in. */
export function normaliseSerial(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Letters, digits and dashes only; anything else cannot be a serial. */
export function isPlausibleSerial(serial: string): boolean {
  return /^[A-Z0-9-]{4,40}$/.test(serial);
}

/** Why a typed serial cannot be checked, or null when it can. */
export function serialProblem(raw: string, tx: (english: string) => string): string | null {
  const serial = normaliseSerial(raw);
  if (!serial) return tx("Type the serial printed on the certificate.");
  if (isPlausibleSerial(serial)) return null;
  return /^[A-Z0-9-]+$/.test(serial)
    ? tx("That is too short or too long to be a serial. Check you have copied all of it.")
    : tx("A serial uses only letters, numbers and dashes.");
}

/**
 * What the public check found.
 *
 * Each failure stays distinct because each means something different to the
 * person checking: a typo, a certificate withdrawn, one past its validity, and
 * a record altered after it was issued are four different answers.
 */
export type CertificateCheck =
  | { status: "valid"; certificate: IssuedCertificate }
  | { status: "not_found" | "revoked" | "expired" | "integrity_failed" | "sample" };

/**
 * Look a certificate up by serial, and say why when it does not check out.
 *
 * Throws when the register cannot be reached, so the page can tell a lost
 * connection apart from a serial that genuinely does not exist.
 */
export async function checkCertificate(serial: string): Promise<CertificateCheck> {
  const clean = normaliseSerial(serial);
  if (clean === SAMPLE_SERIAL) return { status: "sample" };

  const supabase = getSupabase();
  if (!supabase) throw new Error("The certificate register isn't reachable right now.");

  // Through the RPC rather than the table.
  //
  // Two reasons. The certificates table is no longer readable without a
  // session — listing it handed out every serial on the platform, and a serial
  // is what an employer checks — while this function is SECURITY DEFINER, so
  // the page still works for a logged-out visitor with a link.
  //
  // And it verifies more than the old select did: revocation, expiry, and an
  // integrity hash over the serial, recipient, title, date and score. The
  // direct read checked only `revoked_at`, so a row edited in the database
  // would still have shown as genuine.
  const { data, error } = await supabase.rpc("verify_certificate", { p_serial: clean });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as VerifyCertificateRow | undefined;
  if (!row?.found) return { status: "not_found" };
  if (!row.valid) {
    const reason = row.reason;
    return reason === "revoked" || reason === "expired" || reason === "integrity_failed"
      ? { status: reason }
      : { status: "not_found" };
  }

  return {
    status: "valid",
    certificate: {
      id: row.serial,
      serial: row.serial,
      title: row.title,
      issuer: issuerName(row.issuer),
      recipientName: row.recipient_name,
      score: row.score === null ? null : Number(row.score),
      issuedAt: row.issued_at,
    },
  };
}

/**
 * Look a certificate up by serial.
 *
 * Deliberately readable without signing in: a certificate nobody else can
 * check is not proof of anything. Returns the certificate only when it is
 * genuine; `checkCertificate` says why when it is not.
 */
export async function verifyCertificate(serial: string): Promise<IssuedCertificate | null> {
  if (!getSupabase()) return null;
  const check = await checkCertificate(serial);
  return check.status === "valid" ? check.certificate : null;
}

/** One row of `verify_certificate`, which reports *why* a serial failed. */
interface VerifyCertificateRow {
  found: boolean;
  valid: boolean;
  /** "valid" | "not_found" | "revoked" | "expired" | "integrity_failed" */
  reason: string;
  serial: string;
  recipient_name: string;
  title: string;
  issuer: string | null;
  issued_at: string;
  score: number | string | null;
}

/* ── Drawing ─────────────────────────────────────────────────────── */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The certificate as SVG, at print proportions (A4 landscape).
 *
 * Self-contained: no external fonts, no images, no network. It has to survive
 * being emailed, printed at a cyber cafe and shown on a cracked phone.
 */
export function certificateSvg(cert: IssuedCertificate): string {
  const issued = new Date(cert.issuedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const font = "Georgia, 'Times New Roman', serif";
  const sans = "'Segoe UI', Roboto, system-ui, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1123 794" width="1123" height="794" role="img" aria-label="Certificate for ${esc(cert.recipientName)}">
  <rect width="1123" height="794" fill="#f6f4ef"/>
  <rect x="26" y="26" width="1071" height="742" fill="#ffffff" stroke="#e2ded4" stroke-width="2"/>
  <rect x="26" y="26" width="1071" height="10" fill="#c9330a"/>
  <rect x="44" y="52" width="1035" height="690" fill="none" stroke="#e2ded4" stroke-width="1"/>

  <text x="561" y="120" text-anchor="middle" font-family="${sans}" font-size="26" font-weight="600" fill="#1a1a1b" letter-spacing="-0.5">
    <tspan>स्व</tspan><tspan fill="#c9330a">YAM</tspan>
  </text>
  <text x="561" y="146" text-anchor="middle" font-family="${sans}" font-size="11" letter-spacing="3" fill="#5c5c60">SKILL INDIA DIGITAL ECOSYSTEM</text>

  <text x="561" y="228" text-anchor="middle" font-family="${font}" font-size="17" font-style="italic" fill="#5c5c60">This is to certify that</text>
  <text x="561" y="298" text-anchor="middle" font-family="${font}" font-size="52" fill="#1a1a1b">${esc(cert.recipientName)}</text>
  <line x1="290" y1="322" x2="833" y2="322" stroke="#e2ded4" stroke-width="1"/>

  <text x="561" y="368" text-anchor="middle" font-family="${font}" font-size="17" font-style="italic" fill="#5c5c60">has successfully completed</text>
  <text x="561" y="428" text-anchor="middle" font-family="${sans}" font-size="32" font-weight="600" fill="#c9330a">${esc(cert.title)}</text>

  ${
    cert.score != null
      ? `<text x="561" y="466" text-anchor="middle" font-family="${sans}" font-size="15" fill="#5c5c60">with a score of ${Math.round(cert.score)}%</text>`
      : ""
  }

  <text x="150" y="628" font-family="${sans}" font-size="10" letter-spacing="2" fill="#5c5c60">ISSUED ON</text>
  <text x="150" y="652" font-family="${sans}" font-size="15" fill="#1a1a1b">${esc(issued)}</text>

  <text x="150" y="692" font-family="${sans}" font-size="10" letter-spacing="2" fill="#5c5c60">ISSUED BY</text>
  <text x="150" y="716" font-family="${sans}" font-size="15" fill="#1a1a1b">${esc(cert.issuer ?? "स्वYAM")}</text>

  <text x="973" y="628" text-anchor="end" font-family="${sans}" font-size="10" letter-spacing="2" fill="#5c5c60">CERTIFICATE SERIAL</text>
  <text x="973" y="654" text-anchor="end" font-family="ui-monospace, 'Courier New', monospace" font-size="18" font-weight="700" fill="#1a1a1b">${esc(cert.serial)}</text>
  <text x="973" y="694" text-anchor="end" font-family="${sans}" font-size="11" fill="#5c5c60">Verify this serial at</text>
  <text x="973" y="712" text-anchor="end" font-family="${sans}" font-size="12" fill="#c9330a">swyam.online/verify</text>
</svg>`;
}

/**
 * Download the certificate as a PNG.
 *
 * Rasterised in a canvas at 2x so it is sharp when printed. A PNG rather than
 * a PDF on purpose: it attaches to WhatsApp, opens on any phone, and needs no
 * reader app — which is how these actually get shared.
 */
export async function downloadCertificatePng(cert: IssuedCertificate): Promise<void> {
  const svg = certificateSvg(cert);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render the certificate."));
      img.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = 1123 * scale;
    canvas.height = 794 * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render the certificate.");
    ctx.fillStyle = "#f6f4ef";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("Could not render the certificate.");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(png);
    link.download = `swayam-certificate-${cert.serial}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Open the browser's print dialogue with just the certificate on the page. */
export function printCertificate(cert: IssuedCertificate): void {
  const w = window.open("", "_blank", "width=1180,height=840");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><title>Certificate ${esc(cert.serial)}</title>
     <style>@page{size:A4 landscape;margin:0}
     html,body{margin:0;padding:0;background:#fff}
     svg{width:100%;height:auto;display:block}</style></head>
     <body>${certificateSvg(cert)}</body></html>`,
  );
  w.document.close();
  w.focus();
  // Give the SVG a tick to lay out before the dialogue steals the thread.
  w.setTimeout(() => w.print(), 300);
}

/* ── The member's own certificates ───────────────────────────────── */

/**
 * Every certificate this member holds.
 *
 * Reads the same rows the public verifier reads, so what someone sees on
 * their own passport is exactly what an employer sees when they check a
 * serial — including a revocation.
 */
export async function listMyCertificates(profileId: string): Promise<IssuedCertificate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("certificates")
    .select("id, serial, title, issuer, recipient_name, score, issued_at, revoked_at")
    .eq("profile_id", profileId)
    .order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((c) => !c.revoked_at)
    .map((c) => ({
      id: c.id,
      serial: c.serial,
      title: c.title,
      issuer: issuerName(c.issuer),
      recipientName: c.recipient_name,
      score: c.score === null ? null : Number(c.score),
      issuedAt: c.issued_at,
    }));
}
