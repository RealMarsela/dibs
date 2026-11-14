import { SCENES } from "../../scene";
import { TAIL } from "../../timeline.generated";
import { V as VARIANT } from "./variant";
import { kf, lerp } from "../../lib/anim";
import { EASE, IN_OUT_STRONG, OUT_STRONG } from "../../tokens";

/* S03 clock. Every narrated moment comes from cue(); the scene end comes from SCENES (variant B is SHIFT frames longer). */
export const K = 1.35; // Leo's single-row card scale (BedRow is already film px)
export const WIN = { w: 1000, h: 820 };
/** The window hugs each PaySheet step (the slot stays WIN-sized and centred, so this only trims the crop vertically). */
export const FRONT_H = { passkey: 620, chain: 820, track: 700 };
export const BACK = VARIANT === "A" ? { w: 1000, h: 640 } : { w: 1100, h: 500 };
/** Row 03 of H3's bed list, in stage coords (centre origin). The page renders border-box (measured), so the list box is
    860 wide and each row 842 (860 - padding 16 - border 2); row 03 sits at x 539..1381, y 372..456. */
export const ROW3 = { x: 0, y: -126, w: 842, h: 84 };
/** Where the "Pay $40" pill sits in Leo's card (stage coords) and its film size. */
export const PILL = { x: 470, y: 0, w: 146, h: 62 };
export const PULL = { x: -260, s: 0.86 };

type Cue = (line: string, word: string, nth?: number) => number;

export function timing(cue: Cue) {
  const c = (w: string, n = 0) => cue("L03", w, n);
  const D = SCENES.S03.to - SCENES.S03.from;
  const pays = c("pays");
  const gas = c("gas");
  const base = c("base");
  const near = c("near");
  const swaps = c("swaps");
  const three = c("three");
  const tail =
    VARIANT === "A"
      ? { start: cue(TAIL, "we"), mainnet: cue(TAIL, "mainnet"), words: [] as number[], grey: 0 }
      : {
          start: cue(TAIL, "on"),
          mainnet: cue(TAIL, "mainnet"),
          // "On testnet, a faucet stands in for the deposit." timed to "On testnet, a faucet stands in for that deposit"
          words: ["on", "testnet", "a", "faucet", "stands", "in", "for", "that", "deposit"].map((w) => cue(TAIL, w)),
          grey: cue(TAIL, "deposit") + 8,
        };
  return {
    D,
    lineOut: 2,
    morph0: 2,
    morph1: 22,
    press: pays + 4,
    win0: pays + 9,
    win1: pays + 33,
    passkey: c("passkey"),
    key: c("key"),
    wallet: c("wallet"),
    gas,
    pkPress: gas + 6,
    chain0: gas + 20,
    pan0: c("usdc") + 6,
    pan1: base + 8,
    base,
    pull0: base + 6,
    pull1: base + 30,
    chip0: near - 4,
    track0: swaps - 6,
    deposit: swaps + 2,
    swapped: swaps + 14,
    landed: three,
    dao: three + 10,
    lands: c("lands"),
    flip0: three + 16,
    flip1: three + 40,
    tail,
    shrink0: D - 32,
    shrink1: D - 4,
  };
}
export type T = ReturnType<typeof timing>;

export type Pose = { x: number; y: number; z: number; s: number; rx: number; ry: number; open: number; flip: number; shrink: number; w: number; h: number };

/** The pay window's pose in stage coords at local frame f. */
export function winPose(f: number, t: T): Pose {
  const open = kf(f, [t.win0, t.win1], [0, 1], OUT_STRONG);
  const pullIn = kf(f, [t.pull0, t.pull1], [0, 1], EASE);
  const pullOut = kf(f, [t.flip0 - 4, t.flip1], [0, 1], IN_OUT_STRONG);
  const pull = pullIn * (1 - pullOut);
  const flip = kf(f, [t.flip0, t.flip1], [0, 1], IN_OUT_STRONG);
  const shrink = kf(f, [t.shrink0, t.shrink1], [0, 1], IN_OUT_STRONG);
  const push = kf(f, [t.flip1, t.shrink0], [0, 1], EASE);
  const still = 1 - shrink;
  const drift = open * still;
  const x = lerp(PILL.x, 0, open) + PULL.x * pull + Math.sin(f / 52) * 6 * drift;
  // the face reaches row 03's height first, then finishes shrinking in place (nothing slides across the other rows)
  const shrinkY = kf(f, [t.shrink0, t.shrink0 + (t.shrink1 - t.shrink0) * 0.6], [0, 1], IN_OUT_STRONG);
  const y = lerp(Math.sin(f / 38) * 5 * drift, ROW3.y, shrinkY);
  const z = -150 * Math.sin(flip * Math.PI);
  const s = lerp(1, PULL.s, pull) * (1 + 0.04 * push * still);
  const rx = lerp(14, 0, kf(f, [t.win0, t.win0 + 30], [0, 1], EASE));
  const ry = flip * 180 + Math.sin(f / 70) * 1.6 * drift * (1 - Math.min(1, flip * 4)) * (1 - pull);
  const fh = kf(f, [t.chain0, t.chain0 + 10, t.track0, t.track0 + 10], [FRONT_H.passkey, FRONT_H.chain, FRONT_H.chain, FRONT_H.track], IN_OUT_STRONG);
  const w = lerp(lerp(WIN.w, BACK.w, flip), ROW3.w, shrink);
  const h = lerp(lerp(fh, BACK.h, flip), ROW3.h, shrink);
  return { x, y, z, s, rx, ry, open, flip, shrink, w, h };
}
