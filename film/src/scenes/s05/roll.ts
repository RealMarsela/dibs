import { BEDS, DRAWN } from "../../components/Trip";
import { prog } from "../../lib/anim";
import { EASE, OUT_STRONG } from "../../tokens";

/* The draw's rolling clock, ported from draw-sheet.tsx: the offline app re-renders every 70 + tick*12 ms and stops
   after tick 14 (15 changes). T(k) = film frames from tick 0 to tick k at 30 fps.
   Each row runs that schedule stretched so its LAST tick lands exactly on its lock frame, and the names are
   phased so that last tick shows the row's drawn bed: a reel decelerating onto its result. */
export const TICKS = 15;
export const T = (k: number) => ((70 * k + 6 * k * (k - 1)) * 30) / 1000;

export type ReelNow = {
  /** ticks shown so far (0 = first bed name, TICKS = the drawn bed) */
  k: number;
  /** 0 → 1 slide of the current name into the slot */
  e: number;
  cur: string;
  /** name sliding out (null on tick 0: the row's original sub-line slides out instead) */
  prev: string | null;
  /** 1 at full speed, 0 at the stop (drives the motion blur) */
  speed: number;
};

const bedAt = (n: number, k: number) => {
  const d = BEDS.indexOf(DRAWN[n] as (typeof BEDS)[number]);
  return BEDS[(((d - (TICKS - k)) % BEDS.length) + BEDS.length) % BEDS.length];
};

/** Tick frames for one row (local frames, ascending, length TICKS + 1; the last one equals `lock`). */
export function rowTicks(start: number, lock: number): number[] {
  const st = (lock - start) / T(TICKS);
  return Array.from({ length: TICKS + 1 }, (_, k) => start + T(k) * st);
}

export function reel(f: number, start: number, lock: number, n: number): ReelNow | null {
  if (f < start) return null;
  const at = rowTicks(start, lock);
  let k = 0;
  while (k < TICKS && at[k + 1] <= f + 1e-6) k++;
  const landing = k === TICKS;
  const gap = landing ? 6 : at[k + 1] - at[k];
  const e = prog(f, at[k], landing ? 6 : Math.min(4, gap), landing ? OUT_STRONG : EASE);
  return { k, e, cur: bedAt(n, k), prev: k === 0 ? null : bedAt(n, k - 1), speed: 1 - k / TICKS };
}
