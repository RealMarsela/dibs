import React from "react";
import { C, FONT, LIST_SCALE } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { At } from "../../components/Stage";
import { ROWS_ALL_PAID, BedRow } from "../../components/Trip";
import { BACK, K, PILL, ROW_1X, WIN, type Pose, type T } from "./timing";
import { cropAt } from "./PayScreen";
import { PayFront } from "./PayFront";
import { BackContent, BackPill, windowSurface } from "./Back";
import { V } from "./variant";

/* The pay window in stage space. Front: FootageSlot "pay-base" (placeholder = PaySheet rebuilt). It grows out of the
   "Pay $40" pill (clip reveal + tilt) and pulls back for the lift-out. Variant A then turns over (ry 0 -> 180) to the
   mainnet receipt on its back face; variant B stays face-up while the real payment finishes. The final face (back in A,
   front in B) shrinks into row 03 of the bed list (H3) and becomes Leo's paid row. */

const hide: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
const LEO_PAID = ROWS_ALL_PAID[2];
const SHEEN = "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 30%)";

/** Leo's paid row at H3's scale, centred in the shrinking face. */
const LeoRow = ({ o }: { o: number }) =>
  o > 0 ? (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: ROW_1X.w, opacity: o, transform: `translate(-50%, -50%) scale(${LIST_SCALE})` }}>
      <BedRow row={LEO_PAID} />
    </div>
  ) : null;

export function PayWindow({ f, t, P }: { f: number; t: T; P: Pose }) {
  const { w, h } = P;
  const crop = cropAt(f, t);
  const vw = lerp(PILL.w, w, P.open);
  const vh = lerp(PILL.h, h, P.open);
  const rr = lerp(PILL.h / 2, 28, P.open);
  const reveal = P.open < 1 ? `inset(${(h - vh) / 2}px ${(w - vw) / 2}px round ${rr}px)` : undefined;
  // the white pill fades straight into the passkey dialog, which is already on screen under it (no empty stage)
  const cover = 1 - prog(P.open, 0.12, 0.45);
  const label = 1 - prog(P.open, 0, 0.2);
  const showFront = P.flip < 0.6;
  const showBack = V === "A" && P.flip > 0.4;
  // the shrink into row 03: content out first, then Leo's row in, then the surface dissolves into the list
  const fade = prog(f, t.shrink0, 7);
  const row = prog(P.shrink, 0.55, 0.45);
  const surf = 1 - prog(P.shrink, 0.5, 0.5);
  const radius = lerp(28, 22 * LIST_SCALE, P.shrink);
  const frontFinal = V === "B";
  return (
    <At x={P.x} y={P.y} z={P.z} rx={P.rx} ry={P.ry} s={P.s} style={{ width: w, height: h }}>
      {showFront && (
        <div style={{ ...hide, position: "absolute", inset: 0, clipPath: reveal, WebkitClipPath: reveal }}>
          <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: radius, overflow: "hidden", ...windowSurface(frontFinal ? surf : 1) }}>
            <div style={{ position: "absolute", left: (w - WIN.w) / 2, top: (h - WIN.h) / 2, opacity: frontFinal ? 1 - fade : 1 }}>
              <PayFront f={f} t={t} crop={crop} />
            </div>
            <div style={{ position: "absolute", inset: 0, background: SHEEN, opacity: frontFinal ? surf : 1 }} />
            {frontFinal && <LeoRow o={row} />}
          </div>
          {cover > 0 && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 28, background: C.fg, opacity: cover, display: "grid", placeItems: "center" }}>
              <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 19 * K, color: C.void, opacity: label }}>Pay $40</span>
            </div>
          )}
        </div>
      )}
      {showBack && (
        <div style={{ ...hide, position: "absolute", inset: 0, transform: "rotateY(180deg)" }}>
          <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: radius, overflow: "hidden", ...windowSurface(surf) }}>
            <div style={{ position: "absolute", left: (w - BACK.w) / 2, top: (h - BACK.h) / 2 }}>
              <BackContent t={t} fade={fade} />
            </div>
            <LeoRow o={row} />
          </div>
          <BackPill t={t} fade={fade} />
        </div>
      )}
    </At>
  );
}
