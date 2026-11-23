import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { resetTours, startTour } from "../components/Tour";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accessibility,
  Building2,
  Check,
  Contrast,
  Ear,
  Eye,
  Globe,
  Keyboard,
  Loader2,
  MessageSquare,
  Palette,
  Signal,
  RotateCcw,
  ShieldOff,
  Type,
  UserCheck,
  UserRoundX,
  Users,
  Volume2,
  Waves,
  Zap,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useAuth } from "../context/AuthContext";
import { usePreferences, type Preferences } from "../context/PreferencesContext";
import { SUPPORTED_LANGUAGES } from "../lib/languages";
import { setProfileType, typesForRole, useProfileType } from "../lib/profile-type";
import { TRANSLATED_LOCALES, useTx } from "../lib/i18n";
import { getProfileDetail, updateProfileDetail } from "../lib/profile-data";
import { type UsernameState } from "../lib/username";
import UsernameField from "../components/UsernameField";
import YourSwayamSettings from "../components/evolution/YourSwayamSettings";
import ThemeControl from "../components/evolution/ThemeControl";
import AppearanceControl from "../components/appearance/AppearanceControl";
import MembershipCard from "../components/membership/MembershipCard";
import PhoneAccess from "../components/PhoneAccess";
import {
  getPrivacy,
  getVisibility,
  listBlocked,
  setVisibility,
  unblockProfile,
  updatePrivacy,
  VISIBILITY_CHOICES,
  type Privacy,
  type ProfileVisibility,
} from "../lib/safety";
import { pendingFollowRequests, respondToFollow } from "../lib/people";
import { initialsAvatar } from "../lib/avatar";

/**
 * Settings — how the product looks, reads and speaks.
 *
 * Everything here writes straight through to `user_preferences`, so a choice
 * follows the account rather than the browser. The accessibility switches are
 * deliberately independent: someone who needs larger text and high contrast
 * and a dyslexia-friendly face can have all three, and someone who needs one
 * is not forced into the others.
 */

/**
 * Full effects: `swayam.fx` is "auto" (Swayam lightens itself on a slow or data-saving device) or
 * "full" (keep every effect). The frame-budget code stamps `html[data-fx]` and listens for
 * `swayam:fx`; this only writes the preference and announces it.
 */
function useFullEffects() {
  const [full, setFull] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        setFull(localStorage.getItem("swayam.fx") === "full");
      } catch {
        setFull(false);
      }
      setTier(document.documentElement.dataset["fx"] ?? null);
    };
    const later = () => window.setTimeout(read, 0);
    read();
    window.addEventListener("swayam:fx", later);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("swayam:fx", later);
      window.removeEventListener("storage", read);
    };
  }, []);
  const update = (on: boolean) => {
    try {
      localStorage.setItem("swayam.fx", on ? "full" : "auto");
    } catch {
      /* private mode: the toggle still reflects this visit */
    }
    setFull(on);
    window.dispatchEvent(new CustomEvent("swayam:fx", { detail: { fx: on ? "full" : "auto" } }));
  };
  return { full, tier, update };
}

function Row({
  icon,
  title,
  note,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink-line py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0 text-saffron-500">{icon}</span>
        <div className="min-w-0">
          <p className="font-body text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 font-body text-[12px] leading-snug text-ink-mute">{note}</p>
        </div>
      </div>
      <div className="shrink-0 sm:pl-6">{children}</div>
    </div>
  );
}

