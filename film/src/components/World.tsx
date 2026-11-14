import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../tokens";
import { useSceneFrom } from "../scene";

/* The one background every scene shares, so seams never show: near-black #0e0e0e, a very soft warm lift at the centre
   that drifts slowly, and a fine static grain. Identical math in every scene (it reads the absolute film frame via `t`). */
export function World({ t, children, glow = 1 }: { t?: number; children?: React.ReactNode; glow?: number }) {
  const abs = useCurrentFrame() + useSceneFrom();
  const f = t ?? abs;
  const gx = 50 + Math.sin(f / 240) * 6;
  const gy = 46 + Math.cos(f / 300) * 4;
  return (
    <AbsoluteFill style={{ background: C.void, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 55% at ${gx}% ${gy}%, rgba(236,236,234,${0.045 * glow}) 0%, rgba(236,236,234,0) 70%)`,
        }}
      />
      {children}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id="dibs-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#dibs-grain)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(120% 90% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)" }} />
    </AbsoluteFill>
  );
}
