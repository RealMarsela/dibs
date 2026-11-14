import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { World } from "../components/World";
import { H3, H4 } from "../handoffs";
import { C, IN_OUT_STRONG, LIST_SCALE } from "../tokens";
import { ROWS_ALL_PAID, ROWS_RESOLD } from "../components/Trip";
import { kf, lerp, prog } from "../lib/anim";
import { useT, type TT } from "./s04/time";
import { List, ROW_HS, ROW_W, rowY } from "./s04/List";
import { PUSH_S, WindowGroup } from "./s04/Window";
import { CH, HoleMeter, meterState } from "./s04/HoleMeter";
import { Ticket, type Flight } from "./s04/Ticket";
import { K, stubPoint, tearAt, TH, TS, TW } from "./s04/tear";
import { PRIYA_AT, ticketPose, TICKET_ROT, toLocal, toScreen } from "./s04/geo";
import { Swap } from "./s04/Swap";
import { mixHex } from "./s04/Sheet";

/* S04 "Can't make it". H3 → push into Ana's row → the resale window (footage `resale`): ask, "Get my $40 back"
   pressed on "refund", refused card, REFUSED · E_NO_REFUND stamp on "refuses" → the meter's hole (cell 04) and refill
   → cell 04 becomes Ana's tear ticket, the stub tears on "sells" → Priya brings $40, takes the stub and the seat →
   pull back: the ticket becomes row 04 → H4. */
const PUSH_EASE = Easing.bezier(0.5, 0, 0.2, 1);
const BG = "#232322";

export const S04: React.FC = () => {
  const T = useT();
  const { f } = T;
  if (f <= 3) return (<World><H3 /></World>);
  if (f >= T.end - 5) return (<World><H4 /></World>);
  return (
    <World>
      {f < T.win + 16 && <OpeningList T={T} />}
      {f >= T.pull && <ClosingList T={T} />}
      {f >= T.win && f < T.away + 30 && <WindowGroup T={T} />}
      {f >= T.meterIn && f < T.morph + 20 && <HoleMeter T={T} />}
      {f >= T.morph && f < T.morph + 24 && <CellToTicket T={T} />}
      {f >= T.morph + 3 && f < T.pull + 6 && <TicketOnStage T={T} />}
      {f >= T.pull && <TicketToRow T={T} />}
      {f >= T.meterIn && <Swap T={T} />}
    </World>
  );
};

/** A: H3, other rows dim to 30 %, camera pushes into Ana's row; B: the row hands over to the window. */
function OpeningList({ T }: { T: TT }) {
  const { f } = T;
  const dim = prog(f, T.dim, 24);
  const p = kf(f, [T.push, T.push + 46], [0, 1], PUSH_EASE);
  const gone = prog(f, T.win, 14);
  const rowOut = prog(f, T.win, 6);
  return (
    <List
      rows={ROWS_ALL_PAID}
      rowOpacity={(n) => (n === 4 ? 1 - rowOut : (1 - 0.7 * dim) * (1 - gone))}
      glass={1 - gone}
      highlight={prog(f, T.dim, 18)}
      highlightRow={4}
      cam={{ s: 1 + (PUSH_S - 1) * p, dy: (540 - rowY(4)) * p }}
    />
  );
}

/** F: the list assembles around row 04 as the camera pulls back; lands on H4's layout exactly. */
function ClosingList({ T }: { T: TT }) {
  const { f } = T;
  const pb = prog(f, T.pull, 30, IN_OUT_STRONG);
  const rowIn = (n: number) => (n === 4 ? prog(f, T.pull + 22, 8) : prog(f, T.pull + 20 + (Math.abs(n - 4) - 1) * 1.2, 9));
  return (
    <List
      rows={ROWS_RESOLD}
      rowOpacity={rowIn}
      rowLift={(n) => (n === 4 ? 0 : (1 - rowIn(n)) * 10)}
      glass={prog(f, T.pull + 6, 18)}
      cam={{ s: 1.05 - 0.05 * pb, dy: 0 }}
    />
  );
}

