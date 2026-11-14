import React from "react";

/* Lucide glyphs the proof sheet uses (Mail, ShieldCheck, Check, Loader arc), drawn inline at film size. */
type G = { size: number; color: string; style?: React.CSSProperties };
const svg = (size: number, color: string, w: number, style?: React.CSSProperties) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: w,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: { display: "block", ...style },
});

export const MailGlyph = ({ size, color, style }: G) => (
  <svg {...svg(size, color, 2, style)}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const ShieldGlyph = ({ size, color, style }: G) => (
  <svg {...svg(size, color, 2.2, style)}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

/** Check mark drawn from the short stroke; `draw` 0..1. */
export const CheckGlyph = ({ size, color, draw = 1, style }: G & { draw?: number }) => (
  <svg {...svg(size, color, 3, style)}>
    <path d="M4 12l5 5L20 6" strokeDasharray={23} strokeDashoffset={23 * (1 - draw)} />
  </svg>
);

/** The app's loader arc, turned by `rot` degrees. */
export const SpinnerGlyph = ({ size, color, rot, style }: G & { rot: number }) => (
  <svg {...svg(size, color, 2.5, { transform: `rotate(${rot}deg)`, ...style })}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/* Layer glyphs for the checks while the proof is not yet accepted (descriptive, not a pass). */
export const KeyGlyph = ({ size, color, style }: G) => (
  <svg {...svg(size, color, 2.2, style)}>
    <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
    <circle cx="16.5" cy="7.5" r=".5" fill={color} />
  </svg>
);

export const EyeOffGlyph = ({ size, color, style }: G) => (
  <svg {...svg(size, color, 2.2, style)}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </svg>
);

export const LinkGlyph = ({ size, color, style }: G) => (
  <svg {...svg(size, color, 2.2, style)}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
