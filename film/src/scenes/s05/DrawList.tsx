import React from "react";
import { C, FONT, GLASS, PEOPLE } from "../../tokens";
import { Face } from "../../components/LetterFace";
import { Badge, ChainTag, hexA } from "../../components/Surfaces";
import { BedRow, LIST_W, ROW_H, type Row } from "../../components/Trip";

/* Local variant of Trip.tsx BedList/BedRow for the draw. A row with no effects renders the shared <BedRow/> itself,
   so rest states are pixel-identical to the H4/H5 poses; a row with effects renders the same layout plus:
   badge glow (the green wave), lock flash, the "you" ring, and a reel in the sub-line slot. */

/** One layer in the sub-line slot: either the row's original sub content or a bed name. */
export type Layer = { y: number; opacity: number; blur: number; text?: string; color?: string; sub?: Row["sub"] };
export type RowFx = { glow?: number; flash?: number; ring?: number; layers?: Layer[] };

function SubContent({ sub }: { sub: Row["sub"] }) {
  return (
    <>
      {sub?.kind === "chain" && <ChainTag chain={sub.chain} s={1.4} />}
      {sub?.kind === "text" && <span style={{ fontSize: 17.5, color: sub.color ?? C.fg2 }}>{sub.text}</span>}
      {sub?.kind === "bed" && <span style={{ fontSize: 17.5, color: C.fg }}>{sub.bed}</span>}
    </>
  );
}

function FxRow({ row, fx }: { row: Row; fx: RowFx }) {
  const p = PEOPLE[row.who];
  const g = fx.glow ?? 0;
  const ring = fx.ring ?? 0;
  const flash = fx.flash ?? 0;
  const bg = ring > 0 ? hexA(C.you, 0.06 * ring) : `rgba(255,255,255,${0.05 * flash})`;
  const glowStyle: React.CSSProperties | undefined =
    g > 0
      ? {
          background: hexA(C.paid, 0.15 + 0.2 * g),
          border: `1.45px solid ${hexA(C.paid, 0.25 + 0.5 * g)}`,
          boxShadow: `0 0 ${22 * g}px ${hexA(C.paid, 0.42 * g)}`,
          transform: `scale(${1 + 0.07 * g})`,
        }
      : undefined;
  return (
    <div
      style={{
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 20px",
        borderRadius: 22,
        background: bg,
        boxShadow: ring > 0 ? `inset 0 0 0 2px ${hexA(C.you, 0.9 * ring)}, 0 0 30px -8px ${hexA(C.you, 0.45 * ring)}` : undefined,
        position: "relative",
      }}
    >
      <Face id={row.who} size={52} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: C.fg, letterSpacing: "-0.01em" }}>{p.name}</span>
          {row.you && <span style={{ fontSize: 15, fontWeight: 600, color: C.you, background: "rgba(250,204,21,0.15)", borderRadius: 99, padding: "1px 9px" }}>you</span>}
          <span style={{ fontSize: 17, color: C.fg3, fontVariantNumeric: "tabular-nums" }}>bed {String(row.n).padStart(2, "0")}</span>
        </div>
        {fx.layers ? (
          <div style={{ marginTop: 3, height: 24, position: "relative", overflow: "hidden" }}>
            {fx.layers.map((l, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  opacity: l.opacity,
                  transform: l.y ? `translateY(${l.y}px)` : undefined,
                  filter: l.blur > 0.01 ? `blur(${l.blur}px)` : undefined,
                }}
              >
                {l.sub ? <SubContent sub={l.sub} /> : <span style={{ fontSize: 17.5, color: l.color ?? C.fg }}>{l.text}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 3, height: 24, display: "flex", alignItems: "center" }}>
            <SubContent sub={row.sub} />
          </div>
        )}
      </div>
      {row.status === "pay" ? (
        <span style={{ height: 46, padding: "0 20px", borderRadius: 99, background: C.fg, color: C.void, fontFamily: FONT, fontWeight: 600, fontSize: 19, display: "inline-flex", alignItems: "center" }}>Pay $40</span>
      ) : (
        <Badge kind={row.status} s={1.45} style={glowStyle} />
      )}
    </div>
  );
}

/** "The beds" glass list, same box as BedList (width LIST_W, rows of ROW_H, hairline separators). */
export function DrawList({ items }: { items: { row: Row; fx?: RowFx }[] }) {
  return (
    <div style={{ ...GLASS, width: LIST_W, padding: 8, borderRadius: 30 }}>
      {items.map(({ row, fx }, i) => (
        <div key={row.n} style={{ position: "relative" }}>
          {fx ? <FxRow row={row} fx={fx} /> : <BedRow row={row} />}
          {i < items.length - 1 && <div style={{ position: "absolute", bottom: 0, left: 90, right: 20, height: 1, background: C.line }} />}
        </div>
      ))}
    </div>
  );
}
