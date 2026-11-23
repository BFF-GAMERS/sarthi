import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/motion";
import { useTx } from "@/lib/i18n";

/** How long the strike line takes to draw before the figure starts to roll. */
export const STRIKE_MS = 300;
/** The roll from the regular price to the intro price. */
export const ROLL_MS = 600;

type Phase = "strike" | "roll" | "done";

export interface PriceRollProps {
  /** The plan's real regular price, rupees a month. */
  regular: number;
  /** The intro price for the first month. */
  intro: number;
  /** Play the strike-then-roll once. False renders the settled price straight away. */
  animate: boolean;
}

/** `then ₹{price}/mo` and friends use a placeholder so the whole sentence can be translated. */
export const fill = (s: string, values: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

/**
 * The price lock-up. Strike, then roll: the regular price is struck for 300 ms, then the figure rolls
 * down to the intro price over about 600 ms, once per open. The terms line sits beneath at the same
 * size as the "first month" tag, so the price after the intro is never smaller than the offer.
 *
 * What a screen reader hears is one polite sentence with the whole price, whether or not anything moves.
 * Nothing here counts down, flashes or hurries anyone.
 */
export default function PriceRoll({ regular, intro, animate }: PriceRollProps) {
  const tx = useTx();
  const [phase, setPhase] = useState<Phase>(animate ? "strike" : "done");
  const [shown, setShown] = useState(animate ? regular : intro);

  useEffect(() => {
    if (!animate) {
      setPhase("done");
      setShown(intro);
      return;
    }
    setPhase("strike");
    setShown(regular);
    const roll = window.setTimeout(() => {
      setPhase("roll");
      setShown(intro);
    }, STRIKE_MS);
    const done = window.setTimeout(() => setPhase("done"), STRIKE_MS + ROLL_MS + 80);
    return () => {
      window.clearTimeout(roll);
      window.clearTimeout(done);
    };
  }, [animate, regular, intro]);

  const settled = phase === "done";
  const spoken = settled
    ? fill(
        tx(
          "₹{intro} for the first month, then ₹{price} a month. Cancel anytime. Demo, no payment taken.",
        ),
        { intro, price: regular },
      )
    : fill(tx("Regular price ₹{price} a month."), { price: regular });

  return (
    <div className="plus-price" data-phase={phase}>
      <div className="plus-price-row" aria-hidden="true">
        <span className="plus-price-now">
          <AnimatedNumber value={shown} prefix="₹" spring="major" />
        </span>
        <span className="plus-was">₹{regular}</span>
      </div>
      <p className="plus-price-line" aria-hidden="true">
        {fill(tx("₹{intro} first month"), { intro })}
      </p>
      <p className="plus-price-line" aria-hidden="true">
        {fill(tx("then ₹{price}/mo · cancel anytime"), { price: regular })}
      </p>
      <p className="plus-sr" role="status" aria-live="polite">
        {spoken}
      </p>
    </div>
  );
}
