import React from "react";
import { C, CHAIN_DOT, DISPLAY, FONT, GLASS, IN_OUT_STRONG, MONO } from "../../tokens";
import { kf, prog } from "../../lib/anim";
import type { Crop } from "../../components/Footage";
import { Steps } from "../../components/Steps";
import { WIN, type T } from "./timing";

/* Placeholder for FootageSlot "pay-base": the app's PaySheet (apps/web/src/components/trip/pay-sheet.tsx) rebuilt at CSS px
   on a 1920x1080 "screen" exactly where the desktop Dialog sits (440 wide, x 740-1180, vertically centred on its own
   height), then cropped with the same crop the footage uses. Steps: passkey -> chain (Base) -> tracking. */
const DX = 740;
const DW = 440;
// Heights and offsets measured on the real pay-base clip (CSS px): passkey 417-663, chain 200-880, tracking 396-684.
const HEAD = 105; // padding 28 + eyebrow 16 + gap 14 + title 27 + mb 20
export const H_PK = 246;
export const H_CH = 680;
export const H_TR = 288;
export const H_DONE = 387; // "You're in": 346-733 on the clip
const top = (h: number) => 540 - h / 2;
const ROW = 71;
const ROW_GAP = 10;
/** Centre of the "$40.42" amount on the Base row, in screen CSS px (measured on the clip). */
export const BASE_AMOUNT = { x: 1108, y: 474 };

const CHAINS = [
  { id: "near", name: "NEAR", amt: "$40.00", eta: "2 s" },
  { id: "base", name: "Base", amt: "$40.42", eta: "about 35 s" },
  { id: "solana", name: "Solana", amt: "$40.36", eta: "about 25 s" },
  { id: "arbitrum", name: "Arbitrum", amt: "$40.44", eta: "about 40 s" },
  { id: "ethereum", name: "Ethereum", amt: "$40.72", eta: "about 3 min" },
] as const;

/* The live app's testnet copy (coordinator, 14 Nov): on testnet the faucet does the deposit and nothing is swapped. */
const TRACK = ["Test deposit sent by the faucet", "No swap needed on testnet", "Landed in your bed’s own account", "Counted in the crew DAO"];

/** The crop (screen CSS px) at local frame f, shared by footage and placeholder. 450 wide (the 440 dialog + 5 a side), so
    the slot shows it at x2.56; its height keeps the slot's aspect and the window face shows the middle of it. The visible
    centre: passkey 540; chain 360 (title to Base, cut in the gap before Solana) panning to 604 (Base to Ethereum, cut
    before the button); tracking 544 (from the dialog's top edge, no page text above it); "You're in" (variant B) 540
    (eyebrow to "Back to the trip"). */
const CROP_W = 450;
const CROP_H = (CROP_W * WIN.h) / WIN.w;
export function cropAt(f: number, t: T): Crop {
  const c = kf(
    f,
    [t.chain0, t.chain0 + 10, t.pan0, t.pan1, t.track0, t.track0 + 10, t.tail.youIn, t.tail.youIn + 10],
    [540, 360, 360, 604, 604, 544, 544, 540],
    IN_OUT_STRONG,
  );
  return { x: 960 - CROP_W / 2, y: c - CROP_H / 2, w: CROP_W, h: CROP_H };
}

export function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

const Icon = ({ d, size = 16, color = "currentColor", style }: { d: string[]; size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const FINGERPRINT = [
  "M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4", "M14 13.12c0 2.38 0 6.38-1 8.88", "M17.29 21.02c.12-.6.43-2.3.5-3.02",
  "M2 12a10 10 0 0 1 18-6", "M2 16h.01", "M21.8 16c.2-2 .131-5.354 0-6", "M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2",
  "M8.65 22c.21-.66.45-1.32.57-2", "M9 6.8a6 6 0 0 1 9 5.2v2",
];
const SPIN = ["M21 12a9 9 0 1 1-6.219-8.56"];

function Dialog({ h, title, opacity, children }: { h: number; title: string; opacity: number; children: React.ReactNode }) {
  if (opacity <= 0) return null;
  return (
    <div style={{ ...GLASS, position: "absolute", left: DX, top: top(h), width: DW, height: h, boxSizing: "border-box", borderRadius: 28, padding: 28, opacity, fontFamily: FONT, color: C.fg }}>
      <Icon d={["M18 6 6 18", "m6 6 12 12"]} color={C.fg2} style={{ position: "absolute", top: 16, right: 16, opacity: 0.7 }} />
      <div style={{ fontSize: 12, fontWeight: 500, color: C.fg2, lineHeight: "16px", marginBottom: 14 }}>Bed 03 · Lisbon</div>
      <div style={{ ...DISPLAY, fontSize: 24, height: 27, marginBottom: 20 }}>{title}</div>
      {children}
    </div>
  );
}

function LightPill({ children, press = 0, style }: { children: React.ReactNode; press?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ height: 40, borderRadius: 999, background: C.fg, color: C.void, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14.5, fontWeight: 600, transform: `scale(${1 - 0.04 * press})`, ...style }}>
      {children}
    </div>
  );
}

