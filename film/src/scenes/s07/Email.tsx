import React from "react";
import { C, DISPLAY, FACTS, FONT, GLASS, MONO, PROOF_ACCEPTED } from "../../tokens";
import { MailGlyph, ShieldGlyph } from "./glyphs";

/* The booking.com confirmation as a glass email card (film px). The same card morphs into the inbox row:
   `w`/`h`/`radius` drive the container, `chrome` fades glass (1) to the row's white/5 fill (0), and the content
   scales with the container so it reads as being filed away. */
export const EW = 760;
export const EH = 420;
const PAD = 38;

/** Where the body facts sit (offsets from the card centre to the start of each fact's text line, design px). */
export const BODY_AT = {
  dates: { x: -EW / 2 + PAD, y: 89 },
  guests: { x: -EW / 2 + PAD + 362, y: 89 },
  total: { x: -EW / 2 + PAD, y: 125 },
} as const;

const Bar = ({ w }: { w: number }) => (
  <span style={{ display: "inline-block", width: w, height: 14, borderRadius: 99, background: C.fg3, verticalAlign: "middle" }} />
);

/* The real sin1025 confirmation, redacted: guest name, hotel/address and booking reference are bars, never text. */
const BODY: React.ReactNode[] = [
  <Bar key="a" w={300} />,
  <Bar key="b" w={470} />,
  `${FACTS.proofDates} · ${FACTS.proofNights} night · ${FACTS.proofGuests} guests`,
  <>
    Total {FACTS.proofTotal} · ref <Bar w={140} />
  </>,
];

export function EmailCard({
  w = EW,
  h = EH,
  radius = 36,
  chrome = 1,
  content = 1,
  blur = 2.2,
  bodyO = 1,
  sheen = -1,
  seal = 0,
}: {
  w?: number;
  h?: number;
  radius?: number;
  chrome?: number;
  content?: number;
  /** body blur in px */
  blur?: number;
  bodyO?: number;
  /** sheen band position 0..1 across the card; outside that range it is off */
  sheen?: number;
  /** small seal next to the sender, 0..1 (green only once the proof is accepted on chain) */
  seal?: number;
}) {
  const k = Math.min(w / EW, h / EH);
  return (
    <div style={{ width: w, height: h, position: "relative", borderRadius: radius, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: radius, background: "rgba(255,255,255,0.05)", opacity: 1 - chrome }} />
      <div style={{ ...GLASS, position: "absolute", inset: 0, borderRadius: radius, opacity: chrome }} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: EW,
          height: EH,
          padding: PAD,
          boxSizing: "border-box",
          transform: `translate(-50%, -50%) scale(${k})`,
          opacity: content,
          fontFamily: FONT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, height: 64 }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(255,255,255,0.07)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <MailGlyph size={30} color={C.fg} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, height: 33 }}>
              <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.015em", color: C.fg, lineHeight: 1.1 }}>booking.com</span>
              <span style={{ display: "inline-flex", opacity: seal, transform: `scale(${0.5 + 0.5 * seal})` }}>
                <ShieldGlyph size={28} color={PROOF_ACCEPTED ? C.paid : C.fg} />
              </span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 22, color: C.fg2, lineHeight: 1.2 }}>to {FACTS.proofInbox}</span>
          </div>
        </div>
        <div style={{ ...DISPLAY, fontSize: 46, color: C.fg, marginTop: 28, whiteSpace: "nowrap" }}>Your booking is confirmed</div>
        <div style={{ height: 1, background: C.line, marginTop: 22 }} />
        <div style={{ marginTop: 22, fontSize: 22, lineHeight: "36px", color: C.fg2, filter: `blur(${blur}px)`, opacity: bodyO, whiteSpace: "nowrap" }}>
          {BODY.map((b, i) => (
            <div key={i}>{b}</div>
          ))}
        </div>
      </div>
      {sheen > 0 && sheen < 1 && (
        <div
          style={{
            position: "absolute",
            top: -60,
            bottom: -60,
            width: 300,
            left: -360 + sheen * (w + 420),
            transform: "skewX(-18deg)",
            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.11) 50%, rgba(255,255,255,0) 100%)",
          }}
        />
      )}
    </div>
  );
}
