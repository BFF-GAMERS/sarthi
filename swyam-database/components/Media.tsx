import { useEffect, useRef, useState } from "react";

/**
 * A picture that does not leave a hole in the page.
 *
 * Every image on this site is remote, every card in a grid of thirty-nine has
 * one, and they were being dropped straight into the layout: on anything
 * slower than office wifi the catalogue is a screen of white rectangles with
 * a price chip floating in the middle of each. It reads as broken, and the
 * first impression of a skilling site in India cannot assume a fast
 * connection.
 *
 * So: the box reserves its own aspect ratio, holds a quiet tinted surface
 * with a slow shimmer while the bytes are in the air, and fades the image in
 * when it lands. A file that fails outright leaves the tint rather than a
 * torn-image icon. Nothing here is decoration — it is the difference between
 * "loading" and "broken" on a phone.
 */
export default function Media({
  src,
  alt = "",
  ratio = "16 / 10",
  className = "",
  imgClassName = "",
  priority = false,
  children,
}: {
  src: string | null | undefined;
  alt?: string;
  /**
   * Any CSS aspect-ratio, kept before the image arrives. Pass null when the
   * ratio changes with the breakpoint and the class names set it instead.
   */
  ratio?: string | null;
  className?: string;
  imgClassName?: string;
  /** Above the fold: load eagerly and decode synchronously. */
  priority?: boolean;
  /** Badges and chips that sit over the image. */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");

  // A cached image can be complete before React attaches onLoad, which would
  // leave it invisible behind the placeholder forever.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.complete) setState(el.naturalWidth > 0 ? "loaded" : "failed");
  }, [src]);

  return (
    <div
      className={`media ${state === "loading" ? "is-loading" : ""} ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
      data-state={state}
    >
      {src && (
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={`h-full w-full object-cover ${imgClassName}`}
          data-loaded={state === "loaded"}
        />
      )}
      {children}
    </div>
  );
}
