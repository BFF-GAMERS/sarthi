import { describe, expect, it } from "vitest";
import {
  applyDismiss,
  applyInterest,
  applyShown,
  resetForRoleChange,
} from "@/membership/core/plus-state";
import { DEFAULT_PLUS_STATE, type PlusState } from "@/membership/core/types";
import {
  TRIGGER,
  evaluateTrigger,
  isBlockedRoute,
  memoryFromPlusState,
  momentFromEvent,
  type TriggerInput,
} from "./trigger";

const DAY = 24 * 60 * 60_000;
const NOW = 1_800_000_000_000;

/** The stored Plus state of someone first seen ten days ago, with `over` applied. */
const stored = (over: Partial<PlusState> = {}): PlusState => ({
  ...DEFAULT_PLUS_STATE,
  signupAt: NOW - 10 * DAY,
  ...over,
});

/** An eligible college student, ten days in, a moment that settled five seconds ago. */
const base = (over: Partial<TriggerInput> = {}, plus: PlusState = stored()): TriggerInput => ({
  now: NOW,
  signedIn: true,
  profileType: "college",
  isMinor: false,
  signupAt: NOW - 10 * DAY,
  sandbox: false,
  tier: 2,
  state: "CAREER_FIRST",
  sessionCount: 4,
  moment: { id: "job_applied", at: NOW - 5_000 },
  pathname: "/jobs",
  lastTransitionAt: NOW - 10 * 60_000,
  typing: false,
  overlayOpen: false,
  shownThisSession: false,
  memory: memoryFromPlusState(plus, NOW),
  ...over,
});

const why = (over: Partial<TriggerInput> = {}, plus?: PlusState) =>
  evaluateTrigger(base(over, plus)).reason;

describe("the happy path", () => {
  it("opens for an adult college student after a meaningful moment", () => {
    expect(evaluateTrigger(base())).toEqual({ show: true, reason: null, moment: "job_applied" });
  });

  it.each(["college", "jobseeker", "professional"] as const)("opens for %s", (t) => {
    expect(evaluateTrigger(base({ profileType: t })).show).toBe(true);
  });

  it("opens for a school student only when they are known to be an adult", () => {
    expect(evaluateTrigger(base({ profileType: "school", isMinor: false })).show).toBe(true);
  });
});

describe("who never gets the popup", () => {
  it("guests", () => expect(why({ signedIn: false })).toBe("guest"));
  it("members who have not declared a type", () =>
    expect(why({ profileType: null })).toBe("no_type"));
  it("minors", () => {
    expect(why({ profileType: "school", isMinor: true })).toBe("minor");
    expect(why({ profileType: "college", isMinor: true })).toBe("minor");
  });
  it("unknown age counts as a minor", () => {
    expect(why({ profileType: "school", isMinor: null })).toBe("unknown_age");
    expect(why({ profileType: "jobseeker", isMinor: null })).toBe("unknown_age");
  });
  it("recruiters and institutes, who get the Settings card only", () => {
    expect(why({ profileType: "recruiter" })).toBe("no_auto_role");
    expect(why({ profileType: "institute" })).toBe("no_auto_role");
  });
  it("the Lab sandbox", () => expect(why({ sandbox: true })).toBe("sandbox"));
});

describe("readiness", () => {
  it("never inside the first 24 hours after signup", () => {
    expect(why({ signupAt: NOW - (DAY - 1) })).toBe("too_new");
    expect(why({ signupAt: NOW - DAY })).toBeNull();
  });

  it("falls back to first-seen when the account date is unknown", () => {
    expect(why({ signupAt: null }, stored({ signupAt: NOW - 60_000 }))).toBe("too_new");
    expect(why({ signupAt: null }, stored({ signupAt: NOW - 2 * DAY }))).toBeNull();
  });

  it("never on a first session", () => expect(why({ sessionCount: 1 })).toBe("session"));
  it("needs engine tier 1", () => expect(why({ tier: 0 })).toBe("tier"));
  it("needs a committed state, not UNIVERSAL", () =>
    expect(why({ state: "UNIVERSAL" })).toBe("universal"));
  it("needs a meaningful moment", () => expect(why({ moment: null })).toBe("no_moment"));

  it("a moment goes stale after two minutes", () => {
    expect(why({ moment: { id: "job_applied", at: NOW - TRIGGER.MOMENT_WINDOW_MS - 1 } })).toBe(
      "stale_moment",
    );
  });

  it("waits a beat after the moment so it never lands mid-tap", () => {
    expect(why({ moment: { id: "course_completed", at: NOW - 500 } })).toBe("settling");
  });
});

describe("blocked routes", () => {
  it.each([
    "/auth",
    "/auth/callback",
    "/login",
    "/register",
    "/signup",
    "/settings",
    "/lab",
    "/lab/compare",
    "/privacy",
    "/terms",
    "/learn/python-basics",
    "/cart",
  ])("%s", (p) => {
    expect(isBlockedRoute(p)).toBe(true);
    expect(why({ pathname: p })).toBe("route");
  });

  it.each([
    "/",
    "/jobs",
    "/jobs/abc",
    "/courses",
    "/cv",
    "/passport",
    "/skillswap",
    "/labs-of-love",
  ])("%s is fine", (p) => expect(isBlockedRoute(p)).toBe(false));

  it("ignores a query string, a hash and a trailing slash", () => {
    expect(isBlockedRoute("/settings/?tab=plus")).toBe(true);
    expect(isBlockedRoute("/jobs#top")).toBe(false);
  });
});

