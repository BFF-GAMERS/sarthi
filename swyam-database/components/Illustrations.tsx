/**
 * Flat vector illustrations — pure inline SVG, no 3D, no external assets.
 * Colours are drawn from the design tokens so the art stays on-brand.
 */

const INK = "#1a1a1b";
const INK_SOFT = "#3a3a3c";
const LINE = "#e2ded4";
const PAPER = "#ffffff";
const PAPER_DIM = "#f6f4ef";
const SAFFRON = "#c9330a";
const SAFFRON_SOFT = "#fbe2d6";
const SAFFRON_MID = "#f5723f";
const GREEN = "#1f5c3d";

/**
 * Hero artwork: a learner's progress card, a certificate and an offer card —
 * the three moments the platform actually connects.
 */
export function CareerIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 460"
      className={className}
      role="img"
      aria-label="Illustration of a learning progress card, a skill certificate and a job offer"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff4ee" />
          <stop offset="100%" stopColor="#fde3d5" />
        </linearGradient>
        <linearGradient id="hero-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SAFFRON_MID} />
          <stop offset="100%" stopColor={SAFFRON} />
        </linearGradient>
        <pattern id="hero-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="1.6" fill={SAFFRON} opacity="0.28" />
        </pattern>
        <filter id="hero-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor={INK} floodOpacity="0.11" />
        </filter>
      </defs>

      {/* Soft backdrop */}
      <rect x="52" y="24" width="470" height="404" rx="72" fill="url(#hero-bg)" />
      <rect x="392" y="290" width="112" height="112" rx="18" fill="url(#hero-dots)" />

      {/* ── Progress card ─────────────────────────────────────── */}
      <g filter="url(#hero-shadow)">
        <rect x="86" y="96" width="286" height="216" rx="24" fill={PAPER} stroke={LINE} />
        {/* thumbnail band */}
        <rect x="106" y="116" width="246" height="72" rx="14" fill={PAPER_DIM} />
        <circle cx="146" cy="152" r="20" fill="url(#hero-accent)" />
        <path
          d="M139 152.5l5.5 5.5 10-11"
          fill="none"
          stroke={PAPER}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="180" y="140" width="128" height="9" rx="4.5" fill={INK} opacity="0.82" />
        <rect x="180" y="157" width="86" height="8" rx="4" fill={INK} opacity="0.24" />

        {/* skill bars */}
        <g>
          <rect x="106" y="208" width="60" height="7" rx="3.5" fill={INK} opacity="0.35" />
          <rect x="106" y="222" width="246" height="10" rx="5" fill={PAPER_DIM} />
          <rect x="106" y="222" width="196" height="10" rx="5" fill="url(#hero-accent)" />
        </g>
        <g>
          <rect x="106" y="248" width="44" height="7" rx="3.5" fill={INK} opacity="0.35" />
          <rect x="106" y="262" width="246" height="10" rx="5" fill={PAPER_DIM} />
          <rect x="106" y="262" width="132" height="10" rx="5" fill={SAFFRON_MID} />
        </g>
        <rect x="106" y="286" width="246" height="8" rx="4" fill={PAPER_DIM} />
        <rect x="106" y="286" width="94" height="8" rx="4" fill={GREEN} opacity="0.55" />
      </g>

      {/* ── Graduation cap ────────────────────────────────────── */}
      <g className="ill-float">
        <g filter="url(#hero-shadow)">
          <path d="M150 46 236 82 150 118 64 82Z" fill={INK} />
          <path d="M104 100v30c0 12 21 21 46 21s46-9 46-21v-30l-46 19Z" fill={INK_SOFT} />
          <path d="M228 86v40" stroke={SAFFRON_MID} strokeWidth="4" strokeLinecap="round" />
          <circle cx="228" cy="132" r="8" fill={SAFFRON_MID} />
        </g>
      </g>

      {/* ── Certificate badge ─────────────────────────────────── */}
      <g className="ill-float-slow" filter="url(#hero-shadow)">
        <circle cx="404" cy="132" r="52" fill={PAPER} stroke={LINE} />
        <circle cx="404" cy="132" r="36" fill={SAFFRON_SOFT} />
        <path
          d="M389 132.5l10 10 20-21"
          fill="none"
          stroke={SAFFRON}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M388 176l-8 40 24-13 24 13-8-40Z" fill="url(#hero-accent)" />
      </g>

      {/* ── Offer card ────────────────────────────────────────── */}
      <g className="ill-float" filter="url(#hero-shadow)">
        <rect x="228" y="318" width="252" height="112" rx="22" fill={PAPER} stroke={LINE} />
        <rect x="250" y="342" width="52" height="52" rx="14" fill={INK} />
        {/* briefcase */}
        <rect x="262" y="362" width="28" height="20" rx="4" fill={PAPER} />
        <path
          d="M270 362v-5a4 4 0 014-4h4a4 4 0 014 4v5"
          fill="none"
          stroke={PAPER}
          strokeWidth="3"
        />
        <rect x="318" y="348" width="120" height="10" rx="5" fill={INK} opacity="0.82" />
        <rect x="318" y="366" width="76" height="8" rx="4" fill={INK} opacity="0.22" />
        <rect x="318" y="382" width="58" height="16" rx="8" fill={SAFFRON_SOFT} />
        <text
          x="347"
          y="394"
          textAnchor="middle"
          fill={SAFFRON}
          fontSize="10"
          fontFamily="Space Grotesk, system-ui, sans-serif"
          fontWeight="700"
        >
          HIRED
        </text>
      </g>

      {/* Growth ticks */}
      <g opacity="0.9">
        <rect x="96" y="366" width="16" height="34" rx="8" fill={SAFFRON_SOFT} />
        <rect x="122" y="348" width="16" height="52" rx="8" fill={SAFFRON_MID} opacity="0.7" />
        <rect x="148" y="326" width="16" height="74" rx="8" fill={SAFFRON} />
      </g>

      <style>{`
        .ill-float { animation: ill-float 7s ease-in-out infinite; transform-origin: center; }
        .ill-float-slow { animation: ill-float 9s ease-in-out infinite; animation-delay: -3s; }
        @keyframes ill-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ill-float, .ill-float-slow { animation: none; }
        }
      `}</style>
    </svg>
  );
}

