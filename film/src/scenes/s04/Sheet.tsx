import React from "react";
import { C, FONT, GLASS, MONO, OUT_STRONG } from "../../tokens";
import { Badge, hexA } from "../../components/Surfaces";
import { kf, prog } from "../../lib/anim";
import type { TT } from "./time";

/* Placeholder for footage slot `resale`: apps/web/src/components/trip/resale-sheet.tsx (desktop Dialog, 440 css px,
   radius 28, padding 28) rebuilt at S x its CSS px, centred in the window exactly where the crop puts the real dialog. */
/* v2: the window hugs the dialog (desktop Dialog x 740-1180 css px, centred on y 540; measured in the live clip:
   ask step y 394.7-684.7, refused step y 376-703.5), so no trip page shows at its edges. */
export const CROP_W = 441;
export const WIN_W = 1150;
export const S = WIN_W / CROP_W;
export const WIN_H_ASK = 292 * S;
export const WIN_H_REF = 330 * S;
export const WIN_R = 28.5 * S;
/** Crop in the 1920 x 1080 (css px) recording for a window of height h. */
export const cropFor = (h: number) => ({ x: 960 - CROP_W / 2, y: 540 - h / S / 2, w: CROP_W, h: h / S });

const SHEET_W = 440 * S;
const PAD = 28 * S;
const HEAD = 12 * S * 1.5 + 4 * S + 24 * S * 1.12 + 20 * S;
const LH = 15 * S * 1.625;
const ASK_BODY = 2 * LH + 8 * S + 10 * S + 40 * S + 10 * S + 40 * S;
const REF_BODY = 2 * S + 32 * S + 3 * LH + 8 * S + 12 * S * 1.5 + 20 * S + 40 * S;
const ASK_H = 2 * PAD + HEAD + ASK_BODY;
const REF_H = 2 * PAD + HEAD + REF_BODY;

const Arrow = () => (
  <svg width={16 * S} height={16 * S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);
export const Ban = ({ size, color = "currentColor", w = 2 }: { size: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

const pill = (tone: "dark" | "light", extra?: React.CSSProperties): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 40 * S,
  padding: `0 ${22 * S}px`,
  borderRadius: 999,
  fontSize: 14.5 * S,
  fontWeight: 600,
  background: tone === "light" ? C.fg : C.panel,
  color: tone === "light" ? C.void : C.fg,
  boxShadow: tone === "dark" ? `inset 0 0 0 ${S}px ${C.line}` : undefined,
  whiteSpace: "nowrap",
  ...extra,
});

export function ResaleSheet({ T, winH }: { T: TT; winH: number }) {
  const { f } = T;
  const open = prog(f, T.win + 10, 14);
  const toRef = prog(f, T.step, 10, OUT_STRONG);
  const askO = 1 - prog(f, T.step, 4);
  const refO = prog(f, T.step + 2, 6);
  const h = ASK_H + (REF_H - ASK_H) * toRef;
  const hover = prog(f, T.press - 8, 6);
  const press = kf(f, [T.press, T.press + 3, T.press + 9], [1, 0.97, 1]);
  const answered = prog(f, T.answer, 3);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, background: C.void }}>
      <div
        style={{
          ...GLASS,
          position: "absolute",
          left: (WIN_W - SHEET_W) / 2,
          top: (winH - h) / 2,
          width: SHEET_W,
          height: h,
          boxSizing: "border-box",
          borderRadius: 28 * S,
          padding: PAD,
          opacity: open,
          transform: `scale(${0.96 + 0.04 * open})`,
          color: C.fg,
        }}
      >
        <div style={{ fontSize: 12 * S, lineHeight: 1.5, fontWeight: 500, color: C.fg2, marginBottom: 4 * S }}>Bed 04 · Ana</div>
        <div style={{ position: "relative", height: 24 * S * 1.12, marginBottom: 20 * S, fontSize: 24 * S, lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.024em" }}>
          <span style={{ position: "absolute", left: 0, top: 0, opacity: askO, whiteSpace: "nowrap" }}>Can’t make it?</span>
          <span style={{ position: "absolute", left: 0, top: 0, opacity: refO, whiteSpace: "nowrap" }}>No refunds. Ever.</span>
        </div>
        <div style={{ position: "relative" }}>
          {askO > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: askO, display: "flex", flexDirection: "column", gap: 10 * S }}>
              <p style={{ margin: `0 0 ${8 * S}px`, fontSize: 15 * S, lineHeight: 1.625, color: C.fg2 }}>Plans change. Here is what this trip’s contract lets you do.</p>
              <div style={pill("dark", { transform: `scale(${press})`, background: hover > 0 ? mixHex(C.panel, C.raise, hover) : C.panel })}>
                <span>Get my $40 back</span>
                <Arrow />
              </div>
              <div style={pill("light")}>
                <span>Sell my bed at the price I paid</span>
                <Arrow />
              </div>
            </div>
          )}
          {refO > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: refO }}>
              <div style={{ position: "relative", borderRadius: 20 * S, border: `${S}px solid ${hexA(C.refused, 0.4)}`, background: hexA(C.refused, 0.1), padding: 16 * S }}>
                <Badge
                  kind="refused"
                  s={S}
                  icon={<Ban size={12 * S} />}
                  style={{ position: "absolute", top: -12 * S, right: 16 * S, transform: "rotate(-4deg)", background: C.void, padding: `0 ${10 * S}px` }}
                />
                <p style={{ margin: 0, fontSize: 15 * S, lineHeight: 1.625, color: C.fg }}>
                  Refunds don’t exist in this trip. Your $40 holds a bed that 7 friends are counting on, and the booker shouldn’t pay for your change of plans.
                </p>
                <div style={{ position: "relative", marginTop: 8 * S, height: 12 * S * 1.5, fontFamily: MONO, fontSize: 12 * S, lineHeight: 1.5, color: C.fg2 }}>
                  <span style={{ position: "absolute", left: 0, opacity: 1 - answered }}>Asking the contract…</span>
                  <span style={{ position: "absolute", left: 0, opacity: answered }}>Contract answered E_NO_REFUND</span>
                </div>
              </div>
              <div style={pill("light", { marginTop: 20 * S, justifyContent: "center" })}>Sell it instead, for exactly $40</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The rose "Refused" stamp that lands on the window on "refuses". Centred on its own box. */
export function Stamp({ p }: { p: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "22px 40px 20px",
        borderRadius: 26,
        border: `5px solid ${C.refused}`,
        background: "rgba(14,14,14,0.78)",
        boxShadow: `inset 0 0 0 6px rgba(14,14,14,0.78), inset 0 0 0 8px ${hexA(C.refused, 0.45)}, 0 30px 60px -20px rgba(0,0,0,0.8), 0 0 ${40 * (1 - p)}px ${hexA(C.refused, 0.35 * (1 - p))}`,
        fontFamily: FONT,
        color: C.refused,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 72, fontWeight: 600, letterSpacing: "-0.024em", lineHeight: 1 }}>
        <Ban size={58} color={C.refused} w={2.6} />
        Refused
      </div>
      <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.08em", fontWeight: 500 }}>E_NO_REFUND</div>
    </div>
  );
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