/** An accessible on/off switch — a real checkbox under a drawn control. */
function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-6 w-11 rounded-full border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-saffron-500 ${
          on ? "border-transparent bg-saffron-500" : "border-ink-line bg-paper-deep/70"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left,transform] ${
            on ? "left-[1.4rem]" : "left-0.5"
          }`}
        />
      </span>
      <span className="font-body text-xs font-medium text-ink-soft">{on ? "On" : "Off"}</span>
    </label>
  );
}

const TEXT_SCALES: Array<{ value: number; label: string }> = [
  { value: 0.9, label: "S" },
  { value: 1, label: "M" },
  { value: 1.15, label: "L" },
  { value: 1.3, label: "XL" },
  { value: 1.5, label: "XXL" },
];

export default function Settings() {
  const tx = useTx();
  const { user, profileId, ready } = useAuth();
  const { prefs, set, reset } = usePreferences();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { full: fullFx, tier: fxTier, update: setFullFx } = useFullEffects();

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const detail = useQuery({
    queryKey: ["profile-detail", profileId],
    queryFn: () => getProfileDetail(profileId!),
    enabled: Boolean(profileId),
  });

  const [form, setForm] = useState({
    handle: "",
    displayName: "",
    headline: "",
    bio: "",
    region: "",
    url: "",
  });
  const [usernameState, setUsernameState] = useState<UsernameState>("empty");
  const [savedAt, setSavedAt] = useState(false);

  useEffect(() => {
    const d = detail.data;
    if (!d) return;
    setForm({
      handle: d.handle ?? "",
      displayName: d.displayName ?? "",
      headline: d.headline ?? "",
      bio: d.bio ?? "",
      region: d.region ?? "",
      url: d.websiteUrl ?? "",
    });
  }, [detail.data]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateProfileDetail(profileId!, {
        // Sent only when it actually changed, so an unchanged save never
        // races the unique index against the member's own row.
        ...(form.handle && form.handle !== detail.data?.handle ? { handle: form.handle } : {}),
        displayName: form.displayName.trim(),
        headline: form.headline.trim() || null,
        bio: form.bio.trim() || null,
        region: form.region.trim() || null,
        websiteUrl: form.url.trim() || null,
      }),
    onSuccess: () => {
      setSavedAt(true);
      window.setTimeout(() => setSavedAt(false), 2500);
      void qc.invalidateQueries({ queryKey: ["profile-detail", profileId] });
    },
  });

  /* ── Privacy and safety ────────────────────────────────────────────
   *
   * Nine switches have sat in `profile_privacy` since the schema was written,
   * one row per account, and this application never read or wrote one of
   * them. Two of the nine are enforced server-side already:
   * `open_direct_conversation` refuses when `allow_messages_from_strangers`
   * is off. The rule worked; the switch was unreachable.
   */
  const privacy = useQuery({
    queryKey: ["privacy", profileId],
    queryFn: () => getPrivacy(profileId!),
    enabled: Boolean(profileId),
  });

  const visibility = useQuery({
    queryKey: ["visibility", profileId],
    queryFn: () => getVisibility(profileId!),
    enabled: Boolean(profileId),
  });

  const blocked = useQuery({
    queryKey: ["blocked", profileId],
    queryFn: listBlocked,
    enabled: Boolean(profileId),
  });

  const requests = useQuery({
    queryKey: ["follow-requests", profileId],
    queryFn: pendingFollowRequests,
    enabled: Boolean(profileId),
  });

  // Written one switch at a time. A "save privacy" button would mean a
  // half-changed setting sitting unsaved on a page somebody closes, and the
  // one setting nobody should have to remember to save is a safety one.
  const savePrivacy = useMutation({
    mutationFn: (patch: Partial<Privacy>) => updatePrivacy(profileId!, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["privacy", profileId] }),
  });

  const saveVisibility = useMutation({
    mutationFn: (v: ProfileVisibility) => setVisibility(profileId!, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["visibility", profileId] });
      void qc.invalidateQueries({ queryKey: ["profile-card"] });
    },
  });

  const unblock = useMutation({
    mutationFn: (id: string) => unblockProfile(id, profileId!),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["blocked", profileId] }),
  });

  const respond = useMutation({
    mutationFn: (v: { id: string; accept: boolean }) => respondToFollow(v.id, v.accept),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["follow-requests", profileId] }),
  });

  if (!user) return null;

  const flag = (key: keyof Preferences) => prefs[key] as boolean;
  const pv = privacy.data;
  const toggle = (key: keyof Privacy) => (v: boolean) => savePrivacy.mutate({ [key]: v });
  const fxNote = fullFx
    ? "Swayam keeps every effect on, even if this device is slow. Turn off to let it lighten itself."
    : fxTier === "lite" || fxTier === "static"
      ? "Swayam lightened itself for this phone: less grain, blur and counting, so it stays smooth. Turn on to keep everything."
      : "Grain, blur and counting numbers stay on unless this device struggles, then Swayam turns them down by itself. Turn on to keep everything.";

  return (
    <div className="container-x max-w-3xl pb-24 pt-28">
      <Reveal>
        <p className="kicker">{tx("Settings")}</p>
        <h1 className="mt-3 section-title">{tx("Make it yours")}</h1>
        <p className="type-lede mt-4">
          {tx(
            "How \u0938\u094d\u0935YAM looks, which language it speaks, and how it adapts to how you read, see and hear.",
          )}
        </p>
      </Reveal>

      {/* ── Look ─────────────────────────────────────────────────── */}
      <Reveal className="mt-10">
        <section className="panel p-6">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
            <Palette size={18} className="text-saffron-500" aria-hidden /> {tx("Look")}
          </h2>

          <Row
            icon={<Palette size={17} aria-hidden />}
            title={tx("Theme")}
            note="Gen Z and Millennial are two looks of the same product. Until you pick one, your device decides. Swayam never picks a look from who you are."
          >
            <ThemeControl />
          </Row>

          <Row
            icon={<Waves size={17} aria-hidden />}
            title={tx("Appearance")}
            note={tx(
              "How cards and panels are made. Classic is the standard look. Glass and Metallic are optional and switch themselves off on devices that cannot afford them.",
            )}
          >
            <AppearanceControl />
          </Row>

          <Row icon={<Zap size={17} aria-hidden />} title={tx("Full effects")} note={fxNote}>
            <Toggle on={fullFx} onChange={setFullFx} label="Full effects" />
          </Row>

          <Row
            icon={<Globe size={17} aria-hidden />}
            title={tx("Language")}
            note="All 22 scheduled languages plus English. Sarthi reads, listens and replies in the one you pick."
          >
            <label className="block">
              <span className="sr-only">{tx("Language")}</span>
              <select
                value={prefs.locale}
                onChange={(e) => set("locale", e.target.value)}
                className="input !py-2 !text-sm"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native} · {l.label}
                    {TRANSLATED_LOCALES.has(l.code) ? "" : " (English labels)"}
                  </option>
                ))}
              </select>
            </label>
          </Row>
        </section>
      </Reveal>

      {/* ── Your membership (B4's card, self-contained) ─────────── */}
      <Reveal className="mt-8">
        <section className="panel p-6" aria-labelledby="settings-membership">
          <h2 id="settings-membership" className="font-display text-lg tracking-tight text-ink">
            {tx("Your membership")}
          </h2>
          <div className="mt-4">
            <MembershipCard />
          </div>
        </section>
      </Reveal>

      {/* ── Phone access: the number Sarthi recognises on a call ── */}
      {profileId && (
        <Reveal className="mt-8">
          <PhoneAccess profileId={profileId} />
        </Reveal>
      )}

      {/* ── Your Swayam: how it adapts to you ───────────────────── */}
      <Reveal className="mt-8">
        <YourSwayamSettings />
      </Reveal>

      {/* ── Access ───────────────────────────────────────────────── */}
      <Reveal className="mt-8">
        <section className="panel p-6">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
            <Accessibility size={18} className="text-saffron-500" aria-hidden /> {tx("Access")}
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
            {tx(
              "Every switch here is independent. Turn on as many as you need \u2014 nothing is bundled and nothing is guessed on your behalf.",
            )}
          </p>

          <Row
            icon={<Type size={17} aria-hidden />}
            title={tx("Text size")}
            note="Scales the whole layout, not just the words, so nothing overflows its box."
          >
            <div className="flex gap-1.5" role="radiogroup" aria-label={tx("Text size")}>
              {TEXT_SCALES.map((t) => (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={prefs.textScale === t.value}
                  onClick={() => set("textScale", t.value)}
                  className={`h-11 w-11 rounded-lg border font-body text-xs font-semibold transition-[color,background-color,border-color] ${
                    prefs.textScale === t.value
                      ? "evo-choice-on"
                      : "border-ink-line bg-paper-light text-ink-soft hover:border-saffron-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Row>

          <Row
            icon={<Contrast size={17} aria-hidden />}
            title={tx("High contrast")}
            note="Pure black on white (or white on black), heavier borders, no shadows or background texture."
          >
            <Toggle
              on={flag("highContrast")}
              onChange={(v) => set("highContrast", v)}
              label="High contrast"
            />
          </Row>

          <Row
            icon={<Eye size={17} aria-hidden />}
            title={tx("Dyslexia-friendly text")}
            note="Wider letter, word and line spacing, a rounder typeface, and no all-caps headings."
          >
            <Toggle
              on={flag("dyslexiaFont")}
              onChange={(v) => set("dyslexiaFont", v)}
              label="Dyslexia-friendly text"
            />
          </Row>

          <Row
            icon={<Signal size={17} aria-hidden />}
            title={tx("Use less data")}
            note="Photographs do not load and nothing animates. Every word, price, date and link stays exactly where it is — this takes away weight, never information. Switched on by itself if your phone is set to save data or you are on a 2G connection, and it stays on this device rather than following your account, because the connection is what changes."
          >
            <Toggle
              on={flag("lowData")}
              onChange={(v) => set("lowData", v)}
              label="Use less data"
            />
          </Row>

          <Row
            icon={<Waves size={17} aria-hidden />}
            title={tx("Reduce motion")}
            note="Stops the scroll reveals, parallax and the scrolling ticker."
          >
            <Toggle
              on={flag("reducedMotion")}
              onChange={(v) => set("reducedMotion", v)}
              label="Reduce motion"
            />
          </Row>

          <Row
            icon={<Volume2 size={17} aria-hidden />}
            title={tx("Read the page aloud")}
            note="Announces each page and speaks whatever you focus or hover. Built for low vision and for reading with your eyes off the screen."
          >
            <Toggle
              on={flag("voiceNavigation")}
              onChange={(v) => set("voiceNavigation", v)}
              label="Read the page aloud"
            />
          </Row>

          <Row
            icon={<Ear size={17} aria-hidden />}
            title={tx("Extra screen-reader detail")}
            note="Adds longer descriptions to charts, match scores and progress bars."
          >
            <Toggle
              on={flag("screenReaderHints")}
              onChange={(v) => set("screenReaderHints", v)}
              label="Extra screen-reader detail"
            />
          </Row>

          <Row
            icon={<Keyboard size={17} aria-hidden />}
            title={tx("Keyboard shortcuts")}
            note="Single-key jumps around the site. Turn off if they clash with your assistive software."
          >
            <Toggle
              on={flag("keyboardShortcuts")}
              onChange={(v) => set("keyboardShortcuts", v)}
              label="Keyboard shortcuts"
            />
          </Row>

          <div className="pt-5">
            <button onClick={reset} className="btn-ghost !py-2 !text-xs">
              <RotateCcw size={13} aria-hidden /> {tx("Reset to defaults")}
            </button>
          </div>
        </section>
      </Reveal>

      {/* ── Who you are ──────────────────────────────────────────── */}
      {user && typesForRole(user.role).length > 1 && (
        <Reveal className="mt-8">
          <ProfileTypeSection email={user.email} role={user.role} profileId={profileId} />
          <TourSection />
        </Reveal>
      )}

      {/* ── Account ──────────────────────────────────────────────── */}
      <Reveal className="mt-8">
        <section className="panel p-6">
          <h2 className="font-display text-lg tracking-tight text-ink">{tx("Your details")}</h2>
          <p className="mt-2 font-body text-sm text-ink-soft">
            This is what swap partners and employers see on your{" "}
            <Link to="/passport" className="link-sweep text-saffron-500">
              {tx("Skill Passport")}
            </Link>
            .
          </p>

          <div className="mt-5">
            <UsernameField
              id="settings-username"
              label="Username"
              value={form.handle}
              ownValue={detail.data?.handle ?? ""}
              onChange={(v) => setForm({ ...form, handle: v })}
              onStateChange={setUsernameState}
            />
            <p className="mt-1.5 font-body text-[12px] text-ink-mute">
              {tx(
                "This is the name beside yours in Messages, on your Skill Passport and in swap requests.",
              )}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="datum">{tx("Display name")}</span>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="datum">{tx("City / region")}</span>
              <input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder={tx("Pune, Maharashtra")}
                className="input mt-1"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="datum">{tx("Headline")}</span>
            <input
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              placeholder={tx("Backend developer learning to design what I build")}
              className="input mt-1"
            />
          </label>

          <label className="mt-4 block">
            <span className="datum">{tx("About you")}</span>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              placeholder={tx("What you work on, and what you're trying to learn.")}
              className="input mt-1 resize-none"
            />
          </label>

          <label className="mt-4 block">
            <span className="datum">{tx("Website or LinkedIn")}</span>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://linkedin.com/in/you"
              className="input mt-1"
            />
          </label>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending || usernameState === "taken"}
              className="btn-primary !py-2.5 !text-xs disabled:opacity-60"
            >
              {saveProfile.isPending && <Loader2 size={13} className="animate-spin" aria-hidden />}
              Save details
            </button>
            {savedAt && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 font-body text-xs text-emeraldx-400"
              >
                <Check size={13} aria-hidden /> {tx("Saved")}
              </span>
            )}
            {saveProfile.error && (
              <span role="alert" className="font-body text-xs text-saffron-700">
                {saveProfile.error instanceof Error ? saveProfile.error.message : "Save failed."}
              </span>
            )}
          </div>
        </section>
      </Reveal>

      {/* ── Privacy and safety ─────────────────────── */}
      <Reveal className="mt-8">
        <section className="panel p-6">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
            <ShieldOff size={18} className="text-saffron-500" aria-hidden />{" "}
            {tx("Privacy & safety")}
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
            {tx(
              "स्वYAM puts you in touch with strangers — to swap a skill, to take a call, to answer a job advert. These decide how much of that reaches you.",
            )}
          </p>

          <fieldset className="mt-5">
            <legend className="datum">{tx("Who can see your profile")}</legend>
            <div className="mt-2.5 space-y-1.5" role="radiogroup">
              {VISIBILITY_CHOICES.map((c) => (
                <label
                  key={c.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                    visibility.data === c.value
                      ? "border-saffron-500 bg-saffron-50"
                      : "border-ink-line hover:bg-paper-dim"
                  }`}
                >
                  <input
                    type="radio"
                    name="profile-visibility"
                    checked={visibility.data === c.value}
                    onChange={() => saveVisibility.mutate(c.value)}
                    disabled={saveVisibility.isPending}
                    className="mt-0.5 accent-saffron-500"
                  />
                  <span className="min-w-0">
                    <span className="block font-body text-sm font-medium text-ink">
                      {tx(c.label)}
                    </span>
                    <span className="mt-0.5 block font-body text-[12px] leading-snug text-ink-mute">
                      {tx(c.note)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {(requests.data ?? []).length > 0 && (
            <div className="mt-6 rounded-2xl border border-saffron-200 bg-saffron-50 p-4">
              <p className="flex items-center gap-2 font-body text-sm font-medium text-ink">
                <UserCheck size={15} className="text-saffron-600" aria-hidden />
                {(requests.data ?? []).length} {tx("waiting to follow you")}
              </p>
              <ul className="mt-3 space-y-2">
                {(requests.data ?? []).map((r) => (
                  <li key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <img
                      src={r.avatarUrl || initialsAvatar(r.name)}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                    <Link to="/u/$handle" params={{ handle: r.handle }} className="min-w-0 flex-1">
                      <span className="block truncate font-body text-[13px] font-medium text-ink">
                        {r.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-ink-mute">
                        @{r.handle}
                      </span>
                    </Link>
                    <button
                      onClick={() => respond.mutate({ id: r.id, accept: true })}
                      disabled={respond.isPending}
                      className="btn-primary !px-3 !py-1.5 !text-[11px] disabled:opacity-60"
                    >
                      {tx("Accept")}
                    </button>
                    <button
                      onClick={() => respond.mutate({ id: r.id, accept: false })}
                      disabled={respond.isPending}
                      className="btn-ghost !px-3 !py-1.5 !text-[11px] disabled:opacity-60"
                    >
                      {tx("Refuse")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <Row
              icon={<MessageSquare size={17} />}
              title={tx("Messages from people you have not swapped with")}
              note={tx(
                "Off means only your swap partners can start a conversation. The database enforces this one, not the page.",
              )}
            >
              <Toggle
                on={pv?.allowMessagesFromStrangers ?? true}
                onChange={toggle("allowMessagesFromStrangers")}
                label={tx("Messages from strangers")}
              />
            </Row>

            <Row
              icon={<Building2 size={17} />}
              title={tx("Let employers find you")}
              note={tx(
                "Off removes you from the candidate searches recruiters run against their open roles.",
              )}
            >
              <Toggle
                on={pv?.discoverableByCompanies ?? true}
                onChange={toggle("discoverableByCompanies")}
                label={tx("Discoverable by companies")}
              />
            </Row>

            <Row
              icon={<Users size={17} />}
              title={tx("Show your skills")}
              note={tx("Your skill list, and the evidence behind each verified one.")}
            >
              <Toggle
                on={pv?.showSkills ?? true}
                onChange={toggle("showSkills")}
                label={tx("Show skills")}
              />
            </Row>

            <Row
              icon={<Eye size={17} />}
              title={tx("Show your city")}
              note={tx("Useful for finding people nearby. Off if you would rather not say.")}
            >
              <Toggle
                on={pv?.showRegion ?? true}
                onChange={toggle("showRegion")}
                label={tx("Show region")}
              />
            </Row>

            <Row
              icon={<Waves size={17} />}
              title={tx("Show your activity")}
              note={tx("Posts, swaps and completions on your profile.")}
            >
              <Toggle
                on={pv?.showActivity ?? true}
                onChange={toggle("showActivity")}
                label={tx("Show activity")}
              />
            </Row>
          </div>

          {savePrivacy.error && (
            <p role="alert" className="mt-3 font-body text-xs text-saffron-700">
              {savePrivacy.error instanceof Error
                ? savePrivacy.error.message
                : tx("That setting did not save.")}
            </p>
          )}

          <div className="mt-6 border-t border-ink-line pt-5">
            <p className="flex items-center gap-2 font-body text-sm font-medium text-ink">
              <UserRoundX size={15} className="text-ink-mute" aria-hidden /> {tx("Blocked")}
            </p>
            {(blocked.data ?? []).length === 0 ? (
              <p className="mt-1.5 font-body text-[12px] text-ink-mute">
                {tx("You have not blocked anyone. Block someone from their profile.")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(blocked.data ?? []).map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <img
                      src={b.avatarUrl || initialsAvatar(b.name)}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-body text-[13px] text-ink">
                        {b.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-ink-mute">
                        @{b.handle}
                      </span>
                    </span>
                    <button
                      onClick={() => unblock.mutate(b.id)}
                      disabled={unblock.isPending}
                      className="btn-ghost !px-3 !py-1.5 !text-[11px] disabled:opacity-60"
                    >
                      {tx("Unblock")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </Reveal>
    </div>
  );
}

/**
 * Which kind of student this account is.
 *
 * The brief asks for this to be changeable later, and it is: the dashboard,
 * its navigation and the coach all follow the answer the moment it changes.
 */
/**
 * Show me around again.
 *
 * The tour is a four-stop thing somebody can lose halfway through, so the
 * way back to it belongs in Settings rather than in a popup that waits to
 * ambush them.
 */
function TourSection() {
  const tx = useTx();
  const navigate = useNavigate();
  return (
    <section className="panel p-6">
      <h2 className="font-display text-lg tracking-tight text-ink">{tx("Show me around")}</h2>
      <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
        {tx(
          "A short guided tour of your dashboard — four stops, skippable, and it never blocks anything.",
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          resetTours();
          startTour();
          void navigate({ to: "/dashboard" });
        }}
        className="btn-ghost mt-4 !py-2.5 !text-xs"
      >
        {tx("Take the tour again")}
      </button>
    </section>
  );
}

function ProfileTypeSection({
  email,
  role,
  profileId,
}: {
  email: string;
  role: "student" | "recruiter" | "institute";
  profileId: string | null;
}) {
  const tx = useTx();
  const current = useProfileType(email, role, profileId);
  const options = typesForRole(role);
  return (
    <section className="panel p-6">
      <h2 className="font-display text-lg tracking-tight text-ink">{tx("Who you are")}</h2>
      <p className="mt-2 font-body text-sm text-ink-soft">
        {tx("Decides what the dashboard shows and which coach you get. Change it any time.")}
      </p>
      <div
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label={tx("Profile type")}
      >
        {options.map((o) => {
          const on = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setProfileType(email, o.id, profileId)}
              className={`rounded-xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-saffron-500 ${
                on ? "evo-choice-on" : "border-ink-line bg-paper-light hover:border-saffron-300"
              }`}
            >
              <span className="flex items-center justify-between gap-2 font-body text-[14px] font-semibold">
                {tx(o.label)}
                {/* A non-colour cue: the selected card carries a check as well as the inverted fill. */}
                {on && <Check size={16} strokeWidth={2.5} aria-hidden className="shrink-0" />}
              </span>
              <span
                className={`evo-choice-sub mt-0.5 block font-body text-[12px] ${on ? "" : "text-ink-mute"}`}
              >
                {tx(o.purpose)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
