import React from "react";
import { C, CHAIN_DOT, EASE, FONT, GLASS, IN_OUT_STRONG, MONO } from "../../tokens";
import { kf, lerp, prog } from "../../lib/anim";
import { At } from "../../components/Stage";
import { WIN, winPose, type T } from "./timing";
import { BASE_AMOUNT, cropAt } from "./PayScreen";

/* The money's journey, lifted out of the pay window: the Base row's "$40.42" rises as a chip "40.42 USDC · Base", passes
   through a turning glass ring labelled "NEAR Intents", flips to "40.00 USDC · NEAR" inside it, slips behind the ring's
   lower band and drops into bed 03's own account, a glass tile "b03-lis0312" that lights white. Stage coords. */

const RING = { x: 560, y: -160, r: 190, band: 54 };
const TILE = { x: 560, y: 232, w: 290, h: 112 };
const hide: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };

function ChipFace({ amount, chain, back, opacity }: { amount: string; chain: "base" | "near"; back?: boolean; opacity: number }) {
  return (
    <div
      style={{
        ...GLASS,
        ...hide,
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%)${back ? " rotateY(180deg)" : ""}`,
        height: 64,
        padding: "0 28px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        whiteSpace: "nowrap",
        fontFamily: FONT,
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        fontVariantNumeric: "tabular-nums",
        color: C.fg,
        background: "rgba(48,48,47,0.92)",
        opacity,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 99, background: CHAIN_DOT[chain] }} />
      {amount} USDC <span style={{ color: C.fg2 }}>· {chain === "base" ? "Base" : "NEAR"}</span>
    </div>
  );
}

function Ring({ f, t, c2 }: { f: number; t: T; c2: number }) {
  const inP = prog(f, t.chip0 + 4, 16);
  const outP = prog(f, t.landed - 2, 14);
  const spin = f * 2.2 + 220 * prog(f, c2 - 10, 30, IN_OUT_STRONG);
  const glow = Math.sin(prog(f, c2, 16) * Math.PI);
  const d = RING.r * 2;
  const rin = RING.r - RING.band;
  const mid = RING.r - RING.band / 2;
  const mask = `radial-gradient(circle at center, transparent ${rin - 0.5}px, #000 ${rin + 0.5}px)`;
  return (
    <At x={RING.x} y={RING.y} s={lerp(0.86, 1, inP) * (1 + 0.08 * outP) * (1 + 0.03 * glow)} opacity={inP * (1 - outP)} style={{ width: d, height: d, filter: outP > 0 ? `blur(${outP * 8}px)` : undefined }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `rgba(40,40,39,0.8)`, WebkitMaskImage: mask, maskImage: mask, boxShadow: `0 0 0 1px ${C.line} inset` }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          WebkitMaskImage: mask,
          maskImage: mask,
          background: `conic-gradient(from ${spin}deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,${0.14 + 0.2 * glow}) 50deg, rgba(255,255,255,0) 110deg, rgba(255,255,255,0) 360deg)`,
        }}
      />
      <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <circle cx={RING.r} cy={RING.r} r={RING.r - 0.5} fill="none" stroke="rgba(255,255,255,0.22)" />
        <circle cx={RING.r} cy={RING.r} r={rin} fill="none" stroke={`rgba(255,255,255,${0.16 + 0.5 * glow})`} strokeWidth={1.5} />
        <circle cx={RING.r} cy={RING.r} r={rin + 8} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} strokeDasharray="2 11" transform={`rotate(${spin * 0.6} ${RING.r} ${RING.r})`} />
        <path id="s03-ring-arc" d={`M ${RING.r - mid} ${RING.r} A ${mid} ${mid} 0 0 1 ${RING.r + mid} ${RING.r}`} fill="none" />
        <text fill={C.fg} fontFamily={FONT} fontSize={24} fontWeight={600} letterSpacing={0.5} dominantBaseline="central">
          <textPath href="#s03-ring-arc" startOffset="50%" textAnchor="middle">
            NEAR Intents
          </textPath>
        </text>
      </svg>
    </At>
  );
}

