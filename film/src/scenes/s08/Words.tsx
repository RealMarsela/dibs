import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, OE } from "../../tokens";
import { Display } from "../../components/Surfaces";
import { Centre } from "../../handoffs";
import type { T08 } from "./data";

/* H8's line swept in word by word (the app's word sweep: opacity, blur 8 px, y 8 px, --oe), laid out exactly like H8:
   one Display line, 72 px, centred at (960, 540), real spaces between words, the continuation in fg2. */
const WORDS = ["35", "attacks.", "Every", "one", "refused."];

export function H8Sweep({ f, t }: { f: number; t: T08 }) {
  if (f < t.words0) return null;
  // Inline spans (not inline-block) so the text shapes and spaces exactly like H8's plain line; the lift uses
  // position: relative, which never touches layout.
  const word = (i: number) => {
    const p = interpolate(f, [t.words0 + i * 2, t.words0 + i * 2 + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
    return (
      <span key={i} style={{ position: "relative", top: (1 - p) * 12, opacity: p, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined }}>
        {WORDS[i]}
      </span>
    );
  };
  return (
    <AbsoluteFill>
      <Centre cx={960} cy={540}>
        <Display size={72} style={{ whiteSpace: "nowrap" }}>
          {word(0)} {word(1)} <span style={{ color: C.fg2 }}>{word(2)} {word(3)} {word(4)}</span>
        </Display>
      </Centre>
    </AbsoluteFill>
  );
}
