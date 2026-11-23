import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { currentAccount, updateAccount, type Language } from "../lib/auth";
import { getItem, setItem } from "../lib/store";

const AVATARS = ["🦁", "🐯", "🦊", "🐼", "🐸", "🦉"] as const;
const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "hinglish", label: "Hinglish" },
];
const AVATAR_KEY = "avatar";

export default function Profile() {
  const [account, setAccount] = useState(() => currentAccount());
  const [name, setName] = useState(() => account?.name ?? "");
  const [language, setLanguage] = useState<Language>(() => account?.language ?? "hinglish");
  const [avatar, setAvatar] = useState<string>(() => {
    if (!account) return "";
    const map = getItem<Record<string, string>>(AVATAR_KEY, {});
    return map[account.id] ?? "";
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!account) {
    return (
      <section className="container-x py-12">
        <div className="card p-6">
          <p>Profile dekhne ke liye pehle login karein.</p>
          <Link to="/login" className="btn-primary mt-4 inline-block">
            Login par jayein
          </Link>
        </div>
      </section>
    );
  }

  function saveName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) return;
    const result = updateAccount(account.id, { name });
    if (!result.ok) {
      setMessage({ ok: false, text: result.error ?? "Naam save nahi hua." });
      return;
    }
    setAccount(currentAccount());
    setMessage({ ok: true, text: "Naam save ho gaya." });
  }

  function pickAvatar(emoji: string) {
    if (!account) return;
    const map = getItem<Record<string, string>>(AVATAR_KEY, {});
    setItem<Record<string, string>>(AVATAR_KEY, { ...map, [account.id]: emoji });
    setAvatar(emoji);
    setMessage({ ok: true, text: "Avatar save ho gaya." });
  }

  return (
    <section className="container-x py-10">
      <p className="kicker">Profile</p>
      <h1 className="type-xl mt-2">Aapka profile</h1>

      <div className="card mt-6 flex items-center gap-4 p-5 sm:p-6">
        <span aria-hidden="true" className="text-4xl">
          {avatar || "🙂"}
        </span>
        <div>
          <p className="text-lg font-semibold">{account.name}</p>
          <p className="text-sm opacity-75">Role: {account.role}</p>
        </div>
      </div>

      {message && (
        <p role="status" className="card mt-4 p-4 text-sm font-medium">
          {message.text}
        </p>
      )}

      <form onSubmit={saveName} className="card mt-6 grid max-w-xl gap-4 p-5 sm:p-6">
        <h2 className="section-title">Naam badlein</h2>
        <label className="grid gap-1 text-sm">
          <span>Naam</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            required
          />
        </label>
        <div>
          <button type="submit" className="btn-primary min-h-10 !px-4 !py-2 text-sm">
            Save naam
          </button>
        </div>
      </form>

      <div className="card mt-6 grid max-w-xl gap-3 p-5 sm:p-6">
        <h2 className="section-title">Language</h2>
        <label className="grid gap-1 text-sm">
          <span>Preferred language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full rounded-md border px-3 py-2"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs opacity-75">
          Language abhi save nahi hogi: account update sirf naam aur role save karta hai, language nahi.
        </p>
      </div>

      <div className="card mt-6 grid max-w-xl gap-3 p-5 sm:p-6">
        <h2 className="section-title">Avatar chunein</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Avatar">
          {AVATARS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="btn-ghost h-12 w-12 !p-0 text-2xl"
              aria-label={`Avatar ${emoji}`}
              aria-pressed={avatar === emoji}
              onClick={() => pickAvatar(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
