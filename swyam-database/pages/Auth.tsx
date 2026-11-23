import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, MailCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthCast, { type CastMood } from "../components/AuthCast";
import { getAuthSettings, type AuthSettings } from "../lib/auth-settings";
import type { Role } from "../data/mock";
import type { AuthMode } from "@/routes/auth";
import { suggestUsername, type UsernameState } from "../lib/username";
import UsernameField from "../components/UsernameField";
import { useTx } from "../lib/i18n";

type Mode = AuthMode;

export default function Auth() {
  const tx = useTx();
  // The route resolves ?mode= to a concrete value, so this is always a real Mode.
  const { mode: modeParam, next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(modeParam);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  // True once the member edits the field themselves, after which the
  // suggestion stops following their name around.
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>("empty");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /*
    What the cast beside the form is watching.

    `focused` is which field has the caret, and `nudge` counts deliberate
    presses — the remember-me box, the reveal — because a boolean cannot say
    "it happened again" and both of those can be pressed twice in a row.
  */
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [nudge, setNudge] = useState(0);
  const bump = () => setNudge((n) => n + 1);

  /*
    Eyes shut exactly when the password is legible, and not a moment before.

    The reveal is the only time the password is on screen as characters, so it
    is the only time looking away means anything. While it is masked there is
    nothing to be discreet about, and shutting their eyes then said the
    opposite of what was true.

    Deliberately not also conditioned on the field having focus: pressing the
    reveal moves focus to the button, and clicking anywhere else leaves the
    password sitting there in plain text. Tying discretion to the caret meant
    they opened their eyes while it was still readable.
  */
  const mood: CastMood = busy
    ? "cheering"
    : showPassword
      ? "hiding"
      : focused
        ? "watching"
        : "idle";
  const {
    ready,
    user,
    login,
    signup,
    loginWithGoogle,
    forgotPassword,
    resendConfirmation,
    isRemote,
    recovery,
    setPassword: writePassword,
  } = useAuth();
  const navigate = useNavigate();

  /**
   * What the auth server actually supports. Until this resolves no OAuth
   * button is drawn, so the form never offers a provider that would fail.
   */
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  useEffect(() => {
    let live = true;
    void getAuthSettings().then((s) => live && setSettings(s));
    return () => {
      live = false;
    };
  }, []);
  const googleEnabled = !isRemote || (settings?.providers.includes("google") ?? false);

  /** Set once an account is created but still needs its email confirmed. */
  const [awaitingConfirm, setAwaitingConfirm] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  /**
   * Seconds until the resend button is usable again.
   *
   * Both a courtesy and a necessity: the mail server allows only a couple of
   * messages an hour, so a button that stays pressable just produces a wall of
   * rate-limit errors. Counting down says *when* to try instead of *that it
   * failed*, and it re-enables itself, which the old one-shot `resent` flag
   * never did — one press and the only way back was a page reload.
   */
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  // The URL is the single source of truth for which form is showing. A missing
  // or unrecognised ?mode= falls back to "login", so a plain /auth link (the
  // navbar "Log in" button) switches away from the register form instead of
  // silently leaving it on screen.
  useEffect(() => {
    setMode(modeParam);
    setError("");
    setNotice("");
  }, [modeParam]);

  /*
   * Already signed in? Leave.
   *
   * The session restores a moment after the first paint, so a guard elsewhere
   * that fired too early could bounce a logged-in person to this page — and
   * they would then sit looking at a login form while the header above it
   * showed their own name. Whatever put them here, once the session is known
   * and real, this is not the page they want. `recovery` is the exception:
   * a reset link signs you in precisely so you can set a new password.
   */
  useEffect(() => {
    if (ready && user && !recovery && mode !== "reset") {
      navigate({ to: next ?? "/dashboard" });
    }
  }, [ready, user, recovery, mode, navigate, next]);

  // Switching forms pushes a new history entry, so the browser Back button
  // walks back through login <-> register <-> forgot as the user expects.
  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setNotice("");
    // The "check your email" panel replaces the whole form, so leaving it has
    // to be part of changing mode. Without this, "Go to log in" changed the
    // heading behind a panel that was still covering it: a dead button.
    if (awaitingConfirm) {
      setEmail(awaitingConfirm);
      setPassword("");
      setAwaitingConfirm(null);
      setResent(false);
    }
    navigate({ to: "/auth", search: next ? { mode: m, next } : { mode: m } });
  };

  // A username nobody has to think about. It tracks the name as it is typed
  // and stops the moment the member edits it — a prefilled field they cannot
  // steer is worse than an empty one.
  useEffect(() => {
    if (mode !== "signup" || usernameTouched) return;
    setUsername(suggestUsername(name));
  }, [name, mode, usernameTouched]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        await login(email, password, remember);
        navigate({ to: next ?? "/dashboard" });
      } else if (mode === "signup") {
        const { needsConfirmation } = await signup(name, email, password, role, username);
        if (needsConfirmation) {
          setAwaitingConfirm(email.trim().toLowerCase());
        } else {
          navigate({ to: next ?? "/dashboard" });
        }
      } else if (mode === "reset") {
        if (password !== confirm) throw new Error("The two passwords do not match.");
        await writePassword(password);
        setNotice("Password changed. You can use it the next time you log in.");
        setPassword("");
        setConfirm("");
        window.setTimeout(() => navigate({ to: "/dashboard" }), 1200);
      } else {
        await forgotPassword(email);
        setNotice(`Password reset link sent to ${email}. Check your inbox, including spam.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError("");
    try {
      await loginWithGoogle();
      // A real OAuth handoff navigates away; only the offline fallback returns
      // here with a session already in place.
      if (!isRemote) navigate({ to: next ?? "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!awaitingConfirm || busy || cooldown > 0) return;
    setBusy(true);
    setError("");
    setResent(false);
    try {
      await resendConfirmation(awaitingConfirm);
      setResent(true);
      setCooldown(60);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend the link.";
      setError(message);
      // The server usually says how long to wait; honour it rather than
      // inviting a press that is guaranteed to fail again.
      const wait = /(\d+)\s*seconds?/i.exec(message)?.[1];
      setCooldown(wait ? Math.min(Number(wait), 600) : 60);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 min-h-dvh lg:h-dvh lg:grid-cols-[1.05fr_0.95fr] lg:overflow-hidden">
      {/*
        The panel beside the form: the cast, and nothing else.

        It carried a kicker, a headline, a standfirst and a caption over a
        stock photograph. All of it competed with the one thing a person came
        to this route to do, and none of it was reading anybody stopped for.
        The characters say the same thing without asking to be read.
      */}
      <aside className="auth-panel ink-block relative m-3 hidden items-center justify-center overflow-hidden rounded-[2rem] p-10 lg:flex">
        <div className="halftone absolute inset-0 opacity-[0.06]" aria-hidden />
        <div className="relative flex h-full w-full items-center justify-center">
          <AuthCast mood={mood} nudge={nudge} />
        </div>
      </aside>

      {/*
        Form column — deliberately not animated in.

        This is the one screen a person cannot route around, and an entrance
        animation that starts at `opacity: 0` leaves it blank if the animation
        never runs: opened in a background tab, or interrupted part-way. The
        sign-in form is always painted.
      */}
      {/*
        Sized to the viewport rather than to its content.

        With the navigation gone this route owns the whole screen, so the page
        itself never scrolls: from `lg` up the grid is exactly one screen tall
        and this column carries any overflow of its own. Sign-up on a short
        laptop was pushing the whole document 114px past the fold, which
        dragged the panel and its cast up out of view along with it — the form
        is the part that needs the room, so the form is the part that scrolls.

        Below `lg` the panel is hidden and this column *is* the page, so there
        it scrolls the ordinary way.
      */}
      <div className="relative flex min-h-dvh flex-col justify-center px-6 py-6 sm:px-12 lg:h-dvh lg:min-h-0 lg:overflow-y-auto">
        {/* The site navigation is deliberately hidden on this route, so this
            is the only way back out. Without it the page is a trap. */}
        <Link
          to="/"
          className="relative mx-auto mb-3 flex w-full max-w-sm items-center gap-1.5 font-body text-[12px] text-ink-mute transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} aria-hidden />
          {tx("Back to home")}
        </Link>

        {/*
          A flat card, deliberately.

          This panel used to lean toward the pointer and lift its contents
          38px in Z. On a real mouse the submit button then drifts away as you
          reach for it — you click where it looks and miss. The effect only ran
          under `(hover: hover) and (pointer: fine)`, which is why it passed
          every automated check and failed for a person. A 3D flourish is not
          worth a login button that does not respond.
        */}
        <div className="card relative mx-auto w-full max-w-sm p-5 shadow-[var(--shadow-float)] sm:p-6">
          <p className="kicker">
            {mode === "login" && "Members"}
            {mode === "signup" && "New here"}
            {mode === "forgot" && "Recovery"}
            {mode === "reset" && "Recovery"}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Create your free account"}
            {mode === "forgot" && "Reset password"}
            {mode === "reset" && "Choose a new password"}
          </h1>
          <p className="mt-1.5 hidden font-body text-[13.5px] text-ink-mute lg:block [@media(max-height:760px)]:lg:hidden">
            {mode === "login" && "Log in to continue your skilling journey."}
            {mode === "signup" && "Two minutes to a personalized career plan."}
            {mode === "forgot" && "We'll email you a secure reset link."}
            {mode === "reset" &&
              "Type it twice. Nothing changes on your account until you press save."}
          </p>

          {mode !== "forgot" && mode !== "reset" && googleEnabled && (
            <>
              <button
                type="button"
                onClick={google}
                disabled={busy}
                className="btn-ghost mt-5 w-full !py-2.5 !text-[14px]"
              >
                <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden>
                  <path
                    fill="#FFC107"
                    d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
                  />
                </svg>
                {tx("Continue with Google")}
              </button>
              <div className="my-4 flex items-center gap-3 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
                <span className="h-px flex-1 bg-ink-line" /> or with email{" "}
                <span className="h-px flex-1 bg-ink-line" />
              </div>
            </>
          )}

          {awaitingConfirm ? (
            <div className="mt-6 rounded-[var(--radius-card)] border border-ink-line bg-paper-light p-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-emeraldx-400/10 text-emeraldx-400">
                <MailCheck size={20} aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-xl tracking-tight text-ink">
                {tx("Check your email")}
              </h2>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
                Your account is created. We sent a confirmation link to{" "}
                <span className="font-medium text-ink">{awaitingConfirm}</span>
                {tx(
                  ". Open it, then log in \u2014 that one account covers SkillSwap, courses, jobs and Sarthi.",
                )}
              </p>
              <p className="mt-2 font-body text-xs text-ink-mute">
                {tx("Nothing yet? Check spam, then resend below.")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => switchMode("login")}
                  className="btn-primary !py-2.5 !text-xs"
                >
                  {tx("Go to log in")}
                </button>
                <button
                  onClick={resend}
                  disabled={busy || cooldown > 0}
                  className="btn-ghost !py-2.5 !text-xs disabled:opacity-60"
                >
                  {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  {cooldown > 0
                    ? `${resent ? tx("Sent") : tx("Wait")} · ${cooldown}s`
                    : resent
                      ? tx("Send it again")
                      : tx("Resend link")}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-4 font-body text-[13px] text-saffron-700">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-2.5">
              {/* Rendered plainly rather than through an animated height: a
                  frozen animation here hides the name field and the role
                  picker, which makes sign-up impossible to complete. */}
              {mode === "signup" && (
                <div className="space-y-2.5">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-1 block text-[13px] font-medium text-ink-soft"
                    >
                      {tx("Full name")}
                    </label>
                    <input
                      id="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input"
                      placeholder={tx("Aarav Sharma")}
                    />
                  </div>

                  <UsernameField
                    value={username}
                    onChange={(v) => {
                      setUsernameTouched(true);
                      setUsername(v);
                    }}
                    onStateChange={setUsernameState}
                  />

                  <fieldset>
                    <legend className="mb-1 text-[13px] font-medium text-ink-soft">
                      I'm joining as:
                    </legend>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup">
                      {(["student", "recruiter", "institute"] as Role[]).map((r) => (
                        <button
                          type="button"
                          key={r}
                          onClick={() => setRole(r)}
                          aria-pressed={role === r}
                          className={`rounded-xl border px-2 py-1.5 text-[13px] font-medium capitalize transition ${
                            role === r
                              ? "border-saffron-500 bg-saffron-100 text-saffron-700"
                              : "border-ink-line bg-paper-dim text-ink-mute hover:text-ink"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {mode === "reset" && !recovery && (
                <p className="rounded-xl bg-saffron-50 px-4 py-2.5 text-sm font-medium text-saffron-700">
                  {tx(
                    "Open this page from the link in your reset email \u2014 that link is what proves the account is yours.",
                  )}
                </p>
              )}

              {mode !== "reset" && (
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
                    {tx("Email")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    className="input"
                    placeholder={tx("you@example.com")}
                  />
                </div>
              )}

              {mode !== "forgot" && (
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-ink-soft"
                  >
                    {mode === "reset" ? "New password" : "Password"}
                  </label>
                  {/*
                    Typing a password blind on a phone keyboard is where most
                    failed sign-ins actually come from, so the reveal sits
                    inside the field rather than as a separate checkbox.
                  */}
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className="input !pr-11"
                      placeholder="••••••••"
                      autoComplete={mode === "reset" ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowPassword((v) => !v);
                        bump();
                      }}
                      // Pressing the reveal moves the focus to this button, so
                      // without this the field blurs and the cast drops back to
                      // idle at the exact moment it should be reacting.
                      onMouseDown={(e) => e.preventDefault()}
                      aria-pressed={showPassword}
                      aria-controls="password"
                      aria-label={showPassword ? tx("Hide password") : tx("Show password")}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-mute transition-colors hover:text-ink"
                    >
                      {showPassword ? (
                        <EyeOff size={17} aria-hidden />
                      ) : (
                        <Eye size={17} aria-hidden />
                      )}
                    </button>
                  </div>

                  {/*
                    Shown on the screens where a password is being *created*,
                    and only once typing starts — a checklist above an empty
                    box reads as a telling-off. Supabase enforces the eight
                    characters; the rest is advice, and says so.
                  */}
                  {(mode === "signup" || mode === "reset") && password.length > 0 && (
                    /*
                      One wrapping line, not three stacked rows.

                      As three rows this added 79px the moment somebody started
                      typing — enough to push the submit button off a laptop
                      screen at the exact moment they were reaching for it. The
                      same information fits on one line as short chips.
                    */
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {[
                        { ok: password.length >= 8, label: tx("8+ characters"), required: true },
                        {
                          ok: /[a-z]/.test(password) && /[A-Z]/.test(password),
                          label: tx("Aa"),
                          required: false,
                        },
                        { ok: /\d/.test(password), label: tx("number"), required: false },
                      ].map((r) => (
                        <li
                          key={r.label}
                          className={`flex items-center gap-1 font-body text-[11px] ${
                            r.ok
                              ? "text-emeraldx-400"
                              : r.required
                                ? "text-ink-soft"
                                : "text-ink-mute"
                          }`}
                        >
                          {r.ok ? (
                            <CheckCircle2 size={11} aria-hidden />
                          ) : (
                            <span className="grid h-2.5 w-2.5 place-items-center" aria-hidden>
                              <span className="h-1 w-1 rounded-full bg-current opacity-40" />
                            </span>
                          )}
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {mode === "reset" && (
                <div>
                  <label
                    htmlFor="confirm"
                    className="mb-1.5 block text-sm font-medium text-ink-soft"
                  >
                    {tx("New password again")}
                  </label>
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              )}

              {mode === "login" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-ink-soft">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => {
                        setRemember(e.target.checked);
                        bump();
                      }}
                      className="h-4 w-4 rounded border-ink-line bg-paper-dim accent-saffron-500"
                    />
                    {tx("Remember me")}
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="font-medium text-saffron-500 hover:text-saffron-700"
                  >
                    {tx("Forgot password?")}
                  </button>
                </div>
              )}

              {error && (
                <motion.p
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-danger"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
              {notice && (
                <motion.p
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-2 rounded-xl bg-emeraldx-500/10 px-4 py-2.5 text-sm text-emeraldx-400"
                  role="status"
                >
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden /> {notice}
                </motion.p>
              )}

              <button
                type="submit"
                // A taken username fails at the database anyway; stopping here
                // means the failure arrives beside the field that caused it
                // rather than as a red box under a form they must refill.
                disabled={busy || (mode === "signup" && usernameState === "taken")}
                className="btn-primary w-full !py-3 disabled:opacity-60"
              >
                {busy && <Loader2 size={17} className="animate-spin" aria-hidden />}
                {mode === "login" && "Log in"}
                {mode === "signup" && "Create account"}
                {mode === "forgot" && "Send reset link"}
                {mode === "reset" && "Save new password"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-mute">
            {mode === "forgot" || mode === "reset" ? (
              <>
                Remembered it?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="link-sweep text-saffron-500"
                >
                  {tx("Back to log in")}
                </button>
              </>
            ) : mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="link-sweep text-saffron-500"
                >
                  {tx("Create a free account")}
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="link-sweep text-saffron-500"
                >
                  {tx("Log in")}
                </button>
              </>
            )}
          </p>

          {/* Only advertise the offline demo login when it would actually
              work; against a live database, accounts are real. */}
          {isRemote ? (
            <p className="mt-4 px-4 py-2 text-center font-body text-[11px] leading-relaxed text-ink-mute [@media(max-height:820px)]:hidden">
              {tx(
                "One free account covers everything \u2014 SkillSwap, courses, jobs, your Skill Passport and Sarthi.",
              )}
            </p>
          ) : (
            <p className="mt-5 border-dashed border-ink/40 px-4 py-3 text-center font-body text-[11px] uppercase tracking-wider text-ink-mute">
              {tx("Demo \u00b7")}{" "}
              <span className="font-medium text-ink">{tx("demo@skillindia.in")}</span> ·{" "}
              <span className="font-medium text-ink">demo1234</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
