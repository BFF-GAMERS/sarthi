import { getSupabase } from "./supabase";

/**
 * Sending a contact message somewhere it will actually be read.
 *
 * The form used to call `saveContactSubmission`, which wrote to localStorage.
 * The message never left the browser. It was given a ticket number, the page
 * said "A real person reads every message" underneath it, and clearing site
 * data deleted every enquiry the platform had ever received. Somebody asking
 * for help got a receipt for a letter that was never posted.
 *
 * This writes to `contact_messages`, where an administrator can read it. RLS
 * lets anyone insert — that is what a contact form is for, reaching a human
 * without an account — and lets nobody read them back except an admin, so an
 * open endpoint does not become a public archive of other people's phone
 * numbers.
 */

export type ContactReason = "learner" | "employer" | "centre" | "press" | "general";

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  reason: ContactReason;
  subject: string;
  message: string;
  sourcePath?: string;
}

export interface ContactResult {
  /** Short human reference, so they can quote it if they follow up. */
  reference: string;
}

/**
 * The reference is derived from the row id rather than invented, so quoting it
 * back actually finds the message. A ticket number that maps to nothing is
 * worse than no ticket number: it implies a queue that does not exist.
 */
export async function sendContactMessage(input: ContactInput): Promise<ContactResult> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Messages cannot be sent right now. Please try again shortly.");
  }

  /*
   * The id is generated here and sent, rather than read back afterwards.
   *
   * The first version did `.insert(...).select("id")`, which needs SELECT on
   * the row — and the whole point of the policy is that nobody reads these
   * back except an administrator. So the table refused its own insert's
   * return, every submission failed, and neither typecheck nor build had
   * anything to say about it; only sending the form on the live site did.
   *
   * Knowing the id up front keeps the reference honest and the table shut.
   */
  const id = crypto.randomUUID();

  const { error } = await supabase.from("contact_messages").insert({
    id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    reason: input.reason,
    subject: input.subject.trim(),
    message: input.message.trim(),
    source_path: input.sourcePath ?? null,
  });

  if (error) {
    // The database's own limits are the real validation — the checks in the
    // form are a courtesy, and a message that fails here failed a constraint
    // worth naming rather than swallowing.
    throw new Error(
      /check constraint/i.test(error.message)
        ? "That message is too short or too long. Two sentences is plenty."
        : "The message could not be sent. Please try again.",
    );
  }

  const reference = id.slice(0, 8).toUpperCase();

  /*
   * Tell the team, without making the sender wait for it.
   *
   * The message is already stored by this point, so a mail failure costs a
   * notification and not an enquiry — it is still in the admin inbox either
   * way. Awaiting it would turn a slow mail provider into a form that looks
   * broken, and a missing RESEND_API_KEY into one that cannot be used at all.
   *
   * The recipient is chosen by the server from CONTACT_TO. Passing it from
   * here would make this endpoint a way to send mail from this domain to any
   * address somebody typed.
   */
  void fetch("/api/mail", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "contact",
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      reason: input.reason,
      subject: input.subject.trim(),
      message: input.message.trim(),
      reference,
      sourcePath: input.sourcePath ?? null,
    }),
  }).catch(() => {
    /* Best effort. The row is stored and the inbox will show it. */
  });

  return { reference };
}
