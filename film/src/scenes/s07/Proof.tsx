import React from "react";
import { C, FACTS, FONT, PROOF_ACCEPTED } from "../../tokens";
import { Badge, hexA } from "../../components/Surfaces";
import { ShieldGlyph } from "./glyphs";

/* The `proof` footage slot (public/footage/proof.mp4, 1920x1080 = CSS px, 24 fps): the proof sheet "Money released" for
   the REAL booking (trip sin1025). Measured on the clip: dialog x 742-1178, facts card (770, 428) 380 x 194, fact columns
   at x 786 / 969, rows at y 473 / 524, hidden line y 588, green DAO line box y 643-729. The crop region is static from
   1.75 s to the end. The crop starts on the facts card only and grows down on "releases" to reveal the green line.
   K = film px per CSS px (14 px text -> 27 px). The placeholder rebuilds the same region with the same geometry. */
export const CROP_X = 752;
export const CROP_Y = 409; // just below the descender of the sheet title
export const CROP_W = 416;
export const CROP_H_FACTS = 227;
export const CROP_H_FULL = 333;
export const WIN_W = 800;
export const K = WIN_W / CROP_W;
/** Centre of the fully grown window in stage px while it sits in the left column. */
export const WIN_C = { x: -440, y: -10 };
export const WIN_TOP = WIN_C.y - (CROP_H_FULL * K) / 2;
/** Fact chips are shown at this scale (CSS px x CHIP_K) before they dock into the window at K. */
export const CHIP_K = 2.6;

/* Geometry in crop CSS px (origin = crop top-left). */
const CARD = { x: 18, y: 19, w: 380, h: 194 };
export const FACT_AT = {
  booked: { x: 34, y: 64 },
  dates: { x: 217, y: 64 },
  guests: { x: 34, y: 115 },
  total: { x: 217, y: 115 },
  hidden: { x: 34, y: 179 },
} as const;
const LINE = { x: 18, y: 234, w: 380 };

/** Stage position of a crop point when the window is flat in place. */
export const stageOf = (p: { x: number; y: number }) => ({ x: WIN_C.x - WIN_W / 2 + p.x * K, y: WIN_TOP + p.y * K });

export const HIDDEN_TEXT = "Hidden: guest names, address, card, booking reference";
const PENDING_LINE = "The crew DAO pays out when the contract accepts the proof.";
const PAID_LINE = `The crew DAO paid Maya ${FACTS.proofPaid}. The proposal passed because the contract proved the booking; no vote needed.`;

/** The app's <Fact> (dt 12 px fg-3, dd 14 px semibold) laid out at its real CSS size and scaled by k, so SF picks the same
    optical size (Text) as the recording and the widths match the footage exactly. Box: 168k x 39k. */
export function FactBlock({ k, label, value, style }: { k: number; label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div style={{ width: 168 * k, height: 39 * k, ...style }}>
      <div style={{ width: 168, transform: `scale(${k})`, transformOrigin: "0 0", fontFamily: FONT, whiteSpace: "nowrap" }}>
        <div style={{ fontSize: 12, lineHeight: "18px", color: C.fg3 }}>{label}</div>
        <div style={{ fontSize: 14, lineHeight: "21px", fontWeight: 600, color: C.fg }}>{value}</div>
      </div>
    </div>
  );
}

/** A 12 px app line (label / hidden line) at its real CSS size, scaled by k. */
export function SmallLine({ k, color, weight = 400, children, style }: { k: number; color: string; weight?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ height: 18 * k, ...style }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: "0 0", fontFamily: FONT, fontSize: 12, lineHeight: "18px", fontWeight: weight, color, whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
}

/* Exactly as the app prints them (the sheet drops the year; the email body keeps it). */
export const FACT_VALUES = {
  booked: { label: "Booked on", value: "booking.com" },
  dates: { label: "Dates", value: `${FACTS.proofDates.replace(/ \d{4}$/, "")} · ${FACTS.proofNights} night` },
  guests: { label: "Guests", value: String(FACTS.proofGuests) },
  total: { label: "Total", value: `${FACTS.proofTotal} (cap ${FACTS.proofCap})` },
} as const;

const abs = (p: { x: number; y: number }): React.CSSProperties => ({ position: "absolute", left: p.x * K, top: p.y * K });

/** Placeholder for the `proof` slot. factsIn: the three docked facts; hiddenIn: the hidden line; line: the line under the card. */
export function ProofPlaceholder({ factsIn, hiddenIn, line }: { factsIn: number; hiddenIn: number; line: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.void, fontFamily: FONT, color: C.fg }}>
      <div style={{ ...abs(CARD), width: CARD.w * K, height: CARD.h * K, borderRadius: 16 * K, background: "rgba(255,255,255,0.05)" }} />
      {PROOF_ACCEPTED && (
        <div style={{ position: "absolute", left: (CARD.x + CARD.w - 16) * K, top: (CARD.y - 12) * K, transform: "translateX(-100%)" }}>
          <Badge kind="verified" s={K * 1.1} icon={<ShieldGlyph size={12 * K} color={C.paid} />} style={{ background: C.void }} />
        </div>
      )}
      <SmallLine k={K} color={C.fg2} weight={500} style={abs({ x: 34, y: 34 })}>What every friend sees</SmallLine>
      <FactBlock k={K} {...FACT_VALUES.booked} style={abs(FACT_AT.booked)} />
      <FactBlock k={K} {...FACT_VALUES.dates} style={{ ...abs(FACT_AT.dates), opacity: factsIn }} />
      <FactBlock k={K} {...FACT_VALUES.guests} style={{ ...abs(FACT_AT.guests), opacity: factsIn }} />
      <FactBlock k={K} {...FACT_VALUES.total} style={{ ...abs(FACT_AT.total), opacity: factsIn }} />
      <div style={{ position: "absolute", left: 34 * K, top: 166 * K, width: 348 * K, borderTop: `${K}px dashed ${C.lineStrong}` }} />
      <SmallLine k={K} color={C.fg3} style={{ ...abs(FACT_AT.hidden), opacity: hiddenIn }}>{HIDDEN_TEXT}</SmallLine>
      <div
        style={{
          ...abs(LINE),
          width: LINE.w * K,
          boxSizing: "border-box",
          padding: `${12 * K}px ${16 * K}px`,
          borderRadius: 16 * K,
          background: PROOF_ACCEPTED ? hexA(C.paid, 0.1) : "rgba(255,255,255,0.05)",
          color: PROOF_ACCEPTED ? C.paid : C.fg2,
          fontSize: 14 * K,
          lineHeight: 1.5,
          opacity: line,
          transform: `translateY(${(1 - line) * 8 * K}px)`,
          filter: line < 1 ? `blur(${(1 - line) * 6}px)` : undefined,
        }}
      >
        {PROOF_ACCEPTED ? PAID_LINE : PENDING_LINE}
      </div>
    </div>
  );
}
