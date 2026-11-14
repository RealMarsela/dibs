import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "./tokens";
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

/** H2 S02→S03 @570: the funding meter (1200 x 22 at y=620, 7 paid white, bed 03 hatched orange, ringed) under
    the two-tone line "7 of 8 paid. 1 to go before anyone can book." at 60 px centred on y=500. */
export const H2 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={500}>
      <Display size={60} style={{ whiteSpace: "nowrap" }}>
        7 of 8 paid. <span style={{ color: C.fg2 }}>1 to go before anyone can book.</span>
      </Display>
    </Centre>
    <Centre cx={960} cy={620}>
      <Meter state={["paid", "paid", "held", "paid", "paid", "paid", "paid", "paid"]} width={1200} height={22} gap={12} highlight={2} />
    </Centre>
  </AbsoluteFill>
);

/** H3 S03→S04 @1104: "The beds" list, all eight paid (Leo now USDC on Base), centred at (960, 540). */
export const H3 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <BedList rows={ROWS_ALL_PAID} />
    </Centre>
  </AbsoluteFill>
);

/** H4 S04→S05 @1521: the same list with Priya in bed 04. */
export const H4 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <BedList rows={ROWS_RESOLD} />
    </Centre>
  </AbsoluteFill>
);

/** H5 S05→S06 @1782: the list after the draw (every row shows its bed). */
export const H5 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <BedList rows={ROWS_DRAWN} />
    </Centre>
  </AbsoluteFill>
);

/** H6 S06→S07 @2403: the trip card, flat and front-on, 640 px wide, centred at (960, 540). */
export const H6 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <TripCard width={640} />
    </Centre>
  </AbsoluteFill>
);

/** H7 S07→S08 @3093: the trip inbox with the verified booking.com email, centred at (960, 540). */
export const H7 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <InboxPanel items={[{ from: "booking.com", subject: "Your booking is confirmed", status: "verified" }]} />
    </Centre>
  </AbsoluteFill>
);

/** H8 S08→S09 @3381: "35 attacks. Every one refused." 72 px two-tone, centred at (960, 540). */
export const H8 = () => (
  <AbsoluteFill>
    <Centre cx={960} cy={540}>
      <Display size={72} style={{ whiteSpace: "nowrap" }}>
        35 attacks. <span style={{ color: C.fg2 }}>Every one refused.</span>
      </Display>
    </Centre>
  </AbsoluteFill>
);
