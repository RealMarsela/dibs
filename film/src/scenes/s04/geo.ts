import { IN_OUT_STRONG } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { CH, CW, cellX, MY } from "./HoleMeter";
import { TH, TW } from "./tear";
import type { TT } from "./time";

/* Where the ticket lives on screen. It floats a little (motion never stops) and sits at the app's -2 deg. */
export const TICKET_ROT = -2;
export const TC = (f: number) => ({ x: 860, y: 520 + 3 * Math.sin(f / 28) });

/** Ticket-local point → screen point. */
export function toScreen(lx: number, ly: number, f: number, rotDeg = TICKET_ROT) {
  const c = TC(f);
  const a = (rotDeg * Math.PI) / 180;
  const dx = lx - TW / 2;
  const dy = ly - TH / 2;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
}
/** Screen point → ticket-local point. */
export function toLocal(x: number, y: number, f: number, rotDeg = TICKET_ROT) {
  const c = TC(f);
  const a = (-rotDeg * Math.PI) / 180;
  const dx = x - c.x;
  const dy = y - c.y;
  return { x: TW / 2 + dx * Math.cos(a) - dy * Math.sin(a), y: TH / 2 + dx * Math.sin(a) + dy * Math.cos(a) };
}

export const PRIYA_AT = { x: 1706, y: 500 };
export const PRIYA_SIZE = 132;
export const CHIP_AT = { x: 1706, y: 624 };
export const ANA_OUT = { x: 212, y: 556 };
export const ANA_SIZE_OUT = 100;
export const PLUS_AT = { x: 212, y: 664 };
export const COIN_CTRL = { x: 960, y: 1010 };

/** Quadratic Bézier point. */
export function bez(p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}

/* The ticket's pose while meter cell 04 grows into it: the box goes from the cell's rect to the ticket's; the ticket
   itself (text and all) rides inside at a uniform scale that fits the box, so it never reads as an empty card. */
export type Pose = { x: number; y: number; w: number; h: number; sc: number; rot: number };
export function ticketPose(T: TT, f: number): Pose {
  const m = prog(f, T.morph, 22, IN_OUT_STRONG);
  const c = TC(f);
  const w = lerp(CW, TW, m);
  const h = lerp(CH, TH, m);
  return { x: lerp(cellX(3), c.x, m), y: lerp(MY, c.y, m), w, h, sc: Math.min(w / TW, h / TH), rot: TICKET_ROT * m };
}
/** Ticket-local point → screen point for a pose. */
export function poseScreen(p: Pose, lx: number, ly: number) {
  const a = (p.rot * Math.PI) / 180;
  const dx = (lx - TW / 2) * p.sc;
  const dy = (ly - TH / 2) * p.sc;
  return { x: p.x + dx * Math.cos(a) - dy * Math.sin(a), y: p.y + dx * Math.sin(a) + dy * Math.cos(a) };
}
