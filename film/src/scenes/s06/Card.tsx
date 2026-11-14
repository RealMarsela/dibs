import React from "react";
import { C, FONT, MONO, FACTS } from "../../tokens";
import { Wordmark } from "../../components/Surfaces";

/* Local variant of TripCard (components/Trip.tsx) with two extras S06 needs: a glow on the "Hotels only" chip and one
   glossy sheen pass. With glow = 0 and no sheen it renders exactly like TripCard, so the scene can land on H6. */

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

export function S06Card({ width = 640, glow = 0, sheen = 0, last4 = "0810" }: { width?: number; glow?: number; sheen?: number; last4?: string }) {
  const k = width / 400;
  const g = glow > 0.001;
  return (
    <div
      style={{
        width,
        height: width / 1.586,
        borderRadius: 20 * k,
        padding: 20 * k,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: FONT,
        color: C.fg,
        background: "radial-gradient(120% 140% at 0% 0%, #2f2f2d 0%, #1a1a19 55%, #111110 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 30px 60px -30px rgba(0,0,0,.8)",
      }}
    >
      {sheen > 0 && sheen < 1 && (
        <div
          style={{
            position: "absolute",
            top: "-30%",
            bottom: "-30%",
            width: "34%",
            left: `${-45 + 170 * sheen}%`,
            transform: "skewX(-20deg)",
            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0) 100%)",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Wordmark size={20 * k} />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4 * k,
            borderRadius: 99,
            background: g ? `rgba(255,255,255,${0.08 + 0.1 * glow})` : "rgba(255,255,255,0.08)",
            padding: `${4 * k}px ${10 * k}px`,
            fontSize: 11.5 * k,
            color: g ? mix(C.fg2, C.fg, glow) : C.fg2,
            boxShadow: g ? `0 0 0 ${1.5 * glow}px rgba(236,236,234,${0.4 * glow}), 0 0 ${26 * glow}px ${3 * glow}px rgba(236,236,234,${0.22 * glow})` : undefined,
            transform: g ? `scale(${1 + 0.05 * glow})` : undefined,
            transformOrigin: "100% 0%",
          }}
        >
          <svg width={14 * k} height={14 * k} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M12 4v6" /><path d="M2 18h20" /></svg>
          Hotels only
        </span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 19 * k, letterSpacing: "0.12em" }}>•••• •••• •••• {last4}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", fontSize: 12 * k, color: C.fg2 }}>
        <span>
          {FACTS.place.toUpperCase()} · {FACTS.tripCode}
          <br />
          <span style={{ color: C.fg }}>Single use</span>
        </span>
        <span style={{ textAlign: "right" }}>
          Limit
          <br />
          <span style={{ fontSize: 15 * k, fontWeight: 600, color: C.fg }}>${FACTS.pot}</span>
        </span>
      </div>
    </div>
  );
}
