import React from "react";
import { AbsoluteFill } from "remotion";
import { C, GLASS, LIST_SCALE } from "../../tokens";
import { BedRow, LIST_W, ROW_H, type Row } from "../../components/Trip";
import { Centre } from "../../handoffs";

/* "The beds" list exactly as BedList draws it (handoffs H3/H4), but with the glass and each row on their own
   opacity, so rows can dim, fade and assemble. Centred at (960, 540) like the poses. */
export const LIST_OUTER_H = rows8H();
function rows8H() {
  return 8 * ROW_H + 16 + 2;
}
/* Poses H3/H4 draw BedList scaled LIST_SCALE about the frame centre. The film renders border-box: LIST_W is the
   outer width, so rows start 1 + 8 px inside it and are LIST_W - 18 wide (before the scale). */
const LS = LIST_SCALE;
const rowY0 = (n: number) => 540 - LIST_OUTER_H / 2 + 1 + 8 + (n - 1) * ROW_H + ROW_H / 2;
/** Screen centre y of row n. */
export const rowY = (n: number) => 540 + (rowY0(n) - 540) * LS;
/** Row box size on screen. */
export const ROW_W = (LIST_W - 18) * LS;
export const ROW_HS = ROW_H * LS;
/** Screen centre of the face in row n (BedRow: 20 px padding, 52 px face), and its on-screen size. */
export const rowFace = (n: number) => ({ x: 960 + (960 - LIST_W / 2 + 9 + 20 + 26 - 960) * LS, y: rowY(n) });
export const ROW_FACE = 52 * LS;

export function List({
  rows,
  rowOpacity,
  rowLift = () => 0,
  glass = 1,
  highlight = 0,
  highlightRow,
  cam = { s: 1, dy: 0 },
  originY = rowY(4),
}: {
  rows: Row[];
  rowOpacity: (n: number) => number;
  rowLift?: (n: number) => number;
  glass?: number;
  highlight?: number;
  highlightRow?: number;
  cam?: { s: number; dy: number };
  originY?: number;
}) {
  return (
    <AbsoluteFill style={{ transform: `translateY(${cam.dy}px) scale(${cam.s})`, transformOrigin: `960px ${originY}px` }}>
      <Centre cx={960} cy={540}>
        <div style={{ position: "relative", transform: `scale(${LS})` }}>
          <div style={{ ...GLASS, position: "absolute", inset: 0, borderRadius: 30, opacity: glass }} />
          <div style={{ width: LIST_W, padding: 8, borderRadius: 30, border: "1px solid transparent", position: "relative" }}>
            {rows.map((r, i) => {
              const o = rowOpacity(r.n);
              return (
                <div key={r.n} style={{ position: "relative", opacity: o, transform: `translateY(${rowLift(r.n)}px)` }}>
                  <BedRow row={r} highlight={highlightRow === r.n ? highlight : 0} />
                  {i < rows.length - 1 && <div style={{ position: "absolute", bottom: 0, left: 90, right: 20, height: 1, background: C.line }} />}
                </div>
              );
            })}
          </div>
        </div>
      </Centre>
    </AbsoluteFill>
  );
}
