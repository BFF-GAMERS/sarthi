import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Mail, MessageSquare, Phone } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { JaaliPattern } from "@/components/Patterns";
import { isEmail, isPhone } from "@/lib/local-store";
import { sendContactMessage, type ContactReason } from "@/lib/contact";
import SarvamCall from "@/components/SarvamCall";

const TITLE = "The Connection Point — talk to स्वYAM | स्वYAM";
const DESC =
  "Reach the स्वYAM team: learner support, employer partnerships, training-center onboarding and press.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: ContactPage,
});

const REASONS = [
  { id: "learner", label: "I'm learning" },
  { id: "employer", label: "I'm hiring" },
  { id: "centre", label: "I run a center" },
  { id: "press", label: "Press" },
] as const;

/*
 * What was here: a helpline number, a partnerships address on a domain this
 * platform does not own, and a head office at "Kaushal Bhawan, New Delhi
 * 110016" — with twelve languages, two-day replies and appointment-only
 * walk-ins attached. None of it existed. Somebody who rang that number, or
 * travelled to that address, would have been worse off than if this section
 * had been blank.
 *
 * These are the routes that actually work from this page. Nothing here is a
 * promise the platform cannot keep.
 */
const CHANNELS = [
  {
    icon: MessageSquare,
    label: "This form",
    value: "Goes to the team",
    note: "Every message is stored and read. You get a reference to quote.",
  },
  {
    icon: Phone,
    label: "Talk instead of typing",
    value: "Sarthi, by voice",
    note: "In your own language, from this page — no number to ring.",
  },
  {
    icon: Mail,
    label: "Already a member?",
    value: "Use Messages",
    note: "Signed in, your thread keeps its history with the team.",
  },
];

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "subject" | "message", string>>;

