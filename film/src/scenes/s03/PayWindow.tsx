import React from "react";
import { Sequence } from "remotion";
import { C, FONT } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { At } from "../../components/Stage";
import { AppWindow, FootageSlot } from "../../components/Footage";
import { ROWS_ALL_PAID, BedRow } from "../../components/Trip";
import { BACK, K, PILL, ROW3, WIN, type Pose, type T } from "./timing";
import { PayScreen, cropAt } from "./PayScreen";
import { BackContent, BackPill, backSurface } from "./Back";

/* The pay window in stage space. Front: FootageSlot "pay-base" (placeholder = PaySheet rebuilt). It grows out of the
   "Pay $40" pill (clip reveal + tilt), pulls back for the lift-out, then turns over (ry 0 -> 180) to its back face, which
   pushes in and finally shrinks into row 03 of the bed list (H3), becoming Leo's paid row. */

const hide: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
const LEO_PAID = ROWS_ALL_PAID[2];

export function PayWindow({ f, t, P }: { f: number; t: T; P: Pose }) {
  const { w, h } = P;
  const crop = cropAt(f, t);
  const vw = lerp(PILL.w, w, P.open);
  const vh = lerp(PILL.h, h, P.open);
  const rr = lerp(PILL.h / 2, 28, P.open);
  const reveal = P.open < 1 ? `inset(${(h - vh) / 2}px ${(w - vw) / 2}px round ${rr}px)` : undefined;
  const white = 1 - prog(P.open, 0.2, 0.5);
  const label = 1 - prog(P.open, 0, 0.3);
  const showFront = P.flip < 0.6;
  const showBack = P.flip > 0.4;
  const fade = prog(f, t.shrink0, 7);
  const row = prog(P.shrink, 0.55, 0.45);
  const surf = 1 - prog(P.shrink, 0.5, 0.5);
  return (
    <At x={P.x} y={P.y} z={P.z} rx={P.rx} ry={P.ry} s={P.s} style={{ width: w, height: h }}>
      {showFront && (
        <div style={{ ...hide, position: "absolute", inset: 0, clipPath: reveal, WebkitClipPath: reveal }}>
          <AppWindow width={w} height={h}>
            <div style={{ position: "absolute", left: (w - WIN.w) / 2, top: (h - WIN.h) / 2 }}>
              <Sequence from={t.win0} layout="none">
                <FootageSlot id="pay-base" width={WIN.w} height={WIN.h} crop={crop} placeholder={<PayScreen f={f} t={t} crop={crop} off={t.win0} />} />
              </Sequence>
            </div>
          </AppWindow>
          {white > 0 && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 28, background: C.fg, opacity: white, display: "grid", placeItems: "center" }}>
              <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 19 * K, color: C.void, opacity: label }}>Pay $40</span>
            </div>
          )}
        </div>
      )}
      {showBack && (
        <div style={{ ...hide, position: "absolute", inset: 0, transform: "rotateY(180deg)" }}>
          <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: lerp(28, 22, P.shrink), overflow: "hidden", ...backSurface(surf) }}>
            <div style={{ position: "absolute", left: (w - BACK.w) / 2, top: (h - BACK.h) / 2 }}>
              <BackContent t={t} fade={fade} />
            </div>
            {row > 0 && (
              <div style={{ position: "absolute", left: (w - ROW3.w) / 2 - 1, top: (h - ROW3.h) / 2 - 1, width: ROW3.w, opacity: row }}>
                <BedRow row={LEO_PAID} />
              </div>
            )}
          </div>
          <BackPill t={t} fade={fade} />
        </div>
      )}
    </At>
  );
}

