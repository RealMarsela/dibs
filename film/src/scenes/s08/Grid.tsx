import React from "react";
import { interpolate } from "remotion";
import { C, MONO, EASE, OE, OUT_STRONG, IN_OUT_STRONG, FACTS } from "../../tokens";
import { Stage, At } from "../../components/Stage";
import { hexA } from "../../components/Surfaces";
import { prog } from "../../lib/anim";
import { CODES, type T08 } from "./data";

/* Shot 3: 35 glass tiles, one real refusal code each (judge-report.json order), flip in one frame apart;
   a rose wave flips every tile to its refused side, then they collapse to the centre for H8.
   7 x 5 grid, 224 x 100 tiles, 14 px gaps: 1652 x 556 at s = 1 (inside the 96 px margin with the tilt). */
const TW = 224;
const TH = 100;
const GAP = 14;
const COLS = 7;
const GRID_Y = -40;
const CAPTION_Y = GRID_Y + (5 * TH + 4 * GAP) / 2 + 54;

/** Break opportunities after underscores so the two longest codes wrap instead of overflowing. */
function codeText(code: string) {
  const parts = code.split("_");
  return parts.map((p, i) => (
    <React.Fragment key={i}>
      {p}
      {i < parts.length - 1 && (
        <>
          _<wbr />
        </>
      )}
    </React.Fragment>
  ));
}

const faceBase: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 12px",
  textAlign: "center",
  fontFamily: MONO,
  fontSize: 20,
  fontWeight: 500,
  lineHeight: 1.25,
  letterSpacing: "-0.01em",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  overflow: "hidden",
};

function Tile({ code, flip }: { code: string; flip: number }) {
  return (
    <div style={{ width: TW, height: TH, position: "relative", transformStyle: "preserve-3d", transform: flip > 0 ? `rotateY(${flip * 180}deg)` : undefined }}>
      <div style={{ ...faceBase, background: C.glass, border: `1px solid ${C.line}`, boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 18px 40px -22px rgba(0,0,0,0.8)", color: C.fg }}>
        {codeText(code)}
      </div>
      <div style={{ ...faceBase, transform: "rotateY(180deg)", background: C.panel, color: C.refused }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: hexA(C.refused, 0.14), border: `1px solid ${hexA(C.refused, 0.3)}` }} />
        <span style={{ position: "relative" }}>{codeText(code)}</span>
      </div>
    </div>
  );
}

export function AttackGrid({ f, t }: { f: number; t: T08 }) {
  if (f < t.grid0 - 1 || f >= t.wordsEnd) return null;
  // Slow push with a slight tilt that keeps turning until the collapse.
  const u = interpolate(f, [t.grid0, t.words0 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cam = { s: 0.95 + 0.05 * u, rx: 6 - 4.5 * u, ry: -4 + 7 * u };
  const capIn = interpolate(f, [t.cap0, t.cap0 + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
  const capOut = prog(f, t.wave0 + 6, 12, EASE);
  const capA = capIn * (1 - capOut);
  return (
    <Stage cam={cam}>
      {CODES.map((code, i) => {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        const x = (c - 3) * (TW + GAP);
        const y = GRID_Y + (r - 2) * (TH + GAP);
        const pin = prog(f, t.grid0 + i, 14, OUT_STRONG); // one frame apart, file order
        const d = r + c; // diagonal wave index, 0..10
        const flip = prog(f, t.wave0 + d, 9, EASE);
        const cs = t.collapse0 + d * 0.4;
        const cp = prog(f, cs, 16, IN_OUT_STRONG);
        const fade = 1 - interpolate(f, [cs + 2, cs + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const a = Math.min(1, pin * 2.2) * fade;
        if (a <= 0.001) return null;
        return (
          <At key={i} x={x * (1 - cp)} y={y * (1 - cp)} z={-160 * (1 - pin)} rx={-90 * (1 - pin)} s={1 - 0.8 * cp} opacity={a}>
            <Tile code={code} flip={flip} />
          </At>
        );
      })}
      {capA > 0.001 && (
        <At y={CAPTION_Y + 8 * (1 - capIn)} opacity={capA}>
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "-0.01em", whiteSpace: "nowrap", color: C.fg3 }}>
            contracts/judge-report.json · <span style={{ color: C.fg2 }}>{FACTS.checksPassed} of {FACTS.checksTotal} checks pass</span>
          </div>
        </At>
      )}
    </Stage>
  );
}
