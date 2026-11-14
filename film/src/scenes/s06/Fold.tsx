import React from "react";
import { C, FONT, GLASS, PEOPLE } from "../../tokens";
import { LIST_W, ROW_H, ROWS_DRAWN, type Row } from "../../components/Trip";
import { Badge } from "../../components/Surfaces";
import { prog } from "../../lib/anim";

/* H5 taken apart: the same glass list (identical geometry to BedList) with each face slot left empty, because S06
   flies the faces on their own layer (Crew.tsx). The rows fold up (rx -70 about their top edge, fade) top to bottom,
   2 frames apart, while the glass panel fades. */

function RowNoFace({ row }: { row: Row }) {
  const p = PEOPLE[row.who];
  return (
    <div style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 18, padding: "0 20px", borderRadius: 22, background: "rgba(255,255,255,0)", position: "relative" }}>
      <div style={{ width: 52, height: 52, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: C.fg, letterSpacing: "-0.01em" }}>{p.name}</span>
          <span style={{ fontSize: 17, color: C.fg3, fontVariantNumeric: "tabular-nums" }}>bed {String(row.n).padStart(2, "0")}</span>
        </div>
        <div style={{ marginTop: 3, height: 24, display: "flex", alignItems: "center" }}>
          {row.sub?.kind === "bed" && <span style={{ fontSize: 17.5, color: C.fg }}>{row.sub.bed}</span>}
        </div>
      </div>
      {row.status !== "pay" && <Badge kind={row.status} s={1.45} />}
    </div>
  );
}

export function FoldList({ f }: { f: number }) {
  const bg = prog(f, 6, 24);
  const n = ROWS_DRAWN.length;
  return (
    <div style={{ position: "absolute", left: 960, top: 540, transform: "translate(-50%, -50%)" }}>
      {bg < 1 && <div style={{ ...GLASS, position: "absolute", inset: 0, borderRadius: 30, opacity: 1 - bg, transform: `scale(${1 - 0.03 * bg})` }} />}
      <div style={{ width: LIST_W, padding: 8, borderRadius: 30, border: "1px solid transparent", position: "relative" }}>
        {ROWS_DRAWN.map((r, i) => {
          const p = prog(f, 1 + 2 * i, 16); // top row first, 2 frames apart
          const o = 1 - prog(f, 1 + 2 * i, 10);
          return (
            <div key={r.n} style={{ position: "relative" }}>
              <div style={{ transform: p > 0 ? `perspective(900px) rotateX(${-70 * p}deg)` : undefined, transformOrigin: "50% 0%", opacity: o }}>
                <RowNoFace row={r} />
              </div>
              {i < n - 1 && <div style={{ position: "absolute", bottom: 0, left: 90, right: 20, height: 1, background: C.line, opacity: o }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
