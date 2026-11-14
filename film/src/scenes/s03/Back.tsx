import React from "react";
import { interpolate, Sequence, useCurrentFrame } from "remotion";
import { C, DISPLAY, FONT, MONO, OE } from "../../tokens";
import { kf, prog } from "../../lib/anim";
import { FootageSlot } from "../../components/Footage";
import { Badge } from "../../components/Surfaces";
import { V as VARIANT } from "./variant";
import { BACK, type T } from "./timing";

/* The pay window's back face, by voice variant.
   A: the real mainnet transaction (FootageSlot "mainnet-receipt"), placeholder without amounts or hashes, and the yellow
      "NEAR mainnet · real money" pill that lands on "mainnet".
   B: no mainnet claim. An honest glass card: a faucet stands in for the deposit on testnet. */

const RECEIPT_ROWS = [
  ["Network", "NEAR mainnet"],
  ["From", "NEAR Intents 1Click deposit"],
  ["To", "bed 03’s own account"],
  ["Asset", "USDC, sent from Base"],
] as const;

function ReceiptPlaceholder() {
  return (
    <div style={{ width: BACK.w, height: BACK.h, boxSizing: "border-box", padding: "84px 76px 0", background: C.void, fontFamily: FONT }}>
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

type W = { text: string; at: number; grey?: boolean };

/** Inline two-tone word sweep (motion.css .sweep-word), so the white statement and grey continuation share one paragraph. */
function InlineSweep({ words, size }: { words: W[]; size: number }) {
  const f = useCurrentFrame();
  return (
    <div style={{ ...DISPLAY, fontSize: size, color: C.fg }}>
      {words.map((w, i) => {
        const p = interpolate(f, [w.at, w.at + 16.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              color: w.grey ? C.fg2 : C.fg,
              opacity: p,
              filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
              transform: `translateY(${(1 - p) * 8 * (size / 48)}px)`,
            }}
          >
            {w.text}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}

const FG = "On testnet, a faucet stands in for the deposit.".split(" ");
const GREY = "NEAR Intents 1Click runs on mainnet; the same bed address takes USDC from Base there.".split(" ");

function TestnetCard({ t }: { t: T }) {
  const f = useCurrentFrame();
  const floor = t.flip1 - 8;
  const words: W[] = [
    ...FG.map((text, i) => ({ text, at: Math.max(floor + i, t.tail.words[i] ?? floor) })),
    ...GREY.map((text, i) => ({ text, at: t.tail.grey + i * 2.5, grey: true })),
  ];
  const chipAt = Math.max(floor, t.tail.words[1] ?? floor);
  const chip = prog(f, chipAt, 14);
  return (
    <div style={{ width: BACK.w, height: BACK.h, boxSizing: "border-box", padding: "0 84px", fontFamily: FONT, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 46,
          padding: "0 20px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${C.line}`,
          fontFamily: MONO,
          fontSize: 24,
          color: C.fg2,
          opacity: chip,
          transform: `translateY(${(1 - chip) * 10}px)`,
        }}
      >
        NEAR testnet · faucet deposit
      </span>
      <div style={{ marginTop: 34 }}>
        <InlineSweep words={words} size={56} />
      </div>
    </div>
  );
}

/** Back face content (BACK.w x BACK.h); `fade` 0..1 hides it during the shrink into row 03. */
export function BackContent({ t, fade }: { t: T; fade: number }) {
  if (VARIANT === "A") {
    return (
      <div style={{ position: "relative", width: BACK.w, height: BACK.h, opacity: 1 - fade }}>
        <Sequence from={t.flip0} layout="none">
          <FootageSlot id="mainnet-receipt" width={BACK.w} height={BACK.h} crop={RECEIPT_CROP} placeholder={<ReceiptPlaceholder />} />
        </Sequence>
      </div>
    );
  }
  return (
    <div style={{ width: BACK.w, height: BACK.h, opacity: 1 - fade }}>
      <TestnetCard t={t} />
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

/** Face surface: A is an app window (void, strong hairline); B is frosted glass. k = 1 full, 0 gone (end of the shrink). */
export function backSurface(k: number): React.CSSProperties {
  if (VARIANT === "A") {
    return {
      background: `rgba(14,14,14,${k})`,
      border: `1px solid rgba(255,255,255,${0.14 * k})`,
      boxShadow: `0 40px 120px -30px rgba(0,0,0,${0.9 * k})`,
    };
  }
  return {
    background: `rgba(40,40,39,${0.74 * k})`,
    border: `1px solid rgba(255,255,255,${0.08 * k})`,
    boxShadow: `0 1px 0 rgba(255,255,255,${0.05 * k}) inset, 0 24px 60px -24px rgba(0,0,0,${0.7 * k})`,
    backdropFilter: k > 0.02 ? "blur(24px) saturate(1.2)" : undefined,
  };
}
