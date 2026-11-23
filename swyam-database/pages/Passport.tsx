import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Award,
  BadgeCheck,
  Check,
  Copy,
  Download,
  GraduationCap,
  IdCard,
  Loader2,
  Printer,
  Repeat2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import PassportBook from "../components/PassportBook";
import { useAuth } from "../context/AuthContext";
import { getPassport, LEVEL_LABEL } from "../lib/skillswap";
import {
  certificateSvg,
  downloadCertificatePng,
  listMyCertificates,
  printCertificate,
  type IssuedCertificate,
} from "../lib/certificate";
import { useTx } from "../lib/i18n";
import { SloganPlate } from "../components/Ornaments";

/**
 * Skill Passport.
 *
 * Three pages, the way a real passport has pages: the identity document
 * itself, the certificates earned, and what is still being learned. The
 * document is the point — it is what you hand to someone who has no reason to
 * trust you yet.
 */

type Tab = "document" | "certificates" | "learning";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "document", label: "Passport", icon: <IdCard size={13} aria-hidden /> },
  { id: "certificates", label: "Certificates", icon: <Award size={13} aria-hidden /> },
  { id: "learning", label: "Learning", icon: <GraduationCap size={13} aria-hidden /> },
];

export default function Passport() {
  const tx = useTx();
  const { user, profileId, ready, isRemote } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("document");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<IssuedCertificate | null>(null);

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const enabled = Boolean(profileId) && isRemote;

  const passport = useQuery({
    queryKey: ["passport", profileId],
    queryFn: () => getPassport(profileId!),
    enabled,
  });
  const certs = useQuery({
    queryKey: ["my-certificates", profileId],
    queryFn: () => listMyCertificates(profileId!),
    enabled,
  });

  // Escape closes the certificate viewer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user) return null;

  const data = passport.data;
  const shareUrl =
    data?.shareSlug && typeof window !== "undefined"
      ? `${window.location.origin}/passport/${data.shareSlug}`
      : null;

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is on screen */
    }
  };

  return (
    <div className="pb-24 pt-28">
      <div className="container-x max-w-4xl">
        <Reveal>
          <SloganPlate tone="indigo">{tx("Skill Passport")}</SloganPlate>
          <h1 className="mt-3 section-title">
            {tx("Proof, not")}
            <span className="block text-saffron-500">promises.</span>
          </h1>
          <p className="type-lede mt-4 max-w-2xl">
            {tx(
              "One document that says what you can actually do \u2014 each entry backed by a course finished, a swap completed, or an assessment passed.",
            )}
          </p>
        </Reveal>

        {!isRemote && (
          <p className="mt-8 rounded-[var(--radius-card)] border border-ink-line bg-paper-dim px-5 py-4 font-body text-sm text-ink-soft">
            {tx("The passport reads from your account records, so it needs a database connection.")}
          </p>
        )}

        {passport.isLoading && (
          <p className="mt-10 flex items-center gap-2 font-body text-sm text-ink-mute">
            <Loader2 size={16} className="animate-spin" aria-hidden />{" "}
            {tx("Building your passport\u2026")}
          </p>
        )}

        {passport.error && (
          <p
            role="alert"
            className="mt-10 border-l-[3px] border-saffron-500 py-4 pl-4 font-body text-sm text-ink"
          >
            {passport.error instanceof Error ? passport.error.message : "Couldn't load."}
          </p>
        )}

        {data && (
          <>
            <div className="mt-8 flex flex-wrap gap-2 border-b border-ink-line pb-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className="filter-pill"
                >
                  {t.icon}
                  {t.label}
                  {t.id === "certificates" && (certs.data ?? []).length > 0 && (
                    <span className="font-mono text-[10px] tabular-nums opacity-70">
                      {(certs.data ?? []).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── The document ─────────────────────────────────── */}
            {tab === "document" && (
              <>
                <Reveal className="mt-8">
                  <PassportBook
                    name={data.profile?.displayName ?? user.name}
                    handle={data.profile?.handle ?? ""}
                    headline={data.profile?.headline ?? null}
                    region={data.profile?.region ?? null}
                    avatarUrl={data.profile?.avatarUrl ?? null}
                    level={data.stats.level}
                    xp={data.stats.xp}
                    skills={data.skills}
                    swapsCompleted={data.stats.swapsCompleted}
                    sessionsCompleted={data.stats.sessionsCompleted}
                    issuedOn={new Date().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    documentNumber={data.shareSlug}
                  />
                </Reveal>

                {shareUrl && data.isPublic && <EmbedSnippet slug={data.shareSlug!} />}

                {shareUrl && (
                  <Reveal className="mt-6">
                    <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="datum">{tx("Shareable link")}</p>
                        <p className="mt-0.5 truncate font-mono text-xs text-ink-soft">
                          {shareUrl}
                        </p>
                        {!data.isPublic && (
                          <p className="mt-1 font-body text-[11px] text-ink-mute">
                            {tx(
                              "Not published \u2014 this link opens for nobody yet, including you. Publish it to make it work.",
                            )}
                          </p>
                        )}
                      </div>
                      <button onClick={copy} className="btn-ghost shrink-0 !py-2.5 !text-xs">
                        {copied ? (
                          <>
                            <Check size={14} aria-hidden /> {tx("Copied")}
                          </>
                        ) : (
                          <>
                            <Copy size={14} aria-hidden /> {tx("Copy link")}
                          </>
                        )}
                      </button>
                    </div>
                  </Reveal>
                )}

                {data.skills.length === 0 && (
                  <Reveal className="mt-6">
                    <p className="panel p-5 font-body text-sm text-ink-soft">
                      Your passport has no stamps yet.{" "}
                      <Link to="/profile" className="link-sweep text-saffron-500">
                        {tx("Add what you can teach")}
                      </Link>{" "}
                      and complete a swap or a course to start earning them.
                    </p>
                  </Reveal>
                )}
              </>
            )}

            {/* ── Certificates ─────────────────────────────────── */}
            {tab === "certificates" && (
              <div className="mt-8">
                {certs.isLoading && (
                  <p className="flex items-center gap-2 font-body text-sm text-ink-mute">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> Loading…
                  </p>
                )}

                {!certs.isLoading && (certs.data ?? []).length === 0 && (
                  <div className="panel flex flex-col items-center px-6 py-14 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-saffron-50 text-saffron-500">
                      <Award size={22} aria-hidden />
                    </span>
                    <h2 className="mt-4 font-display text-lg tracking-tight text-ink">
                      {tx("No certificates yet")}
                    </h2>
                    <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-ink-mute">
                      {tx(
                        "Finish a course and one is issued automatically, with a serial anyone can check.",
                      )}
                    </p>
                    <Link to="/courses" className="btn-primary mt-6 !py-2.5 !text-xs">
                      {tx("Browse courses")}
                    </Link>
                  </div>
                )}

                <div className="card-grid grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {(certs.data ?? []).map((c) => (
                    <article key={c.id} className="card overflow-hidden">
                      {/* A real thumbnail of the document, not an icon. */}
                      <button
                        onClick={() => setOpen(c)}
                        className="block w-full border-b border-ink-line bg-paper text-left [&_svg]:h-auto [&_svg]:w-full"
                        aria-label={`Open certificate for ${c.title}`}
                        dangerouslySetInnerHTML={{ __html: certificateSvg(c) }}
                      />
                      <div className="p-5">
                        <p className="font-display text-base leading-tight tracking-tight text-ink">
                          {c.title}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-ink-mute">{c.serial}</p>
                        <p className="mt-0.5 font-body text-[12px] text-ink-mute">
                          {c.issuer ?? "स्वYAM"} ·{" "}
                          {new Date(c.issuedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {c.score != null && ` · ${Math.round(c.score)}%`}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => setOpen(c)}
                            className="btn-primary !px-3 !py-2 !text-[11px]"
                          >
                            {tx("Open")}
                          </button>
                          <button
                            onClick={() => void downloadCertificatePng(c)}
                            className="btn-ghost !px-3 !py-2 !text-[11px]"
                          >
                            <Download size={12} aria-hidden /> {tx("PNG")}
                          </button>
                          <Link
                            to="/verify/$serial"
                            params={{ serial: c.serial }}
                            className="btn-ghost !px-3 !py-2 !text-[11px]"
                          >
                            <ShieldCheck size={12} aria-hidden /> {tx("Verify")}
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* ── Learning ─────────────────────────────────────── */}
            {tab === "learning" && (
              <div className="mt-8 space-y-6">
                <section className="panel p-6">
                  <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
                    <GraduationCap size={18} className="text-saffron-500" aria-hidden />{" "}
                    {tx("Currently learning")}
                  </h2>
                  {data.learning.length === 0 ? (
                    <p className="mt-4 font-body text-sm text-ink-mute">
                      No learning goals set yet.{" "}
                      <Link to="/profile" className="link-sweep text-saffron-500">
                        {tx("Add one")}
                      </Link>{" "}
                      and we can find you a swap partner.
                    </p>
                  ) : (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {data.learning.map((l) => (
                        <li key={l.id} className="chip">
                          {l.skill.name} · {LEVEL_LABEL[l.currentLevel]} →{" "}
                          {LEVEL_LABEL[l.targetLevel]}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {data.courses.length > 0 && (
                  <section className="panel p-6">
                    <h2 className="font-display text-lg tracking-tight text-ink">
                      {tx("Courses")}
                    </h2>
                    <ul className="mt-4 space-y-3">
                      {data.courses.map((c, i) => (
                        <li key={`${c.title}-${i}`}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-medium text-ink">{c.title}</span>
                            <span className="font-mono text-xs tabular-nums text-ink-mute">
                              {Math.round(c.progress)}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-paper-dim">
                            <span
                              className="block h-full rounded-full bg-saffron-500"
                              style={{ width: `${c.progress}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {data.badges.length > 0 && (
                  <section className="panel p-6">
                    <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
                      <Award size={18} className="text-saffron-500" aria-hidden /> {tx("Badges")}
                    </h2>
                    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {data.badges.map((b, i) => (
                        <li
                          key={`${b.name}-${i}`}
                          className="flex gap-3 rounded-2xl bg-paper-dim p-3.5"
                        >
                          <span className="text-2xl leading-none" aria-hidden>
                            {b.icon ?? "🏅"}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-ink">{b.name}</span>
                            {b.description && (
                              <span className="block font-body text-xs leading-snug text-ink-mute">
                                {b.description}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="panel p-6">
                  <h2 className="font-display text-lg tracking-tight text-ink">
                    {tx("Add a stamp")}
                  </h2>
                  <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
                    {tx(
                      "Finished swaps and completed sessions are what turn a self-declared skill into a verified one.",
                    )}
                  </p>
                  <Link to="/skillswap" className="btn-primary mt-4 !py-2.5 !text-xs">
                    <Repeat2 size={14} aria-hidden /> {tx("Find a swap")}
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Certificate viewer ─────────────────────────────────── */}
      {open && (
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate for ${open.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            data-lenis-prevent
            className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-[var(--radius-card)] bg-paper-light p-4 shadow-[var(--shadow-float)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-base tracking-tight text-ink">
                  {open.title}
                </p>
                <p className="font-mono text-[11px] text-ink-mute">{open.serial}</p>
              </div>
              <button
                onClick={() => setOpen(null)}
                aria-label={tx("Close")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-dim"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="overflow-hidden rounded-xl border border-ink-line [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: certificateSvg(open) }}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void downloadCertificatePng(open)}
                className="btn-primary !py-2.5 !text-xs"
              >
                <Download size={14} aria-hidden /> {tx("Download PNG")}
              </button>
              <button onClick={() => printCertificate(open)} className="btn-ghost !py-2.5 !text-xs">
                <Printer size={14} aria-hidden /> {tx("Print")}
              </button>
              <Link
                to="/verify/$serial"
                params={{ serial: open.serial }}
                className="btn-ghost !py-2.5 !text-xs"
              >
                <BadgeCheck size={14} aria-hidden /> {tx("Public check")}
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * The copyable embed.
 *
 * A shareable link only works while somebody is willing to follow it. This is
 * the same passport as a card that lives on their own site — a portfolio, a
 * blog, a freelancing profile — and it stays current, because it renders from
 * the database on every view rather than being a screenshot taken once.
 *
 * Only offered on a published passport. Handing somebody an embed code for a
 * private record would produce a card that says "this passport is private"
 * wherever they pasted it.
 */
function EmbedSnippet({ slug }: { slug: string }) {
  const tx = useTx();
  const [copied, setCopied] = useState(false);

  const code =
    typeof window === "undefined"
      ? ""
      : `<iframe src="${window.location.origin}/embed/passport/${slug}" width="100%" height="420" style="border:0" title="Skill Passport" loading="lazy"></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard refused — the code is on screen to copy by hand. */
    }
  };

  return (
    <Reveal className="mt-6">
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="datum">{tx("Put it on your own site")}</p>
            <p className="mt-0.5 font-body text-[12px] text-ink-mute">
              {tx("Paste this anywhere that takes HTML. It updates itself.")}
            </p>
          </div>
          <button onClick={copy} className="btn-ghost shrink-0 !py-2.5 !text-xs">
            {copied ? tx("Copied") : tx("Copy embed code")}
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-paper-dim p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          <code>{code}</code>
        </pre>
      </div>
    </Reveal>
  );
}
