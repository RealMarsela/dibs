import React from "react";
import { AbsoluteFill, Easing, interpolateColors } from "remotion";
import { World } from "../components/World";
import { Centre, H4, H5 } from "../handoffs";
import { useScene } from "../scene";
import { kf, lerp, prog } from "../lib/anim";
import { C, EASE, LIST_SCALE, OE } from "../tokens";
import { ROWS_DRAWN, ROWS_RESOLD } from "../components/Trip";
import { DrawList, type Layer, type RowFx } from "./s05/DrawList";
import { ProofChip, VrfChip } from "./s05/Chips";
import { reel, TICKS } from "./s05/roll";

/* S05 Fair draw. From H4 (the resold list): on "eight beds are paid" the Paid badges brighten in a green wave and the
   camera eases back; the "OutLayer VRF" chip rises above the list; on "verifiable randomness decides" every sub-line
   rolls through bed names (the app's rolling state: grey, slightly blurred, ticks slowing like 70 + tick*12 ms) and
   locks in white on its drawn bed, top to bottom, by "where"; on "so nobody argues over the double room" Leo's row
   gets the "you" ring and the proof chip rises under the list; both fade and the frame lands on H5.
   The list itself never moves (LIST_SCALE, as in H4/H5): only the camera scales about the frame centre. It pulls back
   to ~0.83 so the chips fit above and below the list inside the 96 px margin, and pushes back in to exactly 1 after
   the proof chip has faded. Chips live in camera space; world sizes are chosen so they read >= 19 px on screen. */

const SOFT = Easing.bezier(0.45, 0, 0.25, 1);
// World (camera 1:1) layout: the list spans y 108.75-971.25. Chips sit 26 px off its edges; at camera 0.83-0.835
// the VRF chip's top is >= 103 px and the proof chip's bottom <= 974 px on screen.
const VRF_S = 1.1; // chip scale in world px (VrfChip is 60 tall -> 66)
const PROOF_S = 1.15; // ProofChip is 54 tall -> 62
const VRF_Y = 108.75 - 26 - 33;
const PROOF_Y = 971.25 + 26 + 31;
const CAM_DRAW = 0.83;
const HOLD = 256; // from here the frame is <H5/> itself
const PUSH_END = HOLD - 6; // camera is exactly 1 (no transform) for the frames before the switch
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
  const tOver = cue("L05", "over");
  const tRoomEnd = cueEnd("L05", "room");

  // Draw clock: rows start rolling in a quick wave on "verifiable"; they lock top to bottom from "who", the last
  // one before "where" (cue("L05","where") = local 156).
  const start = (i: number) => tVer + 2 * i;
  const lock = (i: number) => tWho - 1 + 3 * i;
  const lastLock = lock(7);
  const pushStart = PUSH_END - 22;
  const ringOut = tRoomEnd - 9; // the ring fades as "room" ends, during the push-in
  const proofOut = pushStart - 8; // the proof chip is gone before the camera pushes it past the margin

  // Camera: ease back on "once all eight beds are paid" (done before the VRF chip rises), drift in very slowly
  // through the draw, push back to 1:1 once the proof chip has faded, and hold on H5.
  const pullEnd = tOutLayer - 8;
  const s =
    f <= pullEnd
      ? kf(f, [tOnce, pullEnd], [1, CAM_DRAW], SOFT)
      : f <= pushStart
        ? lerp(CAM_DRAW, CAM_DRAW + 0.005, (f - pullEnd) / (pushStart - pullEnd))
        : kf(f, [pushStart, PUSH_END], [CAM_DRAW + 0.005, 1], SOFT);

  const items = ROWS_RESOLD.map((row, i) => {
    const g0 = tEight + 3 * i;
    const glow = kf(f, [g0, g0 + 6, g0 + 26], [0, 1, 0], [EASE, OE]);
    const ring = row.n === LEO ? kf(f, [tOver, tOver + 10, ringOut, ringOut + 14], [0, 1, 1, 0], [EASE, EASE, OE]) : 0;
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
  // Proof chip: rises under the list as the last bed locks (just before "so"), readable ~1.8 s, fades before the push.
  const pIn = prog(f, lastLock + 6, 18, EASE);
  const pOut = prog(f, proofOut, 12, OE);
  const pOp = pIn * (1 - pOut);

  return (
    <World>
      <AbsoluteFill style={s !== 1 ? { transform: `scale(${s})`, transformOrigin: "960px 540px" } : undefined}>
        <Centre cx={960} cy={540}>
          <div style={{ transform: `scale(${LIST_SCALE})` }}>
            <DrawList items={items} />
          </div>
        </Centre>
        {vOp > 0.001 && (
          <Centre cx={960} cy={VRF_Y}>
            <div style={{ opacity: vOp, transform: `translateY(${(1 - vIn) * 18 - vOut * 12}px)`, filter: vIn < 1 || vOut > 0 ? `blur(${(1 - vIn) * 8 + vOut * 10}px)` : undefined }}>
              <div style={{ transform: `scale(${VRF_S})` }}>
                <VrfChip spin={spin} />
              </div>
            </div>
          </Centre>
        )}
        {pOp > 0.001 && (
          <Centre cx={960} cy={PROOF_Y}>
            <div style={{ opacity: pOp, transform: `translateY(${(1 - pIn) * 18}px)`, filter: pIn < 1 || pOut > 0 ? `blur(${(1 - pIn) * 8 + pOut * 6}px)` : undefined }}>
              <div style={{ transform: `scale(${PROOF_S})` }}>
                <ProofChip />
              </div>
            </div>
          </Centre>
        )}
      </AbsoluteFill>
    </World>
  );
};
