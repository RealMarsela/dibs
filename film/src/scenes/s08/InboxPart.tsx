import React from "react";
import { AbsoluteFill } from "remotion";
import { C, GLASS, EASE, IN_OUT_STRONG } from "../../tokens";
import { InboxPanel } from "../../components/Trip";
import { Badge } from "../../components/Surfaces";
import { kf, lerp, prog } from "../../lib/anim";
import { CARD_H, CARD_W, ForgedCardBody } from "./ForgedCard";
import { CHIP_FULL, ForgedRow, ForgedRowBody, Grow, ROW2_FULL, ROW_H, ROW_W, RowBody, VerdictChip } from "./Rows";
import type { T08 } from "./data";

/* Shots 1-2: H7's inbox; a copy of the verified email lifts out in front (the inbox racks back out of focus),
   opens into the full email and its total is retyped; it flies back in as row 2, "Checking…", then Refused.
   World coords: (0,0) = frame centre. A 2D camera (scale about a look-at point) wraps everything, identity at f0. */

const PANEL_H0 = 251; // measured height of H7's InboxPanel
const CARD_Y = 50;
type Rect = { x: number; y: number; w: number; h: number; r: number };
const lerpRect = (a: Rect, b: Rect, p: number): Rect => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), r: lerp(a.r, b.r, p) });
const CARD: Rect = { x: 0, y: CARD_Y, w: CARD_W, h: CARD_H, r: 32 };

/** Rect of the panel's last row (bottom-anchored), given the panel's centre y, own scale and current extra heights. */
function lastRow(pcY: number, k: number, hp: number, below: number): Rect {
  return { x: 0, y: pcY + k * (hp / 2 - 28 - below - ROW_H / 2), w: ROW_W * k, h: ROW_H * k, r: 22 * k };
}

export function InboxPart({ f, t }: { f: number; t: T08 }) {
  // Panel: racks back while the forged card is in front, returns, then recedes for the grid.
  const back1 = prog(f, t.lift, 22, EASE) * (1 - prog(f, t.back + 4, 22, EASE));
  const gone = prog(f, t.recede, 18, EASE);
  const k = 1 - 0.14 * back1 - 0.16 * gone;
  const pcY = -90 * back1;
  const pOpacity = (1 - 0.6 * back1) * (1 - gone);
  const pBlur = 6 * back1 + 10 * gone;
  const h2 = ROW2_FULL * prog(f, t.back, 24, EASE);
  const hc = CHIP_FULL * prog(f, t.chip, 16, EASE);
  const hp = PANEL_H0 + h2 + hc;

  // Camera: push toward the total line during the retype, pull back as the card returns, then a slow drift.
  const s = kf(f, [6, 36, t.back, t.swap, t.recede + 18], [1, 1.14, 1.15, 1, 1.035], [EASE, EASE, IN_OUT_STRONG, EASE]);
  const cy = kf(f, [6, 36, t.back, t.swap, t.recede + 18], [0, CARD_Y + 60, CARD_Y + 66, 0, 24], [EASE, EASE, IN_OUT_STRONG, EASE]);
  const camT = s === 1 && cy === 0 ? undefined : `scale(${s}) translate(0px, ${-cy}px)`;

  // The flying email: row 1's copy -> open card -> row 2.
  const p1 = prog(f, t.lift, 24, EASE);
  const p2 = prog(f, t.back, t.swap - t.back, EASE);
  const startR = lastRow(pcY, k, PANEL_H0, 0);
  const endR = lastRow(pcY, k, hp, hc);
  const box = f < t.back ? lerpRect(startR, CARD, p1) : lerpRect(CARD, endR, p2);
  const showBox = f >= t.lift && f < t.swap;
  const glassA = f < t.back ? prog(f, t.lift, 3) : 1 - prog(f, t.back + 10, 14); // opaque at once: nothing reads through it
  const r1A = 1 - prog(f, t.lift + 3, 6);
  const cA = prog(f, t.lift + 3, 8) * (1 - prog(f, t.back + 6, 8)); // overlaps r1A: the box is never empty
  const r2A = prog(f, t.back + 5, 8);

  const layer = (natW: number, natH: number, a: number, node: React.ReactNode) => {
    const sc = Math.min(box.w / natW, box.h / natH); // uniform fit, centred: content never clips while the box morphs
    return (
      <div style={{ position: "absolute", left: (box.w - natW * sc) / 2, top: (box.h - natH * sc) / 2, width: natW, transform: `scale(${sc})`, transformOrigin: "0 0", opacity: a }}>{node}</div>
    );
  };

  return (
    <AbsoluteFill style={{ transform: camT, transformOrigin: "960px 540px" }}>
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 540 + pcY,
          transform: `translate(-50%, -50%)${k !== 1 ? ` scale(${k})` : ""}`,
          opacity: pOpacity < 1 ? pOpacity : undefined,
          filter: pBlur > 0.01 ? `blur(${pBlur}px)` : undefined,
        }}
      >
        <InboxPanel items={[{ from: "booking.com", subject: "Your booking is confirmed", status: "verified" }]}>
          <Grow h={h2}>
            <ForgedRow f={f} t={t} />
          </Grow>
          <Grow h={hc}>{hc > 0 && <VerdictChip f={f} t={t} />}</Grow>
        </InboxPanel>
      </div>
      {showBox && (
        <div
          style={{
            position: "absolute",
            left: 960 + box.x - box.w / 2,
            top: 540 + box.y - box.h / 2,
            width: box.w,
            height: box.h,
            borderRadius: box.r,
            overflow: "hidden",
          }}
        >
          <div style={{ ...GLASS, position: "absolute", inset: 0, borderRadius: box.r, opacity: glassA, background: C.raise, border: `1px solid ${C.lineStrong}` }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: box.r, background: "rgba(255,255,255,0.05)", opacity: 1 - glassA }} />
          {r1A > 0 && layer(ROW_W, ROW_H, r1A, <RowBody icon={C.paid} sub="from booking.com" status={<Badge kind="verified" s={1.5} />} />)}
          {cA > 0 && layer(CARD_W, CARD_H, cA, <ForgedCardBody f={f} t={t} />)}
          {r2A > 0 && layer(ROW_W, ROW_H, r2A, <ForgedRowBody />)}
        </div>
      )}
    </AbsoluteFill>
  );
}

