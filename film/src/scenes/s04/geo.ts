import { TH, TW } from "./tear";

/* Where the ticket lives on screen. It floats a little (motion never stops) and sits at the app's -2 deg. */
export const TICKET_ROT = -2;
export const TC = (f: number) => ({ x: 940, y: 540 + 3 * Math.sin(f / 28) });

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

export const PRIYA_AT = { x: 1660, y: 530 };
export const PRIYA_SIZE = 120;
export const CHIP_AT = { x: 1660, y: 640 };
export const ANA_OUT = { x: 372, y: 590 };
export const ANA_SIZE_OUT = 84;
export const PLUS_AT = { x: 372, y: 686 };

/** Quadratic Bézier point. */
export function bez(p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}
