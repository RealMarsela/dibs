import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT, GLASS, OE, CHAIN_DOT } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { CUBE, cubePose, dockOf, type CardPose, type Times } from "./poses";
import { GlassCube } from "./Cube";
import { FingerprintIcon } from "./icons";

/* The pot pill, the "called from NEAR" pill, the enclave cube with its chip, and the seal chip under the card. */

export const Place = ({ x, y, s = 1, children, style }: { x: number; y: number; s?: number; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${s})`, ...style }}>{children}</div>
);

export function GlassPill({ h, fs, children, style }: { h: number; fs: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        ...GLASS,
        borderRadius: 999,
        height: h,
        padding: `0 ${Math.round(h * 0.42)}px`,
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(fs * 0.4),
        fontFamily: FONT,
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: "-0.012em",
        color: C.fg,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const blur = (px: number) => (px > 0.05 ? `blur(${px}px)` : undefined);

/** Arrival look for small chips: opacity, blur, small offset (the word-sweep feel). */
const arrive = (p: number, dx = 0, dy = 10): React.CSSProperties => ({
  opacity: p,
  filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
  translate: `${(1 - p) * dx}px ${(1 - p) * dy}px`,
});

/** Things that go INTO the cube: drawn before (under) it so its glass covers them. */
export function Inflow({ f, T }: { f: number; T: Times }) {
  const potIn = prog(f, 34, 22);
  const potMove = prog(f, 100, 36);
  const potFlow = prog(f, T.near + 6, 24);
  const potX = lerp(lerp(1220, 700, potMove), CUBE.x, potFlow);
  const potY = lerp(lerp(450, 580, potMove), CUBE.y, potFlow) + Math.sin(f / 34) * 3 - Math.sin(potFlow * Math.PI) * 40;
  const potO = potIn * (1 - prog(f, T.near + 16, 12));
  const nearIn = prog(f, T.called - 2, 16, OE);
  const nearMove = prog(f, T.near, 18);
  const nearY = lerp(164, CUBE.y - 20, nearMove);
  const nearO = nearIn * (1 - prog(f, T.near + 8, 10));
  return (
    <AbsoluteFill>
      {potO > 0 && (
        <Place x={potX} y={potY} s={(0.92 + 0.08 * potIn) * lerp(1, 0.45, potFlow)} style={{ ...arrive(potIn, 0, 16), opacity: potO, filter: blur((1 - potIn) * 8 + potFlow * 8) }}>
          <GlassPill h={100} fs={42}>
            <span>$320</span>
            <span style={{ color: C.fg2 }}>· crew DAO</span>
          </GlassPill>
        </Place>
      )}
      {nearO > 0 && (
        <Place x={CUBE.x} y={nearY} s={lerp(1, 0.55, nearMove)} style={{ ...arrive(nearIn, 0, -10), opacity: nearO, filter: blur((1 - nearIn) * 8 + nearMove * 6) }}>
          <GlassPill h={64} fs={28}>
            <span style={{ width: 12, height: 12, borderRadius: 99, background: CHAIN_DOT.near }} />
            <span style={{ color: C.fg2 }}>called from</span>
            <span style={{ marginLeft: -4 }}>NEAR</span>
          </GlassPill>
        </Place>
      )}
    </AbsoluteFill>
  );
}

export function Enclave({ f, T }: { f: number; T: Times }) {
  const c = cubePose(f, T);
  const chipIn = prog(f, T.outlayer + 4, 16, OE);
  const chipO = chipIn * (1 - prog(f, T.issues + 11, 14));
  if (c.o <= 0) return null;
  return (
    <AbsoluteFill>
      <Place x={c.x} y={c.y} s={c.s} style={{ opacity: c.o }}>
        <GlassCube size={CUBE.size} rx={-20} ry={c.ry} pulse={c.pulse} />
      </Place>
      {chipO > 0 && (
        <Place x={CUBE.x} y={CUBE.y + 355} style={{ ...arrive(chipIn), opacity: chipO }}>
          <GlassPill h={60} fs={28}>
            <span>OutLayer</span>
            <span style={{ color: C.fg2, marginLeft: -4 }}>· Intel TDX</span>
          </GlassPill>
        </Place>
      )}
    </AbsoluteFill>
  );
}

/** "Sealed to Maya's passkey" chip, pinned just right of where Maya docks under the card. */
export function SealChip({ f, T, card }: { f: number; T: Times; card: CardPose }) {
  const p = prog(f, T.mayas, 16, OE);
  const o = p * (1 - prog(f, T.so - 15, 12));
  if (o <= 0) return null;
  const d = dockOf(card);
  return (
    <div style={{ position: "absolute", left: d.x + d.size * 0.78, top: d.y + d.size * 0.36, transform: "translateY(-50%)", ...arrive(p, -14, 0), opacity: o }}>
      <GlassPill h={60} fs={28}>
        <FingerprintIcon size={30} color={C.fg2} stroke={1.9} />
        <span>
          Sealed to Maya’s passkey
        </span>
      </GlassPill>
    </div>
  );
}
