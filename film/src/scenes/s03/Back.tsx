import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { C, DISPLAY, FONT } from "../../tokens";
import { kf, prog } from "../../lib/anim";
import { FootageSlot } from "../../components/Footage";
import { Badge } from "../../components/Surfaces";
import { V as VARIANT } from "./variant";
import { BACK, type T } from "./timing";

/* Variant A only: the pay window's back face is the real mainnet transaction (FootageSlot "mainnet-receipt"; the
   placeholder has no amounts or hashes, those come from the real run), with the yellow "NEAR mainnet · real money" pill
   landing on "mainnet". Variant B never turns the window over (see TestnetChip). */

const RECEIPT_ROWS = [
  ["Network", "NEAR mainnet"],
  ["From", "NEAR Intents 1Click deposit"],
  ["To", "bed 03’s own account"],
  ["Asset", "USDC, sent from Base"],
] as const;

function ReceiptPlaceholder() {
  // laid out at 1000 x 640 and scaled to fill BACK (same aspect)
  return (
    <div style={{ width: BACK.w, height: BACK.h, background: C.void, overflow: "hidden" }}>
      <div style={{ width: 1000, height: 640, boxSizing: "border-box", padding: "84px 76px 0", fontFamily: FONT, transform: `scale(${BACK.w / 1000})`, transformOrigin: "0 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <span style={{ ...DISPLAY, fontSize: 48, color: C.fg }}>Transaction</span>
          <Badge kind="paid" label="Success" s={1.9} />
        </div>
        {RECEIPT_ROWS.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", height: 92, borderTop: `1px solid ${C.line}` }}>
            <span style={{ width: 210, fontSize: 28, color: C.fg2 }}>{k}</span>
            <span style={{ fontSize: 32, fontWeight: 500, color: C.fg, letterSpacing: "-0.01em" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Crop on the explorer's summary block (needs one pass when the clip lands; aspect = BACK). */
const RECEIPT_CROP = { x: 300, y: 250, w: 588, h: (588 * BACK.h) / BACK.w };

function YellowPill({ at }: { at: number }) {
  const f = useCurrentFrame();
  const p = prog(f, at - 3, 12);
  const s = kf(f, [at - 3, at + 7, at + 14], [1.14, 0.97, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 0,
        transform: `translate(-50%, -50%) translateY(${(1 - p) * -46}px) scale(${s})`,
        opacity: p,
        height: 64,
        padding: "0 32px",
        borderRadius: 999,
        background: C.you,
        color: C.void,
        display: "inline-flex",
        alignItems: "center",
        fontFamily: FONT,
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        boxShadow: "0 18px 40px -16px rgba(0,0,0,0.8)",
      }}
    >
      NEAR mainnet · real money
    </div>
  );
}

/** Back face content (BACK.w x BACK.h); `fade` 0..1 hides it during the shrink into row 03. */
export function BackContent({ t, fade }: { t: T; fade: number }) {
  if (VARIANT !== "A") return null;
  return (
    <div style={{ position: "relative", width: BACK.w, height: BACK.h, opacity: 1 - fade }}>
      <Sequence from={t.flip0} layout="none">
        <FootageSlot id="mainnet-receipt" width={BACK.w} height={BACK.h} crop={RECEIPT_CROP} placeholder={<ReceiptPlaceholder />} />
      </Sequence>
    </div>
  );
}

/** Variant A's pill, drawn on the back face's top edge (outside the clipped box). */
export function BackPill({ t, fade }: { t: T; fade: number }) {
  if (VARIANT !== "A") return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: 1 - fade }}>
      <YellowPill at={t.tail.mainnet} />
    </div>
  );
}

/** The window surface (app window: void, strong hairline, deep shadow). k = 1 full, 0 gone (end of the shrink). */
export function windowSurface(k: number): React.CSSProperties {
  return {
    background: `rgba(14,14,14,${k})`,
    border: `1px solid rgba(255,255,255,${0.14 * k})`,
    boxShadow: `0 1px 0 rgba(255,255,255,${0.06 * k}) inset, 0 40px 120px -30px rgba(0,0,0,${0.9 * k}), 0 0 0 1px rgba(0,0,0,${0.4 * k})`,
  };
}
