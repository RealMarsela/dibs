import { Easing, spring } from "remotion";
import { CARD_W, EASE, IN_OUT_STRONG, LIST_SCALE, OUT_STRONG, SPRING } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { ROW_H } from "../../components/Trip";

/* S06 choreography as plain functions of the local frame. Every narrated beat comes from cue() via times(). */
type CueFn = (line: string, word: string, nth?: number) => number;

export function times(cue: CueFn) {
  const c = (w: string, n = 0) => cue("L06", w, n);
  return {
    books: c("books"), not: c("not"), with: c("with"), her: c("her"), own: c("own"), money: c("money"),
    an: c("an"), outlayer: c("OutLayer"), called: c("called"), near: c("NEAR"), issues: c("issues"),
    card: c("card"), forNow: c("for"), sealed: c("sealed"), mayas: c("Maya's"), passkey: c("passkey"), only: c("only"), hotels: c("hotels"),
    so: c("so"), hotel: c("hotel"), through: c("through"), electronics: c("electronics"), declined: c("declined"),
    card2: c("card", 1), lithics: c("Lithic's"), sandbox: c("sandbox"),
  };
}
export type Times = ReturnType<typeof times>;

/** Face centres of the H5 list rows. H5 is BedList scaled LIST_SCALE (1.25) about the frame centre; unscaled, row 1's face
    was measured at (585, 246) with rows 84 px apart, so scaled: x = 960 + (585 - 960) * 1.25, y = 540 + (246 + 84 i - 540) * 1.25. */
export const SLOT = (i: number) => ({ x: 960 + (585 - 960) * LIST_SCALE, y: 540 + (246 + ROW_H * i - 540) * LIST_SCALE });
export const SLOT_SIZE = 52 * LIST_SCALE;

/** Faces leave the list slowly at first so they never cross row text that is still readable. */
export const GATHER = Easing.bezier(0.5, 0, 0.2, 1);

export const CUBE = { x: 1310, y: 580, size: 380 };
const HERO = { x: 960, y: 460, w: 900 };
const SIDE = { x: 532, y: 470, w: 760 };
const HOME = { x: 960, y: 540, w: CARD_W };

/** Triangle bump 0 → 1 → 0 over `dur` frames starting at f0. */
export function bump(f: number, f0: number, dur: number): number {
  const t = (f - f0) / dur;
  return t <= 0 || t >= 1 ? 0 : 1 - Math.abs(t * 2 - 1);
}

/** The card rises out of the cube's mouth (clipped at its middle line until clear), glides to HERO growing (the push),
    slides to SIDE beside the footage window, then lands on HOME = H6. Sizes are the card's width in film px. */
export function cardPose(f: number, T: Times, end: number) {
  const t0 = T.issues + 3;
  const rise = prog(f, t0, 22, OUT_STRONG);
  const glide = prog(f, t0 + 22, 36, EASE);
  const sp = f < t0 ? 0 : spring({ frame: f - t0, fps: 30, config: SPRING, durationInFrames: 40 });
  const side = prog(f, T.so - 6, 28, EASE);
  const home = prog(f, end - 26, 24, EASE);
  const env = prog(f, t0 + 50, 30) * (1 - prog(f, end - 44, 12));
  const x = lerp(CUBE.x, HERO.x, glide) + (SIDE.x - HERO.x) * side + (HOME.x - SIDE.x) * home;
  const y = lerp(lerp(CUBE.y - 90, 280, rise), HERO.y, glide) + (SIDE.y - HERO.y) * side + (HOME.y - SIDE.y) * home + Math.sin(f / 36) * 3 * env;
  const w = lerp(lerp(300, 320, rise), HERO.w, glide) + (SIDE.w - HERO.w) * side + (HOME.w - SIDE.w) * home;
  return {
    on: f >= t0,
    clip: f < t0 + 22,
    clipY: CUBE.y - CUBE.size / 2,
    x,
    y,
    w,
    h: w / 1.586,
    rx: 60 * (1 - sp),
    ry: -25 * (1 - sp),
    opacity: prog(f, t0, 4),
    sheen: prog(f, T.card - 2, 26, EASE),
    glow: prog(f, T.only + 2, 14) * (1 - prog(f, T.hotels + 22, 18)),
  };
}
export type CardPose = ReturnType<typeof cardPose>;

/** Where Maya's face docks: just outside the card's bottom-left corner, sized to the card. */
export const dockOf = (c: CardPose) => ({ x: c.x - c.w / 2 - 0.009 * c.w, y: c.y + c.h / 2 + 0.02 * c.w, size: 0.098 * c.w });

export function mayaPose(f: number, T: Times, card: CardPose) {
  const pA = prog(f, 4, 38, GATHER);
  const pB = prog(f, 100, 36);
  const pD = prog(f, T.sealed, 26);
  const s0 = SLOT(0);
  const bx = lerp(lerp(s0.x, 700, pA), 330, pB);
  const by = lerp(lerp(s0.y, 450, pA), 580, pB);
  const d = dockOf(card);
  return {
    bx,
    by,
    x: lerp(bx, d.x, pD),
    y: lerp(by, d.y, pD) - Math.sin(pD * Math.PI) * 30,
    size: lerp(lerp(lerp(SLOT_SIZE, 180, pA), 150, pB), d.size, pD),
    dock: pD,
  };
}

export function cubePose(f: number, T: Times) {
  const t0 = T.issues + 3;
  const a = prog(f, T.an + 3, 30);
  const r = prog(f, t0 + 26, 36);
  const out = prog(f, T.hotels, 26);
  return {
    x: lerp(CUBE.x, 1450, r),
    y: lerp(CUBE.y + 28 * (1 - a), 660, r),
    s: (0.86 + 0.14 * a) * lerp(1, 0.8, r) * (1 - 0.1 * out),
    o: a * lerp(1, 0.55, r) * (1 - out),
    ry: 30 + f * 0.5 + lerp(-10, 10, prog(f, 100, 150, IN_OUT_STRONG)),
    pulse: Math.min(1, bump(f, T.near + 15, 14) + bump(f, T.near + 26, 14) + bump(f, t0, 18)),
  };
}

export const WIN = { w: 860, x: 1394, y: 470 };
export function windowPose(f: number, T: Times, end: number) {
  const i = prog(f, T.so + 4, 28, EASE); // after the card has cleared the right half
  const o = prog(f, end - 44, 16, IN_OUT_STRONG); // gone before the card grows back toward H6
  return {
    on: i > 0 && o < 1,
    x: WIN.x + (1 - i) * 120 + o * 110,
    y: WIN.y + Math.sin(f / 44) * 2,
    z: -380 * (1 - i) - 380 * o,
    ry: 16 * (1 - i) + 16 * o,
    opacity: Math.min(1, i * 1.4) * (1 - o),
  };
}
