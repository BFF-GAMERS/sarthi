import { FormEvent, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, Loader2, X, Plus } from "lucide-react";
import { initialsAvatar } from "../lib/avatar";
import { isEmail, isPhone, type UserProfile } from "../lib/local-store";
import { useTx } from "../lib/i18n";

type Errors = Partial<Record<"name" | "email" | "phone", string>>;

/**
 * Full profile editor. The photo is read as a data URI so it persists with the
 * rest of the record — there is no file server in this build.
 */
export default function ProfileEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: UserProfile;
  onCancel: () => void;
  onSave: (next: UserProfile) => void;
}) {
  const tx = useTx();
  const [form, setForm] = useState<UserProfile>(initial);
  const [skillDraft, setSkillDraft] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => set("avatar", String(reader.result));
    reader.readAsDataURL(file);
  };

  const addSkill = () => {
    const s = skillDraft.trim();
    if (!s) return;
    if (!form.skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
      set("skills", [...form.skills, s]);
    }
    setSkillDraft("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!isEmail(form.email)) next.email = "Enter a valid email address.";
    if (form.phone.trim() && !isPhone(form.phone)) next.phone = "Enter a 10-digit Indian mobile.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    onSave({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
    setSaving(false);
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      className="panel p-6 sm:p-8"
    >
      <h2 className="font-display text-xl tracking-tight text-ink">{tx("Edit your profile")}</h2>

      {/* Photo */}
      <div className="mt-6 flex items-center gap-5">
        <img
          src={form.avatar || initialsAvatar(form.name || "User")}
          alt=""
          className="h-20 w-20 rounded-2xl object-cover ring-2 ring-ink-line"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-ghost !py-2 !text-xs"
          >
            <Camera size={14} aria-hidden /> {tx("Upload photo")}
          </button>
          <button
            type="button"
            onClick={() => set("avatar", initialsAvatar(form.name || "User"))}
            className="btn-ghost !py-2 !text-xs"
          >
            {tx("Use initials")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])}
          />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Labeled label="Full name" error={errors.name}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Labeled>
        <Labeled label="Email" error={errors.email}>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Labeled>
        <Labeled label="Phone" error={errors.phone}>
          <input
            className="input"
            type="tel"
            value={form.phone}
            placeholder="+91 98765 43210"
            onChange={(e) => set("phone", e.target.value)}
          />
        </Labeled>
        <Labeled label="Location">
          <input
            className="input"
            value={form.location}
            placeholder={tx("Pune, Maharashtra")}
            onChange={(e) => set("location", e.target.value)}
          />
        </Labeled>
      </div>

      <div className="mt-5">
        <Labeled label="Education">
          <input
            className="input"
            value={form.education}
            placeholder={tx("B.Sc. Electronics, Savitribai Phule Pune University")}
            onChange={(e) => set("education", e.target.value)}
          />
        </Labeled>
      </div>

      <div className="mt-5">
        <Labeled label="Bio">
          <textarea
            className="input min-h-[7rem] resize-y"
            value={form.bio}
            placeholder={tx("A couple of lines on what you do and what you're looking for.")}
            onChange={(e) => set("bio", e.target.value)}
          />
        </Labeled>
      </div>

      {/* Skills */}
      <div className="mt-5">
        <span className="font-body text-[11px] font-medium uppercase tracking-wide text-ink-mute">
          {tx("Skills")}
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {form.skills.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                set(
                  "skills",
                  form.skills.filter((x) => x !== s),
                )
              }
              className="chip-accent"
              aria-label={`Remove ${s}`}
            >
              {s} <X size={11} aria-hidden />
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input max-w-xs"
            value={skillDraft}
            placeholder={tx("Add a skill")}
            onChange={(e) => setSkillDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <button type="button" onClick={addSkill} className="btn-ghost !py-2.5 !text-xs">
            <Plus size={14} aria-hidden /> {tx("Add")}
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-ink-line pt-6">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Check size={16} aria-hidden />
          )}
          Save changes
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          {tx("Cancel")}
        </button>
      </div>
    </motion.form>
  );
}

function Labeled({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-body text-[11px] font-medium uppercase tracking-wide text-ink-mute">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 font-body text-xs font-medium text-saffron-600">
          {error}
        </p>
      )}
    </label>
  );
}