/** Compact learning-path artwork used on secondary pages. */
export function LearningPathIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 320"
      className={className}
      role="img"
      aria-label="Illustration of a step-by-step learning path"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="path-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff4ee" />
          <stop offset="100%" stopColor="#fde3d5" />
        </linearGradient>
        <linearGradient id="path-accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={SAFFRON_MID} />
          <stop offset="100%" stopColor={SAFFRON} />
        </linearGradient>
        <filter id="path-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor={INK} floodOpacity="0.1" />
        </filter>
      </defs>

      <rect x="20" y="16" width="440" height="288" rx="56" fill="url(#path-bg)" />

      <path
        d="M92 236C150 236 140 160 200 160s52-76 112-76h72"
        fill="none"
        stroke="url(#path-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="1 14"
      />

      {[
        { x: 92, y: 236, r: 15, fill: SAFFRON },
        { x: 200, y: 160, r: 15, fill: SAFFRON_MID },
        { x: 312, y: 84, r: 15, fill: GREEN },
      ].map((n) => (
        <circle key={n.x} cx={n.x} cy={n.y} r={n.r} fill={n.fill} stroke={PAPER} strokeWidth="4" />
      ))}

      <g filter="url(#path-shadow)">
        <rect x="120" y="178" width="146" height="58" rx="16" fill={PAPER} stroke={LINE} />
        <rect x="138" y="196" width="66" height="8" rx="4" fill={INK} opacity="0.8" />
        <rect x="138" y="212" width="102" height="7" rx="3.5" fill={INK} opacity="0.2" />
      </g>
      <g filter="url(#path-shadow)">
        <rect x="232" y="34" width="164" height="62" rx="16" fill={PAPER} stroke={LINE} />
        <circle cx="262" cy="65" r="14" fill={SAFFRON_SOFT} />
        <path
          d="M256 65.5l4.5 4.5 8-9"
          fill="none"
          stroke={SAFFRON}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="288" y="52" width="84" height="8" rx="4" fill={INK} opacity="0.8" />
        <rect x="288" y="68" width="54" height="7" rx="3.5" fill={INK} opacity="0.2" />
      </g>
    </svg>
  );
}
