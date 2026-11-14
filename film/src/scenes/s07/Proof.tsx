import React from "react";
import { C, FACTS, FONT } from "../../tokens";
import { Badge, hexA } from "../../components/Surfaces";
import { ShieldGlyph } from "./glyphs";

/* The `proof` footage slot: a crop on the proof sheet's facts card ("What every friend sees") and the green DAO line.
   Crop is in CSS px of the 1920x1080 recording (desktop Dialog 440 wide at x 740-1180, vertically centred; its content
   column is x 768-1152). K = film px per CSS px, so the sheet's 14 px text reads at ~26 px and 12 px at ~22 px.
   The placeholder rebuilds that region of proof-sheet.tsx with the same geometry (Tailwind line-height 1.5). */
export const CROP = { x: 752, y: 404, w: 416, h: 342 };
export const WIN_W = 770;
export const K = WIN_W / CROP.w;
export const WIN_H = Math.round(CROP.h * K);
/** Window centre in stage px once it has risen. */
export const WIN_C = { x: 0, y: -60 };
/** Fact chips are shown at this scale (CSS px x CHIP_K) before they dock into the window at K. */
export const CHIP_K = 2.8;

/** Facts-card points in crop CSS px (top-left of each block). */
const CARD = { x: 16, y: 26, w: 384, h: 195 };
export const FACT_AT = {
  booked: { x: 32, y: 72 },
  dates: { x: 216, y: 72 },
  guests: { x: 32, y: 123 },
  total: { x: 216, y: 123 },
  hidden: { x: 32, y: 187 },
} as const;
const LINE = { x: 16, y: 241, w: 384 };

/** Stage position of a crop point when the window is flat at WIN_C. */
export const stageOf = (p: { x: number; y: number }) => ({ x: WIN_C.x - WIN_W / 2 + p.x * K, y: WIN_C.y - WIN_H / 2 + p.y * K });

export const HIDDEN_TEXT = "Hidden: guest names, address, card, booking reference";
export const PAID_LINE = `The crew DAO paid Maya $${FACTS.pot}. The proposal passed because the contract proved the booking; no vote needed.`;

/** The app's <Fact>: dt 12 px fg-3, dd 14 px semibold, at scale k. */
export function FactBlock({ k, label, value, style }: { k: number; label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: FONT, whiteSpace: "nowrap", ...style }}>
      <div style={{ fontSize: 12 * k, lineHeight: `${18 * k}px`, color: C.fg3 }}>{label}</div>
      <div style={{ fontSize: 14 * k, lineHeight: `${21 * k}px`, fontWeight: 600, color: C.fg }}>{value}</div>
    </div>
  );
}

export const FACT_VALUES = {
  booked: { label: "Booked on", value: "booking.com" },
  dates: { label: "Dates", value: `${FACTS.dates} · ${FACTS.nights} nights` },
  guests: { label: "Guests", value: String(FACTS.beds) },
  total: { label: "Total", value: `$${FACTS.pot} of $${FACTS.pot}` },
} as const;

const abs = (p: { x: number; y: number }): React.CSSProperties => ({ position: "absolute", left: p.x * K, top: p.y * K });

/** Placeholder for the `proof` slot. factsIn: the three docked facts; hiddenIn: the hidden line; line: green DAO line 0..1. */
export function ProofPlaceholder({ factsIn, hiddenIn, line }: { factsIn: number; hiddenIn: number; line: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.raise, fontFamily: FONT, color: C.fg }}>
      <div style={{ ...abs(CARD), width: CARD.w * K, height: CARD.h * K, borderRadius: 16 * K, background: "rgba(255,255,255,0.05)" }} />
      <div style={{ position: "absolute", left: (CARD.x + CARD.w - 16) * K, top: (CARD.y - 12) * K, transform: "translateX(-100%)" }}>
        <Badge kind="verified" s={K * 1.1} icon={<ShieldGlyph size={12 * K} color={C.paid} />} style={{ background: C.void }} />
      </div>
      <div style={{ ...abs({ x: 32, y: 42 }), fontSize: 12 * K, lineHeight: `${18 * K}px`, fontWeight: 500, color: C.fg2 }}>What every friend sees</div>
      <FactBlock k={K} {...FACT_VALUES.booked} style={abs(FACT_AT.booked)} />
      <FactBlock k={K} {...FACT_VALUES.dates} style={{ ...abs(FACT_AT.dates), opacity: factsIn }} />
      <FactBlock k={K} {...FACT_VALUES.guests} style={{ ...abs(FACT_AT.guests), opacity: factsIn }} />
      <FactBlock k={K} {...FACT_VALUES.total} style={{ ...abs(FACT_AT.total), opacity: factsIn }} />
      <div style={{ position: "absolute", left: 32 * K, top: 174 * K, width: 352 * K, borderTop: `${K}px dashed ${C.lineStrong}` }} />
      <div style={{ ...abs(FACT_AT.hidden), fontSize: 12 * K, lineHeight: `${18 * K}px`, color: C.fg3, whiteSpace: "nowrap", opacity: hiddenIn }}>{HIDDEN_TEXT}</div>
      <div
        style={{
          ...abs(LINE),
          width: LINE.w * K,
          boxSizing: "border-box",
          padding: `${12 * K}px ${16 * K}px`,
          borderRadius: 16 * K,
          background: hexA(C.paid, 0.1),
          color: C.paid,
          fontSize: 14 * K,
          lineHeight: 1.5,
          opacity: line,
          transform: `translateY(${(1 - line) * 8 * K}px)`,
          filter: line < 1 ? `blur(${(1 - line) * 6}px)` : undefined,
        }}
      >
        {PAID_LINE}
        <span style={{ marginLeft: 8 * K, textDecoration: "underline", textDecorationColor: hexA(C.paid, 0.3), textUnderlineOffset: 4 * K }}>receipt ↗</span>
      </div>
    </div>
  );
}
