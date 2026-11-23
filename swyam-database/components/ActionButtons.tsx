import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { track, EV } from "@/evolution";
import { entityId } from "@/evolution/runtime/tracker/track";
import { requestMail } from "../lib/mail-client";
import { enrolWithPayment, formatPrice } from "../lib/payments";
import { courses } from "../data/mock";
import { orgById } from "../data/mock";
import {
  addToCart,
  applyToOpportunity,
  CART_EVENT,
  enrollInCourse,
  getApplication,
  getEnrollment,
  inCart,
  removeFromCart,
} from "../lib/catalogue";
import { useTx } from "../lib/i18n";
import { useToast } from "./Toast";
import { rememberIntent, shouldResume } from "../lib/pending-intent";
import { useUndoable } from "./undo/useUndoable";
import { InlineUndo } from "./undo/UndoHost";

/**
 * Enrol and Apply.
 *
 * Both go through the undo window (src/lib/undo): the tap is acknowledged at
 * once ("Application queued", with Undo), but nothing is written until the
 * 10 seconds are up or the person moves on. Undo inside the window means the
 * server never heard about it.
 *
 * Both used to be `useState(true)` — the button changed colour and nothing
 * was recorded, so the dashboard never knew and a reload forgot. They now
 * write to `course_enrollments` and `applications`, which is what makes the
 * progress bars, counters and passport mean anything.
 *
 * Signed-out visitors are sent to sign-up rather than being shown a control
 * that silently fails.
 */

function useSharedInvalidation() {
  const qc = useQueryClient();
  const { profileId } = useAuth();
  return () => {
    void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
    void qc.invalidateQueries({ queryKey: ["enrollments", profileId] });
  };
}

