import React from "react";
import { spring } from "remotion";
import { C, GLASS, IN_OUT_STRONG, MONO, OE, SPRING } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { H2_METER } from "../../handoffs";
import type { Times } from "./timing";

/* Row geometry in stage coordinates (0,0 = frame centre). Meter cells match H2 exactly (H2_METER: 1500 x 28, gap 14,
   centre y 610). Tiles sit on the meter's line so the squeeze is mostly a height/width collapse. With ry +-6 and pan
   +-16 the outer tile edge stays >= 111 px from the frame edge. */
export const PITCH = 210;
export const FACE_Y = -76; // film y 464
export const TILE = { y: H2_METER.cy - 540, w: 194, h: 136, r: 26 }; // film y 610
const M = H2_METER;
export const CELL = { w: (M.width - M.gap * 7) / 8, h: M.height, y: M.cy - 540 };
export const slotX = (i: number) => (i - 3.5) * PITCH;
export const cellX = (i: number) => -M.width / 2 + i * (CELL.w + M.gap) + CELL.w / 2;

const FLAT = "rgba(255,255,255,0.07)"; // Meter cell track

/** lucide key-round (v1.72) at `size`, with a strike drawn from top-left to bottom-right (0..1). */
function KeyGlyph({ size, strike }: { size: number; strike: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", overflow: "visible" }}>
      <g stroke={C.fg2} strokeWidth={2}>
        <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
        <circle cx="16.5" cy="7.5" r=".5" fill={C.fg2} />
      </g>
      {strike > 0 && (
        <>
          <path d="M1 1 L23 23" pathLength={1} stroke={C.raise} strokeWidth={5} strokeDasharray={`${strike} 1`} />
          <path d="M1 1 L23 23" pathLength={1} stroke={C.fg} strokeWidth={2.2} strokeDasharray={`${strike} 1`} />
        </>
      )}
    </svg>
  );
}

/** One bed account: a glass tile that drops in under its face, shows its keyless account name, gets a key that is
    struck through, then squeezes into its meter cell. Returns null before it drops in. */
export function Tile({ i, f, T }: { i: number; f: number; T: Times }) {
  const t0 = T.tiles + 3 * i;
  if (f < t0) return null;
  const sp = spring({ frame: f - t0, fps: 30, config: SPRING });
  const q = prog(f, T.squeeze, T.squeezeEnd - T.squeeze, IN_OUT_STRONG);
  const x = lerp(slotX(i), cellX(i), q);
  const y = lerp(TILE.y, CELL.y, q) - 18 * (1 - sp);
  const w = lerp(TILE.w, CELL.w, q);
  const h = lerp(TILE.h, CELL.h, q);
  const r = lerp(TILE.r, CELL.h / 2, q);
  const sc = 0.94 + 0.06 * sp;
  const kp = prog(f, T.keys + 2 * i, 10);
  const st = prog(f, T.strike + 3 * i, 7, OE);
  const content = 1 - prog(f, T.squeeze, 10, OE);
  const label = `b0${i + 1}-lis0312`;
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        transform: `scale(${sc})`,
        opacity: Math.min(1, sp * 1.6),
      }}
    >
      <div style={{ position: "absolute", inset: 0, ...GLASS, backdropFilter: undefined, WebkitBackdropFilter: undefined, borderRadius: r, opacity: 1 - q }} />
      {q > 0 && <div style={{ position: "absolute", inset: 0, background: FLAT, borderRadius: r, opacity: q }} />}
      {content > 0 && (
        <div style={{ position: "absolute", inset: 0, borderRadius: r, overflow: "hidden", opacity: content, filter: content < 1 ? `blur(${(1 - content) * 6}px)` : undefined }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) translateY(${-24 - 6 * (1 - kp)}px) scale(${0.85 + 0.15 * kp})`, opacity: kp }}>
            <KeyGlyph size={44} strike={st} />
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translateY(${34 * kp}px)`,
              fontFamily: MONO,
              fontSize: 26,
              letterSpacing: "-0.01em",
              color: C.fg,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        </div>
      )}
    </div>
  );
}
