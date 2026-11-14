import React from "react";
import { interpolate } from "remotion";
import { C, FONT, MONO, EASE, OE } from "../../tokens";
import { Badge, hexA } from "../../components/Surfaces";
import { prog } from "../../lib/anim";
import { FORGED_TOTAL, TX_SHORT, type T08 } from "./data";

/* Local copies of InboxPanel's row markup (components/Trip.tsx) so the forged row can animate.
   Same paddings, sizes and colours as the shared row, so row 1 and row 2 read as one list. */

export const ROW_PAD = "16px 22px";
export const ROW_W = 944; // InboxPanel inner width (1000 - 2 x 28)
export const ROW_H = 82.1; // measured: 16 + 24 px line + 18 px line + 16
export const ROW2_FULL = 12 + ROW_H; // marginTop + row
export const CHIP_FULL = 12 + 92; // marginTop + chip (16 + 2 x 30 + 16)

export function MailIcon({ size = 28, stroke }: { size?: number; stroke: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/** The inside of one inbox row: icon, subject + sender line, status on the right. */
export function RowBody({ icon, sub, status, style }: { icon: string; sub: string; status: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: ROW_PAD, fontFamily: FONT, ...style }}>
      <MailIcon stroke={icon} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 24, fontWeight: 500, color: C.fg }}>Your booking is confirmed</span>
        <span style={{ display: "block", fontSize: 18, color: C.fg3 }}>{sub}</span>
      </span>
      {status}
    </div>
  );
}

const Checking = () => <span style={{ fontSize: 19, color: C.fg2 }}>Checking…</span>;
export const FORGED_SUB = `from booking.com · Total ${FORGED_TOTAL}`;

/** Row 2 at rest before the verdict (also the morph box's last layer, so the swap is invisible). */
export const ForgedRowBody = () => <RowBody icon={C.fg2} sub={FORGED_SUB} status={<Checking />} />;

/** Row 2 inside the panel: Checking… then Refused (rose) with a small decaying shake on "refuses". */
export function ForgedRow({ f, t }: { f: number; t: T08 }) {
  const v = prog(f, t.refuses, 9, EASE); // verdict lands
  const k = f - t.refuses;
  const shake = k > 0 ? 10 * Math.sin(k * 2.1) * Math.exp(-k / 5) : 0;
  const icon = v > 0.5 ? C.refused : C.fg2;
  const status = (
    <span style={{ position: "relative", width: 118, height: 33, flexShrink: 0 }}>
      <span style={{ position: "absolute", right: 0, top: 4, opacity: 1 - prog(f, t.refuses - 2, 5) }}>
        <Checking />
      </span>
      <span style={{ position: "absolute", right: 0, top: 0, opacity: v, transform: `scale(${0.7 + 0.3 * v})`, transformOrigin: "100% 50%" }}>
        <Badge kind="refused" s={1.5} />
      </span>
    </span>
  );
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 22,
        background: "rgba(255,255,255,0.05)",
        boxShadow: v > 0 ? `inset 0 0 0 1.5px ${hexA(C.refused, 0.28 * v)}` : undefined,
        transform: shake ? `translateX(${shake}px)` : undefined,
        position: "relative",
        opacity: f >= t.swap ? 1 : 0,
      }}
    >
      {v > 0 && <div style={{ position: "absolute", inset: 0, borderRadius: 22, background: hexA(C.refused, 0.07 * v) }} />}
      <RowBody icon={icon} sub={FORGED_SUB} status={status} style={{ position: "relative" }} />
    </div>
  );
}

/** The verdict chip under row 2 (mono): why it failed and what the chain stored. */
export function VerdictChip({ f, t }: { f: number; t: T08 }) {
  const seg = (i: number) => {
    const p = interpolate(f, [t.chip + 2 + i * 2, t.chip + 12 + i * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
    return { display: "inline-block", opacity: p, filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined, transform: `translateY(${(1 - p) * 6}px)` } as React.CSSProperties;
  };
  const dot = <span style={{ color: C.fg3 }}>{"\u00a0·\u00a0"}</span>;
  return (
    <div style={{ marginTop: 12, borderRadius: 22, background: hexA(C.refused, 0.1), padding: "16px 22px", fontFamily: MONO, fontSize: 22, lineHeight: "30px", letterSpacing: "-0.01em", color: C.fg2, whiteSpace: "nowrap" }}>
      <div>
        <span style={{ ...seg(0), color: C.refused }}>Body edited after booking.com signed it</span>
      </div>
      <div>
        <span style={seg(1)}>
          proof_refused <span style={{ color: C.refused }}>E_NO_RESULT</span>
          {dot}
        </span>
        <span style={seg(2)}>tx {TX_SHORT}</span>
        <span style={seg(3)}>
          {dot}
          <span style={{ color: C.fg }}>DAO untouched</span>
        </span>
      </div>
    </div>
  );
}

/** Grows a block's height from 0 without clipping a sideways shake (wrapper bleeds 40 px each side). */
export function Grow({ h, children }: { h: number; children: React.ReactNode }) {
  return <div style={{ height: h, overflow: "hidden", margin: "0 -40px", padding: "0 40px" }}>{children}</div>;
}
