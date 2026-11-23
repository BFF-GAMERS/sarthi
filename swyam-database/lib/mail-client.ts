/**
 * Asking the server to send an email.
 *
 * Deliberately fire-and-forget: an enrolment is recorded whether or not the
 * confirmation arrives, and a mail outage must never surface as "enrolment
 * failed". Failures are logged and swallowed.
 */
export async function requestMail(payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch("/api/mail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      console.warn("email not sent:", body.error ?? res.status);
    }
  } catch (error) {
    console.warn("email not sent:", error);
  }
}

/** Whether the server can send mail at all, so UI can say so honestly. */
export async function mailAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/mail");
    const body = (await res.json()) as { configured?: boolean };
    return body.configured === true;
  } catch {
    return false;
  }
}
