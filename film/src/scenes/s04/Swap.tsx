import React from "react";
import { AbsoluteFill, spring } from "remotion";
import { C, EASE, FONT, IN_OUT_STRONG } from "../../tokens";
import { Face, idle } from "../../components/LetterFace";
import { hexA } from "../../components/Surfaces";
import { kf, lerp, prog } from "../../lib/anim";
import { useScene } from "../../scene";
import { cellX, MY } from "./HoleMeter";
import { FACE_SPOT } from "./Ticket";
import { ANA_OUT, ANA_SIZE_OUT, bez, CHIP_AT, COIN_CTRL, PLUS_AT, poseScreen, PRIYA_AT, PRIYA_SIZE, ticketPose, TICKET_ROT, toScreen } from "./geo";
import { ROW_FACE, rowFace } from "./List";
import type { TT } from "./time";

/* Screen-space people for the meter → ticket → list stretch: Ana (from her meter cell into the ticket, then out with
   her +$40), Priya (in from the right with "$40 ready", into the ticket's face spot, then into row 04), and the coin. */

const GreenChip = ({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: 54,
      padding: "0 22px",
      borderRadius: 999,
      fontFamily: FONT,
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: C.paid,
      background: hexA(C.paid, 0.15),
      border: `2px solid ${hexA(C.paid, 0.25)}`,
      whiteSpace: "nowrap",
      transform: `scale(${scale})`,
      fontVariantNumeric: "tabular-nums",
    }}
  >
    {children}
  </div>
);

const Place = ({ x, y, o = 1, children, z }: { x: number; y: number; o?: number; children: React.ReactNode; z?: number }) =>
  o <= 0 ? null : (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", opacity: o, zIndex: z }}>{children}</div>
  );

export function Swap({ T }: { T: TT }) {
  const { f } = T;
  const { A } = useScene();
  const pose = ticketPose(T, f);
  const spot = poseScreen(pose, FACE_SPOT.x, FACE_SPOT.y);

  /* Ana */
  const meterPos = { x: cellX(3), y: MY - 62 };
  const lift = prog(f, T.hole, 12) * (1 - prog(f, T.refill, 12));
  const out = prog(f, T.anaOut, 18, EASE);
  // above her meter cell; as the cell lifts into the ticket she drops into it (the ticket draws her while docked)
  const sink = prog(f, T.morph - 2, 8, IN_OUT_STRONG);
  let ana = { x: meterPos.x, y: lerp(meterPos.y - 30 * lift, pose.y, sink), s: lerp(56, 30, sink) };
  if (f >= T.anaOut) ana = { x: lerp(spot.x, ANA_OUT.x, out), y: lerp(spot.y, ANA_OUT.y, out) - Math.sin(Math.PI * out) * 60, s: lerp(FACE_SPOT.size, ANA_SIZE_OUT, out) };
  const anaO = prog(f, T.meterIn + 6, 14) * (1 - 0.45 * lift) * (1 - prog(f, T.morph + 2, 4)) + (f >= T.anaOut ? 1 - prog(f, T.pull, 16) : 0);
  const anaIdle = f >= T.anaOut ? `${idle(A, "ana", out)} rotate(${TICKET_ROT * (1 - out)}deg)` : idle(A, "ana");
  const anaDrift = prog(f, T.pull, 16) * -24;

  /* Priya */
  const enter = prog(f, T.priya, 20, EASE);
  const seat = prog(f, T.seat, 22, IN_OUT_STRONG);
  const toRow = prog(f, T.pull + 4, 24, IN_OUT_STRONG);
  const row = rowFace(4);
  const pStart = { x: lerp(2100, PRIYA_AT.x, enter), y: PRIYA_AT.y };
  const pSeat = { x: lerp(pStart.x, spot.x, seat), y: lerp(pStart.y, spot.y, seat) + Math.sin(Math.PI * seat) * 32 };
  const spotAtPull = toScreen(FACE_SPOT.x, FACE_SPOT.y, T.pull);
  const docked = f >= T.pull ? spotAtPull : pSeat;
  const priya = { x: lerp(docked.x, row.x, toRow), y: lerp(docked.y, row.y, toRow), s: lerp(lerp(PRIYA_SIZE, FACE_SPOT.size, seat), ROW_FACE, toRow) };
  const catchBump = kf(f, [T.stubFly + 12, T.stubFly + 17, T.stubFly + 24], [1, 1.08, 1]);
  const priyaIdle = idle(A, "priya", seat > 0.99 ? 0.25 * (1 - toRow) : 1);

  /* "$40 ready" chip, then the coin to Ana, then Ana's "+$40" */
  const chipIn = prog(f, T.priya + 5, 18, EASE);
  const chipO = chipIn * (1 - prog(f, T.coin - 2, 5));
  const chipX = lerp(2100, CHIP_AT.x, chipIn);
  const ct = prog(f, T.coin, 20, IN_OUT_STRONG);
  const coin = bez(CHIP_AT, COIN_CTRL, PLUS_AT, ct);
  const coinO = f >= T.coin - 2 && f < T.coin + 21 ? 1 : 0;
  const land = f - (T.coin + 19);
  const plus = land >= 0 ? spring({ frame: land, fps: 30, config: { damping: 12, stiffness: 200 } }) : 0;
  const plusO = (land >= 0 ? 1 : 0) * (1 - prog(f, T.pull, 16));
  const anaBump = kf(f, [T.coin + 18, T.coin + 23, T.coin + 30], [1, 1.07, 1]);
  const anaDocked = f >= T.anaOut ? { x: ana.x + anaDrift, y: ana.y } : ana;

  return (
    <AbsoluteFill>
      {f >= T.meterIn && f < T.pull + 18 && anaO > 0 && (
        <Place x={anaDocked.x} y={anaDocked.y} o={anaO}>
          <div style={{ transform: `${anaIdle} scale(${anaBump})` }}>
            <Face id="ana" size={ana.s} />
          </div>
        </Place>
      )}
      {f >= T.coin + 18 && (
        <Place x={PLUS_AT.x + anaDrift} y={PLUS_AT.y} o={plusO}>
          <GreenChip scale={0.6 + 0.4 * plus}>+$40</GreenChip>
        </Place>
      )}
      {f >= T.priya && chipO > 0 && (
        <Place x={chipX} y={CHIP_AT.y} o={chipO}>
          <GreenChip>$40 ready</GreenChip>
        </Place>
      )}
      {coinO > 0 && (
        <Place x={coin.x} y={coin.y} o={1 - prog(f, T.coin + 17, 3)}>
          <GreenChip>$40</GreenChip>
        </Place>
      )}
      {f >= T.priya && f < T.pull + 30 && (
        <Place x={priya.x} y={priya.y} z={2}>
          <div style={{ transform: `${priyaIdle} scale(${catchBump})` }}>
            <Face id="priya" size={priya.s} />
          </div>
        </Place>
      )}
    </AbsoluteFill>
  );
}
