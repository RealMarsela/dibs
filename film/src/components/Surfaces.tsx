import React from "react";
import { C, DISPLAY, FONT, GLASS, MONO, CHAIN_DOT } from "../tokens";

/* The app's surfaces (index.css): frosted glass panel, pills, ReUI light badges, chain tag, label. Sizes take a
   `s` scale so a scene can show them at film scale (the app's CSS px x s). */

export function Glass({ s = 2, radius = 24, style, children }: { s?: number; radius?: number; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <div style={{ ...GLASS, borderRadius: radius * s, ...style }}>{children}</div>;
}

export function Pill({ s = 2, tone = "light", children, style, small }: { s?: number; tone?: "light" | "dark"; small?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  const h = (small ? 32 : 40) * s;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8 * s,
        height: h,
        padding: `0 ${(small ? 14 : 22) * s}px`,
        borderRadius: 999,
        fontFamily: FONT,
        fontSize: (small ? 13.5 : 14.5) * s,
        fontWeight: 600,
        background: tone === "light" ? C.fg : C.panel,
        color: tone === "light" ? C.void : C.fg,
        boxShadow: tone === "dark" ? `inset 0 0 0 ${s}px ${C.line}` : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const BADGE = {
  paid: { label: "Paid", c: C.paid },
  due: { label: "Due", c: C.due },
  resale: { label: "For resale", c: C.resale },
  refused: { label: "Refused", c: C.refused },
  verified: { label: "Verified", c: C.paid },
  approved: { label: "Approved", c: C.paid },
  declined: { label: "Declined", c: C.refused },
  received: { label: "Received", c: C.fg2 },
  checked: { label: "Checked in the enclave", c: C.fg },
} as const;
export type BadgeKind = keyof typeof BADGE;

/** ReUI "*-light" badge in dark mode: colour/15 fill, colour/25 border, colour text, radius full. */
export function Badge({ kind, s = 2, label, icon, style }: { kind: BadgeKind; s?: number; label?: string; icon?: React.ReactNode; style?: React.CSSProperties }) {
  const b = BADGE[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4 * s,
        height: 22 * s,
        padding: `0 ${10 * s}px`,
        borderRadius: 999,
        fontFamily: FONT,
        fontSize: 12 * s,
        fontWeight: 600,
        color: b.c,
        background: hexA(b.c, 0.15),
        border: `${s}px solid ${hexA(b.c, 0.25)}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {icon}
      {label ?? b.label}
    </span>
  );
}

export function ChainTag({ chain, s = 2, style }: { chain: keyof typeof CHAIN_DOT; s?: number; style?: React.CSSProperties }) {
  const name = { near: "NEAR", base: "Base", solana: "Solana", arbitrum: "Arbitrum", ethereum: "Ethereum" }[chain];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 * s, fontFamily: FONT, fontSize: 12.5 * s, color: C.fg2, ...style }}>
      <span style={{ width: 6 * s, height: 6 * s, borderRadius: 99, background: CHAIN_DOT[chain] }} />
      USDC on {name}
    </span>
  );
}

export function Label({ s = 2, children, style }: { s?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ fontFamily: FONT, fontSize: 12 * s, fontWeight: 500, color: C.fg2, ...style }}>{children}</span>;
}

export function Mono({ size = 24, color = C.fg2, children, style }: { size?: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ fontFamily: MONO, fontSize: size, color, letterSpacing: "-0.01em", ...style }}>{children}</span>;
}

/** Dibs wordmark (bits.tsx Wordmark): bold, tracking -0.04em, lowercase. */
export function Wordmark({ size = 44, color = C.fg, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, letterSpacing: "-0.04em", color, ...style }}>dibs</span>;
}

export function Display({ size = 64, children, style }: { size?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...DISPLAY, fontSize: size, color: C.fg, ...style }}>{children}</div>;
}

/** #rrggbb + alpha → rgba() */
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
