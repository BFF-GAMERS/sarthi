import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * Whether the entrance animation should be skipped.
 *
 * Kept for callers that need the answer in JavaScript. The reveals below no longer ask: they are driven by
 * CSS off the pre-paint html[data-motion] attribute, so the server HTML and the first client render are
 * identical whatever the visitor's motion setting (no transform in the markup, no #418 under reduced
 * motion). This hook reads the setting only after mount, for the same reason.
 */
export function useSkipAnimation(): boolean {
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const read = () =>
      setSkip(
        document.documentElement.dataset["motion"] === "reduced" ||
          (typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
          document.hidden,
      );
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);
  return skip;
}

/**
 * Marks `data-in` on the element once it scrolls into view. The offset itself lives in evo-ui.css and is
 * only applied under html[data-motion="full"], so with no JavaScript, reduced motion or a background tab
 * the content simply sits where it belongs. A sliding entrance degrades honestly: no frames means the
 * content is a few pixels off, never invisible.
 */
function useInView<T extends HTMLElement>(once: boolean, margin: number, stagger = false) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stagger)
      el.querySelectorAll<HTMLElement>(".rv-item").forEach((n, i) =>
        n.style.setProperty("--rv-i", String(i)),
      );
    if (typeof IntersectionObserver === "undefined") {
      el.dataset["in"] = "true";
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) {
          el.dataset["in"] = "true";
          if (once) io.disconnect();
        } else if (!once) delete el.dataset["in"];
      },
      { rootMargin: `0px 0px -${margin}px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, margin, stagger]);
  return ref;
}

/** Fade-up on scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 32,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useInView<HTMLDivElement>(once, 80);
  return (
    <div
      ref={ref}
      className={`rv${className ? ` ${className}` : ""}`}
      style={{ ["--rv-y" as string]: `${y}px`, ["--rv-d" as string]: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/** Staggered container: children with <StaggerItem> animate in sequence, in document order. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useInView<HTMLDivElement>(true, 60, true);
  return (
    <div ref={ref} className={`rv-stagger${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rv-item${className ? ` ${className}` : ""}`}>{children}</div>;
}

/** Parallax wrapper — content drifts as the section scrolls. */
export function Parallax({
  children,
  distance = 80,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className={`rv-parallax${className ? ` ${className}` : ""}`}
    >
      {children}
    </motion.div>
  );
}

/** Image that scales subtly as it enters the viewport. */
export function ScaleImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const ref = useInView<HTMLDivElement>(true, 60);
  return (
    <div ref={ref} className={`rv-scale overflow-hidden ${className ?? ""}`}>
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
}
