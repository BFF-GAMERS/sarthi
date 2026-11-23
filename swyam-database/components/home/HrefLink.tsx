import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useRouter } from "@tanstack/react-router";
import { usePressProps } from "@/components/motion/PressScale";

/**
 * A link for a destination that arrives as a string (the evolution registry,
 * resolved entities). It is a real <a href>, so open-in-new-tab, copy-link and
 * no-JS all work, and a plain left click navigates inside the app. `press` gives a primary call to
 * action the physical press from the motion kit (the element is still just the <a>).
 */
export default function HrefLink({
  href,
  onClick,
  children,
  press = false,
  ...rest
}: { href: string; children: ReactNode; press?: boolean } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const router = useRouter();
  const pressProps = usePressProps({ disabled: !press });
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    if (rest.target && rest.target !== "_self") return;
    e.preventDefault();
    router.history.push(href);
  };
  if (press)
    return (
      <motion.a {...(rest as HTMLMotionProps<"a">)} {...pressProps} href={href} onClick={go}>
        {children}
      </motion.a>
    );
  return (
    <a {...rest} href={href} onClick={go}>
      {children}
    </a>
  );
}
