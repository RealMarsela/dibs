import React from "react";
import { spring } from "remotion";
import { C, FONT, GLASS, OUT_STRONG, SPRING } from "../../tokens";
import { hexA } from "../../components/Surfaces";
import { kf, prog } from "../../lib/anim";
import { CheckGlyph, SpinnerGlyph } from "./glyphs";

/* One proof check as a glass tile. Pending: grey disc with the app's spinning loader. Lit: green disc with a drawn
   check (the app's ProgressSteps done state). Each tile confirms in its own quiet way:
   ring  = a single green ring breathes out of the disc (the signature),
   bloom = the disc glows up and settles (the private read),
   stamp = the disc lands like a seal with a small overshoot (the chain verdict). */
export const TW = 720;
export const TH = 148;
export type Accent = "ring" | "bloom" | "stamp";

export function CheckTile({ title, sub, f, lightAt, accent }: { title: string; sub: string; f: number; lightAt: number; accent: Accent }) {
  const lit = f >= lightAt;
  const p = prog(f, lightAt, 10);
  const draw = prog(f, lightAt + 2, 12);
  let discS = 1;
  let ringS = 1;
  let ringO = 0;
  let bloom = 0;
  if (accent === "ring") {
    const q = prog(f, lightAt, 24, OUT_STRONG);
    ringS = 1 + q * 1.2;
    ringO = lit ? 0.6 * (1 - q) : 0;
    discS = 1 + Math.sin(p * Math.PI) * 0.1;
  } else if (accent === "bloom") {
    bloom = kf(f, [lightAt, lightAt + 9, lightAt + 45], [0, 1, 0.3]);
    discS = 1 + Math.sin(p * Math.PI) * 0.06;
  } else if (lit) {
    discS = 1.45 - 0.45 * spring({ frame: f - lightAt, fps: 30, config: SPRING });
  }
  return (
    <div
      style={{
        ...GLASS,
        width: TW,
        height: TH,
        borderRadius: 30,
        boxSizing: "border-box",
        padding: "0 34px",
        display: "flex",
        alignItems: "center",
        gap: 26,
        fontFamily: FONT,
        border: `1px solid ${lit ? hexA(C.paid, 0.1 + 0.2 * p) : C.line}`,
      }}
    >
      <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
        {accent === "ring" && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 99, border: `3px solid ${C.paid}`, opacity: ringO, transform: `scale(${ringS})` }} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 99,
            display: "grid",
            placeItems: "center",
            background: lit ? C.paid : "rgba(255,255,255,0.08)",
            transform: `scale(${discS})`,
            boxShadow: lit ? `0 0 ${22 + 46 * bloom}px ${-6 + 8 * bloom}px ${hexA(C.paid, 0.3 + 0.35 * bloom)}` : undefined,
          }}
        >
          {lit ? <CheckGlyph size={34} color={C.void} draw={draw} /> : <SpinnerGlyph size={30} color={C.fg2} rot={f * 12} />}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.15, color: mixHex(C.fg2, C.fg, p), whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ fontSize: 22, color: C.fg2, whiteSpace: "nowrap" }}>{sub}</span>
      </div>
    </div>
  );
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