function Tile({ f, t, land }: { f: number; t: T; land: number }) {
  const inP = prog(f, t.chip0 + 14, 16);
  const lit = prog(f, land - 2, 8);
  const flash = Math.sin(prog(f, land - 2, 14) * Math.PI);
  const outP = prog(f, t.flip0 - 6, 14);
  return (
    <At x={TILE.x + 50 * outP} y={TILE.y + (1 - inP) * 24} z={-2} s={(1 + 0.05 * flash) * (1 - 0.08 * outP)} opacity={inP * (1 - outP)}>
      <div
        style={{
          ...GLASS,
          width: TILE.w,
          height: TILE.h,
          boxSizing: "border-box",
          borderRadius: 26,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          background: `rgba(${lerp(40, 236, lit)}, ${lerp(40, 236, lit)}, ${lerp(39, 234, lit)}, ${lerp(0.74, 1, lit)})`,
          boxShadow: `0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px -24px rgba(0,0,0,0.7), 0 0 ${60 * flash}px ${10 * flash}px rgba(236,236,234,${0.28 * flash})`,
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: 19, fontWeight: 500, color: lit > 0.5 ? C.fg3 : C.fg2 }}>bed 03’s own account</span>
        <span style={{ fontFamily: MONO, fontSize: 28, color: lit > 0.5 ? C.void : C.fg, letterSpacing: "-0.01em" }}>b03-lis0312</span>
      </div>
    </At>
  );
}

export function LiftOut({ f, t }: { f: number; t: T }) {
  const c0 = t.chip0;
  const c1 = c0 + 16;
  const c2 = t.swapped - 8;
  const c2b = c2 + 12;
  const land = t.lands + 10;
  if (f < c0 - 1 || f > t.flip0 + 12) return null;
  // chip start: the "$40.42" on the Base row, mapped through the crop and the window pose at c0
  const P0 = winPose(c0, t);
  const cr = cropAt(c0, t);
  const S = WIN.w / cr.w;
  const sx = P0.x + ((BASE_AMOUNT.x - cr.x) * S - WIN.w / 2) * P0.s;
  const sy = P0.y + ((BASE_AMOUNT.y - cr.y) * S - WIN.h / 2) * P0.s;
  // one continuous move from the amount straight into the ring's hole (no stop on the way), lifting off the window first
  const x = kf(f, [c0, c2], [sx, RING.x], EASE);
  const y = f <= c2b ? kf(f, [c0, c2], [sy, RING.y], EASE) : kf(f, [c2b, land], [RING.y, TILE.y], IN_OUT_STRONG);
  const z = kf(f, [c0, c1, c2 - 6, c2, c2b, c2b + 12, land], [0, 80, 40, -70, -70, -70, 0], [EASE, EASE, IN_OUT_STRONG, EASE, EASE, IN_OUT_STRONG]);
  const s = kf(f, [c0, c0 + 8, c2, c2b, land - 4, land + 2], [0.45, 1, 0.8, 0.8, 0.8, 0.55], [EASE, IN_OUT_STRONG, EASE, EASE, IN_OUT_STRONG]);
  const ry = kf(f, [c2, c2b], [0, 180], IN_OUT_STRONG);
  const op = prog(f, c0, 5) * (1 - prog(f, land - 3, 6));
  return (
    <>
      <Ring f={f} t={t} c2={c2} />
      <Tile f={f} t={t} land={land} />
      {op > 0 && (
        <At x={x} y={y} z={z} ry={ry} s={s} style={{ width: 0, height: 0 }}>
          <ChipFace amount="40.42" chain="base" opacity={op} />
          <ChipFace amount="40.00" chain="near" back opacity={op} />
        </At>
      )}
    </>
  );
}
