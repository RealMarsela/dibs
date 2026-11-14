import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, GLASS, MONO, OE } from "../../tokens";
import { V } from "./variant";
import type { T } from "./timing";

/* Variant B's honest caption: a glass pill under the pay window (clear space between the window's bottom edge and the
   safe margin, never over dialog text). It sweeps in on "testnet" and sweeps out as the window starts its shrink. */
export const CHIP_Y = 945;

export function TestnetChip({ f, t }: { f: number; t: T }) {
  if (V !== "B") return null;
  const inP = interpolate(f, [t.tail.chipAt, t.tail.chipAt + 16.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
  const outP = interpolate(f, [t.shrink0 - 4, t.shrink0 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
  const p = inP * (1 - outP);
  if (p <= 0) return null;
  return (
    <AbsoluteFill>
      <div
        style={{
          ...GLASS,
          position: "absolute",
          left: 960,
          top: CHIP_Y,
          transform: `translate(-50%, -50%) translateY(${(1 - inP) * 10 - outP * 10}px)`,
          opacity: p,
          filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
          height: 60,
          padding: "0 30px",
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          whiteSpace: "nowrap",
          fontFamily: MONO,
          fontSize: 26,
          letterSpacing: "-0.01em",
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 99, background: C.fg2 }} />
        <span style={{ color: C.fg }}>NEAR testnet</span>
        <span style={{ color: C.fg2 }}>· a faucet stands in for 1Click</span>
      </div>
    </AbsoluteFill>
  );
}
