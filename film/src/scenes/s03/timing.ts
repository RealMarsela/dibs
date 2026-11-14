import { SCENES } from "../../scene";
import { TAIL } from "../../timeline.generated";
import { V as VARIANT } from "./variant";
import { kf, lerp } from "../../lib/anim";
import { EASE, IN_OUT_STRONG, LIST_SCALE, OUT_STRONG } from "../../tokens";

/* S03 clock. Every narrated moment comes from cue(); the scene end comes from SCENES (variant B is SHIFT frames longer). */
export const K = 1.5; // Leo's single-row card scale (BedRow is already film px)
/** The pay-base slot box: 1150 wide (crop 450 CSS px -> x2.56), as tall as the 96 px margins allow. */
export const WIN = { w: 1150, h: 888 };
/** The window hugs each PaySheet step (the slot stays WIN-sized and centred, so this only trims the crop vertically). */
export const FRONT_H = { passkey: 670, chain: 859, track: 757, done: 869 }; // CSS 262 / 336 / 296 / 340 tall at x2.556
/** Variant B: the window's pose while the testnet chip sits under it (stage y, scale). */
export const TAIL_POSE = { y: -40, s: 0.9 };
export const BACK = VARIANT === "A" ? { w: 1040, h: 657 } : { w: 1200, h: 560 };
/** Row 03 of H3's bed list, in stage coords (centre origin). The page renders border-box (measured), so each row is 842 x 84
    at 1x (centre 126 px above the list centre); H3 scales the list by LIST_SCALE about the frame centre. */
export const ROW_1X = { w: 842, h: 84, y: -126 };
export const ROW3 = { x: 0, y: ROW_1X.y * LIST_SCALE, w: ROW_1X.w * LIST_SCALE, h: ROW_1X.h * LIST_SCALE };
/** Where the "Pay $40" pill sits in Leo's card (stage coords) and its film size. */
export const PILL = { x: 518, y: 0, w: 169, h: 69 };
export const PULL = { x: -200, s: 0.84 };

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
  /* A: the window turns over to the mainnet receipt; the yellow pill lands on "mainnet".
     B: no turn-over. The real payment keeps running ("You're in" lands just after "deposit") and a testnet chip
        sits under the window from "testnet" until the shrink. NEVER: a far-future frame for the unused variant's events. */
  const NEVER = 1e6;
  const tail =
    VARIANT === "A"
      ? { mainnet: cue(TAIL, "mainnet"), chipAt: NEVER, youIn: NEVER }
      : { mainnet: NEVER, chipAt: cue(TAIL, "testnet"), youIn: cue(TAIL, "deposit") + 8 };
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
    // A: the front never shows the testnet tracking steps (its labels are the testnet copy); the chain list holds
    // through the coin lift-out and the window turns over to the real mainnet deposit.
    track0: VARIANT === "A" ? NEVER : swaps - 6,
    deposit: swaps + 2,
    swapped: swaps + 14,
    landed: three,
    dao: VARIANT === "A" ? three + 10 : tail.youIn,
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
  const isA = VARIANT === "A";
  const flip = isA ? kf(f, [t.flip0, t.flip1], [0, 1], IN_OUT_STRONG) : 0;
  const tailP = isA ? 0 : pullOut; // B settles into TAIL_POSE as it returns from the lift-out
  const shrink = kf(f, [t.shrink0, t.shrink1], [0, 1], IN_OUT_STRONG);
  const push = kf(f, [t.flip1, t.shrink0], [0, 1], EASE);
  const still = 1 - shrink;
  const drift = open * still;
  const x = lerp(PILL.x, 0, open) + PULL.x * pull + Math.sin(f / 52) * 6 * drift;
  // the face reaches row 03's height first, then finishes shrinking in place (nothing slides across the other rows)
  const shrinkY = kf(f, [t.shrink0, t.shrink0 + (t.shrink1 - t.shrink0) * 0.6], [0, 1], IN_OUT_STRONG);
  const y = lerp(Math.sin(f / 38) * 4 * drift + TAIL_POSE.y * tailP, ROW3.y, shrinkY);
  const z = -150 * Math.sin(flip * Math.PI);
  const s = lerp(1, PULL.s, pull) * (isA ? 1 + 0.04 * push * still : lerp(1, TAIL_POSE.s, tailP * still));
  const rx = lerp(14, 0, kf(f, [t.win0, t.win0 + 30], [0, 1], EASE));
  const ry = flip * 180 + Math.sin(f / 70) * 1.6 * drift * (1 - Math.min(1, flip * 4)) * (1 - pull);
  const fh = kf(
    f,
    [t.chain0, t.chain0 + 10, t.track0, t.track0 + 10, t.tail.youIn, t.tail.youIn + 10],
    [FRONT_H.passkey, FRONT_H.chain, FRONT_H.chain, FRONT_H.track, FRONT_H.track, FRONT_H.done],
    IN_OUT_STRONG,
  );
  const w = lerp(lerp(WIN.w, BACK.w, flip), ROW3.w, shrink);
  const h = lerp(lerp(fh, BACK.h, flip), ROW3.h, shrink);
  return { x, y, z, s, rx, ry, open, flip, shrink, w, h };
}
