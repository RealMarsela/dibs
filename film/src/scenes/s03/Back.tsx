import React from "react";
import { Freeze, Sequence, useCurrentFrame } from "remotion";
import { C, DISPLAY, FONT } from "../../tokens";
import { kf, prog } from "../../lib/anim";
import { FootageSlot, hasFootage } from "../../components/Footage";
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

/* The real mainnet payment (coordinator, 15 Nov 00:41 IST: lismain bed 1 paid 0.25 USDC from Base through NEAR Intents,
   swept into the crew DAO). The back face plays three real clips back to back, hard cuts, each cropped to BACK's aspect
   (CSS px of a 1920x1080 page; all clips 2880x1620):
     1. mainnet-pay-a: the "One address, one amount" sheet (QR, "Send exactly 0.252579 USDC on Base", the one-time 1Click
        address); crop starts under the "Bed 01" eyebrow and ends above the line the cursor rests on.
     2. mainnet-receipt-intents: the NEAR Intents explorer, Deposit Completed -> Processed -> Withdrawn "Transferred to
        b01-li…p.near", held on its first still frame (before it scrolls to the sender's wallet address).
     3. mainnet-lismain-paid: dibs.larinova.com/t/lismain, "Trip LISMAIN · NEAR mainnet · real USDC", "Lisbon",
        "Every bed is paid. $0.50 sits in the crew's DAO."
   `at` = frames after the turn-over starts (t.flip0); `freezeS` holds that clip second. */
const cropFor = (x: number, y: number, w: number) => ({ x, y, w, h: (w * BACK.h) / BACK.w });
const SEGMENTS = [
  { id: "mainnet-pay-a", at: 0, startS: 28, freezeS: undefined as number | undefined, crop: cropFor(667, 284, 586) },
  { id: "mainnet-receipt-intents", at: 52, startS: 1.0, freezeS: 1.2, crop: cropFor(330, 372, 910) },
  { id: "mainnet-lismain-paid", at: 118, startS: 0.4, freezeS: undefined as number | undefined, crop: cropFor(230, 140, 900) },
];

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
      {SEGMENTS.map((g, i) => {
        const next = SEGMENTS.slice(i + 1).find((n) => hasFootage(n.id));
        if (i > 0 && !hasFootage(g.id)) return null;
        const startFrom = Math.round(g.startS * 30);
        const slot = <FootageSlot id={g.id} width={BACK.w} height={BACK.h} crop={g.crop} startFrom={startFrom} placeholder={i === 0 ? <ReceiptPlaceholder /> : null} />;
        const hold = g.freezeS === undefined ? null : Math.round((g.freezeS - g.startS) * 30);
        return (
          <Sequence key={g.id} from={t.flip0 + g.at} durationInFrames={next ? next.at - g.at : undefined} layout="none">
            <div style={{ position: "absolute", inset: 0 }}>
              {hold === null ? slot : <Freeze frame={hold} active={(fr: number) => fr >= hold}>{slot}</Freeze>}
            </div>
          </Sequence>
        );
      })}
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
