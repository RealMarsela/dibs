import React from "react";
import { AbsoluteFill, Easing, spring } from "remotion";
import { C, type PersonId } from "../../tokens";
import { Face, idle } from "../../components/LetterFace";
import { InboxPanel, type InboxItem } from "../../components/Trip";
import { kf, prog } from "../../lib/anim";

/* 2D layers of S07 (outside the 3D Stage so they land pixel-identical on the H7 pose and keep the bottom safe margin). */

/* The real InboxPanel (identical to H7 when every var is at rest), with its children driven by CSS vars so the label,
   address row and email row can assemble one by one and the row can glow once when it turns Verified. */
const CSS = [
  ".s07-inbox > div > div:nth-child(1){opacity:var(--lab)}",
  ".s07-inbox > div > div:nth-child(2){opacity:var(--addr)}",
  ".s07-inbox > div > div:nth-child(3){opacity:var(--row);transform:translateY(var(--rowy));",
  "box-shadow:0 0 0 calc(var(--glow) * 2px) rgba(52,211,153,calc(var(--glow) * 0.5)),0 0 calc(var(--glow) * 56px) rgba(52,211,153,calc(var(--glow) * 0.22))}",
].join("");

export type InboxLook = { o: number; s: number; blur: number; lab: number; addr: number; row: number; rowY: number; glow: number; status: InboxItem["status"] };

export function InboxLayer({ look, camT }: { look: InboxLook; camT: string }) {
  const vars = { "--lab": look.lab, "--addr": look.addr, "--row": look.row, "--rowy": `${look.rowY}px`, "--glow": look.glow } as React.CSSProperties;
  return (
    <AbsoluteFill style={{ transform: camT }}>
      <div
        className="s07-inbox"
        style={{
          position: "absolute",
          left: 960,
          top: 540,
          transform: `translate(-50%, -50%) scale(${look.s})`,
          opacity: look.o,
          filter: look.blur > 0.05 ? `blur(${look.blur}px)` : undefined,
          ...vars,
        }}
      >
        <style>{CSS}</style>
        <InboxPanel items={[{ from: "booking.com", subject: "Your booking is confirmed", status: look.status }]} />
      </div>
    </AbsoluteFill>
  );
}

/* The crew after the resale (bed order), popping up along the bottom edge for a quiet cheer, then sinking away. */
const CREW: PersonId[] = ["maya", "sam", "leo", "priya", "tomas", "jun", "chloe", "kofi"];
const SIZE = 80;
const GAP = 28;
const ROW_Y = 928;

export function CrewCheer({ f, A, inAt, outAt }: { f: number; A: number; inAt: number; outAt: number }) {
  const span = CREW.length * SIZE + (CREW.length - 1) * GAP;
  return (
    <AbsoluteFill>
      {CREW.map((id, i) => {
        const t0 = inAt + i * 2;
        const up = spring({ frame: f - t0, fps: 30, config: { damping: 13, stiffness: 150, mass: 1 } });
        const hop = kf(f, [t0 + 14, t0 + 21, t0 + 31], [0, -22, 0], [Easing.out(Easing.quad), Easing.in(Easing.quad)]);
        const down = prog(f, outAt + i * 1.5, 18, Easing.in(Easing.cubic));
        const y = (1 - up) * 230 + hop + down * 240;
        if (f < t0 || down >= 1) return null;
        return (
          <div key={id} style={{ position: "absolute", left: 960 - span / 2 + SIZE / 2 + i * (SIZE + GAP), top: ROW_Y, transform: `translate(-50%, -50%) translateY(${y}px)` }}>
            <div style={{ transform: idle(A, id, 1.3) }}>
              <Face id={id} size={SIZE} ring={C.void} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