function ContactPage() {
  const [reason, setReason] = useState<string>("learner");
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);

  const set =
    (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
      setErrors((prev) => ({ ...prev, [k]: undefined }));
    };

  async function submit() {
    const next: FieldErrors = {};
    if (!values.name.trim()) next.name = "Add your name so we know who's writing.";
    if (!isEmail(values.email)) next.email = "Check this address — we reply here.";
    if (values.phone.trim() && !isPhone(values.phone))
      next.phone = "Enter a 10-digit Indian mobile number.";
    if (!values.subject.trim()) next.subject = "A short subject helps us route this.";
    if (values.message.trim().length < 12) next.message = "Give us a sentence or two of detail.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setSendError(null);
    try {
      // Writes to `contact_messages`, where an administrator reads it. The
      // reference comes back from the stored row, so quoting it finds the
      // message — a ticket number that maps to nothing implies a queue that
      // does not exist.
      const { reference } = await sendContactMessage({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim() || undefined,
        reason: reason as ContactReason,
        subject: values.subject.trim(),
        message: values.message.trim(),
        sourcePath: typeof window === "undefined" ? undefined : window.location.pathname,
      });
      setTicket(reference);
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "The message could not be sent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative z-10">
      <section className="relative border-b border-ink-line">
        <div className="ledger absolute inset-0 opacity-70" aria-hidden />
        <div className="container-x relative pb-14 pt-32 lg:pt-40">
          <div className="flex items-center gap-3">
            <p className="kicker">The Connection Point</p>
          </div>
          <h1 className="type-hero mt-6 font-display text-ink">
            Say what you
            <span className="block text-saffron-500">need.</span>
          </h1>
          <p className="type-lede mt-7 max-w-xl border-l-[3px] border-saffron-500 pl-5 font-editorial text-ink-soft">
            Tell us which side of the platform you are on and your message is filed for the team
            with a reference you can quote. We read every message and reply as soon as we can.
          </p>

          {/*
            Speaking is faster than a form, and for anyone who reads slowly or
            not at all it is the only usable option on this page.
          */}
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-ink-line pt-7">
            <SarvamCall label="Talk to us now" />
            <p className="font-body text-[13px] text-ink-mute">
              Rather talk? Speak to Sarthi in your own language, straight from this page.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-line">
        <div className="container-x grid grid-cols-1 gap-14 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          {/* ── The form: rules, not boxes ─────────────────── */}
          <div>
            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="sent"
                  initial={{ y: 16 }}
                  animate={{ y: 0 }}
                  className="border border-ink-line bg-paper-light p-8 shadow-[var(--shadow-raised)]"
                >
                  <span className="grid h-12 w-12 place-items-center border border-ink-line bg-saffron-500 text-ink">
                    <Check size={22} aria-hidden />
                  </span>
                  <h2 className="type-md mt-6 font-display text-ink">Message received</h2>
                  <p className="mt-3 max-w-md font-body text-base leading-relaxed text-ink-soft">
                    We've logged it against the{" "}
                    {REASONS.find((r) => r.id === reason)?.label.toLowerCase()} queue. Expect a
                    reply at <span className="font-medium text-ink">{values.email}</span> within two
                    working days.
                  </p>
                  {ticket && (
                    <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-ink-mute">
                      Reference · {ticket}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setSent(false);
                      setTicket(null);
                      setValues({ name: "", email: "", phone: "", subject: "", message: "" });
                    }}
                    className="btn-ghost mt-8"
                  >
                    Send another
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={false}
                  animate={{ opacity: 1 }}
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <fieldset>
                    <legend className="datum">What brings you here</legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {REASONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReason(r.id)}
                          aria-pressed={reason === r.id}
                          className={`border border-ink-line px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
                            reason === r.id
                              ? "bg-ink text-paper-light"
                              : "bg-transparent text-ink hover:bg-paper-dim"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <Field
                      label="Your name"
                      value={values.name}
                      onChange={set("name")}
                      error={errors.name}
                      placeholder="Asha Verma"
                    />
                    <Field
                      label="Email"
                      type="email"
                      value={values.email}
                      onChange={set("email")}
                      error={errors.email}
                      placeholder="asha@example.in"
                    />
                  </div>

                  <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <Field
                      label="Phone (optional)"
                      type="tel"
                      value={values.phone}
                      onChange={set("phone")}
                      error={errors.phone}
                      placeholder="+91 98765 43210"
                    />
                    <Field
                      label="Subject"
                      value={values.subject}
                      onChange={set("subject")}
                      error={errors.subject}
                      placeholder="Fee waiver for a solar course"
                    />
                  </div>

                  <div className="mt-8">
                    <label className="block">
                      <span className="datum">Your message</span>
                      <textarea
                        rows={4}
                        value={values.message}
                        onChange={set("message")}
                        placeholder="Tell us what you're trying to do."
                        className="field-rule resize-none"
                        aria-invalid={Boolean(errors.message)}
                      />
                    </label>
                    {errors.message && (
                      <p
                        role="alert"
                        className="mt-2 font-mono text-[11px] uppercase tracking-wide text-saffron-500"
                      >
                        {errors.message}
                      </p>
                    )}
                  </div>

                  {/* Chunky submit — full-bleed slab that inverts on hover */}
                  <button
                    type="submit"
                    disabled={saving}
                    className="group mt-12 flex w-full items-center justify-between rounded-2xl border border-ink-line bg-saffron-500 px-7 py-6 text-on-accent shadow-[var(--shadow-soft)] transition-colors duration-200 hover:bg-ink hover:text-saffron-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-60"
                  >
                    <span className="type-md font-display ">{saving ? "Sending…" : "Send it"}</span>
                    <ArrowRight
                      size={30}
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-2"
                    />
                  </button>
                  {sendError && (
                    <p
                      role="alert"
                      className="mt-3 font-body text-[13px] font-medium text-saffron-600"
                    >
                      {sendError}
                    </p>
                  )}
                  {/*
                    This used to read "Demo build — messages aren't delivered.
                    Use the helpline for anything urgent." Both halves were
                    false: the message now reaches the team, and the helpline
                    it pointed at never existed.
                  */}
                  <p className="mt-3 font-body text-xs text-ink-mute">
                    Your message is stored for the team along with the address you give here. We do
                    not share it.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* ── Direct channels ────────────────────────────── */}
          <Reveal>
            <div className="relative overflow-hidden border border-ink-line bg-ink text-paper-light shadow-[var(--shadow-raised)]">
              <div className="pointer-events-none absolute inset-0 text-paper-light" aria-hidden>
                <JaaliPattern opacity={0.09} scale={52} />
              </div>
              <div className="relative p-8">
                <p className="kicker text-saffron-glow">Direct lines</p>
                <ul className="mt-8 space-y-8">
                  {CHANNELS.map((c) => (
                    <li
                      key={c.label}
                      className="border-b border-paper-light/20 pb-8 last:border-0 last:pb-0"
                    >
                      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-deep">
                        <c.icon size={13} aria-hidden />
                        {c.label}
                      </span>
                      <p className="mt-2.5 font-display text-xl leading-tight tracking-tight text-paper-light">
                        {c.value}
                      </p>
                      <p className="mt-1.5 font-body text-sm leading-relaxed text-paper-deep">
                        {c.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block">
        <span className="datum">{label}</span>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="field-rule"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="mt-2 font-mono text-[11px] uppercase tracking-wide text-saffron-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
