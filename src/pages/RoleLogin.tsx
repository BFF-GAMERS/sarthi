import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, GraduationCap, HeartHandshake, Loader2, Moon, Presentation, Shield, Sun, Users } from "lucide-react";
import { getMode, setMode, type Mode } from "../lib/theme";
import { login, register, type ClassLevel, type Language, type Role } from "../lib/auth";
import { listSubjects } from "../lib/content";
import Wordmark from "../components/Wordmark";

const ROLES: { value: Role; label: string; icon: typeof Users; blurb: string }[] = [
  { value: "student", label: "Student", icon: GraduationCap, blurb: "Learn chapters, ask Sarthi, earn SkillPoints." },
  { value: "parent", label: "Parent", icon: Users, blurb: "See your child’s progress, read-only." },
  { value: "teacher", label: "Teacher", icon: Presentation, blurb: "Track your class group and assign revision." },
  { value: "volunteer", label: "Volunteer", icon: HeartHandshake, blurb: "Mentor a small group of students." },
  { value: "admin", label: "Admin", icon: Shield, blurb: "Platform admin" },
];

const CLASS_OPTIONS: ClassLevel[] = [8, 9, 10, 11, 12];

function roleFromParam(value: string | null): Role {
  return value === "teacher" || value === "volunteer" || value === "parent" || value === "admin" ? value : "student";
}

export default function RoleLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"login" | "register">(params.get("mode") === "register" || params.get("role") ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const initialRole = roleFromParam(params.get("role"));
  const [role, setRole] = useState<Role>(initialRole === "admin" && tab === "register" ? "student" : initialRole);
  const [classLevel, setClassLevel] = useState<string>("");
  const [subjects, setSubjects] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(getMode() === "genz");

  const isRegister = tab === "register";
  const roleInfo = ROLES.find((r) => r.value === role)!;
  const visibleRoles = ROLES.filter((r) => !(isRegister && r.value === "admin"));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (isRegister && role === "student" && !classLevel) return setError("Please choose your class.");
    setBusy(true);
    try {
      const result = isRegister
        ? await register({
            name,
            email,
            password,
            role,
            classLevel: role === "student" && classLevel ? (Number(classLevel) as ClassLevel) : undefined,
            subjects: subjects.split(",").filter(Boolean),
            language,
          })
        : await login(email, password, role);
      if (result.ok) navigate("/dashboard");
      else setError(result.error);
    } finally {
      setBusy(false);
    }
  }

  function switchTab(next: "login" | "register") {
    setTab(next);
    if (next === "register" && role === "admin") setRole("student");
    setError(null);
  }

  return (
    <div className="relative flex min-h-dvh flex-col justify-center px-6 py-10 sm:px-12">
      <div className="mx-auto mb-4 flex w-full max-w-md items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-mute)] no-underline transition-colors hover:text-[var(--color-ink)]">
          <ArrowLeft size={14} /> Back to home
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-1.5"
            aria-label="Switch theme"
            onClick={() => {
              const next: Mode = getMode() === "millennial" ? "genz" : "millennial";
              setMode(next);
              setDark(next === "genz");
            }}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/" className="no-underline">
            <Wordmark className="text-lg text-ink" />
          </Link>
        </div>
      </div>

      <div className="card relative mx-auto w-full max-w-md p-6 shadow-[var(--shadow-float)] sm:p-8">
        <p className="kicker">{isRegister ? "Join Swyam · free forever" : "Welcome back"}</p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
          {isRegister ? "Create your account" : "Log in to Swyam"}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--color-ink-mute)]">{roleInfo.blurb}</p>

        <fieldset className="mt-5">
          <legend className="mb-1.5 text-[13px] font-medium text-[var(--color-ink-soft)]">I am a</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Account type">
            {visibleRoles.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={role === r.value}
                  className="role-pill flex min-h-11 flex-col items-center gap-1"
                  onClick={() => {
                    setRole(r.value);
                    setError(null);
                  }}
                >
                  <Icon size={18} aria-hidden />
                  {r.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <form onSubmit={submit} className="mt-5 space-y-3.5">
          {isRegister && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
                Full name
              </label>
              <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Email
            </label>
            <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                className="input !pr-11"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                aria-describedby={isRegister ? "password-hint" : undefined}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[var(--radius-control)] text-[var(--color-ink-mute)] transition-colors hover:text-[var(--color-ink)]"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-controls="password"
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {isRegister && (
              <p id="password-hint" className="mt-1 text-xs text-[var(--color-ink-mute)]">
                At least 6 characters.
              </p>
            )}
          </div>

          {isRegister && role === "student" && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-[var(--color-ink-soft)]">Class (CBSE)</p>
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Class">
                {CLASS_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={classLevel === String(c)}
                    className="role-pill min-h-11"
                    onClick={() => {
                      setClassLevel(String(c));
                      setSubjects(listSubjects(c).map((s) => s.id).join(","));
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isRegister && role === "student" && classLevel && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-[var(--color-ink-soft)]">Your subjects</legend>
              <div className="flex flex-wrap gap-2">
                {listSubjects(Number(classLevel) as ClassLevel).map((s) => {
                  const list = subjects.split(",").filter(Boolean);
                  const on = list.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      className="role-pill min-h-11 !px-3"
                      onClick={() => setSubjects((on ? list.filter((x) => x !== s.id) : [...list, s.id]).join(","))}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {isRegister && (
            <div>
              <label htmlFor="language" className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
                Preferred language
              </label>
              <select id="language" className="input" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm" style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2 !py-3" disabled={busy} aria-busy={busy}>
            {busy && <Loader2 size={17} className="animate-spin" aria-hidden />}
            {isRegister ? `Create ${roleInfo.label.toLowerCase()} account` : `Log in as ${roleInfo.label.toLowerCase()}`}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-ink-mute)]">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button type="button" className="link-sweep text-[var(--color-saffron-500)]" onClick={() => switchTab("login")}>
                Log in
              </button>
            </>
          ) : (
            <>
              New to Swyam?{" "}
              <button type="button" className="link-sweep text-[var(--color-saffron-500)]" onClick={() => switchTab("register")}>
                Create a free account
              </button>
            </>
          )}
        </p>
        {role !== "student" && isRegister && (
          <p className="mt-3 text-center text-xs leading-relaxed text-[var(--color-ink-mute)]">
            {role === "parent" ? "After signing up, link your child using the email they joined with." : "After signing up, add students to your group by their Swyam email."}
          </p>
        )}
      </div>

      <p className="mx-auto mt-5 max-w-md text-center text-xs leading-relaxed text-[var(--color-ink-mute)]">
        Your account lives on this device. Swyam keeps learning free for every student.
      </p>
    </div>
  );
}
