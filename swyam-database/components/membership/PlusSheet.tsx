import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useIsPresent,
  type PanInfo,
} from "framer-motion";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SPRING } from "@/components/motion";
import { useTx } from "@/lib/i18n";
import { profileTypeInfo } from "@/lib/profile-type";
import { recordPlusEvent, useMembership, usePlusState } from "@/membership";
import type { PlusDismissKind } from "@/membership/config/events";
import type { AccentId } from "@/membership/config/plans";
import { closePlus, usePlusOpen } from "@/membership/trigger/plus-open-store";
import { useIsMinor } from "@/membership/trigger/use-is-minor";
import { attachDialog } from "./dialog-a11y";
import FoilCard from "./FoilCard";
import PriceRoll from "./PriceRoll";
import { useIsWide, useStaticFx } from "./use-plus-fx";

export type DismissAction = "not_now" | "close" | "backdrop" | "esc" | "swipe" | "never" | "done";

export interface SheetBenefit {
  id: string;
  /** English source string. */
  label: string;
  availability: "live" | "preview";
}

export interface PlusSheetViewProps {
  planName: string;
  regularPrice: number;
  introPrice: number;
  roleLabel: string;
  firstName: string;
  accent: AccentId | null;
  /** English source strings: the view runs them through tx(). */
  headline: string;
  reason: string;
  source: "ai" | "rules";
  benefits: readonly SheetBenefit[];
  /** Reduced motion, or the lite and static effects tiers: a still card, no roll. */
  staticFx: boolean;
  /** Laptop: a centred two-pane dialog. Phone: a bottom sheet. */
  wide: boolean;
  /** A minor, or age not known: ask a guardian. */
  guardian: boolean;
  stage: "offer" | "result";
  notify: boolean;
  /** Where focus goes when the sheet closes. Defaults to wherever it was when the sheet opened. */
  returnTo?: HTMLElement | null;
  onDismiss: (action: DismissAction) => void;
  onDemo: () => void;
  onNotify: (checked: boolean) => void;
}

/** Swipe past this, or flick faster than this, and the sheet goes. */
const SWIPE_DISTANCE = 90;
const SWIPE_VELOCITY = 600;

/**
 * The Swayam Plus sheet. On a phone it is a bottom sheet with a drag handle; on a laptop a centred
 * two-pane dialog, card on the left and benefits on the right.
 *
 * It is an invitation and written like one: the price is stated in full and at one size, "Not now" and
 * the X are as easy to hit as the offer, "Don't show again" is always there, and there is no timer, no
 * scarcity and no guilt copy anywhere. Nothing is charged: it says so on the card and again after the tap.
 */
