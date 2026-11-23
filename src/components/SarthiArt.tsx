import type { CSSProperties } from "react";

/** Small decorative illustration: a tutor's open book with a question bubble. Purely visual. */
export default function SarthiArt({ size = 112, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="60" cy="62" r="50" fill="var(--color-saffron-50)" />
      <path d="M22 84 Q60 72 60 92 Q60 72 98 84 L98 102 Q60 92 60 110 Q60 92 22 102 Z" fill="#fff" stroke="var(--color-saffron-500)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M60 92 L60 110" stroke="var(--color-saffron-500)" strokeWidth="3" />
      <path d="M32 92 Q44 88 56 93 M32 99 Q44 95 56 100 M64 93 Q76 88 88 92 M64 100 Q76 95 88 99" stroke="var(--color-saffron-500)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <rect x="64" y="14" width="40" height="28" rx="10" fill="var(--color-saffron-500)" />
      <path d="M70 42 L66 50 L78 42 Z" fill="var(--color-saffron-500)" />
      <circle cx="75" cy="28" r="2.5" fill="#fff" />
      <circle cx="84" cy="28" r="2.5" fill="#fff" />
      <circle cx="93" cy="28" r="2.5" fill="#fff" />
      <circle cx="36" cy="46" r="4" fill="var(--color-saffron-500)" />
      <path d="M36 54 L36 74" stroke="var(--color-saffron-500)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
