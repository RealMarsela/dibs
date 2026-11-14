import React from "react";
import { AbsoluteFill } from "remotion";
import { C, GLASS } from "../../tokens";
import { BedRow, LIST_W, ROW_H, type Row } from "../../components/Trip";
import { Centre } from "../../handoffs";

/* "The beds" list exactly as BedList draws it (handoffs H3/H4), but with the glass and each row on their own
   opacity, so rows can dim, fade and assemble. Centred at (960, 540) like the poses. */
export const LIST_OUTER_H = rows8H();
function rows8H() {
  return 8 * ROW_H + 16 + 2;
}
/** Screen centre of row n's box (content-box list: 1 px border + 8 px padding above the first row). */
export const rowY = (n: number) => 540 - LIST_OUTER_H / 2 + 1 + 8 + (n - 1) * ROW_H + ROW_H / 2;
/* The film renders border-box: LIST_W is the outer width, so rows start 1 + 8 px inside it and are LIST_W - 18 wide. */
export const ROW_LEFT = 960 - LIST_W / 2 + 9;
export const ROW_W = LIST_W - 18;
/** Screen centre of the face in row n (BedRow: 20 px padding, 52 px face). */
export const rowFace = (n: number) => ({ x: ROW_LEFT + 20 + 26, y: rowY(n) });

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
        <div style={{ position: "relative" }}>
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