export function PlusSheetView(p: PlusSheetViewProps) {
  const tx = useTx();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  const controls = useDragControls();
  const dismissRef = useRef(p.onDismiss);
  dismissRef.current = p.onDismiss;

  // Keyboard focus inside, Escape closes, the page behind holds still, focus goes back afterwards.
  // Released the moment the exit animation starts, so focus never lingers in a fading dialog.
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !present) return;
    return attachDialog(el, { onEscape: () => dismissRef.current("esc"), returnTo: p.returnTo });
  }, [present, p.returnTo]);

  // The offer button is gone once it is taken: hand focus to the result so it is read out.
  useEffect(() => {
    if (p.stage === "result") resultRef.current?.focus({ preventScroll: true });
  }, [p.stage]);

  const onDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.y > SWIPE_DISTANCE || info.velocity.y > SWIPE_VELOCITY) {
      dismissRef.current("swipe");
    }
  }, []);

  const spring = SPRING.standard;
  const panelMotion = p.staticFx
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : p.wide
      ? {
          initial: { opacity: 0, y: 16, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 8, scale: 0.99 },
          transition: spring,
        }
      : {
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: spring,
        };

  const reasonLine = `${tx(p.reason)} · ${p.source === "ai" ? tx("Chosen by AI") : tx("Chosen by rules")}`;
  const planLine = `${tx("Swayam Plus")} · ${p.planName}`;

  return (
    <div className="plus-root" data-static={p.staticFx ? "" : undefined}>
      <motion.div
        className="plus-backdrop"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: p.staticFx ? 0.1 : 0.2 }}
        onClick={() => p.onDismiss("backdrop")}
      />
      <motion.div
        ref={panelRef}
        className="plus-sheet plus-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-plus-sheet=""
        data-static={p.staticFx ? "" : undefined}
        tabIndex={-1}
        drag={p.wide ? false : "y"}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={onDragEnd}
        {...panelMotion}
      >
        {/* First in the tab order on purpose: the way out is the first thing a keyboard reaches. */}
        <button
          type="button"
          className="plus-dismiss plus-x"
          aria-label={tx("Close")}
          onClick={() => p.onDismiss("close")}
        >
          <X aria-hidden="true" size={20} />
        </button>

        {!p.wide && (
          <div className="plus-grab" aria-hidden="true" onPointerDown={(e) => controls.start(e)} />
        )}

        <div className="plus-body">
          <div className="plus-left">
            <FoilCard
              firstName={p.firstName}
              planName={p.planName}
              roleLabel={p.roleLabel}
              accent={p.accent}
              staticFx={p.staticFx}
            />
            <PriceRoll
              regular={p.regularPrice}
              intro={p.introPrice}
              animate={!p.staticFx && p.stage === "offer"}
            />
            <p className="plus-honesty">
              {tx("Demo · no payment taken · everything is free during the pilot")}
            </p>
          </div>

          <div className="plus-right">
            {p.stage === "offer" ? (
              <>
                <p className="plus-eyebrow">{planLine}</p>
                <h2 id={titleId} className="plus-title">
                  {tx(p.headline)}
                </h2>

                <ul className="plus-benefits" aria-label={tx("What is included")}>
                  {p.benefits.map((b, i) => (
                    <motion.li
                      key={b.id}
                      className="plus-ticket"
                      initial={p.staticFx ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        p.staticFx ? { duration: 0 } : { ...spring, delay: 0.2 + i * 0.06 }
                      }
                    >
                      <span className="plus-ticket-stub" aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="plus-ticket-main">
                        <span>{tx(b.label)}</span>
                        {i < 2 && (
                          <span
                            className="plus-chip"
                            data-kind="picked"
                            title={reasonLine}
                            aria-describedby={descId}
                          >
                            {tx("Picked for you")}
                          </span>
                        )}
                        {b.availability === "preview" && (
                          <span className="plus-chip" data-kind="preview">
                            {tx("Preview")}
                          </span>
                        )}
                      </span>
                    </motion.li>
                  ))}
                </ul>
                <p id={descId} className="plus-reason">
                  {reasonLine}
                </p>

                <div className="plus-actions">
                  <button type="button" className="plus-btn" data-primary="" onClick={p.onDemo}>
                    {tx("Start ₹1 trial — demo, no payment taken")}
                  </button>
                  {p.guardian && (
                    <p className="plus-reason">
                      {tx("Ask a parent or guardian before subscribing")}
                    </p>
                  )}
                  <label className="plus-notify">
                    <input
                      type="checkbox"
                      checked={p.notify}
                      onChange={(e) => p.onNotify(e.target.checked)}
                    />
                    <span>{tx("Notify me when payments open")}</span>
                  </label>
                  <p className="plus-sr" role="status" aria-live="polite">
                    {p.notify ? tx("Saved. We will tell you here when payments open.") : ""}
                  </p>
                  <div className="plus-foot">
                    <button
                      type="button"
                      className="plus-dismiss"
                      onClick={() => p.onDismiss("not_now")}
                    >
                      {tx("Not now")}
                    </button>
                    <button
                      type="button"
                      className="plus-link"
                      onClick={() => p.onDismiss("never")}
                    >
                      {tx("Don't show again")}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div ref={resultRef} className="plus-result" tabIndex={-1}>
                <p className="plus-eyebrow">{planLine}</p>
                <h2 id={titleId} className="plus-title">
                  {tx("You're on the Swayam Plus demo")}
                </h2>
                <p id={descId}>{tx("Nothing was charged. Payments aren't open yet.")}</p>
                {p.notify && <p>{tx("We will tell you here when payments open.")}</p>}
                <p className="plus-reason">
                  {tx("Everything stays free during the pilot, so nothing you use today changes.")}
                </p>
                <div className="plus-foot">
                  <button
                    type="button"
                    className="plus-btn"
                    data-primary=""
                    onClick={() => p.onDismiss("done")}
                  >
                    {tx("Done")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * The connected sheet, mounted by PlusHost the first time anything asks to open it. Renders nothing for
 * a guest (no plan, nothing to show), and keeps the exit animation alive after the store closes.
 */
export default function PlusSheet() {
  const open = usePlusOpen();
  const tx = useTx();
  const { user, profileId } = useAuth();
  const m = useMembership();
  const plus = usePlusState();
  const isMinor = useIsMinor(profileId);
  const staticFx = useStaticFx();
  const wide = useIsWide();
  const [stage, setStage] = useState<"offer" | "result">("offer");
  const [notify, setNotify] = useState(false);
  const shownFor = useRef(0);
  const interestRef = useRef(plus.state.interest);
  interestRef.current = plus.state.interest;

  const plan = m.plan;

  // A new open starts from the right screen: the result again for someone already on the demo.
  useEffect(() => {
    if (!open.open) return;
    setStage(interestRef.current === "trial_demo" ? "result" : "offer");
    setNotify(interestRef.current === "notify");
  }, [open.open, open.token]);

  // A guest has no plan: there is nothing honest to show, so close quietly.
  useEffect(() => {
    if (open.open && !plan && m.ready) closePlus();
  }, [open.open, plan, m.ready]);

  // One "shown" per open.
  useEffect(() => {
    if (!open.open || !plan || shownFor.current === open.token) return;
    shownFor.current = open.token;
    recordPlusEvent("plus_shown", {
      moment: open.moment ?? (open.source === "lab" ? "lab" : "settings"),
      planId: plan.id,
      source: m.source,
    });
  }, [open.open, open.token, open.moment, open.source, plan, m.source]);

  const handleDismiss = (action: DismissAction) => {
    if (action !== "done") {
      const kind: PlusDismissKind =
        action === "never"
          ? "never"
          : action === "backdrop"
            ? "backdrop"
            : action === "esc"
              ? "esc"
              : "not_now";
      recordPlusEvent("plus_dismissed", { kind });
      // Opened by hand, closing is just closing. Only "never" and an accepted offer change the schedule.
      const automatic = open.source === "trigger";
      const engaged = stage === "result" || plus.state.interest !== null;
      if (kind === "never" || (automatic && !engaged)) plus.dismiss(kind);
    }
    closePlus();
  };

  const handleNotify = (checked: boolean) => {
    setNotify(checked);
    if (checked) {
      plus.setInterest("notify");
      if (plan) recordPlusEvent("plus_cta_notify", { planId: plan.id });
    } else {
      plus.update((s) => (s.interest === "notify" ? { ...s, interest: null } : s));
    }
  };

  const handleDemo = () => {
    if (plan) recordPlusEvent("plus_cta_demo", { planId: plan.id });
    // Asking to be told is the larger ask, so it is the one kept when both are chosen.
    plus.setInterest(notify ? "notify" : "trial_demo");
    setStage("result");
  };

  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] || tx("Member");

  return (
    <AnimatePresence>
      {open.open && plan && (
        <PlusSheetView
          key={open.token}
          planName={plan.name}
          regularPrice={plan.regularPrice}
          introPrice={plan.introPrice}
          roleLabel={tx(profileTypeInfo(plan.profileType).label)}
          firstName={firstName}
          accent={m.accent}
          headline={m.headline ?? ""}
          reason={m.reason ?? ""}
          source={m.source}
          benefits={m.benefits}
          staticFx={staticFx}
          wide={wide}
          guardian={isMinor !== false}
          stage={stage}
          notify={notify}
          returnTo={open.returnTo}
          onDismiss={handleDismiss}
          onDemo={handleDemo}
          onNotify={handleNotify}
        />
      )}
    </AnimatePresence>
  );
}
