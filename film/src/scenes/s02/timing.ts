import { Easing } from "remotion";
import { kf } from "../../lib/anim";
import type { Cam } from "../../components/Stage";

/* S02 clock. Every narrated moment is tied to an L02 word cue (local frames). Per-item staggers are noted. */
type CueFn = (line: string, word: string, nth?: number) => number;

export function times(cue: CueFn, dur: number) {
  const c = (w: string, n = 0) => cue("L02", w, n);
  const near = c("near");
  return {
    end: dur - 1,
    crowdIn: 2,
    mark: c("dibs"),
    markOut: c("where") - 6,
    head: [c("the") + 2, c("trip"), c("itself"), c("is"), c("a"), c("contract"), c("on"), near],
    push0: c("trip"),
    push1: near + 9,
    crowdOut: near + 2,
    headOut: near + 20,
    mayaGo: near + 20,
    crew: near + 26, // + 3k, k = 1..7
    rowSettle: near + 44,
    lisbon: c("every") + 3,
    tiles: c("own") - 4, // + 3i
    keys: c("no") - 4, // + 2i
    strike: c("keys") - 2, // + 3i
    headingOut: c("and") - 5,
    facesOut: c("and") + 1, // + 2i
    squeeze: c("nobody") - 2,
    squeezeEnd: c("nobody") + 26, // tiles already sit on the meter line: a shorter collapse
    fill: c("until") + 1, // + 2i, bed 03 (held) takes its slot as hatch
    line1: c("until") + 3, // + 3j
    ring: c("is", 1) + 6,
    line2: c("bed", 1) + 3, // + 2.5j
  };
}
export type Times = ReturnType<typeof times>;

const SINE = Easing.inOut(Easing.sin);
const SETTLE = Easing.bezier(0.45, 0, 0.25, 1);
const LIN = (t: number) => t;

/** Camera: slow push on the headline, pull back to reveal the row, truck along it (ry 6 -> -6, pan with the near side
    so the bigger row keeps the safe margin), return to neutral while the tiles become the meter with a small push,
    then a slow settle that lands on exact identity on the last frame. */
export function camAt(f: number, T: Times): Required<Pick<Cam, "s" | "ry" | "x">> {
  const s = kf(f, [0, T.push0, T.push1, T.rowSettle, T.squeeze, T.squeezeEnd, T.end], [1, 1, 1.04, 1, 1, 1.02, 1], [LIN, SINE, SINE, LIN, SINE, SETTLE]);
  const ry = kf(f, [T.push1, T.rowSettle, T.squeeze - 2, T.squeezeEnd], [0, 6, -6, 0], SINE);
  const x = kf(f, [T.push1, T.rowSettle, T.squeeze - 2, T.squeezeEnd], [0, -16, 16, 0], SINE);
  return { s, ry, x };
}