/** D: cell 04 of the meter grows into the ticket (green paid cell → the ticket's #232322 paper, 0 → -2 deg). */
function CellToTicket({ T }: { T: TT }) {
  const { f } = T;
  const m = prog(f, T.morph, 22, IN_OUT_STRONG);
  const { x, y, w, h } = ticketPose(T, f);
  const { green } = meterState(T);
  const cell = mixHex(C.fg, C.paid, green);
  const k = prog(f, T.morph + 2, 10);
  const col = k <= 0 ? cell : mixHex(C.paid, BG, k);
  const o = 1 - prog(f, T.morph + 8, 8);
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: lerp(CH / 2, 16 * K, m),
        background: col,
        border: `1.5px solid rgba(255,255,255,${0.14 * m})`,
        transform: `rotate(${TICKET_ROT * m}deg)`,
        opacity: o,
        boxShadow: `0 30px 60px -30px rgba(0,0,0,${0.8 * m})`,
      }}
    />
  );
}

/** D-E: the ticket itself: tear on "sells", the stub swings free, flies to Priya; the seat changes hands. */
function TicketOnStage({ T }: { T: TT }) {
  const { f } = T;
  const st = tearAt(f - T.tear);
  const pose = ticketPose(T, f);
  const ink = 1 - prog(f, T.pull - 6, 10);
  const show = prog(f, T.morph + 3, 8);
  // stub flight to Priya, in ticket-local space
  const fp = prog(f, T.stubFly, 18, IN_OUT_STRONG);
  let flight: Flight | undefined;
  if (fp > 0) {
    const hc = stubPoint(st, TW - TS / 2, TH / 2);
    const tgt = toLocal(PRIYA_AT.x, PRIYA_AT.y, f);
    flight = { dx: (tgt.x - hc.x) * fp, dy: (tgt.y - hc.y) * fp - Math.sin(Math.PI * fp) * 70, s: 1 - 0.72 * fp, o: 1 - prog(fp, 0.7, 0.3), ox: hc.x, oy: hc.y };
  }
  const ring = prog(f, T.anaOut + 4, 8) * (1 - prog(f, T.seat + 16, 6));
  return (
    <div
      style={{
        position: "absolute",
        left: pose.x - TW / 2,
        top: pose.y - TH / 2,
        transform: `rotate(${pose.rot}deg) scale(${pose.sc})`,
        opacity: show,
      }}
    >
      <Ticket
        st={st}
        ink={ink}
        ana={1 - prog(f, T.anaOut, 8)}
        priya={prog(f, T.seat + 22, 8)}
        ring={ring}
        anaFace={f < T.anaOut ? 1 : 0}
        stub={f < T.stubFly + 19 ? 1 : 0}
        flight={flight}
        body={1 - prog(f, T.pull + 2, 4)}
      />
    </div>
  );
}

/** F: the ticket body becomes row 04's box (no fill, list row size), its ink fading as the row's text arrives. */
function TicketToRow({ T }: { T: TT }) {
  const { f } = T;
  const m = prog(f, T.pull, 30, IN_OUT_STRONG);
  const from = toScreen((TW - TS) / 2, TH / 2, T.pull);
  const x = lerp(from.x, 960, m);
  const y = lerp(from.y, rowY(4), m);
  const w = lerp(TW - TS, ROW_W, m);
  const h = lerp(TH, ROW_HS, m);
  const fill = (1 - prog(f, T.pull + 12, 18)) * prog(f, T.pull + 1, 3);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: x - w / 2,
          top: y - h / 2,
          width: w,
          height: h,
          borderRadius: lerp(16 * K, 22 * LIST_SCALE, m),
          background: `rgba(35,35,34,${fill})`,
          border: `1.5px solid rgba(255,255,255,${0.14 * fill})`,
          transform: `rotate(${TICKET_ROT * (1 - m)}deg)`,
        }}
      />
    </AbsoluteFill>
  );
}
