/**
 * Transactional email.
 *
 * SERVER ONLY — `RESEND_API_KEY` has no `VITE_` prefix precisely so it never
 * reaches the browser bundle. Everything here is reached through `/api/mail`.
 *
 * Two rules shape the templates below:
 *
 *   They must read on a phone, in a cramped Gmail window, with images off.
 *   So: one column, real text, inline styles, and every important thing said
 *   in words rather than shown in a picture.
 *
 *   They must never be the only copy of something. The certificate is stored
 *   in the database and downloadable from the site; the email is a
 *   convenience, not the record.
 */

const RESEND_URL = "https://api.resend.com/emails";

export function mailKey(): string | null {
  const key = process.env["RESEND_API_KEY"];
  return key && key.trim() ? key.trim() : null;
}

export const isMailConfigured = (): boolean => mailKey() !== null;

/**
 * The From address.
 *
 * Resend only accepts `onboarding@resend.dev` until a domain is verified, and
 * that sender can only deliver to the account owner. Once a domain is added,
 * set MAIL_FROM and delivery opens up — no code change needed.
 */
function sender(): string {
  return process.env["MAIL_FROM"]?.trim() || "स्वYAM <onboarding@resend.dev>";
}

export interface SendResult {
  id: string | null;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Set for a contact message, so a reply reaches the person who wrote. */
  replyTo?: string;
}): Promise<SendResult> {
  const key = mailKey();
  if (!key) throw new Error("Email is not configured.");

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: sender(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      // A plain-text part is not optional: it is what a low-bandwidth client,
      // a screen reader and a spam filter all read first.
      text: opts.text,
      ...(opts.replyTo ? { reply_to: [opts.replyTo] } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email failed (${res.status}). ${detail.slice(0, 300)}`);
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { id: body.id ?? null };
}

/* ── Template shell ──────────────────────────────────────────────── */

const INK = "#1a1a1b";
const MUTE = "#5c5c60";
const SAFFRON = "#c9330a";
const PAPER = "#f6f4ef";
const LINE = "#e2ded4";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, bodyHtml: string, footerNote: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
  <tr><td style="padding:22px 26px;border-bottom:1px solid ${LINE};">
    <span style="font:600 19px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};letter-spacing:-0.01em;">स्व<span style="color:${SAFFRON};">YAM</span></span>
  </td></tr>
  <tr><td style="padding:26px;font:400 15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};">
    ${bodyHtml}
  </td></tr>
  <tr><td style="padding:16px 26px;border-top:1px solid ${LINE};font:400 12px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTE};">
    ${esc(footerNote)}
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${SAFFRON};color:#fff;text-decoration:none;font:600 14px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:13px 22px;border-radius:10px;">${esc(label)}</a>`;
}

/* ── Enrolment ───────────────────────────────────────────────────── */

export function enrolmentEmail(opts: {
  name: string;
  courseTitle: string;
  provider: string;
  duration: string;
  siteUrl: string;
}) {
  const { name, courseTitle, provider, duration, siteUrl } = opts;
  const subject = `You're enrolled: ${courseTitle}`;

  const html = shell(
    subject,
    `<p style="margin:0 0 14px;">Namaste ${esc(name)},</p>
     <p style="margin:0 0 18px;">Your seat on <strong>${esc(courseTitle)}</strong> is confirmed.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${PAPER};border-radius:12px;padding:14px 16px;margin:0 0 20px;">
       <tr><td style="font:400 13px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTE};">
         <strong style="color:${INK};">Provider</strong><br>${esc(provider)}<br><br>
         <strong style="color:${INK};">Length</strong><br>${esc(duration)}
       </td></tr>
     </table>
     <p style="margin:0 0 20px;">Work through it at your own pace. When you finish, we issue a certificate with a serial anyone can verify.</p>
     <p style="margin:0 0 8px;">${button(`${siteUrl}/dashboard`, "Open your dashboard")}</p>`,
    "You are receiving this because you enrolled on स्वYAM.",
  );

  const text = [
    `Namaste ${name},`,
    ``,
    `Your seat on "${courseTitle}" is confirmed.`,
    `Provider: ${provider}`,
    `Length: ${duration}`,
    ``,
    `Work through it at your own pace. When you finish, we issue a certificate with a serial anyone can verify.`,
    ``,
    `Your dashboard: ${siteUrl}/dashboard`,
  ].join("\n");

  return { subject, html, text };
}

/* ── Contact ─────────────────────────────────────────────────────── */

/**
 * A contact message, on its way to the team.
 *
 * The reply-to is the sender's address, so answering is one keystroke rather
 * than a copy and paste out of the body. The reference is the same one the
 * form showed them, so a follow-up can be matched to a row without searching.
 */
export function contactEmail(opts: {
  name: string;
  email: string;
  phone: string | null;
  reason: string;
  subject: string;
  message: string;
  reference: string;
  sourcePath: string | null;
  siteUrl: string;
}) {
  const { name, email, phone, reason, subject, message, reference, sourcePath, siteUrl } = opts;
  const line = `${reason} · ${reference}`;

  const html = shell(
    `Contact: ${subject}`,
    `<p style="margin:0 0 14px;"><strong>${esc(name)}</strong> wrote in through the contact form.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${PAPER};border-radius:12px;padding:14px 16px;margin:0 0 20px;">
       <tr><td style="font:400 13px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTE};">
         <strong style="color:${INK};">Subject</strong><br>${esc(subject)}<br><br>
         <strong style="color:${INK};">From</strong><br>${esc(email)}${phone ? `<br>${esc(phone)}` : ""}<br><br>
         <strong style="color:${INK};">Reason</strong><br>${esc(line)}${sourcePath ? `<br><br><strong style="color:${INK};">Sent from</strong><br>${esc(sourcePath)}` : ""}
       </td></tr>
     </table>
     <p style="margin:0 0 6px;white-space:pre-wrap;">${esc(message)}</p>
     <p style="margin:18px 0 8px;">${button(`${siteUrl}/admin`, "Open the inbox")}</p>`,
    "You are receiving this because somebody used the contact form on स्वYAM.",
  );

  const text = [
    `${name} wrote in through the contact form.`,
    ``,
    `Subject: ${subject}`,
    `From: ${email}${phone ? ` / ${phone}` : ""}`,
    `Reason: ${line}`,
    sourcePath ? `Sent from: ${sourcePath}` : ``,
    ``,
    message,
    ``,
    `Inbox: ${siteUrl}/admin`,
  ]
    .filter((l) => l !== ``)
    .join("\n");

  return { subject: `Contact: ${subject}`, html, text, replyTo: email };
}

/* ── Certificate ─────────────────────────────────────────────────── */

export function certificateEmail(opts: {
  name: string;
  courseTitle: string;
  serial: string;
  issuedOn: string;
  siteUrl: string;
  score?: number | null;
}) {
  const { name, courseTitle, serial, issuedOn, siteUrl, score } = opts;
  const subject = `Your certificate: ${courseTitle}`;
  const verifyUrl = `${siteUrl}/verify/${encodeURIComponent(serial)}`;

  const html = shell(
    subject,
    `<p style="margin:0 0 14px;">Congratulations ${esc(name)} —</p>
     <p style="margin:0 0 18px;">you have completed <strong>${esc(courseTitle)}</strong>.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:2px solid ${SAFFRON};border-radius:12px;padding:18px;margin:0 0 20px;">
       <tr><td align="center" style="font:400 13px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTE};">
         <span style="font:600 11px/1 -apple-system,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${SAFFRON};">Certificate serial</span><br>
         <span style="font:700 18px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:${INK};letter-spacing:.04em;">${esc(serial)}</span><br>
         <span style="font-size:12px;">Issued ${esc(issuedOn)}${score != null ? ` · Score ${Math.round(score)}%` : ""}</span>
       </td></tr>
     </table>
     <p style="margin:0 0 18px;">Anyone — an employer, a training partner — can check this serial and see it is genuine. It is on your Skill Passport too.</p>
     <p style="margin:0 0 10px;">${button(`${siteUrl}/passport`, "View your Skill Passport")}</p>
     <p style="margin:0;font-size:13px;color:${MUTE};">Verify this certificate: <a href="${esc(verifyUrl)}" style="color:${SAFFRON};">${esc(verifyUrl)}</a></p>`,
    "Keep this serial. It is the proof employers can check.",
  );

  const text = [
    `Congratulations ${name},`,
    ``,
    `You have completed "${courseTitle}".`,
    ``,
    `Certificate serial: ${serial}`,
    `Issued: ${issuedOn}${score != null ? ` · Score ${Math.round(score)}%` : ""}`,
    ``,
    `Anyone can check this serial and see it is genuine.`,
    `Verify: ${verifyUrl}`,
    `Your Skill Passport: ${siteUrl}/passport`,
  ].join("\n");

  return { subject, html, text };
}

/* ── Swap request ────────────────────────────────────────────────── */

export function swapRequestEmail(opts: {
  name: string;
  fromName: string;
  theyTeach: string;
  youTeach: string;
  siteUrl: string;
}) {
  const { name, fromName, theyTeach, youTeach, siteUrl } = opts;
  const subject = `${fromName} wants to swap skills with you`;

  const html = shell(
    subject,
    `<p style="margin:0 0 14px;">Namaste ${esc(name)},</p>
     <p style="margin:0 0 18px;"><strong>${esc(fromName)}</strong> has proposed a SkillSwap.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${PAPER};border-radius:12px;padding:16px;margin:0 0 20px;">
       <tr><td style="font:400 14px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};">
         They teach you <strong>${esc(theyTeach)}</strong><br>
         You teach them <strong>${esc(youTeach)}</strong>
       </td></tr>
     </table>
     <p style="margin:0 0 20px;">No money changes hands — just time, both ways.</p>
     <p style="margin:0;">${button(`${siteUrl}/skillswap`, "See the request")}</p>`,
    "You are receiving this because someone matched with your SkillSwap profile.",
  );

  const text = [
    `Namaste ${name},`,
    ``,
    `${fromName} has proposed a SkillSwap.`,
    `They teach you: ${theyTeach}`,
    `You teach them: ${youTeach}`,
    ``,
    `No money changes hands — just time, both ways.`,
    `See the request: ${siteUrl}/skillswap`,
  ].join("\n");

  return { subject, html, text };
}
