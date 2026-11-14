import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, DISPLAY, OE } from "../tokens";

/* The app's word sweep (motion.css .sweep-word): each word goes opacity 0→1, blur 8px→0, y 8px→0 over 0.55 s with --oe.
   Two tones: the statement in fg, the continuation in fg2. Words can be timed to narration (`at`) or staggered (`stagger`).
   `out` sweeps the whole block away (opacity + blur + small lift) starting at that frame. */
export type SweepLine = { text: string; tone?: "fg" | "fg2"; at?: number[] };

export function Sweep({
  lines,
  start = 0,
  stagger = 3,
  size = 72,
  align = "center",
  out,
  outDur = 12,
  width,
  style,
  lineGap = 0,
}: {
  lines: SweepLine[];
  start?: number;
  stagger?: number;
  size?: number;
  align?: "center" | "left";
  out?: number;
  outDur?: number;
  width?: number;
  style?: React.CSSProperties;
  lineGap?: number;
}) {
  const frame = useCurrentFrame();
  let n = 0;
  const outP = out === undefined ? 0 : interpolate(frame, [out, out + outDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
  return (
    <div
      style={{
        ...DISPLAY,
        fontSize: size,
        textAlign: align,
        width,
        opacity: 1 - outP,
        filter: outP > 0 ? `blur(${outP * 10}px)` : undefined,
        transform: `translateY(${-outP * 12}px)`,
        ...style,
      }}
    >
      {lines.map((ln, li) => {
        const words = ln.text.split(" ");
        return (
          <div key={li} style={{ color: ln.tone === "fg2" ? C.fg2 : C.fg, marginTop: li ? lineGap : 0 }}>
            {words.map((w, wi) => {
              const f0 = ln.at?.[wi] ?? start + n * stagger;
              n++;
              const p = interpolate(frame, [f0, f0 + 16.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    opacity: p,
                    filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
                    transform: `translateY(${(1 - p) * 8 * (size / 48)}px)`,
                    marginRight: wi < words.length - 1 ? "0.25em" : 0,
                    whiteSpace: "pre",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
