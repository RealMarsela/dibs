import React from "react";
import { spring } from "remotion";
import { C, FONT, GLASS, OUT_STRONG, SPRING } from "../../tokens";
import { hexA } from "../../components/Surfaces";
import { kf, prog } from "../../lib/anim";
import { CheckGlyph, EyeOffGlyph, KeyGlyph, LinkGlyph, SpinnerGlyph } from "./glyphs";

/* One proof layer as a glass tile. Pending: grey disc with the app's spinning loader.
   Lit while the proof is NOT accepted on chain (`pass` false): a white "active" step, the disc shows the layer's own
   glyph (key = DKIM signature, eye-off = private read, link = on-chain check). Never green, never a check mark.
   Lit once accepted (`pass` true): the app's done state, green disc with a drawn check.
   Each tile engages in its own quiet way: ring (the signature), bloom (the private read), stamp (the chain). */
export const TW = 800;
export const TH = 160;
export type Accent = "ring" | "bloom" | "stamp";
const GLYPH = { ring: KeyGlyph, bloom: EyeOffGlyph, stamp: LinkGlyph } as const;

export function CheckTile({ title, sub, f, lightAt, accent, pass, chip, chipAt = 0 }: {
  title: string;
  sub: string;
  f: number;
  lightAt: number;
  accent: Accent;
  pass: boolean;
  /** small true chip on the tile's top edge (e.g. the local DKIM result) */
  chip?: string;
  chipAt?: number;
}) {
  const lit = f >= lightAt;
  const p = prog(f, lightAt, 10);
  const draw = prog(f, lightAt + 2, 12);
  const tone = pass ? C.paid : C.fg;
  let discS = 1;
  let ringS = 1;
  let ringO = 0;
  let bloom = 0;
  if (accent === "ring") {
    const q = prog(f, lightAt, 24, OUT_STRONG);
    ringS = 1 + q * 1.2;
    ringO = lit ? 0.5 * (1 - q) : 0;
    discS = 1 + Math.sin(p * Math.PI) * 0.1;
  } else if (accent === "bloom") {
    bloom = kf(f, [lightAt, lightAt + 9, lightAt + 45], [0, 1, 0.25]);
    discS = 1 + Math.sin(p * Math.PI) * 0.06;
  } else if (lit) {
    discS = 1.45 - 0.45 * spring({ frame: f - lightAt, fps: 30, config: SPRING });
  }
  const Glyph = GLYPH[accent];
  const cp = chip ? spring({ frame: f - chipAt, fps: 30, config: SPRING }) : 0;
  return (
    <div
      style={{
        ...GLASS,
        position: "relative",
        width: TW,
        height: TH,
        borderRadius: 32,
        boxSizing: "border-box",
        padding: "0 36px",
        display: "flex",
        alignItems: "center",
        gap: 28,
        fontFamily: FONT,
        border: `1px solid ${lit ? hexA(pass ? C.paid : C.fg, 0.1 + 0.16 * p) : C.line}`,
      }}
    >
      <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
        {accent === "ring" && <div style={{ position: "absolute", inset: 0, borderRadius: 99, border: `3px solid ${tone}`, opacity: ringO, transform: `scale(${ringS})` }} />}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 99,
            display: "grid",
            placeItems: "center",
            background: lit ? tone : "rgba(255,255,255,0.08)",
            transform: `scale(${discS})`,
            boxShadow: lit ? `0 0 ${20 + 46 * bloom}px ${-6 + 8 * bloom}px ${pass ? hexA(C.paid, 0.3 + 0.35 * bloom) : `rgba(236,236,234,${0.12 + 0.3 * bloom})`}` : undefined,
          }}
        >
          {!lit ? <SpinnerGlyph size={32} color={C.fg2} rot={f * 12} /> : pass ? <CheckGlyph size={36} color={C.void} draw={draw} /> : <Glyph size={32} color={C.void} />}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.15, color: mixHex(C.fg2, C.fg, p), whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ fontSize: 23, color: C.fg2, whiteSpace: "nowrap" }}>{sub}</span>
      </div>
      {chip && cp > 0.01 && (
        <span
          style={{
            position: "absolute",
            top: -19,
            right: 30,
            height: 38,
            padding: "0 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 99,
            background: C.void,
            border: `1px solid ${C.lineStrong}`,
            color: C.fg,
            fontSize: 19,
            fontWeight: 600,
            whiteSpace: "nowrap",
            opacity: Math.min(1, cp),
            transform: `scale(${0.7 + 0.3 * cp})`,
            transformOrigin: "100% 50%",
          }}
        >
          <KeyGlyph size={18} color={C.fg2} />
          {chip}
        </span>
      )}
    </div>
  );
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
