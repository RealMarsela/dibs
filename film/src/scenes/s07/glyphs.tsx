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
