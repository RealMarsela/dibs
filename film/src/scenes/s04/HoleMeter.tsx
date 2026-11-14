import React from "react";
import { AbsoluteFill } from "remotion";
import { C, DISPLAY, IN_OUT_STRONG, OE } from "../../tokens";
import { prog } from "../../lib/anim";
import { mixHex } from "./Sheet";
import type { TT } from "./time";

/* The funding meter (trip/funding-meter.tsx) for "that would leave the trip short": eight cells, all green while
   every bed is paid; Ana's cell 04 empties into a pulsing hole (the rest fall back to white: no longer all paid),
   then refills when the contract keeps her $40. Cell 04 then becomes the ticket (drawn by the scene). */
export const MY = 700;
const MW = 1200;
export const CH = 26;
const GAP = 12;
export const CW = (MW - GAP * 7) / 8;
export const cellX = (i: number) => 960 - MW / 2 + i * (CW + GAP) + CW / 2;

/** Cell 04 fill (0 empty, 1 full) and green amount, shared with the morph so the hand-off matches. */
export function meterState(T: TT) {
  const { f } = T;
  const fill = 1 - prog(f, T.hole, 12) + prog(f, T.refill, 12);
  const green = 1 - prog(f, T.hole + 4, 10) + prog(f, T.refill + 2, 10);
  return { fill, green: Math.min(1, Math.max(0, green)) };
}

export function HoleMeter({ T }: { T: TT }) {
  const { f } = T;
  const { fill, green } = meterState(T);
  const empty = f >= T.hole + 6 && f < T.refill + 8 ? 1 : 0;
  const pulse = empty * (0.5 - 0.5 * Math.cos(((f - T.hole - 6) / 18) * Math.PI * 2));
  const holeOn = prog(f, T.hole + 4, 8) * (1 - prog(f, T.refill, 8));
  const col = mixHex(C.fg, C.paid, green);
  return (
    <AbsoluteFill>
      {Array.from({ length: 8 }, (_, i) => {
        if (i === 3 && f >= T.morph) return null;
        const a = prog(f, T.meterIn + i * 2, 14);
        const out = i === 3 ? 0 : prog(f, T.morph - 8 + Math.abs(i - 3) * 1.5, 16, IN_OUT_STRONG);
        const x = cellX(i) - out * 120;
        const sc = i === 3 ? fill : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - CW / 2,
              top: MY - CH / 2 + (1 - a) * 18,
              width: CW,
              height: CH,
              borderRadius: 999,
              overflow: "hidden",
              opacity: a * (1 - out),
              background: i === 3 ? `rgba(251,146,60,${0.07 + 0.16 * pulse * holeOn})` : "rgba(255,255,255,0.07)",
              boxShadow: i === 3 && holeOn > 0 ? `0 0 0 3px ${C.void}, 0 0 0 5px rgba(251,146,60,${(0.3 + 0.45 * pulse) * holeOn})` : undefined,
            }}
          >
            <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: col, transform: `scaleX(${sc})`, transformOrigin: "left" }} />
          </div>
        );
      })}
      <ShortLine T={T} />
    </AbsoluteFill>
  );
}

const WORDS: { w: string; tone: "fg" | "fg2" }[] = [
  { w: "7", tone: "fg" },
  { w: "of", tone: "fg" },
  { w: "8", tone: "fg" },
  { w: "paid.", tone: "fg" },
  { w: "The", tone: "fg2" },
  { w: "trip", tone: "fg2" },
  { w: "would", tone: "fg2" },
  { w: "be", tone: "fg2" },
  { w: "short.", tone: "fg2" },
];

/** Two-tone line under the meter, the app's word sweep in, a soft sweep out. */
function ShortLine({ T }: { T: TT }) {
  const { f } = T;
  if (f < T.lineIn || f > T.lineOut + 14) return null;
  const out = prog(f, T.lineOut, 12, OE);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 800 - 32,
        textAlign: "center",
        ...DISPLAY,
        fontSize: 56,
        opacity: 1 - out,
        filter: out > 0 ? `blur(${out * 10}px)` : undefined,
        transform: `translateY(${-out * 12}px)`,
        whiteSpace: "nowrap",
      }}
    >
      {WORDS.map((wd, i) => {
        const p = prog(f, T.lineIn + i * 2, 16.5, OE);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: wd.tone === "fg" ? C.fg : C.fg2,
              opacity: p,
              filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
              transform: `translateY(${(1 - p) * 9}px)`,
              marginRight: i < WORDS.length - 1 ? "0.25em" : 0,
            }}
          >
            {wd.w}
          </span>
        );
      })}
    </div>
  );
}