function PasskeyStep({ f, t }: { f: number; t: T }) {
  const hi = (at: number) => mixHex(C.fg2, C.fg, prog(f, at, 8));
  const press = Math.sin(prog(f, t.pkPress, 7, IN_OUT_STRONG) * Math.PI);
  const busy = f >= t.pkPress + 3;
  return (
    <div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.625, color: C.fg2, height: 49 }}>
        A <span style={{ color: hi(t.passkey) }}>passkey</span> on this phone becomes <span style={{ color: hi(t.key) }}>the only key</span> bed 03 listens to.{" "}
        <span style={{ color: hi(t.wallet) }}>No wallet</span>, no seed phrase, <span style={{ color: hi(t.gas) }}>no gas.</span>
      </p>
      <LightPill press={press} style={{ marginTop: 24 }}>
        {busy ? <Icon d={SPIN} style={{ transform: `rotate(${f * 14}deg)` }} /> : <Icon d={FINGERPRINT} />}
        Hold bed 03 with a passkey
      </LightPill>
    </div>
  );
}

function ChainStep({ f, t }: { f: number; t: T }) {
  const sel = prog(f, t.base, 6);
  const tap = Math.sin(prog(f, t.base - 2, 8) * Math.PI);
  const amountOut = 1 - prog(f, t.chip0, 4);
  return (
    <div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: C.fg2, height: 45 }}>Pay from wherever your money already is. Your bed receives exactly $40.00.</p>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: ROW_GAP }}>
        {CHAINS.map((ch) => {
          const on = ch.id === "base";
          return (
            <div
              key={ch.id}
              style={{
                height: ROW,
                boxSizing: "border-box",
                borderRadius: 12,
                border: `1px solid ${on ? mixHex("#2e2e2d", C.fg, sel) : C.line}`,
                background: on ? `rgba(255,255,255,${0.04 * sel})` : undefined,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transform: on ? `scale(${1 - 0.015 * tap})` : undefined,
              }}
            >
              <span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: "22px" }}>{ch.name}</span>
                <span style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.fg2, lineHeight: "19px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: CHAIN_DOT[ch.id] }} />
                  USDC on {ch.name}
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontFamily: MONO, fontSize: 14, fontWeight: 600, lineHeight: "21px", opacity: on ? amountOut : 1 }}>{ch.amt}</span>
                <span style={{ display: "block", fontSize: 12, color: C.fg3, lineHeight: "18px" }}>{ch.eta}</span>
              </span>
            </div>
          );
        })}
      </div>
      <LightPill style={{ marginTop: 20 }}>Get my Base address</LightPill>
      <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 12, lineHeight: "18px", color: C.fg3 }}>Live quote from NEAR Intents 1Click, exact output.</p>
    </div>
  );
}

/** The whole placeholder screen. Rendered inside the FootageSlot box (WIN.w x WIN.h), cropped by `crop`. */
/** f = scene-local frame (passed in, because the slot sits in a Sequence); off = that Sequence's start, for Steps. */
export function PayScreen({ f, t, crop, off }: { f: number; t: T; crop: Crop; off: number }) {
  const S = WIN.w / crop.w;
  // hard cuts between steps, like the app swapping the sheet's content (never two steps visible at once)
  const pk = f < t.chain0 ? 1 : 0;
  const ch = f >= t.chain0 && f < t.track0 ? 1 : 0;
  const tr = f >= t.track0 && f < t.tail.youIn ? 1 : 0;
  const done = f >= t.tail.youIn ? 1 : 0;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `scale(${S}) translate(${-crop.x}px, ${-crop.y}px)`, background: C.void }}>
      {/* the trip page under the dialog's dim overlay */}
      <div style={{ ...GLASS, position: "absolute", left: 600, top: 60, width: 720, height: 960, opacity: 0.45 }} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <Dialog h={H_PK} title="This bed is yours" opacity={pk}>
        <PasskeyStep f={f} t={t} />
      </Dialog>
      <Dialog h={H_CH} title="Pay from any chain" opacity={ch}>
        <ChainStep f={f} t={t} />
      </Dialog>
      <Dialog h={H_TR} title="Your money is on its way" opacity={tr}>
        <Steps s={1} steps={TRACK.map((title) => ({ title }))} doneAt={[t.deposit - off, t.swapped - off, t.landed - off, t.dao - off]} />
      </Dialog>
      <Dialog h={H_DONE} title="You’re in" opacity={done}>
        <Steps s={1} steps={TRACK.map((title) => ({ title }))} doneAt={[0, 0, 0, 0]} />
        <div style={{ marginTop: 16, fontSize: 13, lineHeight: "20px", color: C.fg2, textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.2)", textUnderlineOffset: 4 }}>Receipt on NEAR ↗</div>
        <LightPill style={{ marginTop: 24 }}>Back to the trip</LightPill>
      </Dialog>
    </div>
  );
}
