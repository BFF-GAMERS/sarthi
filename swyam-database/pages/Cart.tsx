import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Loader2,
  Lock,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useAuth } from "../context/AuthContext";
import { EV } from "@/evolution";
import { entityId, trackOnce } from "@/evolution/runtime/tracker/track";
import { courses, orgById } from "../data/mock";
import { announce } from "../components/VoiceGuide";
import {
  CART_EVENT,
  addToCart,
  checkoutCart,
  clearCart,
  feeToMinor,
  formatMinor,
  listOffers,
  quoteCoupon,
  readCart,
  redeemCoupon,
  removeFromCart,
  type CheckoutResult,
  type CouponQuote,
} from "../lib/catalogue";
import { useTx } from "../lib/i18n";

/**
 * The cart.
 *
 * Most of this catalogue is free, so the order summary has to do something
 * unusual: be honest that the total is often zero, while still handling paid
 * courses properly — subtotal, a code, what came off, what is left.
 *
 * No card is taken here. Paid courses are settled with the training partner,
 * and saying so plainly is better than a checkout that implies otherwise.
 */
export default function Cart() {
  const tx = useTx();
  const { user, profileId, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [slugs, setSlugs] = useState<string[]>([]);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState<CouponQuote | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const sync = () => setSlugs(readCart());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const offers = useQuery({ queryKey: ["offers"], queryFn: listOffers });

  const lines = useMemo(
    () =>
      slugs
        .map((slug) => courses.find((c) => c.id === slug))
        .filter((c): c is (typeof courses)[number] => Boolean(c)),
    [slugs],
  );

  const subtotalMinor = lines.reduce((sum, c) => sum + feeToMinor(c.fees, c.free), 0);
  const discountMinor = coupon?.valid ? Math.min(coupon.discountMinor, subtotalMinor) : 0;
  const totalMinor = Math.max(0, subtotalMinor - discountMinor);
  const freeCount = lines.filter((c) => c.free).length;
  const paidCount = lines.length - freeCount;

  // A code priced against an old subtotal is a wrong number on screen, so it
  // is re-checked whenever the basket changes.
  useEffect(() => {
    if (!coupon?.valid || !coupon.code) return;
    let live = true;
    void quoteCoupon(coupon.code, subtotalMinor).then((q) => {
      if (!live) return;
      if (q.valid) setCoupon(q);
      else {
        setCoupon(null);
        setCouponError(q.reason ?? "That code no longer applies.");
      }
    });
    return () => {
      live = false;
    };
    // Only the subtotal should retrigger this, not the coupon object itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalMinor]);

  const applyCode = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    setCouponError("");
    try {
      const q = await quoteCoupon(code, subtotalMinor);
      if (q.valid) {
        setCoupon(q);
        setCodeInput("");
        announce(`Code ${code} applied. ${formatMinor(q.discountMinor)} off.`);
      } else {
        setCoupon(null);
        setCouponError(q.reason ?? "That code cannot be used.");
      }
    } finally {
      setChecking(false);
    }
  };

  const checkout = useMutation({
    mutationFn: async () => {
      const r = await checkoutCart(profileId!);
      if (coupon?.valid && coupon.code && discountMinor > 0 && r.enrolled.length > 0) {
        await redeemCoupon(coupon.code, discountMinor);
      }
      return r;
    },
    onSuccess: (r) => {
      for (const slug of r.enrolled) {
        trackOnce(
          `cart:${slug}`,
          EV.COURSE_STARTED,
          { via: "cart" },
          { entityId: entityId("crs", slug) },
        );
      }
      setResult(r);
      setSlugs(readCart());
      setCoupon(null);
      announce(`Enrolled in ${r.enrolled.length} courses.`);
      void qc.invalidateQueries({ queryKey: ["enrollments", profileId] });
      void qc.invalidateQueries({ queryKey: ["member-metrics", profileId] });
    },
  });

  /* Two or three things worth adding, never already in the basket. */
  const suggestions = useMemo(
    () => courses.filter((c) => c.free && !slugs.includes(c.id)).slice(0, 3),
    [slugs],
  );

  return (
    <div className="container-x max-w-6xl pb-24 pt-28">
      <Reveal>
        <p className="kicker flex items-center gap-1.5">
          <ShoppingCart size={12} aria-hidden /> {tx("Cart")}
        </p>
        <h1 className="mt-3 section-title">{tx("Ready to start")}</h1>
        <p className="type-lede mt-4">
          {lines.length === 0
            ? tx("Nothing lined up yet.")
            : /* Split so the countable part stays a translatable phrase: the
                 whole sentence was a template literal, so it never reached
                 the dictionary and sat in English under a Hindi heading. */
              `${lines.length} ${lines.length === 1 ? tx("course in your basket.") : tx("courses in your basket.")}`}
        </p>
      </Reveal>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ y: -6 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className="mt-8 rounded-[var(--radius-card)] border border-emeraldx-400/30 bg-emeraldx-400/10 p-5"
          >
            <p className="flex items-center gap-2 font-body text-sm font-medium text-emeraldx-400">
              <Check size={16} aria-hidden /> Enrolled in {result.enrolled.length} course
              {result.enrolled.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1.5 font-body text-[13px] text-ink-soft">
              {tx("A confirmation is on its way to your email.")}
            </p>
            {result.failed.length > 0 && (
              <p className="mt-2 font-body text-[13px] text-saffron-700">
                {result.failed.length} couldn&apos;t be started: {result.failed[0]?.reason}
              </p>
            )}
            <Link to="/dashboard" className="btn-primary mt-4 !py-2.5 !text-xs">
              {tx("Go to your dashboard")} <ArrowRight size={14} aria-hidden />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {lines.length === 0 && !result && (
        <Reveal className="mt-10">
          <div className="panel flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-saffron-50 text-saffron-500">
              <ShoppingCart size={22} aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-lg tracking-tight text-ink">
              {tx("Your cart is empty")}
            </h2>
            <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-ink-mute">
              Add courses as you browse and start them together when you&apos;re ready.
            </p>
            <Link to="/courses" className="btn-primary mt-6 !py-2.5 !text-xs">
              {tx("Browse courses")} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </Reveal>
      )}

      {lines.length > 0 && (
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          {/* ── Lines ──────────────────────────────────────────── */}
          <div>
            <Reveal>
              <ul className="space-y-3">
                {lines.map((c) => {
                  const org = orgById(c.orgId);
                  return (
                    <li key={c.id} className="card-flat p-4">
                      <div className="flex gap-4">
                        <img
                          src={c.hero}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="hidden h-20 w-28 shrink-0 rounded-xl object-cover sm:block"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/courses/$id"
                            params={{ id: c.id }}
                            className="block font-display text-base leading-tight tracking-tight text-ink hover:text-saffron-600"
                          >
                            {c.title}
                          </Link>
                          <p className="mt-1 truncate font-body text-[12px] text-ink-mute">
                            {org?.name}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="chip !text-[10px]">
                              <Clock size={10} aria-hidden /> {c.duration}
                            </span>
                            <span className="chip !text-[10px]">{c.difficulty}</span>
                            <span className="chip !text-[10px]">{c.mode}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end justify-between">
                          <span className="font-display text-lg leading-none text-saffron-500">
                            {c.free ? tx("Free") : c.fees}
                          </span>
                          <button
                            onClick={() => {
                              setSlugs(removeFromCart(c.id));
                              announce(`${c.title} removed from cart.`);
                            }}
                            aria-label={`Remove ${c.title}`}
                            className="mt-3 inline-flex items-center gap-1 font-body text-[11px] text-ink-mute transition-colors hover:text-saffron-600"
                          >
                            <Trash2 size={12} aria-hidden /> {tx("Remove")}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Reveal>

            {suggestions.length > 0 && (
              <Reveal className="mt-8">
                <h2 className="font-display text-base tracking-tight text-ink">
                  {tx("Free, and often taken alongside")}
                </h2>
                <ul className="mt-3 space-y-2">
                  {suggestions.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-2xl border border-ink-line bg-paper p-3"
                    >
                      <span className="min-w-0 flex-1">
                        <Link
                          to="/courses/$id"
                          params={{ id: c.id }}
                          className="block truncate font-body text-sm font-medium text-ink hover:text-saffron-600"
                        >
                          {c.title}
                        </Link>
                        <span className="block truncate font-body text-[11px] text-ink-mute">
                          {c.duration} · {tx("Free")}
                        </span>
                      </span>
                      <button
                        onClick={() => {
                          setSlugs(addToCart(c.id));
                          announce(`${c.title} added to cart.`);
                        }}
                        className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]"
                      >
                        {tx("Add")}
                      </button>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>

          {/* ── Summary ────────────────────────────────────────── */}
          <Reveal delay={0.05}>
            <div className="panel p-6 lg:sticky lg:top-24">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Order summary")}
              </h2>

              {/* Coupon */}
              <div className="mt-5">
                <label className="block">
                  <span className="datum flex items-center gap-1.5">
                    <Tag size={11} aria-hidden /> {tx("Discount code")}
                  </span>
                  <span className="mt-1.5 flex gap-2">
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && void applyCode(codeInput)}
                      placeholder="SWAYAM50"
                      disabled={Boolean(coupon?.valid)}
                      className="input !py-2 font-mono !text-[13px] uppercase tracking-wide disabled:opacity-50"
                      aria-label={tx("Discount code")}
                    />
                    <button
                      onClick={() => void applyCode(codeInput)}
                      disabled={checking || !codeInput.trim() || Boolean(coupon?.valid)}
                      className="btn-ghost shrink-0 !px-4 !py-2 !text-xs disabled:opacity-50"
                    >
                      {checking ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </span>
                </label>

                {coupon?.valid && (
                  <div className="mt-2 flex items-center justify-between rounded-[var(--radius-control)] border border-emeraldx-400/30 bg-emeraldx-400/10 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-semibold text-emeraldx-400">
                        {coupon.code}
                      </span>
                      {coupon.description && (
                        <span className="block truncate font-body text-[11px] text-ink-mute">
                          {coupon.description}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => {
                        setCoupon(null);
                        setCouponError("");
                      }}
                      aria-label={tx("Remove discount code")}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-light hover:text-ink"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {couponError && (
                  <p role="alert" className="mt-2 font-body text-[12px] text-saffron-700">
                    {couponError}
                  </p>
                )}

                {!coupon?.valid && (offers.data ?? []).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(offers.data ?? []).map((o) => (
                      <button
                        key={o.code}
                        onClick={() => void applyCode(o.code)}
                        title={o.description ?? undefined}
                        className="chip font-mono !text-[10px] hover:!border-saffron-200 hover:!bg-saffron-50"
                      >
                        {o.code}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals */}
              <dl className="mt-6 space-y-2.5 border-t border-ink-line pt-5 font-body text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-mute">
                    Courses ({lines.length})
                    {freeCount > 0 && (
                      <span className="ml-1.5 text-[11px] text-emeraldx-400">{freeCount} free</span>
                    )}
                  </dt>
                  <dd className="tabular-nums text-ink">
                    {subtotalMinor === 0 ? tx("Free") : formatMinor(subtotalMinor)}
                  </dd>
                </div>

                {discountMinor > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-emeraldx-400">Discount ({coupon?.code})</dt>
                    <dd className="tabular-nums text-emeraldx-400">
                      −{formatMinor(discountMinor)}
                    </dd>
                  </div>
                )}

                <div className="flex items-baseline justify-between border-t border-ink-line pt-3">
                  <dt className="font-display text-base tracking-tight text-ink">{tx("Total")}</dt>
                  <dd className="font-display text-2xl text-saffron-500 tabular-nums">
                    {totalMinor === 0 ? tx("Free") : formatMinor(totalMinor)}
                  </dd>
                </div>
              </dl>

              <button
                onClick={() => {
                  if (!user) {
                    navigate({ to: "/auth", search: { mode: "signup" } });
                    return;
                  }
                  checkout.mutate();
                }}
                disabled={checkout.isPending}
                className="btn-primary mt-5 w-full !py-3.5 disabled:opacity-60"
              >
                {checkout.isPending && <Loader2 size={16} className="animate-spin" aria-hidden />}
                {/* While the session is still resolving, `user` is null and this
                    read "Sign in to enrol" at somebody who was already signed
                    in. Say nothing rather than something wrong. */}
                {!ready ? "…" : user ? `Enroll in all ${lines.length}` : "Sign in to enroll"}
              </button>

              {checkout.error && (
                <p role="alert" className="mt-3 font-body text-[13px] text-saffron-700">
                  {checkout.error instanceof Error ? checkout.error.message : "Checkout failed."}
                </p>
              )}

              <button
                onClick={() => {
                  clearCart();
                  setSlugs([]);
                  setCoupon(null);
                }}
                className="mt-3 w-full font-body text-[11px] text-ink-mute transition-colors hover:text-saffron-600"
              >
                {tx("Empty the cart")}
              </button>

              {/* What actually happens next — stated, not implied. */}
              <ul className="mt-6 space-y-2.5 border-t border-ink-line pt-5">
                {[
                  {
                    icon: <Lock size={13} aria-hidden />,
                    text: "No card details are taken on this site.",
                  },
                  {
                    icon: <ShieldCheck size={13} aria-hidden />,
                    text:
                      paidCount > 0
                        ? "Paid courses are settled with the training partner — enrolling reserves your seat and puts you in touch."
                        : "Everything in this basket is free to start.",
                  },
                  {
                    icon: <BadgeCheck size={13} aria-hidden />,
                    text: "Finish a course and we issue a certificate anyone can verify.",
                  },
                ].map((t) => (
                  <li key={t.text} className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 text-saffron-500">{t.icon}</span>
                    <span className="font-body text-[12px] leading-snug text-ink-mute">
                      {t.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      )}
    </div>
  );
}
