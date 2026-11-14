import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, EASE } from "../tokens";

/* FundingMeter (trip/funding-meter.tsx): one rounded cell per bed. White when paid, all green once every bed is,
   hatched orange while held, sky while for resale. `state[i]` per bed; `fillAt[i]` = frame the fill sweeps in. */
export type CellState = "paid" | "held" | "listed" | "open";

export function Meter({ state, fillAt = [], width = 1200, height = 22, gap = 12, allGreenAt, highlight, style }: {
  state: CellState[];
  fillAt?: (number | undefined)[];
  width?: number;
  height?: number;
  gap?: number;
  allGreenAt?: number;
  highlight?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const n = state.length;
  const cw = (width - gap * (n - 1)) / n;
  const green = allGreenAt !== undefined ? interpolate(frame, [allGreenAt, allGreenAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <div style={{ display: "flex", gap, width, ...style }}>
      {state.map((st, i) => {
        const fa = fillAt[i];
        const fill = st === "paid" || st === "listed" ? (fa === undefined ? 1 : interpolate(frame, [fa, fa + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE })) : 0;
        const col = st === "listed" ? C.resale : mix(C.fg, C.paid, green);
        return (
          <div key={i} style={{ position: "relative", width: cw, height, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.07)", boxShadow: highlight === i ? `0 0 0 3px ${C.void}, 0 0 0 5px rgba(251,146,60,0.55)` : undefined }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: col, transform: `scaleX(${fill})`, transformOrigin: "left" }} />
            {st === "held" && (
              <div style={{ position: "absolute", inset: 0, opacity: 0.6, background: `repeating-linear-gradient(135deg, ${C.due} 0 4px, transparent 4px 12px)` }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* The strip's battery (landing/strip.tsx): 8 thin bars in a rounded outline with a nub. Scale s. */
export function Battery({ paid, s = 3, allGreen }: { paid: number; s?: number; allGreen?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 18 * s, borderRadius: 6 * s, border: `${1.5 * s}px solid ${C.fg2}`, padding: 2 * s }}>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ margin: `0 ${0.5 * s}px`, height: "100%", width: 4 * s, borderRadius: 1.5 * s, background: i < paid ? (allGreen ? C.paid : C.fg) : "rgba(255,255,255,0.12)" }} />
      ))}
      <span style={{ marginRight: -5 * s, marginLeft: 2 * s, height: 7 * s, width: 2 * s, borderRadius: `0 ${s}px ${s}px 0`, background: C.fg2 }} />
    </span>
  );
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
