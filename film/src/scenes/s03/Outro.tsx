import React from "react";
import { AbsoluteFill } from "remotion";
import { C, GLASS, LIST_SCALE } from "../../tokens";
import { prog } from "../../lib/anim";
import { Centre } from "../../handoffs";
import { BedRow, LIST_W, ROWS_ALL_PAID } from "../../components/Trip";
import type { T } from "./timing";

/* "The beds" list (H3) assembling around the shrinking back face, top to bottom. Same geometry as BedList: a glass box
   (width LIST_W, padding 8, radius 30) and, on top, an identical transparent box holding the rows, so each row can fade on
   its own. Row 03 is left empty: the back face lands there. */
export function Outro({ f, t }: { f: number; t: T }) {
  const s0 = t.shrink0;
  const box = prog(f, s0 + 4, 20);
  if (box <= 0) return null;
  let k = 0;
  return (
    <AbsoluteFill>
      <Centre cx={960} cy={540}>
        <div style={{ transform: `scale(${LIST_SCALE})` }}>
          <div style={{ ...GLASS, width: LIST_W, padding: 8, borderRadius: 30, opacity: box }}>
            <div style={{ height: 84 * 8 }} />
          </div>
        </div>
      </Centre>
      <Centre cx={960} cy={540}>
        <div style={{ transform: `scale(${LIST_SCALE})` }}>
        <div style={{ width: LIST_W, padding: 8, border: "1px solid transparent", borderRadius: 30 }}>
          {ROWS_ALL_PAID.map((r, i) => {
            const mine = r.n === 3;
            const p = mine ? 0 : prog(f, s0 + 8 + 1.5 * k++, 10);
            const sep = mine ? box : p;
            return (
              <div key={r.n} style={{ position: "relative" }}>
                <div style={{ opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
                  <BedRow row={r} />
                </div>
                {i < ROWS_ALL_PAID.length - 1 && <div style={{ position: "absolute", bottom: 0, left: 90, right: 20, height: 1, background: C.line, opacity: sep }} />}
              </div>
            );
          })}
        </div>
        </div>
      </Centre>
    </AbsoluteFill>
  );
}