export function EnrollButton({ courseSlug }: { courseSlug: string }) {
  const tx = useTx();
  const { user, profileId, isRemote } = useAuth();
  const navigate = useNavigate();
  const invalidate = useSharedInvalidation();

  const status = useQuery({
    queryKey: ["enrollment", profileId, courseSlug],
    queryFn: () => getEnrollment(profileId!, courseSlug),
    enabled: Boolean(profileId) && isRemote,
  });

  const [confirming, setConfirming] = useState(false);
  const toast = useToast();
  const undoable = useUndoable();

  // Came back from signing in mid-enrolment: open the confirmation rather
  // than making them find the button again.
  useEffect(() => {
    if (user && shouldResume("enrol", courseSlug)) setConfirming(true);
  }, [user, courseSlug]);

  // The listed fee, in paise. The server reads the real price from the course
  // row when it charges — this is only what the button shows.
  const listed = courses.find((c) => c.id === courseSlug);
  const priceMinor = listed?.free
    ? 0
    : Math.round(Number(String(listed?.fees ?? "").replace(/[^\d.]/g, "")) * 100) || 0;

  const enroll = useMutation({
    // Goes through the payment path: free courses record no payment, paid ones
    // write a real `payments` row before the enrolment exists.
    mutationFn: () => enrolWithPayment(courseSlug),
    onSuccess: () => {
      track(EV.COURSE_STARTED, { via: "enrol" }, { entityId: entityId("crs", courseSlug) });
      void status.refetch();
      invalidate();
      setConfirming(false);
      const enrolled = courses.find((c) => c.id === courseSlug);
      toast({
        title: enrolled ? `Enrolled — ${enrolled.title}` : "Enrolled",
        body: "It is on your dashboard, and you can start the first lesson now.",
        action: { label: "Go to My learning", to: "/my-learning" },
      });
      // Confirmation email. Best-effort: the enrolment is already recorded.
      const course = courses.find((c) => c.id === courseSlug);
      if (user?.email && course) {
        void requestMail({
          kind: "enrolment",
          to: user.email,
          name: user.name,
          courseTitle: course.title,
          provider: orgById(course.orgId)?.name ?? "स्वYAM",
          duration: course.duration,
        });
      }
    },
  });

  // Not sent yet: the window opens, and `enrolWithPayment` runs when it closes.
  const startEnroll = () => {
    setConfirming(false);
    undoable.start({
      id: `enrol:${courseSlug}`,
      label: tx("Enrollment queued"),
      undoneLabel: tx("Enrollment cancelled"),
      commit: async () => {
        await enroll.mutateAsync();
      },
    });
  };
  const locked = undoable.phase !== "idle" || enroll.isPending;

  const enrolled = status.data?.enrolled ?? false;
  const percent = Math.round(status.data?.progressPercent ?? 0);

  /*
   * Enrolling is only half the job.
   *
   * This used to become a disabled "Enrolled — see your dashboard", which is a
   * dead end on the one screen where somebody has just decided to start: it
   * names a destination and then refuses to take you there. Once enrolled the
   * button becomes the way in, and it carries the progress so that
   * "continue" means something.
   */
  if (enrolled) {
    return (
      <>
        <Link
          to="/learn/$slug"
          params={{ slug: courseSlug }}
          className="btn-primary mt-6 flex w-full justify-center !py-3.5 text-base"
        >
          {percent > 0 ? tx("Continue learning") : tx("Start learning")}
          <ArrowRight size={18} aria-hidden />
        </Link>
        {percent > 0 && (
          <>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-deep/70"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={tx("Course progress")}
            >
              <span
                className="block h-full rounded-full bg-saffron-500 transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1.5 text-center font-body text-[12px] text-ink-mute">
              {percent}% {tx("complete")}
            </p>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {/*
        A paid course asks before it enrols.
        
        Nothing is charged — the provider is a demo — but the amount and what
        will happen are stated plainly first, because a button that silently
        creates a payment record is the wrong shape even when the payment is
        make-believe.
      */}
      {confirming && (
        <div className="mt-4 rounded-2xl border border-ink-line bg-paper-light p-4">
          <p className="font-body text-sm text-ink">
            {tx("Enroll for")} <span className="font-medium">{formatPrice(priceMinor)}</span>?
          </p>
          <p className="mt-1 font-body text-[12px] text-ink-mute">
            {tx(
              "Payments are not live yet, so nothing will be charged. The enrollment and its record are real.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={startEnroll}
              disabled={locked}
              className="btn-primary min-h-11 !py-2.5 !text-xs disabled:opacity-60"
            >
              {locked && <Loader2 size={14} className="animate-spin" aria-hidden />}
              {tx("Confirm and enroll")}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="btn-ghost min-h-11 !py-2.5 !text-xs"
            >
              {tx("Cancel")}
            </button>
          </div>
        </div>
      )}

      <button
        {...undoable.controlProps}
        onClick={() => {
          if (locked) return;
          if (!user) {
            // The course goes with them. `next` brings the page back and the
            // confirmation opens itself on arrival.
            rememberIntent({
              kind: "enrol",
              slug: courseSlug,
              title: listed?.title ?? "this course",
              path: window.location.pathname,
            });
            toast({
              tone: "info",
              title: "Sign in to enroll",
              body: "Free, and it takes a minute. We will bring you straight back here.",
            });
            navigate({ to: "/auth", search: { mode: "signup", next: window.location.pathname } });
            return;
          }
          if (priceMinor > 0) {
            setConfirming(true);
            return;
          }
          startEnroll();
        }}
        // aria-disabled, not disabled: a button that vanishes from the tab order
        // under a keyboard user's finger takes their place with it.
        aria-disabled={locked || undefined}
        aria-busy={undoable.working || enroll.isPending || undefined}
        disabled={confirming}
        className="btn-primary mt-6 w-full !py-3.5 text-base disabled:opacity-80 aria-disabled:cursor-default aria-disabled:opacity-80"
      >
        {undoable.working || enroll.isPending ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden /> {tx("Working…")}
          </>
        ) : undoable.queued ? (
          <>
            <Check size={18} aria-hidden /> {tx("Enrollment queued")}
          </>
        ) : undoable.phase === "done" ? (
          <>
            <CheckCircle2 size={18} aria-hidden /> {tx("Done")}
          </>
        ) : priceMinor > 0 ? (
          `${"Enroll now"} · ${formatPrice(priceMinor)}`
        ) : (
          "Enroll now"
        )}
      </button>
      {undoable.queued && <InlineUndo onUndo={undoable.undo} what={tx("enrollment")} />}
      {enroll.error && (
        <p role="alert" className="mt-2 font-body text-[13px] text-saffron-700">
          {enroll.error instanceof Error ? enroll.error.message : "Could not enroll."}
        </p>
      )}
      {!user && (
        <p className="mt-2 text-center font-body text-[11.5px] text-ink-mute">
          {tx("You'll be asked to log in first. We'll keep this course selected for you.")}
        </p>
      )}
    </>
  );
}

export function ApplyButton({
  opportunitySlug,
  label = "Apply now",
}: {
  opportunitySlug: string;
  label?: string;
}) {
  const tx = useTx();
  const { user, profileId, isRemote } = useAuth();
  const navigate = useNavigate();
  const invalidate = useSharedInvalidation();

  const status = useQuery({
    queryKey: ["application", profileId, opportunitySlug],
    queryFn: () => getApplication(profileId!, opportunitySlug),
    enabled: Boolean(profileId) && isRemote,
  });

  const toast = useToast();
  const qc = useQueryClient();
  const undoable = useUndoable();
  const [error, setError] = useState<string | null>(null);

  // The real send. It runs only when the undo window closes, and the
  // "Application sent" toast belongs here for the same reason: before this
  // point nothing has been sent.
  const send = async () => {
    try {
      await applyToOpportunity(profileId!, opportunitySlug);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not apply.";
      setError(message);
      toast({ tone: "bad", title: "That did not send", body: message });
      throw e;
    }
    setError(null);
    void qc.invalidateQueries({ queryKey: ["application", profileId, opportunitySlug] });
    invalidate();
    toast({
      title: "Application sent",
      body: "Every step the employer takes is dated on My applications.",
      action: { label: "Track it", to: "/applications" },
    });
  };

  const applied = status.data?.applied ?? false;
  const locked = undoable.phase !== "idle";

  return (
    <>
      <button
        {...undoable.controlProps}
        onClick={() => {
          if (locked || applied) return;
          if (!user) {
            rememberIntent({
              kind: "apply",
              slug: opportunitySlug,
              title: label === "Apply now" ? "this opening" : label,
              path: window.location.pathname,
            });
            toast({
              tone: "info",
              title: "Sign in to apply",
              body: "Your Skill Passport goes with the application, so the employer sees your proof.",
            });
            navigate({ to: "/auth", search: { mode: "signup", next: window.location.pathname } });
            return;
          }
          setError(null);
          undoable.start({
            id: `apply:${opportunitySlug}`,
            label: tx("Application queued"),
            undoneLabel: tx("Application not sent"),
            commit: send,
          });
        }}
        // aria-disabled keeps the button in the tab order, so Tab from here reaches Undo.
        aria-disabled={locked || undefined}
        aria-busy={undoable.working || undefined}
        disabled={applied}
        className="btn-primary mt-6 w-full !py-3.5 text-base disabled:opacity-80 aria-disabled:cursor-default aria-disabled:opacity-80"
      >
        {undoable.working ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden /> {tx("Working…")}
          </>
        ) : undoable.queued ? (
          <>
            <Check size={18} aria-hidden /> {tx("Application queued")}
          </>
        ) : applied ? (
          <>
            <CheckCircle2 size={18} aria-hidden /> {tx("Application submitted")}
          </>
        ) : undoable.phase === "done" ? (
          <>
            <CheckCircle2 size={18} aria-hidden /> {tx("Done")}
          </>
        ) : (
          label
        )}
      </button>
      {undoable.queued && <InlineUndo onUndo={undoable.undo} what={tx("application")} />}
      {error && (
        <p role="alert" className="mt-2 font-body text-[13px] text-saffron-700">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Add a course to the cart.
 *
 * Sits beside Enrol rather than replacing it: someone who has decided starts
 * now, someone still browsing collects. Works signed-out, because making a
 * shortlist is exactly the moment before you have an account.
 */
export function AddToCartButton({
  courseSlug,
  className = "",
}: {
  courseSlug: string;
  className?: string;
}) {
  const tx = useTx();
  const [inside, setInside] = useState(false);
  const undoable = useUndoable();

  useEffect(() => {
    const sync = () => setInside(inCart(courseSlug));
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, [courseSlug]);

  return (
    <button
      onClick={() => {
        // Immediate, and Undo (button, bar or Ctrl+Z) puts the cart back.
        const adding = !inside;
        const apply = () => void (adding ? addToCart(courseSlug) : removeFromCart(courseSlug));
        const revert = () => void (adding ? removeFromCart(courseSlug) : addToCart(courseSlug));
        undoable.start({
          id: `cart:${adding ? "add" : "remove"}:${courseSlug}`,
          label: adding ? tx("Added to cart") : tx("Removed from cart"),
          undoneLabel: adding ? tx("Cart restored") : tx("Back in your cart"),
          optimistic: apply,
          revert,
          commit: async () => undefined,
        });
      }}
      aria-pressed={inside}
      className={`btn-ghost min-h-11 !py-2.5 !text-xs ${className}`}
    >
      {inside ? (
        <>
          <Check size={14} aria-hidden /> {tx("In cart")}
        </>
      ) : (
        <>
          <ShoppingCart size={14} aria-hidden /> {tx("Add to cart")}
        </>
      )}
    </button>
  );
}
