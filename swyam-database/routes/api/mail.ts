import { createFileRoute } from "@tanstack/react-router";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import {
  certificateEmail,
  contactEmail,
  enrolmentEmail,
  isMailConfigured,
  sendMail,
  swapRequestEmail,
} from "@/lib/mail";

/**
 * Outbound email.
 *
 * A single endpoint with a named `kind` rather than a free-form send: the
 * server decides what an email says, so a compromised or careless client can
 * never use the platform's sender to deliver arbitrary content to an
 * arbitrary address.
 *
 * Delivery is best-effort by design. A failed email must never fail the thing
 * that triggered it — an enrolment is recorded in the database whether or not
 * the confirmation arrives.
 */

type Kind = "enrolment" | "certificate" | "swap-request" | "contact";

interface Body {
  kind?: Kind;
  to?: string;
  name?: string;
  courseTitle?: string;
  provider?: string;
  duration?: string;
  serial?: string;
  issuedOn?: string;
  score?: number | null;
  fromName?: string;
  theyTeach?: string;
  youTeach?: string;
  /* contact */
  email?: string;
  phone?: string | null;
  reason?: string;
  subject?: string;
  message?: string;
  reference?: string;
  sourcePath?: string | null;
}

/**
 * Where a contact message goes.
 *
 * Read from the environment and never from the request. Every other kind here
 * takes its recipient from the body, which is safe because the caller is
 * telling us their own address; a contact form is the opposite shape, and a
 * body-supplied recipient would turn this endpoint into a way to send mail
 * from this domain to anybody.
 */
const contactRecipient = (): string | null => {
  const to = process.env["CONTACT_TO"]?.trim();
  return to || null;
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const Route = createFileRoute("/api/mail")({
  server: {
    handlers: {
      GET: async () => Response.json({ configured: isMailConfigured() }),

      POST: async ({ request }) => {
        /* Before anything is parsed or paid for. */
        const limited = rateLimit(request, LIMITS.mail);
        if (limited) return limited;

        if (!isMailConfigured()) {
          return Response.json(
            { error: "Email is not configured. Set RESEND_API_KEY." },
            { status: 503 },
          );
        }

        const b = (await request.json()) as Body;

        /*
         * A contact message is addressed by the server; everything else is
         * addressed by the person asking for it. Checking this before the
         * generic recipient test is what keeps the two shapes apart.
         */
        const contact = b.kind === "contact";
        const to = contact ? contactRecipient() : b.to;

        if (contact && !to) {
          return Response.json(
            { error: "Contact email is not configured. Set CONTACT_TO." },
            { status: 503 },
          );
        }
        if (!to || !isEmail(to)) {
          return Response.json({ error: "A valid recipient is required." }, { status: 400 });
        }

        const origin = new URL(request.url).origin;
        const name = (b.name ?? "friend").slice(0, 80);

        let mail: { subject: string; html: string; text: string; replyTo?: string } | null = null;

        if (contact && b.email && b.subject && b.message) {
          /*
           * Bounded to the same lengths the contact_messages table enforces.
           * The row is already stored by the time this runs, so anything
           * longer than the column allows could not have reached here — but
           * this endpoint is reachable on its own, and an unbounded string in
           * an outbound email is a way to send a payload from this domain.
           */
          mail = contactEmail({
            name: name.slice(0, 120),
            email: b.email.slice(0, 200),
            phone: (b.phone ?? null)?.slice(0, 20) ?? null,
            reason: (b.reason ?? "general").slice(0, 20),
            subject: b.subject.slice(0, 200),
            message: b.message.slice(0, 5000),
            reference: (b.reference ?? "—").slice(0, 16),
            sourcePath: (b.sourcePath ?? null)?.slice(0, 200) ?? null,
            siteUrl: origin,
          });
        } else if (b.kind === "enrolment" && b.courseTitle) {
          mail = enrolmentEmail({
            name,
            courseTitle: b.courseTitle.slice(0, 160),
            provider: (b.provider ?? "स्वYAM").slice(0, 120),
            duration: (b.duration ?? "Self-paced").slice(0, 80),
            siteUrl: origin,
          });
        } else if (b.kind === "certificate" && b.courseTitle && b.serial) {
          mail = certificateEmail({
            name,
            courseTitle: b.courseTitle.slice(0, 160),
            serial: b.serial.slice(0, 64),
            issuedOn: (b.issuedOn ?? new Date().toISOString().slice(0, 10)).slice(0, 40),
            score: b.score ?? null,
            siteUrl: origin,
          });
        } else if (b.kind === "swap-request" && b.fromName && b.theyTeach && b.youTeach) {
          mail = swapRequestEmail({
            name,
            fromName: b.fromName.slice(0, 80),
            theyTeach: b.theyTeach.slice(0, 80),
            youTeach: b.youTeach.slice(0, 80),
            siteUrl: origin,
          });
        }

        if (!mail) {
          return Response.json({ error: "Unknown or incomplete mail kind." }, { status: 400 });
        }

        try {
          const { id } = await sendMail({ to, ...mail });
          return Response.json({ ok: true, id });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Send failed.";
          console.error("mail", message);
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
