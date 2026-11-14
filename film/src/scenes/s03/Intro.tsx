import React from "react";
import { AbsoluteFill } from "remotion";
import { C, EASE, FONT, IN_OUT_STRONG, OE } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { Centre } from "../../handoffs";
import { Display } from "../../components/Surfaces";
import { Face } from "../../components/LetterFace";
import { ROW_H } from "../../components/Trip";
import { K, type T } from "./timing";

/* H2 -> Leo's row. The line sweeps out, the seven paid cells fall away (the camera pushes toward bed 03), and cell 03
   grows into Leo's bed row on a glass card at K x. Then "Pay $40" presses on "pays". */

const CW = 139.5; // (1200 - 12 * 7) / 8, the H2 meter cell
const cellX = (i: number) => 360 + i * (CW + 12);
const C3 = { x: cellX(2), y: 609, w: CW, h: 22 };
const CARD = { w: 878 * K, h: 102 * K };
const CARD_RECT = { x: 960 - CARD.w / 2, y: 540 - CARD.h / 2 };
const HATCH = `repeating-linear-gradient(135deg, ${C.due} 0 4px, transparent 4px 12px)`;

/** Local BedRow variant (components/Trip.tsx) for Leo before he pays, with a pressable "Pay $40" pill. */
function LeoRow({ press }: { press: number }) {
  return (
    <div style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 18, padding: "0 20px", borderRadius: 22 }}>
      <Face id="leo" size={52} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: C.fg, letterSpacing: "-0.01em" }}>Leo</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.you, background: "rgba(250,204,21,0.15)", borderRadius: 99, padding: "1px 9px" }}>you</span>
          <span style={{ fontSize: 17, color: C.fg3, fontVariantNumeric: "tabular-nums" }}>bed 03</span>
        </div>
        <div style={{ marginTop: 3, height: 24, display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 17.5, color: C.due }}>Held, not paid yet</span>
        </div>
      </div>
      <span
        style={{
          height: 46,
          padding: "0 20px",
          borderRadius: 99,
          background: C.fg,
          color: C.void,
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 19,
          display: "inline-flex",
          alignItems: "center",
          transform: `scale(${1 - 0.04 * press})`,
          boxShadow: `0 0 0 ${6 * press}px rgba(236,236,234,${0.18 * press})`,
        }}
      >
        Pay $40
      </span>
    </div>
  );
}

export function Intro({ f, t }: { f: number; t: T }) {
  if (f > t.win1 + 4) return null;
  const out = prog(f, t.lineOut, 12, OE);
  const m = prog(f, t.morph0, t.morph1 - t.morph0, IN_OUT_STRONG);
  const away = prog(f, t.lineOut, 16, EASE);
  const press = Math.sin(prog(f, t.press, 9, IN_OUT_STRONG) * Math.PI);
  const cardOut = prog(f, t.win0 + 6, 12, EASE);
  const hatch = 1 - prog(m, 0, 0.45);
  const h = lerp(C3.h, CARD.h, m);
  const content = prog(m, 0.45, 0.55);
  const r = Math.min(h / 2, 30 * K);
  return (
    <AbsoluteFill>
      {out < 1 && (
        <Centre cx={960} cy={500}>
          <Display size={60} style={{ whiteSpace: "nowrap", opacity: 1 - out, filter: out > 0 ? `blur(${out * 10}px)` : undefined, transform: `translateY(${-out * 12}px)` }}>
            7 of 8 paid. <span style={{ color: C.fg2 }}>1 to go before anyone can book.</span>
          </Display>
        </Centre>
      )}
      {away < 1 &&
        [0, 1, 3, 4, 5, 6, 7].map((i) => {
          const cx = cellX(i) + CW / 2;
          const dx = (cx - (C3.x + CW / 2)) * 0.7 * away;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cellX(i),
                top: C3.y,
                width: CW,
                height: C3.h,
                borderRadius: 999,
                overflow: "hidden",
                background: "rgba(255,255,255,0.07)",
                opacity: 1 - away,
                transform: `translate(${dx}px, ${-80 * away}px) scale(${1 + 0.35 * away})`,
                filter: away > 0 ? `blur(${away * 6}px)` : undefined,
              }}
            >
              <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: C.fg }} />
            </div>
          );
        })}
      <div
        style={{
          position: "absolute",
          left: lerp(C3.x, CARD_RECT.x, m),
          top: lerp(C3.y, CARD_RECT.y, m),
          width: lerp(C3.w, CARD.w, m),
          height: h,
          boxSizing: "border-box",
          borderRadius: r,
          overflow: "hidden",
          background: `rgba(${lerp(255, 40, m)}, ${lerp(255, 40, m)}, ${lerp(255, 39, m)}, ${lerp(0.07, 0.74, m)})`,
          border: `1px solid rgba(255,255,255,${0.08 * m})`,
          backdropFilter: m > 0.3 ? "blur(24px) saturate(1.2)" : undefined,
          boxShadow: `0 0 0 3px rgba(14,14,14,${1 - m}), 0 0 0 5px rgba(251,146,60,${0.55 * (1 - m)}), 0 1px 0 rgba(255,255,255,${0.05 * m}) inset, 0 24px 60px -24px rgba(0,0,0,${0.7 * m})`,
          opacity: 1 - cardOut,
          transform: `translateY(${cardOut * 24}px) scale(${1 - 0.04 * cardOut})`,
        }}
      >
        {hatch > 0 && <div style={{ position: "absolute", inset: 0, opacity: 0.6 * hatch, background: HATCH }} />}
        {content > 0 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 860, padding: 8, opacity: content, transform: `translate(-50%, -50%) scale(${K * lerp(0.92, 1, content)})` }}>
            <LeoRow press={press} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