describe("quiet windows", () => {
  it("60 seconds after the layout changed on its own", () => {
    expect(why({ lastTransitionAt: NOW - 59_000 })).toBe("transition");
    expect(why({ lastTransitionAt: NOW - 60_000 })).toBeNull();
  });
  it("while typing", () => expect(why({ typing: true })).toBe("typing"));
  it("over onboarding, the tour or the adaptation notice", () =>
    expect(why({ overlayOpen: true })).toBe("overlay"));
});

describe("frequency", () => {
  it("once per session", () => expect(why({ shownThisSession: true })).toBe("session_cap"));

  it("at least 14 days between two appearances", () => {
    expect(why({}, stored({ shownCount: 1, lastShownAt: NOW - 13 * DAY }))).toBe("spacing");
    expect(why({}, stored({ shownCount: 1, lastShownAt: NOW - 14 * DAY }))).toBeNull();
  });

  it("three in a lifetime, then never", () => {
    expect(why({}, stored({ shownCount: 2, lastShownAt: NOW - 30 * DAY }))).toBeNull();
    expect(why({}, stored({ shownCount: 3, lastShownAt: NOW - 400 * DAY }))).toBe("lifetime");
  });

  it("showing is counted by Plus's own state, and the spacing follows", () => {
    const s = applyShown(stored(), NOW);
    expect(s.shownCount).toBe(1);
    expect(why({ now: NOW + DAY }, s)).toBe("spacing");
  });
});

describe("the snooze ladder (Plus state transitions feeding the trigger)", () => {
  const later = (days: number): Partial<TriggerInput> => ({
    now: NOW + days * DAY,
    moment: { id: "job_applied", at: NOW + days * DAY - 5_000 },
  });

  it("Not now snoozes 14 days", () => {
    const s = applyDismiss(stored(), "not_now", NOW);
    expect(s.snoozeUntil).toBe(NOW + 14 * DAY);
    expect(why(later(13), s)).toBe("snoozed");
    expect(why(later(14), s)).toBeNull();
  });

  it("the second dismissal snoozes 60 days", () => {
    let s = applyDismiss(stored(), "not_now", NOW);
    s = applyDismiss(s, "esc", NOW + 15 * DAY);
    expect(s.snoozeUntil).toBe(NOW + 75 * DAY);
    expect(why(later(74), s)).toBe("snoozed");
  });

  it("Esc and the backdrop count as dismissals too", () => {
    for (const k of ["esc", "backdrop"] as const) {
      expect(applyDismiss(stored(), k, NOW).dismissCount).toBe(1);
    }
  });

  it("Don't show again is permanent", () => {
    const s = applyDismiss(stored(), "never", NOW);
    expect(why(later(900), s)).toBe("never");
  });

  it("taking the offer ends automatic popups", () => {
    expect(why({}, applyInterest(stored(), "trial_demo"))).toBe("engaged");
    expect(why({}, applyInterest(stored(), "notify"))).toBe("engaged");
  });
});

describe("role change", () => {
  it("resets the snooze, so the new role is not penalised for the old one", () => {
    const snoozed = applyDismiss(applyDismiss(stored(), "not_now", NOW), "not_now", NOW);
    expect(why({}, snoozed)).toBe("snoozed");
    expect(why({}, resetForRoleChange(snoozed))).toBeNull();
  });

  it("keeps Don't show again and the lifetime cap", () => {
    const s = resetForRoleChange(
      stored({ never: true, shownCount: 3, lastShownAt: NOW - 400 * DAY }),
    );
    expect(why({}, s)).toBe("never");
    expect(
      why({}, resetForRoleChange(stored({ shownCount: 3, lastShownAt: NOW - 400 * DAY }))),
    ).toBe("lifetime");
  });
});

describe("moments from evolution events", () => {
  it("maps the events the engine already emits", () => {
    expect(momentFromEvent({ type: "course_completed" })).toBe("course_completed");
    expect(momentFromEvent({ type: "job_applied", metadata: { kind: "job" } })).toBe("job_applied");
    expect(momentFromEvent({ type: "skill_swap_requested" })).toBe("swap_completed");
    expect(momentFromEvent({ type: "skill_passport_opened", metadata: { self: true } })).toBe(
      "passport_opened",
    );
    expect(
      momentFromEvent({ type: "skill_passport_opened", metadata: { self: false } }),
    ).toBeNull();
  });

  it("an assessment, not a lesson", () => {
    expect(
      momentFromEvent({ type: "practice_completed", metadata: { surface: "assessment" } }),
    ).toBe("assessment_completed");
    expect(
      momentFromEvent({ type: "practice_completed", metadata: { surface: "lesson" } }),
    ).toBeNull();
  });

  it("a finished CV review, not just opening the page", () => {
    expect(
      momentFromEvent({
        type: "career_launcher_opened",
        metadata: { surface: "cv", action: "plan_built" },
      }),
    ).toBe("cv_review_finished");
    expect(
      momentFromEvent({
        type: "career_launcher_opened",
        metadata: { surface: "cv", action: "open" },
      }),
    ).toBeNull();
  });

  it("the third saved job, then the sixth", () => {
    expect(momentFromEvent({ type: "job_saved" }, { job_saved: 2 })).toBeNull();
    expect(momentFromEvent({ type: "job_saved" }, { job_saved: 3 })).toBe("job_saved_3");
    expect(momentFromEvent({ type: "job_saved" }, { job_saved: 4 })).toBeNull();
    expect(momentFromEvent({ type: "job_saved" }, { job_saved: 6 })).toBe("job_saved_3");
  });

  it("ignores everything else", () => {
    expect(momentFromEvent({ type: "page_viewed", metadata: { route: "/" } })).toBeNull();
    expect(momentFromEvent({ type: "course_viewed" })).toBeNull();
  });
});
