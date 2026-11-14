import React from "react";
import { AbsoluteFill } from "remotion";
import { C, CARD_W, FACTS, INBOX_SCALE, LIST_SCALE, PROOF_ACCEPTED } from "./tokens";
import { Face } from "./components/LetterFace";
import { Meter } from "./components/Meter";
import { BedList, InboxPanel, ROWS_ALL_PAID, ROWS_DRAWN, ROWS_RESOLD, TripCard } from "./components/Trip";
import { Display } from "./components/Surfaces";

/* Seam poses. Scene N's LAST frame renders exactly <Hn/> (plus World), and scene N+1's FIRST frame renders exactly <Hn/>.
   Positions are absolute film px (1920 x 1080). Do not change a pose without changing both scenes that share it. */

/** Centre a fixed-size box at (cx, cy). */
export const Centre = ({ cx, cy, children }: { cx: number; cy: number; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: cx, top: cy, transform: "translate(-50%, -50%)" }}>{children}</div>
);

/** H1 S01→S02 @228: Maya's face alone, 132 px at (960, 420), the hero's orange glow and void ring. */
export const H1 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={420}>
      <Face id="maya" size={132} ring={C.void} style={{ boxShadow: `0 0 0 6px ${C.void}, 0 24px 64px -14px rgba(251,146,60,0.55)` }} />
    </Centre>
  </AbsoluteFill>
);

/** H2 S02→S03: the funding meter (1500 x 28, gap 14, centred on y=610; 7 paid white, bed 03 hatched orange, ringed)
    under the two-tone line "7 of 8 paid. 1 to go before anyone can book." at 76 px centred on y=470. (v2 scale) */
export const H2_LINE = { size: 76, cy: 470 } as const;
export const H2_METER = { width: 1500, height: 28, gap: 14, cy: 610 } as const;
export const H2 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={H2_LINE.cy}>
      <Display size={H2_LINE.size} style={{ whiteSpace: "nowrap" }}>
        7 of 8 paid. <span style={{ color: C.fg2 }}>1 to go before anyone can book.</span>
      </Display>
    </Centre>
    <Centre cx={960} cy={H2_METER.cy}>
      <Meter state={["paid", "paid", "held", "paid", "paid", "paid", "paid", "paid"]} width={H2_METER.width} height={H2_METER.height} gap={H2_METER.gap} highlight={2} />
    </Centre>
  </AbsoluteFill>
);

/** H3 S03→S04 @1104: "The beds" list, all eight paid (Leo now USDC on Base), centred at (960, 540). */
export const H3 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <div style={{ transform: `scale(${LIST_SCALE})` }}>
        <BedList rows={ROWS_ALL_PAID} />
      </div>
    </Centre>
  </AbsoluteFill>
);

/** H4 S04→S05 @1521: the same list with Priya in bed 04. */
export const H4 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <div style={{ transform: `scale(${LIST_SCALE})` }}>
        <BedList rows={ROWS_RESOLD} />
      </div>
    </Centre>
  </AbsoluteFill>
);

/** H5 S05→S06 @1782: the list after the draw (every row shows its bed). */
export const H5 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <div style={{ transform: `scale(${LIST_SCALE})` }}>
        <BedList rows={ROWS_DRAWN} />
      </div>
    </Centre>
  </AbsoluteFill>
);

/** H6 S06→S07: the trip card, flat and front-on, CARD_W (1000) px wide, centred at (960, 540). (v2 scale) */
export const H6 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <TripCard width={CARD_W} />
    </Centre>
  </AbsoluteFill>
);

/** H7 S07→S08: trip sin1025's inbox (the REAL booking) with the booking.com email, scaled INBOX_SCALE, centred.
    Its status is "Received" until PROOF_ACCEPTED (coordinator's word that the live proof was accepted on chain). */
export const H7_ITEM = { from: "booking.com", subject: "Your booking is confirmed", status: PROOF_ACCEPTED ? "verified" : "received" } as const;
export const H7 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <div style={{ transform: `scale(${INBOX_SCALE})` }}>
        <InboxPanel address={FACTS.proofInbox} items={[H7_ITEM]} />
      </div>
    </Centre>
  </AbsoluteFill>
);

/** H8 S08→S09: "35 attacks. Every one refused." 88 px two-tone, centred at (960, 540). (v2 scale) */
export const H8_SIZE = 88;
export const H8 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <Display size={H8_SIZE} style={{ whiteSpace: "nowrap" }}>
        35 attacks. <span style={{ color: C.fg2 }}>Every one refused.</span>
      </Display>
    </Centre>
  </AbsoluteFill>
);
