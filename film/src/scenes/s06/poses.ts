import { Easing, spring } from "remotion";
import { EASE, IN_OUT_STRONG, OUT_STRONG, SPRING } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { ROW_H } from "../../components/Trip";

/* S06 choreography as plain functions of the local frame. Every narrated beat comes from cue() via times(). */
type CueFn = (line: string, word: string, nth?: number) => number;

export function times(cue: CueFn) {
  const c = (w: string, n = 0) => cue("L06", w, n);
  return {
    books: c("books"), not: c("not"), with: c("with"), her: c("her"), own: c("own"), money: c("money"),
    an: c("an"), outlayer: c("OutLayer"), called: c("called"), near: c("NEAR"), issues: c("issues"),
    card: c("card"), sealed: c("sealed"), mayas: c("Maya's"), passkey: c("passkey"), only: c("only"), hotels: c("hotels"),
    so: c("so"), hotel: c("hotel"), through: c("through"), electronics: c("electronics"), declined: c("declined"),
    card2: c("card", 1), lithics: c("Lithic's"), sandbox: c("sandbox"),
  };
}
export type Times = ReturnType<typeof times>;

/** Face centres of the H5 list rows (measured from a render of H5: faces span x 559-611, y 220-272 for row 1). */
export const SLOT = (i: number) => ({ x: 585, y: 246 + ROW_H * i });

/** Faces leave the list slowly at first so they never cross row text that is still readable. */
export const GATHER = Easing.bezier(0.5, 0, 0.2, 1);

export const CUBE = { x: 1250, y: 540 };
const CARD_HERO = { x: 960, y: 470 };
const CARD_SIDE = { x: 620, y: 470 };
/** Where Maya's face docks relative to the card centre (just outside its bottom-left corner). */
export const DOCK = { dx: -326, dy: 214 };

/** Triangle bump 0 → 1 → 0 over `dur` frames starting at f0. */
export function bump(f: number, f0: number, dur: number): number {
  const t = (f - f0) / dur;
  return t <= 0 || t >= 1 ? 0 : 1 - Math.abs(t * 2 - 1);
}

export function cardPose(f: number, T: Times, end: number) {
  const t0 = T.issues + 3;
  const rise = prog(f, t0, 22, OUT_STRONG);
  const glide = prog(f, t0 + 20, 36, EASE);
  const sp = f < t0 ? 0 : spring({ frame: f - t0, fps: 30, config: SPRING, durationInFrames: 40 });
  const side = prog(f, T.so - 6, 28, EASE);
  const home = prog(f, end - 30, 28, EASE);
  const yRise = lerp(CUBE.y - 70, 212, rise);
  const x = lerp(CUBE.x, CARD_HERO.x, glide) + (CARD_SIDE.x - CARD_HERO.x) * side + (960 - CARD_SIDE.x) * home;
  const env = prog(f, t0 + 50, 30) * (1 - prog(f, end - 40, 12));
  const y = lerp(yRise, CARD_HERO.y, glide) + (540 - CARD_HERO.y) * home + Math.sin(f / 36) * 3 * env;
  return {
    on: f >= t0,
    front: f >= t0 + 22,
    clipY: CUBE.y - 150,
    x,
    y,
    s: lerp(lerp(0.44, 0.5, rise), 1, glide),
    rx: 60 * (1 - sp),
    ry: -25 * (1 - sp),
    opacity: prog(f, t0, 4),
    sheen: prog(f, T.card - 2, 26, EASE),
    glow: prog(f, T.only + 2, 14) * (1 - prog(f, T.hotels + 22, 18)),
  };
}
export type CardPose = ReturnType<typeof cardPose>;

export function mayaPose(f: number, T: Times, card: CardPose) {
  const pA = prog(f, 4, 38, GATHER);
  const pB = prog(f, 100, 36);
  const pD = prog(f, T.sealed, 26);
  const s0 = SLOT(0);
  const bx = lerp(lerp(s0.x, 720, pA), 360, pB);
  const by = lerp(lerp(s0.y, 470, pA), 540, pB);
  return {
    bx,
    by,
    x: lerp(bx, card.x + DOCK.dx, pD),
    y: lerp(by, card.y + DOCK.dy, pD) - Math.sin(pD * Math.PI) * 30,
    size: lerp(lerp(lerp(52, 140, pA), 120, pB), 72, pD),
    dock: pD,
  };
}

export function cubePose(f: number, T: Times) {
  const t0 = T.issues + 3;
  const a = prog(f, T.an + 3, 30);
  const r = prog(f, t0 + 24, 36);
  const out = prog(f, T.hotels, 26);
  return {
    x: lerp(CUBE.x, 1330, r),
    y: lerp(CUBE.y + 24 * (1 - a), 616, r),
    s: (0.86 + 0.14 * a) * lerp(1, 0.78, r) * (1 - 0.1 * out),
    o: a * lerp(1, 0.55, r) * (1 - out),
    ry: 30 + f * 0.5 + lerp(-10, 10, prog(f, 100, 150, IN_OUT_STRONG)),
    pulse: Math.min(1, bump(f, T.near + 15, 14) + bump(f, T.near + 26, 14) + bump(f, t0, 18)),
  };
}

export function windowPose(f: number, T: Times, end: number) {
  const i = prog(f, T.so + 4, 28, EASE); // after the card has cleared the right half
  const o = prog(f, end - 36, 16, IN_OUT_STRONG);
  return {
    on: i > 0 && o < 1,
    x: 1416 + (1 - i) * 120 + o * 110,
    y: 470 + Math.sin(f / 44) * 2,
    z: -380 * (1 - i) - 380 * o,
    ry: 16 * (1 - i) + 16 * o,
    opacity: Math.min(1, i * 1.4) * (1 - o),
  };
}
