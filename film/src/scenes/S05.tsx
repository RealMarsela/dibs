import React from "react";
import { AbsoluteFill, Easing, interpolateColors } from "remotion";
import { World } from "../components/World";
import { Centre, H4, H5 } from "../handoffs";
import { useScene } from "../scene";
import { kf, lerp, prog } from "../lib/anim";
import { C, EASE, OE } from "../tokens";
import { ROWS_DRAWN, ROWS_RESOLD } from "../components/Trip";
import { DrawList, type Layer, type RowFx } from "./s05/DrawList";
import { ProofChip, VrfChip } from "./s05/Chips";
import { reel, TICKS } from "./s05/roll";

/* S05 Fair draw. From H4 (the resold list): on "eight beds are paid" the Paid badges brighten in a green wave and the
   camera eases back; the "OutLayer VRF" chip rises above the list; on "verifiable randomness decides" every sub-line
   rolls through bed names (the app's rolling state: grey, slightly blurred, ticks slowing like 70 + tick*12 ms) and
   locks in white on its drawn bed, top to bottom, by "where"; on "so nobody argues over the double room" Leo's row
   gets the "you" ring and the proof chip rises under the list; both fade and the frame lands on H5.
   The list itself never moves: only the camera scales about the frame centre and returns to exactly 1. */

const SOFT = Easing.bezier(0.45, 0, 0.25, 1);
const VRF_Y = 140; // chip centres in camera space (1:1 at the end), clear of the list (y 195-885) and the 96 px margin
const PROOF_Y = 936;
const HOLD = 250; // from here the frame is <H5/> itself
const LEO = 3;
const REEL = 22; // reel travel per tick: outgoing and incoming names never overlap inside the 24 px slot

export const S05: React.FC = () => {
  const { f, cue, cueEnd } = useScene();
  if (f === 0) return <World><H4 /></World>;
  if (f >= HOLD) return <World><H5 /></World>;

  const tOnce = cue("L05", "once");
  const tEight = cue("L05", "eight");
  const tOutLayer = cue("L05", "OutLayer's");
  const tVer = cue("L05", "verifiable");
  const tWho = cue("L05", "who");
  const tSo = cue("L05", "so");
  const tOver = cue("L05", "over");
  const tRoomEnd = cueEnd("L05", "room");

  // Draw clock: rows start rolling in a quick wave on "verifiable"; they lock top to bottom from "who", the last
  // one before "where" (cue("L05","where") = local 156).
  const start = (i: number) => tVer + 2 * i;
  const lock = (i: number) => tWho - 1 + 3 * i;
  const lastLock = lock(7);
  const fadeOut = tRoomEnd - 1;

  // Camera: ease back on "once all eight beds are paid", drift in very slowly through the draw, push back to 1:1
  // on "over the double room" and hold before H5.
  const pushStart = tOver - 10;
  const s =
    f <= tOutLayer + 6
      ? kf(f, [tOnce, tOutLayer + 6], [1, 0.98], SOFT)
      : f <= pushStart
        ? lerp(0.98, 0.984, (f - tOutLayer - 6) / (pushStart - tOutLayer - 6))
        : kf(f, [pushStart, HOLD - 6], [0.984, 1], SOFT);

  const items = ROWS_RESOLD.map((row, i) => {
    const g0 = tEight + 3 * i;
    const glow = kf(f, [g0, g0 + 6, g0 + 26], [0, 1, 0], [EASE, OE]);
    const ring = row.n === LEO ? kf(f, [tOver, tOver + 10, fadeOut, fadeOut + 14], [0, 1, 1, 0], [EASE, EASE, OE]) : 0;
    const r = reel(f, start(i), lock(i), row.n);
    const settled = f >= lock(i) + 20;
    let layers: Layer[] | undefined;
    let flash = 0;
    if (r && !settled) {
      const roll = 0.6 + 1.0 * r.speed; // the app's 0.4 css px blur at film scale, more while the reel is fast
      const landed = r.k === TICKS;
      const ct = landed ? prog(f, lock(i), 7, EASE) : 0;
      layers = [];
      if (f < start(i) + 4) {
        const o = prog(f, start(i), 3, OE);
        layers.push({ sub: row.sub, y: o * REEL, opacity: 1 - o, blur: o * 3 });
      }
      if (r.prev && r.e < 1) layers.push({ text: r.prev, color: C.fg3, y: r.e * REEL, opacity: 1 - r.e, blur: roll });
      layers.push({
        text: r.cur,
        color: landed ? interpolateColors(ct, [0, 1], [C.fg3, C.fg]) : C.fg3,
        y: -(1 - r.e) * REEL,
        opacity: r.e,
        blur: roll * (1 - ct),
      });
      flash = kf(f, [lock(i), lock(i) + 3, lock(i) + 20], [0, 0.9, 0]);
    }
    const shown = settled || (r && r.k === TICKS) ? ROWS_DRAWN[i] : row;
    const active = glow > 0 || ring > 0 || layers !== undefined;
    const fx: RowFx | undefined = active ? { glow, ring, flash, layers } : undefined;
    return { row: shown, fx };
  });

  // VRF chip: rises on "OutLayer's", the dice spins down with the draw, leaves once every bed is locked.
  const vIn = prog(f, tOutLayer - 8, 18, EASE);
  const vOut = prog(f, lastLock + 8, 12, OE);
  const vOp = vIn * (1 - vOut);
  const spin = kf(f, [tVer, lastLock], [0, 360], Easing.out(Easing.cubic));
  // Proof chip: rises under the list on "so", fades with the ring at the end of "room".
  const pIn = prog(f, tSo, 18, EASE);
  const pOut = prog(f, fadeOut, 14, OE);
  const pOp = pIn * (1 - pOut);

  return (
    <World>
      <AbsoluteFill style={s !== 1 ? { transform: `scale(${s})`, transformOrigin: "960px 540px" } : undefined}>
        <Centre cx={960} cy={540}>
          <DrawList items={items} />
        </Centre>
        {vOp > 0.001 && (
          <Centre cx={960} cy={VRF_Y}>
            <div style={{ opacity: vOp, transform: `translateY(${(1 - vIn) * 18 - vOut * 12}px)`, filter: vIn < 1 || vOut > 0 ? `blur(${(1 - vIn) * 8 + vOut * 10}px)` : undefined }}>
              <VrfChip spin={spin} />
            </div>
          </Centre>
        )}
        {pOp > 0.001 && (
          <Centre cx={960} cy={PROOF_Y}>
            <div style={{ opacity: pOp, transform: `translateY(${(1 - pIn) * 18}px)`, filter: pIn < 1 || pOut > 0 ? `blur(${(1 - pIn) * 8 + pOut * 6}px)` : undefined }}>
              <ProofChip />
            </div>
          </Centre>
        )}
      </AbsoluteFill>
    </World>
  );
};
